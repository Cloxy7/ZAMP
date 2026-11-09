"""Learning from the rep's corrections, safely.

A rejection reason becomes a proposed rulebook change. Before anyone accepts it, the change is
replayed on every past prospect so you can see exactly which outcomes would change."""
import copy, json, time

import pipeline, rules
from db import q

REASONS = {
    "wrong_hook": "The hook was the wrong kind of news",
    "never_mention": "It mentioned something we should never mention",
    "not_buyer": "This person is not a buyer",
    "writing": "The writing style was off",
}
LEVELS = ["high", "medium", "low"]


def propose(run_row, reason, detail=""):
    result = json.loads(run_row["result"])
    version, rb, _ = rules.current()
    new = copy.deepcopy(rb)
    detail = (detail or "").strip()

    if reason == "wrong_hook":
        hook = result.get("hook")
        if not hook or hook["topic"] not in new["topics"]:
            raise ValueError("This draft has no hook to learn from.")
        topic, cur = hook["topic"], new["topics"][hook["topic"]]["priority"]
        nxt = LEVELS[min(LEVELS.index(cur) + 1, len(LEVELS) - 1)]
        if nxt == cur:
            raise ValueError(f"'{topic}' news is already at the lowest priority.")
        new["topics"][topic]["priority"] = nxt
        note = f"Lower '{topic}' news from {cur} to {nxt} priority"
    elif reason == "never_mention":
        if not detail:
            raise ValueError("Type the word or topic that should never be mentioned.")
        if detail.lower() in [w.lower() for w in new["never_mention"]]:
            raise ValueError(f"'{detail}' is already on the never-mention list.")
        new["never_mention"].append(detail.lower())
        note = f"Never mention '{detail.lower()}'"
    elif reason == "not_buyer":
        word = (detail or (result.get("person") or {}).get("title", "")).strip().lower()
        if not word:
            raise ValueError("Type the job-title word that means 'not a buyer'.")
        new.setdefault("not_buyer_titles", []).append(word)
        new["buyer_titles"] = [t for t in new["buyer_titles"] if t != word]
        note = f"Treat '{word}' titles as not a buyer"
    elif reason == "writing":
        if not detail:
            raise ValueError("Type the writing rule you want added, as one sentence.")
        new["writing_rules"].append(detail)
        note = f"Writing rule: {detail}"
    else:
        raise ValueError("Unknown reason.")

    replay = replay_all(rb, new)
    if reason == "writing":
        replay["note"] = "Writing rules change future drafts only; past decisions are not affected."
    text = rules.dump(new)
    cur = q("INSERT INTO proposals (ts, run_id, note, yaml, replay) VALUES (?, ?, ?, ?, ?)",
            (time.time(), run_row["id"], note, text, json.dumps(replay)))
    return {"id": cur.lastrowid, "note": note, "replay": replay, "from_version": version}


def _summary(p):
    return {"status": p["status"], "hook": p["hook"]["topic"] if p.get("hook") else None}


def replay_all(old, new):
    """Re-decide every past prospect (latest run each) with the old and new rulebook."""
    seen, changed, checked = set(), [], 0
    for r in q("SELECT id, name, company, result FROM runs ORDER BY id DESC").fetchall():
        key = (r["name"].lower(), r["company"].lower())
        if key in seen:
            continue
        seen.add(key)
        res = json.loads(r["result"])
        if not res.get("person") or "facts" not in res:
            continue   # stopped before a decision was made, nothing to replay
        checked += 1
        before = _summary(pipeline.plan(res["facts"], res["person"], r["company"], old))
        after = _summary(pipeline.plan(res["facts"], res["person"], r["company"], new))
        if before != after:
            changed.append({"run_id": r["id"], "name": r["name"], "company": r["company"], "before": before, "after": after})
    return {"checked": checked, "changed": changed}


def accept(pid):
    p = q("SELECT * FROM proposals WHERE id = ?", (pid,)).fetchone()
    if not p or p["state"] != "open":
        raise ValueError("This proposal is no longer open.")
    version = rules.save(p["yaml"], f"Learned: {p['note']}")
    q("UPDATE proposals SET state = 'accepted' WHERE id = ?", (pid,))
    return version


def dismiss(pid):
    q("UPDATE proposals SET state = 'dismissed' WHERE id = ?", (pid,))


def open_proposals():
    return [{**dict(r), "replay": json.loads(r["replay"])}
            for r in q("SELECT id, ts, run_id, note, replay FROM proposals WHERE state = 'open' ORDER BY id DESC")]
