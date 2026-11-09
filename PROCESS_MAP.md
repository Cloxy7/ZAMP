# Process map: prospect → reviewed outreach draft

**Who it's for:** an SDR at Zamp writing to finance leaders.
**Job:** a rep names a person; the process researches, picks one real hook, and drafts an email.
A human approves before anything is sent.

**Design rule:** AI only *reads* (pulls facts out of pages) and *writes* (the draft).
Every *decision* is plain code that follows the **rulebook** (`rulebook.yaml`), a plain-English
Agent Operating Procedure the rep can edit without touching code.

---

## The 10 steps

| # | Step | Input → Output | Done by |
|---|---|---|---|
| 1 | Check input | name, company → clean request | Code + rulebook |
| 2 | Research | request → web pages (4 searches in parallel) | Search API |
| 3 | Extract & verify | pages → facts, each with link, date, quote | LLM extracts, code verifies |
| 4 | Identify person | facts → one confirmed person | Code |
| 5 | Check fit | person's title → buyer / not a buyer | Code + rulebook |
| 6 | Filter signals | facts → usable facts | Code + rulebook |
| 7 | Score & angle | usable facts → hook, support fact, angle | Code + rulebook |
| 8 | Write draft | hook + angle + offer → subject, body | LLM |
| 9 | Quality check | draft → pass / flags | Code + rulebook |
| 10 | Your review | draft → approved / edited / rejected (+ lesson) | Human |

---

### Step 1 · Check input
- **Input:** person name, company, rep name, optional pick (which match to use).
- **Logic:** trim spaces; both fields required; compare company to the rulebook's
  `do_not_contact` list (existing customers, competitors).
- **Stops when:** a field is empty, or the company is on the do-not-contact list
  → **Stopped**, with zero API calls and zero cost.
- **UI shows:** "Request is valid", rulebook version used.

### Step 2 · Research
- **Input:** clean request.
- **Logic:** 4 searches run at the same time:
  person (`"name" company`), company news, hiring/careers, funding.
  Each answer is cached on disk, so a repeat run is instant and free.
  Every call is retried once.
- **Stops when:** the search service fails twice → **Stopped** ("nothing was guessed");
  no pages at all → **Needs attention** ("check spelling or add a profile link").
- **UI shows:** each search as it finishes, with result counts.

### Step 3 · Extract & verify
- **Input:** pages.
- **Logic:** a cheaper LLM returns `people`, `finance_contacts` and `facts`. Every fact must carry
  the page link and an **exact quote** copied from that page. Code then checks:
  1. the link was in the search results,
  2. the quote really appears on that page,
  3. every number in the fact appears on that page.
  Facts that fail are **dropped and listed**. Two facts on the same topic with different numbers
  (e.g. "$40M" vs "$45M") are marked **conflict**.
- **Stops when:** never by itself; weak results show up in step 7.
- **UI shows:** extracted vs. verified count, each dropped fact with the reason, conflicts.

### Step 4 · Identify person
- **Input:** `people` from step 3.
- **Logic:** zero matches → stop. More than one → ask the rep to pick.
  Compare the person's current company with what was typed (names normalised:
  "Inc", "Ltd", dots removed) → **changed job** flag.
- **Stops when:** nobody confirmed → **Needs attention**; two or more matches → **Needs attention**
  with pick buttons; the run continues after a pick.
- **UI shows:** the confirmed person, or the choices.

### Step 5 · Check fit
- **Input:** person's title.
- **Logic:** title contains a `buyer_titles` word → buyer. Contains a `not_buyer_titles` word
  (and no buyer word) → not a buyer. Neither → continue with a "role unclear" flag.
- **Stops when:** not a buyer → **Not a buyer**, and it suggests finance people it found at the
  same company (one click researches them instead).
- **UI shows:** the fit decision and suggestions.

### Step 6 · Filter signals
- **Logic:** a fact is excluded (kept visible, crossed out) when it is
  - a sensitive topic or contains a `never_mention` word (layoffs, lawsuits, illness…),
  - in conflict with another source,
  - about a different company than the person's current one,
  - older than `max_age_days`.
  A missing date counts as `unknown_date_days` old and is flagged, not dropped.
- **UI shows:** every excluded fact with its reason.

### Step 7 · Score & angle
- **Score** = 0.5 × topic priority + 0.3 × recency + 0.2 × source reliability
  - priority: high 1.0 / medium 0.7 / low 0.4 (set per topic in the rulebook)
  - recency: today 1.0 → `max_age_days` 0
  - reliability: company careers/press 0.95, major news 0.9, podcasts/video 0.75, other 0.7
- **Hook** = best usable fact with score ≥ `minimum_hook`.
  **Support fact** = next one with score ≥ `strong_hook` and a different topic.
- **Angle** = what this role cares about (rulebook `angles`: CFO → cost and close speed,
  Controller → accuracy and audit trail…).
- **Weak signal:** no hook → a role-based draft is still written, clearly labelled
  "low personalisation", status **Needs attention**. No fake specifics.

### Step 8 · Write draft
- **Input:** hook line, support line, topic link to the offer, angle, writing rules.
- **Logic:** the stronger LLM writes subject + body + a one-line note of which fact it used.
  `[1]`/`[2]` tags sit right after each fact.

