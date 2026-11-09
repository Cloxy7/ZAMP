"""SQLite storage: runs (history + reviews), rulebook versions, learning proposals."""
import os, sqlite3, threading

conn = sqlite3.connect(os.getenv("DB_PATH", "runs.db"), check_same_thread=False)
conn.row_factory = sqlite3.Row
_lock = threading.Lock()

conn.executescript("""
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY, ts REAL, name TEXT, company TEXT, status TEXT,
  review TEXT DEFAULT 'pending', review_note TEXT, rulebook_version INTEGER,
  cost REAL, duration REAL, result TEXT);
CREATE TABLE IF NOT EXISTS rulebook_versions (
  version INTEGER PRIMARY KEY, ts REAL, yaml TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY, ts REAL, run_id INTEGER, note TEXT, yaml TEXT,
  replay TEXT, state TEXT DEFAULT 'open');
""")


def recent_runs(days):
    import json, time
    rows = q("SELECT id, ts, name, company, review, result FROM runs WHERE ts > ?", (time.time() - days * 86400,)).fetchall()
    return [{**dict(r), "result": json.loads(r["result"])} for r in rows]


def q(sql, args=()):
    with _lock:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur
