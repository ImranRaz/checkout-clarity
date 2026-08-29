# CoherentX — Product Roadmap

Three agents today and tomorrow: **Funnel** (what the site does to a shopper),
**Reputation** (what customers say about it), **Discovery** (whether anyone —
human or machine — can find it in the first place). The strategic shift after
that is from *reports* to a *system of record*: recurring runs, diffs, owned
tasks, and proof that a change moved a number.

---

## 1. Why the third agent should be Discovery (AI + classic SEO)

Classic SEO tooling is a crowded, mature market (Ahrefs, Semrush, Screaming
Frog, Sitebulb). We do not win by rebuilding a backlink index — we can't, and
buyers already pay for one. We win on the part those tools were not designed
for and are only now bolting on:

**Answer Engine Optimization (AEO) / Generative Engine Optimization (GEO)** —
being cited inside ChatGPT, Claude, Perplexity, Gemini and Google AI Overviews,
where there is no blue link to rank for and no SERP to scrape.

Three properties make this a genuine gap rather than a me-too feature:

1. **The unit of success changed.** In classic SEO the unit is *a position for
   a query*. In AEO the unit is *a citation inside an answer*. Nobody has made
   that measurable in a way a marketing lead can act on Monday morning.
2. **Answer engines read differently than crawlers.** They fetch without
   executing JavaScript in most cases, they favour extractable, self-contained,
   attributable statements, and they reward entity clarity over keyword
   density. Most storefronts are invisible to them for boring, fixable reasons.
3. **We already drive a real browser and already have a review-reading agent.**
   The expensive infrastructure for this exists. The marginal cost of the third
   agent is mostly prompt and rule work.

### What the Discovery agent measures

**Track A — Machine readability (deterministic, cheap, runs headless)**

- Rendered vs. raw HTML delta: how much of the page only exists after JS. If
  the answer to "what does this company sell" is client-rendered, most AI
  crawlers never see it.
