"""
The 10-step outreach process. run() yields an event per step so the page can show progress live.

Design rule: the LLM only READS (pulls facts from pages) and WRITES (the draft).
Every DECISION is plain code that follows the rulebook, so it can be explained and replayed.
"""
import re, time
from datetime import date, datetime

import mock_data, research, rules

STAGES = [
    ("Check input", "Valid request, not on the do-not-contact list"),
    ("Research", "Four searches in parallel: person, news, hiring, funding"),
    ("Extract & verify", "LLM pulls facts; code checks each one is really on its page"),
    ("Identify person", "Exactly one match? Still at this company?"),
    ("Check fit", "Is this person a buyer for what we sell?"),
    ("Filter signals", "Drop sensitive, old, conflicting or off-target facts"),
    ("Score & angle", "Pick the hook, a support fact, and the angle for this role"),
    ("Write draft", "Hook, link to our offer, one clear ask"),
    ("Quality check", "Length, sources, banned words, right name"),
    ("Your review", "Approve, edit or reject"),
]

READY, FLAGS, ATTN, NOT_BUYER, STOPPED = "Ready for review", "Review with flags", "Needs attention", "Not a buyer", "Stopped"
SENSITIVE_TOPICS = {"layoff", "lawsuit", "health", "scandal"}

# Text that tries to give orders to an AI. Pages containing it are removed before the LLM reads them.
INJECTION = re.compile(
    r"ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|prompts)"
    r"|disregard (all |any |your )?(previous |prior )?(instructions|rules)"
    r"|(new|updated|system) instructions?:"
    r"|you are (now )?(an? )?(ai|assistant|language model|llm|chatbot)\b"
    r"|as an ai (assistant|model)|system prompt|do not (tell|reveal to) the (user|reader)", re.I)


def injection_pages(pages):
    clean, blocked = [], []
    for p in pages:
        text = f"{p.get('title') or ''} {p.get('content') or ''}"
        (blocked if INJECTION.search(text) else clean).append(p)
    return clean, blocked


# ---- small helpers ---------------------------------------------------------
def norm_company(s):
    s = re.sub(r"[.,]", " ", (s or "").lower())
    s = re.sub(r"\b(inc|ltd|llc|corp|co|plc|gmbh|pvt|limited|the)\b", " ", s)
    return " ".join(s.split())


def same_company(a, b):
    a, b = norm_company(a), norm_company(b)
    return bool(a and b) and (a in b or b in a)


def norm_text(s):
    return " ".join(re.sub(r"[^a-z0-9$%. ]", " ", (s or "").lower()).split())


_NUM = re.compile(r"\$?\d[\d,]*(?:\.\d+)?\s?(?:million|billion|m|b|k|%)?\b", re.I)


def numbers(s):
    out = set()
    for m in _NUM.finditer(s or ""):
        n = re.sub(r"[\s,$]", "", m.group(0).lower()).replace("million", "m").replace("billion", "b")
        out.add(n)
    return out


def days_ago(d, unknown_days):
    try:
        return max(0, (date.today() - datetime.fromisoformat(str(d)[:10]).date()).days), False
    except Exception:
        return unknown_days, True


def reliability(url):
    u = url.lower()
    if any(k in u for k in ("/careers", "/jobs", "/press", "/newsroom", "prnewswire", "businesswire")):
        return 0.95
    if any(k in u for k in ("reuters", "bloomberg", "techcrunch", "economictimes", "forbes", "wsj")):
        return 0.9
    if any(k in u for k in ("podcast", "youtube", "medium.com", "substack")):
        return 0.75
    if "linkedin.com" in u:
        return 0.6   # search snippets of profiles go stale
    return 0.7


