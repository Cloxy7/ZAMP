"""The rulebook (Agent Operating Procedure): load, check, save as a new version."""
import pathlib, time
import yaml
from db import q

DEFAULT = pathlib.Path(__file__).with_name("rulebook.yaml")
PRIORITY = {"high": 1.0, "medium": 0.7, "low": 0.4}
REQUIRED = ["what_we_sell", "buyer_titles", "topics", "never_mention", "angles", "limits", "writing_rules"]


def _seed():
    if not q("SELECT 1 FROM rulebook_versions LIMIT 1").fetchone():
        q("INSERT INTO rulebook_versions VALUES (1, ?, ?, ?)", (time.time(), DEFAULT.read_text(), "Starting rulebook"))


def current():
    """Returns (version, rulebook dict, yaml text)."""
    _seed()
    r = q("SELECT version, yaml FROM rulebook_versions ORDER BY version DESC LIMIT 1").fetchone()
    return r["version"], yaml.safe_load(r["yaml"]), r["yaml"]


def validate(text):
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        raise ValueError(f"The rulebook is not valid YAML: {e}")
    if not isinstance(data, dict):
        raise ValueError("The rulebook must be a set of named sections.")
    missing = [k for k in REQUIRED if k not in data]
    if missing:
        raise ValueError("Missing section(s): " + ", ".join(missing))
    for name, t in (data.get("topics") or {}).items():
        if not isinstance(t, dict) or t.get("priority") not in PRIORITY:
            raise ValueError(f"Topic '{name}' needs a priority of high, medium or low.")
    for k in ("strong_hook", "minimum_hook", "max_age_days", "unknown_date_days", "max_words"):
        if not isinstance(data["limits"].get(k), (int, float)):
            raise ValueError(f"limits.{k} must be a number.")
    return data


def dump(data):
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110)


def save(text, note):
    validate(text)
    version = current()[0] + 1
    q("INSERT INTO rulebook_versions VALUES (?, ?, ?, ?)", (version, time.time(), text, note))
    return version


def versions():
    return [dict(r) for r in q("SELECT version, ts, note FROM rulebook_versions ORDER BY version DESC")]
