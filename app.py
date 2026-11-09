"""Web server. Run:  uvicorn app:app --reload   then open http://localhost:8000"""
import json, time
from dotenv import load_dotenv
load_dotenv()   # must happen before the modules below read their settings

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import evaluate, learning, pipeline, research, rules
from db import q

app = FastAPI(title="Outreach Drafter")


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/mode")
def mode():
    version = rules.current()[0]
    return {"mock": research.MOCK, "stages": pipeline.STAGES, "rulebook_version": version, "reasons": learning.REASONS}


@app.get("/run")
def run(name: str, company: str, rep: str = "Rep", pick: int | None = None):
    def stream():
        for event in pipeline.run(name, company, rep, pick):
            if "result" in event:
                r = event["result"]
                if pick is not None:   # the "Which one did you mean?" stop is replaced by the run you picked
                    q("DELETE FROM runs WHERE name = ? AND company = ? AND review = 'pending' AND result LIKE '%\"choices\"%'",
                      (r["name"], r["company"]))
                cur = q("INSERT INTO runs (ts, name, company, status, rulebook_version, cost, duration, result) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (time.time(), r["name"], r["company"], r["status"], r["rulebook_version"],
                         r["cost"]["usd"], r["duration"], json.dumps(r)))
                r["run_id"] = cur.lastrowid
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")


def _row(r):
    return {"id": r["id"], "ts": r["ts"], "name": r["name"], "company": r["company"], "status": r["status"],
            "review": r["review"], "review_note": r["review_note"], "version": r["rulebook_version"],
            "cost": r["cost"], "duration": r["duration"], "result": {**json.loads(r["result"]), "run_id": r["id"],
                                                                      "review": r["review"]}}


@app.get("/runs")
def runs():
    return [_row(r) for r in q("SELECT * FROM runs ORDER BY id DESC LIMIT 100")]


class Review(BaseModel):
    action: str                 # approved | edited | rejected
    body: str | None = None     # the edited text
    reason: str | None = None   # a key of learning.REASONS, to teach the rulebook
    detail: str | None = None


@app.post("/runs/{run_id}/review")
def review(run_id: int, rv: Review):
    row = q("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Run not found.")
    if rv.action not in ("approved", "edited", "rejected"):
        raise HTTPException(400, "Action must be approved, edited or rejected.")
    result = json.loads(row["result"])
    if rv.action == "edited":
        if not rv.body or not rv.body.strip():
            raise HTTPException(400, "The edited email is empty.")
        result["original_body"] = result.get("original_body") or result.get("body")
        result["body"] = rv.body
    note = learning.REASONS.get(rv.reason, "") + (f": {rv.detail}" if rv.detail else "") if rv.reason else None
    q("UPDATE runs SET review = ?, review_note = ?, result = ? WHERE id = ?", (rv.action, note, json.dumps(result), run_id))
    proposal = None
    if rv.reason:
        try:
            proposal = learning.propose(q("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone(), rv.reason, rv.detail)
        except ValueError as e:
            return {"ok": True, "proposal": None, "message": str(e)}
    return {"ok": True, "proposal": proposal}


@app.get("/proposals")
def proposals():
    return learning.open_proposals()


@app.post("/proposals/{pid}/accept")
def accept(pid: int):
    try:
        return {"version": learning.accept(pid)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/proposals/{pid}/dismiss")
def dismiss(pid: int):
    learning.dismiss(pid)
    return {"ok": True}


@app.get("/rulebook")
def get_rulebook():
    version, _, text = rules.current()
    return {"version": version, "yaml": text, "versions": rules.versions()}


class RulebookEdit(BaseModel):
    yaml: str
    note: str | None = None


@app.put("/rulebook")
def put_rulebook(edit: RulebookEdit):
    try:
        version = rules.save(edit.yaml, edit.note or "Edited by hand")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"version": version}


@app.get("/metrics")
def metrics():
    rows = [_row(r) for r in q("SELECT * FROM runs")]
    n = len(rows)

    def pct(a, b):
        return round(100 * a / b) if b else None

    reviewed = [r for r in rows if r["review"] != "pending"]
    good = [r for r in reviewed if r["review"] in ("approved", "edited")]
    by_version = {}
    for r in rows:
        v = by_version.setdefault(r["version"], {"version": r["version"], "runs": 0, "reviewed": 0, "approved": 0, "approved_unedited": 0})
        v["runs"] += 1
        if r["review"] != "pending":
            v["reviewed"] += 1
        if r["review"] in ("approved", "edited"):
            v["approved"] += 1
        if r["review"] == "approved":
            v["approved_unedited"] += 1
    for v in by_version.values():
        v["approval_rate"] = pct(v["approved"], v["reviewed"])
    return {
        "runs": n,
        "ready_pct": pct(sum(r["status"] == pipeline.READY for r in rows), n),
        "human_pct": pct(sum(r["status"] in (pipeline.FLAGS, pipeline.ATTN, pipeline.NOT_BUYER) for r in rows), n),
        "stopped_pct": pct(sum(r["status"] == pipeline.STOPPED for r in rows), n),
        "approval_pct": pct(len(good), len(reviewed)),
        "reviewed": len(reviewed),
        "avg_cost": round(sum(r["cost"] or 0 for r in rows) / n, 4) if n else None,
        "avg_seconds": round(sum(r["duration"] or 0 for r in rows) / n, 1) if n else None,
        "by_version": sorted(by_version.values(), key=lambda v: v["version"]),
    }


@app.post("/eval")
def run_eval():
    return evaluate.run_all()


@app.post("/reset")
def reset():
    """Clears history, learned changes and rulebook versions, then reloads rulebook.yaml."""
    q("DELETE FROM runs")
    q("DELETE FROM proposals")
    q("DELETE FROM rulebook_versions")
    rules.current()   # re-seeds version 1 from rulebook.yaml
    return {"ok": True}