# ---- step 3: verify facts against the pages they came from -----------------
def verify(facts, pages, rb, blocked_urls=()):
    by_url = {p["url"]: p for p in pages}
    kept, dropped = [], []
    for f in facts:
        p = by_url.get(f.get("url"))
        if f.get("url") in blocked_urls:
            dropped.append({"fact": f.get("fact"), "reason": "its page had hidden instructions to the AI and was removed"})
            continue
        if not p:
            dropped.append({"fact": f.get("fact"), "reason": "its link was not in the search results"})
            continue
        page_text = (p.get("title") or "") + " " + (p.get("content") or "")
        if not f.get("evidence") or norm_text(f["evidence"]) not in norm_text(page_text):
            dropped.append({"fact": f.get("fact"), "reason": "its quote is not on the page"})
            continue
        missing = numbers(f.get("fact", "")) - numbers(page_text)
        if missing:
            dropped.append({"fact": f.get("fact"), "reason": f"number {', '.join(sorted(missing))} is not on the page"})
            continue
        days, unknown = days_ago(f.get("date") or p.get("published_date"), rb["limits"]["unknown_date_days"])
        kept.append({**f, "days": days, "date_unknown": unknown, "reliability": reliability(f["url"]), "conflict": False})

    # Two facts on the same topic with different numbers = sources disagree.
    conflicts = []
    for i, a in enumerate(kept):
        for b in kept[i + 1:]:
            na, nb = numbers(a["fact"]), numbers(b["fact"])
            if a["topic"] == b["topic"] and na and nb and na != nb:
                a["conflict"] = b["conflict"] = True
                conflicts.append(f"{a['fact']}  vs  {b['fact']}")
    return kept, dropped, conflicts


# ---- steps 5-7: the decision. Pure function, so it can be replayed ---------
def plan(facts, person, input_company, rb):
    lim = rb["limits"]
    title = (person.get("title") or "").lower()
    flags = []

    is_buyer = any(k in title for k in rb.get("buyer_titles", []))
    is_not = any(k in title for k in rb.get("not_buyer_titles", []))
    fit = "buyer" if is_buyer else ("not_buyer" if is_not else "unclear")
    if rb.get("who_to_email") == "anyone":   # generic mode: no job-title gate
        fit = "buyer"
    if fit == "not_buyer":
        return {"fit": fit, "status": NOT_BUYER, "flags": [f"'{person.get('title')}' is not a buyer for what we sell."],
                "signals": [], "hook": None, "second": None, "angle": None, "moved": False}
    if fit == "unclear":
        flags.append("Role is unclear from the sources.")

    current = person.get("current_company") or input_company
    moved = not same_company(input_company, current)
    if moved:
        flags.append(f"{person['name']} now works at {current}, not {input_company}. Check you still want to reach them.")

    never = [w.lower() for w in rb.get("never_mention", [])]
    work_only = (rb.get("compliance") or {}).get("work_facts_only", True)
    signals = []
    for f in facts:
        topic = f.get("topic", "other")
        cfg = rb["topics"].get(topic)
        priority = rules.PRIORITY.get(cfg["priority"], 0.4) if cfg else 0.2
        recency = max(0.0, 1 - f["days"] / lim["max_age_days"])
        score = round(0.5 * priority + 0.3 * recency + 0.2 * f["reliability"], 2)
        text = " ".join(f.get(k) or "" for k in ("fact", "line", "evidence")).lower()
        if topic in SENSITIVE_TOPICS or any(w in text for w in never):
            why = "sensitive topic"
        elif topic == "personal" and work_only:
            why = "personal, not work-related"
        elif f.get("conflict"):
            why = "sources disagree"
        elif f.get("company") and not same_company(f["company"], current):
            why = f"about {f['company']}, not {current}"
        elif f["days"] > lim["max_age_days"]:
            why = f"older than {lim['max_age_days']} days"
        else:
            why = None
        signals.append({**f, "priority": priority, "recency": round(recency, 2), "score": score, "excluded": why})
    signals.sort(key=lambda s: -s["score"])

    usable = [s for s in signals if not s["excluded"]]
    hook = usable[0] if usable and usable[0]["score"] >= lim["minimum_hook"] else None
    second = None
    if hook:
        second = next((s for s in usable[1:] if s["score"] >= lim["strong_hook"] and s["topic"] != hook["topic"]), None)

    angles = rb.get("angles", {})
    angle = next((v for k, v in angles.items() if k != "default" and k in title), angles.get("default", "less manual work"))

    if not hook:
        flags.append("Weak signal: no recent, relevant and safe fact. The draft is role-based only.")
        status = ATTN
    else:
        if hook["score"] < lim["strong_hook"]:
            flags.append(f"Hook score {hook['score']} is usable but below the strong level ({lim['strong_hook']}).")
        if hook.get("date_unknown"):
            flags.append("The hook's date is unknown.")
        status = FLAGS if flags else READY
    return {"fit": fit, "status": status, "flags": flags, "signals": signals, "hook": hook,
            "second": second, "angle": angle, "moved": moved}