- `robots.txt` posture for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`,
  `ClaudeBot`, `Claude-User`, `PerplexityBot`, `Google-Extended`,
  `CCBot`, `Bytespider`, `Applebot-Extended`. Blocking crawl and then asking
  why you're not cited is the single most common own-goal.
- `llms.txt` presence and quality (emerging convention; cheap to ship, and a
  visible signal that the brand is AI-aware).
- Structured data: Organization, Product with offers/price/availability,
  BreadcrumbList, FAQPage, Review/AggregateRating, LocalBusiness, Article.
  Validated, not merely present.
- Canonicals, hreflang, pagination, sitemap freshness vs. actual catalogue,
  orphan pages, redirect chains, soft-404s.
- Core Web Vitals and index-blocking issues — we already collect LCP/CLS/TBT
  in the funnel agent, so this is free.
- Title/H1/heading hierarchy, thin pages, duplicate meta — table stakes, which
  is exactly why we must not skip it.

**Track B — Answer-engine visibility (the differentiator)**

- Build a **prompt set**, not a keyword list: 30–100 natural buying questions
  a real customer would type into an assistant, generated from the brand's
  category, catalogue, location and reputation data we already collected
  ("best merino socks for hiking", "is Bombas worth it", "hotels near Bal
  Harbour with ocean view").
- Run that prompt set against multiple answer engines on a schedule and record,
  per prompt: were we cited, at what position in the answer, with which URL,
  which competitors were cited instead, and what claim was attributed to us.
- Derive a **Share of Model** metric — the percentage of the prompt set where
  the brand appears — trended over time and split per engine. That is the
  number a CMO screenshots. It is also inherently recurring, which is the
  engagement flywheel we want.
- **Sentiment and accuracy of the citation.** Worse than not being mentioned is
  being mentioned wrongly: stale pricing, discontinued products, a complaint
  theme the reputation agent already found repeated as fact by the model.
- **Citation-source analysis**: models mostly quote third parties — Reddit,
  YouTube, listicles, review sites, Wikipedia. Report which sources the models
  lean on for this category, and which of them the brand is absent from. That
  turns into a concrete off-site content plan, not vague advice.
- **Entity coherence**: does the brand have a consistent, machine-resolvable
  identity (same name, address, category, founding facts) across its own site,
  schema, Wikidata, Crunchbase, review platforms? Incoherent entities get
  dropped from answers.

**Track C — Content shape for extraction**

Per key page, score how answerable it is: is there a direct, quotable answer
near the top; are claims self-contained rather than dependent on surrounding
prose; are specs in parseable tables; are FAQs real FAQs; is authorship and
freshness declarable. Output *rewrites*, not scores — the funnel agent already
does before/after rewrites, and that pattern is our strongest asset.

### Cross-agent synthesis is the moat

None of the three tools a customer already pays for can say this:

> Customers complain about sizing (reputation, 41 mentions, rising). Your
> product page buries the size guide at 78% scroll depth (funnel). ChatGPT
> tells shoppers your socks "run small" and cites a Reddit thread, not you
> (discovery). Fix one page, three problems.

That paragraph is the product. Everything else is plumbing.

---

## 2. From one-time report to a habit

A report is an event. Habit needs a **subject that changes** and a **reason to
look today**. Five mechanics, in the order they should ship:

1. **Scheduled runs + diffs.** Nightly reputation, weekly funnel, weekly
   discovery. Store every run; the artefact users open is not the report, it's
   the *delta*: new complaint theme, score dropped 6 points, competitor
   overtook you on 12 prompts, checkout LCP regressed after your last deploy.
2. **Alerts to where work happens.** Email digest, Slack, webhook. Threshold
   and anomaly based, not "your run finished". A well-tuned alert is the whole
   retention strategy.
3. **Issue lifecycle.** Every finding gets a stable fingerprint (page + rule +
   element signature) so it survives re-runs. States: open → acknowledged →
   in progress → fixed → verified → regressed. Auto-verify on the next run.
   "We verified 7 of your fixes this week" is the strongest possible retention
   email.
4. **Export and two-way sync.** Start with clean CSV/JSON and a Jira/Linear CSV
   template (summary, description with evidence URL, severity → priority,
   labels per category, stage, screenshot link). Then real integrations: create
   issues via API, write the CoherentX fingerprint into a custom field, and
   close the loop when the ticket closes. Also: Notion, Asana, GitHub Issues,
   and a Zapier/webhook escape hatch.
5. **Scorecard over time.** One headline number per track plus history, and a
   weekly "what changed" narrative. Public-facing shareable scorecard for the
   brand to send upward.

## 3. What makes it spread

- **Free public scan with a shareable, watermarked scorecard.** Our share links
  already exist. A scan you can run on a competitor and post is the growth loop.
- **Competitor mode.** Run all three agents on up to three rivals and show the
  gap. Comparison content is inherently shareable and inherently recurring.
- **Category leaderboards** — "Top 50 DTC apparel brands by Share of Model" —
  published monthly. Every brand on the list has a reason to visit, and every
  brand not on it has a reason to sign up. This is the single highest-leverage
  viral asset available to us because nobody else is publishing it yet.
- **Embeddable badge** for brands scoring well.
- **Agency/multi-site workspaces** — agencies bring 20 clients each and need
  recurring reports by construction.

## 4. Beyond the three agents

Ranked by value per unit of build effort:

- **Revenue impact model** — convert findings into estimated £/$ recovered
  using traffic and AOV the user supplies. Turns a UX list into a business case
  and unlocks budget.
- **Mobile vs. desktop divergence** — we already drive a browser; a second
  viewport doubles the finding surface for a small cost.
- **Fix packs** — copy-paste patches: schema JSON-LD blocks, `llms.txt`,
  rewritten PDP copy, alt text. Pair with a "verified fixed" run.
- **Accessibility/compliance report** (WCAG 2.2 AA, European Accessibility Act)
  — a deadline-driven, legally motivated purchase, and largely the same crawl.
- **Post-deploy regression watch** — webhook from Vercel/Shopify triggers a
  targeted re-run and diffs against the last known good state.
- **Ask-your-report chat** — the corpus is already structured; a Q&A layer over
  runs makes the data feel alive.

## 5. Suggested build order

| Phase | Ship | Why now |
|---|---|---|
| 1 | Discovery agent, Track A (technical + machine readability) | Deterministic, no browser cost, immediately credible |
| 2 | Discovery Track B (prompt set + Share of Model, one engine) | The differentiator; also inherently recurring |
| 3 | Issue fingerprints + lifecycle + CSV/Jira export | Turns findings into work; unblocks everything else |
| 4 | Scheduling, diffs, digests, alerts | The habit loop |
| 5 | Multi-engine Share of Model + citation-source analysis | Deepens the moat |
| 6 | Competitor mode + public scorecard + leaderboard | Distribution |
| 7 | Revenue model, fix packs, integrations, workspaces | Monetisation and expansion |

## 6. Technical notes

- **Discovery Track A** runs browser-free: fetch raw HTML, fetch rendered HTML
  only when the delta matters, parse with a DOM parser in a server function.
  Reuses the reputation agent's HTTP/LLM shape, not Browserbase minutes.
- **Track B** needs a model-call budget per run (prompt set × engines) — the
  dominant cost. Cache aggressively; run the full set weekly and a 10-prompt
  canary daily.
- **Scheduling** needs a job table plus a cron trigger hitting a route under
  `src/routes/api/public/*` with a shared-secret header, and per-workspace
  concurrency limits so a nightly wave doesn't exhaust browser quota.
- **Findings need stable IDs now.** The current numeric per-run ids cannot
  support diffs, lifecycle, or export round-trips. Introducing a fingerprint
  early is cheap; retrofitting it after three agents ship is not.
- **Schema** gains `discovery` alongside `reputation` on the report, with the
  same optional-block pattern, so existing stored reports keep parsing.
