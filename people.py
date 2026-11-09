"""Who is the prospect? Pure functions, no network and no AI, so every rule here can be tested.

The AI reads the pages and returns a messy list of people and facts. This file cleans that list up
and decides which person we are writing to. Anything odd from the AI is repaired or dropped here,
so it can never crash the run or put the wrong person's facts into an email.
"""
import re


def _text(v):
    return " ".join(str(v).split()) if isinstance(v, (str, int, float)) else ""


def norm(s):
    return " ".join(re.sub(r"[^a-z0-9$%. ]", "", _text(s).lower()).split())


def norm_company(s):
    s = norm(s)
    for w in (" inc", " corp", " corporation", " ltd", " llc", " plc", " co", " company", " technologies", " the"):
        if s.endswith(w):
            s = s[: -len(w)]
    return s.strip()


def same_company(a, b):
    a, b = norm_company(a), norm_company(b)
    return bool(a and b) and (a in b or b in a)


def same_title(a, b):
    """Same job, or one of them has no title. Two different titles at one company are two different people."""
    a, b = norm(a), norm(b)
    return not a or not b or a in b or b in a


def clean_people(raw):
    """Keep only well-formed people. Strips 'former' from titles. Never raises."""
    out = []
    if not isinstance(raw, list):
        return out
    for i, p in enumerate(raw):
        if not isinstance(p, dict):
            continue
        name = _text(p.get("name"))
        if not name:
            continue
        title = re.sub(r"\(?\bformer(ly)?\b\)?", "", _text(p.get("title")), flags=re.I).strip(" ,;()-")
        out.append({"name": name, "title": title or None, "current_company": _text(p.get("current_company")) or None,
                    "previous_company": _text(p.get("previous_company")) or None,
                    "country": _text(p.get("country")) or None, "_i": i})
    return out


def resolve(raw_people, company):
    """Returns (options, index_map, ignored).

    options    people we could be writing to, best match first, same person merged into one
    index_map  original position in the AI's list -> the option it became (used to filter facts)
    ignored    how many people at other companies were left out
    """
    people = clean_people(raw_people)
    merged, index_map = [], {}
    for p in people:
        twin = next((m for m in merged if m["name"].lower() == p["name"].lower()
                     and same_company(m["current_company"], p["current_company"])
                     and same_title(m["title"], p["title"])), None)
        if twin is None:
            merged.append(p)
            index_map[p["_i"]] = p
        else:
            index_map[p["_i"]] = twin
            twin["title"] = twin["title"] or p["title"]
            twin["country"] = twin["country"] or p["country"]
    for p in merged:
        p["company_match"] = same_company(p["current_company"], company)
    merged.sort(key=lambda p: not p["company_match"])          # stable: ties keep the AI's order
    ignored = 0
    if any(p["company_match"] for p in merged):
        ignored = sum(1 for p in merged if not p["company_match"])
        merged = [p for p in merged if p["company_match"]]
    return merged, index_map, ignored


def choose(options, pick):
    """The person to write to, or None if we still have to ask. A bad pick number counts as no pick."""
    if not options:
        return None
    if len(options) == 1:
        return options[0]
    if isinstance(pick, int) and 0 <= pick < len(options):
        return options[pick]
    return None


def split_facts(facts, index_map, person):
    """(mine, others). A fact tagged with another person's number is not about our person."""
    if len({id(v) for v in index_map.values()}) < 2:
        return list(facts), []
    mine, others = [], []
    for f in facts:
        try:
            who = index_map.get(int(f.get("person"))) if f.get("person") is not None else None
        except (ValueError, TypeError):
            who = None
        (others if who is not None and who is not person else mine).append(f)
    return mine, others


def clean_facts(raw):
    """Keep only facts that are dicts. The verifier does the real checking."""
    return [f for f in raw if isinstance(f, dict)] if isinstance(raw, list) else []