# ---- step 9: quality checks --------------------------------------------------
def unsupported_numbers(d, used_facts, rb):
    """Every number in the email must come from a verified fact we chose, or from our own rulebook
    (e.g. the 15-minute call). Anything else is something the writer made up."""
    allowed = set()
    for f in used_facts:
        allowed |= numbers(" ".join(f.get(k) or "" for k in ("fact", "line", "evidence")))
    allowed |= numbers(" ".join(rb.get("writing_rules", [])) + " " + str((rb.get("compliance") or {}).get("opt_out_line", "")))
    text = re.sub(r"\[\d\]", " ", d.get("subject", "") + " " + d.get("body", ""))   # [1] [2] are source tags
    return sorted(numbers(text) - allowed)


def quality(d, first, has_hook, has_second, rb, used_facts=()):
    body, subject = d.get("body", ""), d.get("subject", "")
    words = len(body.split())
    text = (subject + " " + body).lower()
    banned = [p for p in rb.get("banned_phrases", []) if p.lower() in text]
    never = [w for w in rb.get("never_mention", []) if w.lower() in text]
    cites_ok = (not has_hook) or ("[1]" in body and (not has_second or "[2]" in body))
    made_up = unsupported_numbers(d, used_facts, rb)
    opt_out = (rb.get("compliance") or {}).get("opt_out_line")
    return [
        {"ok": not made_up, "text": "Every number comes from a verified fact" if not made_up
         else f"Number not in any verified fact: {', '.join(made_up)}"},
        {"ok": (not opt_out) or opt_out in body, "text": "Opt-out line included" if opt_out else "No opt-out line required"},
        {"ok": 40 <= words <= rb["limits"]["max_words"], "text": f"Length {words} words (40 to {rb['limits']['max_words']})"},
        {"ok": 0 < len(subject) <= 60, "text": f"Subject is {len(subject)} characters (max 60)"},
        {"ok": not re.search(r"\{\{|\}\}", text), "text": "No unfilled placeholders"},
        {"ok": not re.search(r"https?://|www\.", body), "text": "No links in the body"},
        {"ok": not banned, "text": "No banned phrases" if not banned else f"Banned phrase: {', '.join(banned)}"},
        {"ok": cites_ok, "text": "Every fact has a source tag" if has_hook else "No fact used, so no source tags needed"},
        {"ok": first.lower() in body.lower(), "text": f"Uses the right first name ({first})"},
        {"ok": not never, "text": "Nothing from the never-mention list" if not never else f"Mentions: {', '.join(never)}"},
    ]


# ---- the run -----------------------------------------------------------------
def history_flags(name, current_company, rb):
    """Warn when someone else at the same company already got a draft recently."""
    import db
    days = rb["limits"].get("company_cooldown_days", 14)
    hits = []
    for r in db.recent_runs(days):
        res = r["result"]
        other_co = (res.get("person") or {}).get("current_company") or r["company"]
        if (r["name"].lower() != name.lower() and same_company(other_co, current_company)
                and res.get("body") and r["review"] != "rejected"):
            hits.append(f"{r['name']} ({max(0, int((time.time() - r['ts']) / 86400))} days ago)")
    if hits:
        return [f"Someone else at {current_company} got a draft in the last {days} days: {', '.join(sorted(set(hits)))}. "
                "Contacting many people at one company tends to lower replies."]
    return []


