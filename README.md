# Outreach Drafter (PS-3)

A rep names a prospect. The process researches them, verifies every fact against its source page,
picks one real hook, writes a short email for Zamp's sales team, checks it, and waits for a human
to approve. It learns from rejections through a plain-English rulebook.

- **How it works, step by step:** see `PROCESS_MAP.md`.
- **The rules it follows:** `rulebook.yaml` (also editable in the app, with version history).

## Run it

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env
uvicorn app:app --reload          # open http://localhost:8000
```
With no keys it runs in **mock mode** on invented people (the header says so).
For live mode add `TAVILY_API_KEY` and `ANTHROPIC_API_KEY` to `.env`, set `MOCK=0`, restart.

Test set from the terminal: `python evaluate.py` (or the button on the Dashboard tab).

## The three tabs

| Tab | What it's for |
|---|---|
| **Run** | Type a prospect or click a prepared case. Watch the 10 steps live. Review the draft: approve, edit, or reject with a reason. |
| **Dashboard** | Ready %, sent-to-human %, approval %, cost and time per run, approval per rulebook version, run history, test set. |
| **Rulebook** | Edit the rules in plain English, accept or dismiss learned changes, see every version. |

## Files

| File | What it does |
|---|---|
| `pipeline.py` | The 10 steps. `plan()` is the pure decision function (fit, filter, score, angle). |
| `research.py` | Search, LLM calls, cache, retry, cost meter, the two prompts. |
| `rules.py` | Load, check and version the rulebook. |
| `learning.py` | Turns a rejection reason into a rulebook change and replays it on past prospects. |
| `evaluate.py` + `golden.json` | The test set (13 cases). |
| `app.py` | Web server and API. |
| `db.py` | SQLite: runs, reviews, rulebook versions, proposals. |
| `mock_data.py` | Invented pages and extractions for mock mode. |
| `static/index.html` | The page. |

## Demo script (5 minutes)
1. **Happy path:** Priya Raman. Point at the dropped invented fact in step 3, the scores in step 7, the [1][2] sources.
2. **Edge case:** Kevin Park. Not a buyer, so click "Research Lena Fischer instead".
3. **Edge case:** Tom Reyes. Sources disagree on $40M vs $45M, so funding is not used.
4. **Learning:** reject Priya's draft with "wrong kind of news". Show the replay table, accept, rerun Priya with the new hook.
5. **Dashboard:** run the test set. After the change it shows 12/13: the test set caught that the happy path changed.

Extra edge cases to show if there's time: **Grace Lin** (a page hides instructions to the AI and is
removed), **Ravi Kumar** (the writer adds "12-person AP team", the number check catches it),
**Claire Dubois** (based in Canada, stopped by the compliance rules).

