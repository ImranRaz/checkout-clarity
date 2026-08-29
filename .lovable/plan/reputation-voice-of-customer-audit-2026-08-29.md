# Reputation & Voice-of-Customer audit

Add a second, browser-free audit track that reads what real customers say about the
brand, clusters it into themes, and — the important part — links those themes back to
the funnel findings the agent already produces.

## What the user gets

On the new-audit screen, two toggles under the URL field: **Funnel audit** and
**Reputation audit**. Both on by default; either can be turned off (at least one must
stay on).

The report gains a **Reputation** tab alongside the existing funnel view:

- A reputation score (0–100) and rating summary: average rating, review volume, trend.
- Complaint themes ranked by weight — e.g. "Surprise shipping cost (37 mentions,
  mostly 1–2 star, rising)" — each with 2–3 verbatim quotes and links to the source.
- Praise themes, so the report also says what to protect.
- Source breakdown: which sites the evidence came from and how many reviews each.

### The live run: two agents, side by side

The run screen becomes the portfolio piece — visible proof of a multi-agent system,
not a page that appears to be reloading. When both tracks are selected, the terminal
splits into two live lanes:

```text
┌ BROWSER AGENT ────────────┐  ┌ REPUTATION AGENT ─────────┐
│ ● opening store in Chrome │  │ ● resolving the brand     │
│ ✓ measuring paint & shift │  │ ✓ found 4 review sources  │
│ ✓ category → product      │  │ ● reading 128 reviews     │
│ ● adding to cart          │  │ ○ clustering complaints   │
│ ○ guest checkout          │  │ ○ matching to findings    │
└───────────────────────────┘  └───────────────────────────┘
        ↓ both complete ↓
   ┌ SYNTHESIS ─────────────────────────────────────┐
   │ ● cross-referencing 6 themes against 14 findings│
   └─────────────────────────────────────────────────┘
```

Each lane shows its own step list with live status dots, elapsed time and a running
count of what it has found. Steps stream in as they happen, exactly as the browser
agent's log does today. When one lane finishes it stays on screen with its result
summary while the other keeps going, so the parallelism is legible.

A third, short **Synthesis** lane appears once both finish, showing the cross-reference
pass running before the report reveals. One track selected means one lane and no
synthesis step, laid out full width.

On mobile the lanes stack rather than sit side by side.


### The cross-reference (the differentiator)

Every complaint theme is matched against the funnel friction points by category and
meaning. Where they agree, both sides show a corroboration badge:

- On a funnel finding: "37 customers said the same thing → see reputation."
- On a reputation theme: "Confirmed on the page: unlabeled shipping field at cart →
  jump to evidence."

That match is computed once, server-side, at report-assembly time and stored on the
report, so the link is deterministic and survives sharing and PDF export.

Corroborated findings are promoted in the funnel findings order — a problem customers
actually complain about outranks one only the agent noticed.

## How it works

No browser session, no Browserbase minutes. Search plus HTTP scraping plus one LLM
pass:

1. Resolve the brand from the audited domain (name, category, likely review profiles).
2. Search for review sources: Google/Trustpilot/Sitejabber/Reddit/BBB and the
   category-appropriate equivalents (e.g. Cruise Critic for a cruise line).
3. Scrape the top sources for review text, rating and date.
4. One LLM pass clusters the text into complaint and praise themes with sentiment,
   volume, recency, severity and representative quotes.
5. A second, cheap LLM pass matches themes to the existing funnel friction points.

Runs in parallel with the funnel run, so it adds no wall-clock time to an audit that
already takes 1–3 minutes.

## Technical notes

- **Data source:** Firecrawl connector (search + scrape) called from a server function.
  It needs to be connected — I'll open the connect card when we build.
- **Reasoning:** Lovable AI gateway for the clustering and matching passes; both are
  structured JSON outputs validated with Zod.
- **Schema:** a new optional `reputation` block on `auditReportSchema` (optional so
  every existing saved report still parses) holding score, sources, themes, and
  `corroborates: string[]` of friction-point ids. Friction points get an optional
  `corroborated_by` theme id.
- **Where it runs:** an edge server function in the app (`src/lib/reputation.functions.ts`),
  not the Node agent worker — it is HTTP-only.
- **Storage:** persisted inside the existing saved-report JSON, so permalinks, shared
  read-only links and the PDF export pick it up with no extra plumbing.
- **UI:** a tab strip on `ReportDashboard`, a new `ReputationPanel` component, and small
  corroboration chips added to the existing findings rail.
- **Live view:** `LiveTerminal` is generalised into lanes. The reputation track emits
  the same step shape the browser worker already streams (`actor`, `text`, `tone`), so
  the run page polls both jobs on one loop and renders each lane's log independently.
- **Failure mode:** if no credible review presence is found, the tab says so plainly
  rather than inventing themes — and the funnel report is unaffected.

## Out of scope for this pass

Competitor reputation comparison, review-response drafting, and ongoing monitoring
alerts — all natural follow-ups once this lands.