### Step 9 · Quality check
Code checks: every number comes from a verified fact, opt-out line present,
40–`max_words` words, subject ≤ 60 characters, no leftover `{{placeholders}}`,
no links in the body, no banned phrases, every fact tagged, right first name,
no `never_mention` words. Any failure → **Review with flags**.

### Step 10 · Your review
- **Approve**, **Edit** (save your version), or **Reject** with a reason.
- A reason becomes a **proposed rulebook change**:
  | Reason | Proposed change |
  |---|---|
  | Wrong kind of hook | lower that topic's priority one level |
  | Mentioned something we shouldn't | add the word to `never_mention` |
  | Not a buyer | add the title word to `not_buyer_titles` |
  | Writing style | add your sentence to `writing_rules` |
- Before you accept, the change is **replayed on every past prospect**, and the page shows which
  outcomes would change (before → after). Accepting saves a new rulebook version.

---

## Final statuses
| Status | Meaning |
|---|---|
| Ready for review | strong hook, all checks passed |
| Review with flags | draft exists, something needs a human eye (job change, weak hook, unknown date, failed check) |
| Needs attention | no reliable draft: weak signal (role-based draft only), two matches, or nothing found |
| Not a buyer | wrong person for what we sell; suggestions given |
| Stopped | do-not-contact, or a service failed |

## Edge cases built in (test set: `golden.json`)
1. **Weak signal**: only a 410-day-old award → role-based draft, Needs attention.
2. **Two people match**: Sam Lee at Northwind Health vs Northwind Labs → rep picks.
3. **Changed jobs**: Dana moved to Kestrel Retail → draft for the new company, flagged.
4. **Sensitive news**: layoffs skipped, next good fact used.
5. **Sources disagree**: $40M vs $45M → funding not used, flagged.
6. **Wrong person, right company**: a software engineer → Not a buyer, suggests Head of Finance.
7. **Do-not-contact**: existing customer → stopped before any research.
8. **Service down**: search fails twice → Stopped, nothing guessed.
9. **Invented fact**: "50,000 invoices a month" quote not on the page → dropped.

## Metrics on the dashboard
Draft-ready rate, sent-to-a-human rate, approval rate, cost per run (estimated),
seconds per run, approval rate per rulebook version, test-set pass rate.

## Safety and compliance built in
| Risk | What the process does |
|---|---|
| Writer adds a claim no source supports | Step 9 checks every number in the email comes from a chosen verified fact or the rulebook. Anything else → flagged. Rule-based on purpose: AI judges asked "is this true?" miss many invented claims. |
| A web page hides instructions to the AI | Step 2 removes pages with instruction-like text before the LLM reads anything; the extract prompt also marks page text as data. A fact from a removed page is dropped. |
| Personal-life facts | `compliance.work_facts_only`: family, health, hobbies are never used as a hook. |
| Cold-email law | `compliance.opt_out_line` is added by code to every draft; `blocked_countries` stops before drafting (e.g. Canada, where CASL generally needs consent). Contact details are never collected. |
| Too many people at one company | Warns when someone else at the same company got a draft in the last `company_cooldown_days`. |
| Stale research | Cached search answers expire after `CACHE_TTL_DAYS` (7). Set 0 to freeze a demo. |

Extra test cases: **writer adds a claim** (Ravi Kumar), **hidden instructions on a page** (Grace Lin),
**blocked country** (Claire Dubois). Priya's data now also holds a marathon result that must never be used.

## How it would scale (system design)
Today one request runs one prospect live. For a team doing ~1,000 prospects a day:

1. **Queue instead of live requests.** The rep uploads a list; each prospect becomes a job in a queue
   (e.g. Redis/RQ or a database table, like the open-source outreach engines use). Workers pull jobs;
   the page shows progress per job. A failed job retries with a delay, it doesn't block the list.
2. **What breaks first: API rate limits.** Search APIs and LLMs cap requests per minute. Workers use a
   shared rate limiter and back off on "too many requests". Steps 2-3 are the heavy ones.
3. **Cost per draft** (estimate, check current prices): 4 searches + 1 cheap extraction call +
   1 writing call ≈ a few US cents. At 1,000/day that is tens of dollars a day. The cache removes repeat
   searches for the same company (many prospects share one company), and the cheap model handles the
   long input. The real cost is the human review minute per draft, so the goal is a high "ready" rate.
4. **The human queue is the bottleneck.** Drafts land in a review queue sorted by status:
   Ready first (fast approve), flagged second, Needs attention last. Approval rate per rulebook version
   shows whether rule changes actually help.
5. **Data.** Postgres instead of SQLite; store each run's sources and decisions for audit; delete raw
   page text after N days (data minimisation), keep only the facts that were used.
6. **Learning at scale.** Proposals from many reps are grouped (e.g. 12 rejections of funding hooks),
   replayed against the test set and recent runs, and a manager accepts them.

## Choices and trade-offs (for the interview)
- **Search first, identify second.** One round of 4 parallel searches is cheaper and faster than
  searching for the person, confirming, then searching again. Cost: identity is checked after
  research, so a wrong-person run still spends one search round.
- **Rules over model judgement for decisions**, so every outcome can be explained and replayed.
- **Two models:** a cheap one to extract, a stronger one to write.
- **Draft, never send.** The output is a reviewed draft; no contact emails are collected.
- **Weights are hand-set.** Approval data per rulebook version is how they'd be tuned later.