def run(name, company, rep="Rep", pick=None, check_history=True):
    t0, meter = time.time(), research.Meter()
    version, rb, _ = rules.current()
    name, company, rep = " ".join((name or "").split()), " ".join((company or "").split()), (rep or "Rep").strip()

    def ev(i, state, *log):
        return {"stage": i, "state": state, "log": list(log)}

    def end(status, reason="", **extra):
        return {"result": {"name": name, "company": company, "rep": rep, "status": status, "reason": reason,
                           "rulebook_version": version, "cost": meter.summary(),
                           "duration": round(time.time() - t0, 1), "mock": research.MOCK, **extra}}

    # 1. Check input
    yield ev(0, "run")
    if not name or not company:
        yield ev(0, "stop", "bad|Person and company are both needed")
        yield end(STOPPED, "Enter both a person and a company.")
        return
    for blocked in rb.get("do_not_contact") or []:
        if same_company(blocked.get("company"), company):
            yield ev(0, "stop", f"bad|{blocked['company']} is on the do-not-contact list ({blocked.get('reason', 'no reason given')})")
            yield end(STOPPED, f"{blocked['company']} is on the do-not-contact list ({blocked.get('reason', '')}). No research was done.")
            return
    yield ev(0, "done", "good|Request is valid", f"|Rulebook version {version}")

    # 2. Research (parallel)
    yield ev(1, "run")
    queries = [("person", f'"{name}" {company}'), ("news", f"{company} news"),
               ("hiring", f"{company} careers hiring finance accounts payable"), ("funding", f"{company} funding raised")]
    pages, seen, log = [], set(), []
    try:
        for label, results in research.parallel_search(queries, meter):
            new = [r for r in results if r["url"] not in seen]
            seen.update(r["url"] for r in new)
            pages += new
            log.append(f"|{label}: {len(results)} results, {len(new)} new")
            yield ev(1, "run", *log)
    except research.ServiceError as e:
        yield ev(1, "stop", *log, f"bad|Search failed twice: {e}")
        yield end(STOPPED, "The search service failed twice, so nothing was guessed. Try again in a few minutes.")
        return
    pages, blocked = injection_pages(pages)
    log += [f"mid|Removed a page with hidden instructions to the AI: {p['url']}" for p in blocked]
    if not pages:
        yield ev(1, "stop", *log, "bad|No usable pages found")
        yield end(ATTN, "Nothing usable found online for this name and company. Check the spelling or add a profile link.")
        return
    yield ev(1, "flag" if blocked else "done", *log, f"good|{len(pages)} unique pages")

    # 3. Extract & verify
    yield ev(2, "run")
    try:
        data = mock_data.extract(name, company) if research.MOCK else research.extract(name, company, pages, rb, meter)
        if research.MOCK:
            meter.llm(3200, 700)   # what a real extraction call would roughly use
    except research.ServiceError as e:
        yield ev(2, "stop", f"bad|Extraction failed: {e}")
        yield end(STOPPED, "The AI service failed while reading the pages, so nothing was guessed.")
        return
    raw = data.get("facts", [])
    facts, dropped, conflicts = verify(raw, pages, rb, {p["url"] for p in blocked})
    log = [f"|{len(raw)} facts extracted, {len(facts)} verified on their page"]
    log += [f"mid|Dropped: {x['fact']} ({x['reason']})" for x in dropped]
    log += [f"mid|Sources disagree: {c}" for c in conflicts]
    yield ev(2, "flag" if dropped or conflicts else "done", *log)

    # 4. Identify person
    yield ev(3, "run")
    people = data.get("people", [])
    # The same person often shows up twice (two pages, slightly different title). Same name at the
    # same company counts as one person, so we only ask "which one?" when the choices really differ.
    merged = []
    for p in people:
        twin = next((m for m in merged if (m.get("name") or "").strip().lower() == (p.get("name") or "").strip().lower()
                     and same_company(m.get("current_company") or "", p.get("current_company") or "")), None)
        if twin is None:
            merged.append(p)
        elif not twin.get("title") and p.get("title"):
            twin["title"] = p["title"]
    people = merged
    if not people:
        yield ev(3, "stop", "bad|No source confirms who this person is")
        yield end(ATTN, "Could not confirm who this person is in any source.", dropped=dropped)
        return
    if len(people) > 1 and pick is None:
        yield ev(3, "flag", f"mid|{len(people)} people match this name",
                 *[f"|{i + 1}. {p['name']}, {p.get('title')}, {p.get('current_company')}" for i, p in enumerate(people)])
        yield end(ATTN, "More than one person matches. Pick the right one to continue.", choices=people, dropped=dropped)
        return
    person = people[pick or 0]
    blocked_countries = [c.lower() for c in (rb.get("compliance") or {}).get("blocked_countries") or []]
    if (person.get("country") or "").lower() in blocked_countries:
        yield ev(3, "stop", f"good|{person['name']}, {person.get('title')}, {person.get('current_company')}",
                 f"bad|Based in {person['country']}, which the rulebook blocks for cold email")
        yield end(STOPPED, f"{person['name']} is based in {person['country']}. Cold email there generally needs the "
                  "person's consent first, so no draft was written.", person=person, dropped=dropped)
        return
    p = plan(facts, person, company, rb)
    hist = history_flags(person["name"], person.get("current_company") or company, rb) if check_history else []
    log = [f"good|{person['name']}, {person.get('title')}, {person.get('current_company')}"]
    if pick is not None:
        log.append(f"|You picked option {pick + 1}")
    if p["moved"]:
        log.append(f"mid|Now at {person.get('current_company')} (you typed {company}). Writing for the new company.")
    log += [f"mid|{h}" for h in hist]
    yield ev(3, "flag" if p["moved"] or hist else "done", *log)

    # 5. Check fit
    yield ev(4, "run")
    if p["fit"] == "not_buyer":
        suggestions = data.get("finance_contacts", [])
        yield ev(4, "stop", f"bad|{person.get('title')} is not a buyer for us",
                 *[f"|Found instead: {s['name']}, {s['title']}" for s in suggestions])
        yield end(NOT_BUYER, f"{person['name']} ({person.get('title')}) is not a buyer for what we sell."
                  + (" Try the finance contact found at the same company." if suggestions else ""),
                  person=person, facts=facts, dropped=dropped, suggestions=suggestions, flags=p["flags"])
        return
    yield ev(4, "flag" if p["fit"] == "unclear" else "done",
             "good|Buyer role" if p["fit"] == "buyer" else "mid|Role unclear, continuing with a flag")

    # 6. Filter signals
    yield ev(5, "run")
    excluded = [s for s in p["signals"] if s["excluded"]]
    usable = len(p["signals"]) - len(excluded)
    yield ev(5, "flag" if excluded else "done", f"|{usable} usable, {len(excluded)} excluded",
             *[f"bad|Excluded: {s['fact']} ({s['excluded']})" for s in excluded])

    # 7. Score & angle
    yield ev(6, "run")
    log = [f"|{s['score']:.2f}  {s['topic']}{'  (excluded)' if s['excluded'] else ''}" for s in p["signals"]]
    if p["hook"]:
        log.append(f"{'good' if p['hook']['score'] >= rb['limits']['strong_hook'] else 'mid'}|Hook: {p['hook']['fact']}")
        if p["second"]:
            log.append(f"|Support: {p['second']['fact']}")
    else:
        log.append("mid|No fact is good enough. Writing a role-based draft instead.")
    log.append(f"|Angle for this role: {p['angle']}")
    yield ev(6, "done" if p["status"] == READY else "flag", *log)

    # 8. Write draft
    yield ev(7, "run")
    title = person.get("title") or "finance leader"
    ctx = {"first": person["name"].split()[0], "title": title, "company": person.get("current_company") or company,
           "rep": rep, "hook": p["hook"], "second": p["second"], "angle": p["angle"],
           "link": rb["topics"].get(p["hook"]["topic"], {}).get("link", "") if p["hook"] else ""}
    try:
        if research.MOCK:
            d = mock_data.draft(ctx)
            meter.llm(900, 250)
        else:
            d = research.draft(ctx, rb, meter)
    except research.ServiceError as e:
        yield ev(7, "stop", f"bad|Writing failed: {e}")
        yield end(STOPPED, f"The AI service failed while writing ({str(e)[:220]}). The research is saved; run again to retry.",
                  person=person, facts=facts, dropped=dropped, **{k: p[k] for k in ("signals", "hook", "second", "angle", "flags")})
        return
    opt_out = (rb.get("compliance") or {}).get("opt_out_line")
    if opt_out and opt_out not in d.get("body", ""):
        d["body"] = d.get("body", "").rstrip() + "\n\n" + opt_out   # added by code, never left to the model
    yield ev(7, "done", f"|Subject: {d.get('subject')}", f"|{len(d.get('body', '').split())} words",
             "mid|Role-based draft (low personalisation)" if not p["hook"] else f"|{d.get('personalisation', '')}")

    # 9. Quality check
    yield ev(8, "run")
    used = [f for f in (p["hook"], p["second"]) if f]
    checks = quality(d, ctx["first"], bool(p["hook"]), bool(p["second"]), rb, used)
    flags, status = list(p["flags"]) + hist, p["status"]
    if hist and status == READY:
        status = FLAGS
    if not all(c["ok"] for c in checks):
        flags.append("Some quality checks failed.")
        if status == READY:
            status = FLAGS
    yield ev(8, "done" if all(c["ok"] for c in checks) else "flag",
             *[f"{'good' if c['ok'] else 'bad'}|{'pass' if c['ok'] else 'fail'}  {c['text']}" for c in checks])

    # 10. Your review
    yield ev(9, "wait", "mid|Waiting for your decision")
    yield end(status, " ".join(flags), person=person, facts=facts, dropped=dropped, conflicts=conflicts,
              signals=p["signals"], hook=p["hook"], second=p["second"], angle=p["angle"], flags=flags,
              subject=d.get("subject"), body=d.get("body"), personalisation=d.get("personalisation"),
              checks=checks, low_personalisation=not p["hook"])
