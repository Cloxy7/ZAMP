"""Test set: runs every prospect in golden.json and checks the outcome.
Run from the terminal:  python evaluate.py     (or press "Run test set" on the dashboard)

In mock mode it tests the logic with the invented people. For live mode, write your own
golden file of 5-8 real, hand-checked prospects and set GOLDEN_FILE=golden_live.json."""
import json, os, pathlib
import mock_data, pipeline

GOLDEN = pathlib.Path(os.getenv("GOLDEN_FILE", pathlib.Path(__file__).with_name("golden.json")))


def run_case(case):
    result = None
    for event in pipeline.run(case["name"], case["company"], "Test", case.get("pick"), check_history=False):
        if "result" in event:
            result = event["result"]
    problems = []
    if result["status"] != case["expect_status"]:
        problems.append(f"status was '{result['status']}', expected '{case['expect_status']}'")
    if "expect_hook" in case:
        got = result["hook"]["topic"] if result.get("hook") else None
        if got != case["expect_hook"]:
            problems.append(f"hook was '{got}', expected '{case['expect_hook']}'")
    body = (result.get("subject") or "") + " " + (result.get("body") or "")
    for word in case.get("must_not_contain", []):
        if word.lower() in body.lower():
            problems.append(f"draft contains '{word}'")
    return {"case": case.get("case", case["name"]), "name": case["name"], "company": case["company"],
            "status": result["status"], "hook": result["hook"]["topic"] if result.get("hook") else None,
            "passed": not problems, "problems": problems}


def run_all():
    old = mock_data.DELAY
    mock_data.DELAY = 0      # no fake waiting during tests
    try:
        rows = [run_case(c) for c in json.loads(GOLDEN.read_text())]
    finally:
        mock_data.DELAY = old
    return {"passed": sum(r["passed"] for r in rows), "total": len(rows), "rows": rows}


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    out = run_all()
    for r in out["rows"]:
        print(f"{'PASS' if r['passed'] else 'FAIL'}  {r['case']:<28} {r['status']:<18} {r['hook'] or '-':<12} {'; '.join(r['problems'])}")
    print(f"\n{out['passed']}/{out['total']} passed")
