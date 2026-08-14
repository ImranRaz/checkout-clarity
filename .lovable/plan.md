# Making the audit feel like a Fortune-100 optimizer, not a linter

Three problems are visible in your screenshots, and they are different in kind. One is a real bug, one is a prompt/context gap, and one is a product gap.

## 1. The markers point at the wrong thing (a real bug)

In screenshot 1 the "BOOK NOW hero" finding is pinned to the left edge of the image, nowhere near the button. In screenshot 3 the marker sits on top of the element it is describing, so you cannot read the page underneath.

Cause: the vision review is fire-and-merge — it runs *while the agent keeps clicking*. When it finally asks the browser "where is element e2?", the browser is already on a different page (or the page has re-laid out), so the coordinates come back from the wrong DOM. Sometimes the ref resolves to a stale element, sometimes it lands near-arbitrarily.

Fix:
- At capture time (same instant as the screenshot), snapshot a `ref -> {x, y, w, h}` map for every element in the digest and freeze it on the stage. The reviewer resolves refs against that frozen map, never against the live page. If a ref isn't in the map, the finding is dropped.
- Store the full rect, not just a center point, so the UI can draw a highlight **box** around the actual element.
- Move the numbered badge to the outside edge of that box (auto-flipping to whichever side has room) so it never covers the thing it points at.
- "Focus" mode crops to the element's rect plus generous padding and scales it up, instead of panning a full-page image to a center point.

## 2. It doesn't know what business it's auditing (context gap)

"No shipping cost or returns window" on a cruise line is the tell. The reviewer is given a page, not a business.

Fix — a **vertical brief**, resolved once per run and injected into every review prompt:
- A cheap classification pass on the entry page picks a model: physical goods, travel/booking, ticketing/events, subscription/SaaS, services/lead-gen, food/delivery, financial.
- Each vertical carries its own checklist of what a buyer actually needs at the decision point, plus an explicit *do-not-ask-for* list:
  - physical goods → shipping cost, delivery date, returns window, size/fit, stock
  - travel/booking → total fare vs "from" price, what's included, deposit amount, cancellation & change policy, port/resort fees and taxes, occupancy assumptions, date/availability clarity — **never shipping or returns**
  - ticketing → all-in pricing vs fees at checkout, seat/section clarity, delivery method
  - subscription → trial terms, renewal price, cancellation path, what's gated
- The brief also states the buying temperature (a $6k cruise is a considered, multi-session purchase; sneakers are impulse), which changes what counts as a real problem.

## 3. It reports defects, not consulting (product gap)

Today every finding is one voice with one shape: title, description, evidence. A Fortune-100 team doesn't buy a defect list — they buy judgement about revenue. So the review becomes a small council, each with a distinct remit, run per stage:

- **Conversion strategist** — funnel logic, hierarchy, competing CTAs, price transparency, decision information present at the decision point, cognitive load, effort asked before value delivered.
- **Copy & messaging director** — headline clarity, CTA verbs, value proposition, objection handling, jargon. Every copy finding must carry a concrete **before → after rewrite**, not "improve the copy".
- **Trust & risk** — vertical-appropriate reassurance (guarantee, cancellation, security, social proof, contact/human availability) using the vertical brief's vocabulary.
- **Accessibility & technical** — largely already covered by the measured pass; keep it, don't duplicate it in prose.

Each finding gains three new fields the UI renders:
- `persona` (badge on the card)
- `recommendation` — the specific change to make on this page
- `impact` — where in the funnel this leaks and why it costs money (qualitative, with a rough band: minor / meaningful / material)

Plus a new **run-level pass** that no per-page reviewer can do: after the journey completes, one call sees every stage (labels, screenshots, findings) and produces a **Journey Diagnosis** — number of steps to commit vs. the vertical's norm, information asked for too early, price revealed too late, repeated or redundant asks, where a motivated buyer most likely abandons, and the top three moves ranked by expected revenue impact. That becomes the executive summary, replacing today's derived-from-scores text.

## 4. Precision guardrails

More output is worthless if it hallucinates. Two cheap guards:
- **Evidence binding** — a finding is discarded unless its ref resolves in the frozen map AND its quoted evidence string actually appears in the captured page text (or is a measured number). This alone would have killed the misplaced BOOK NOW finding.
- **Self-critique step** — the council's combined findings for a run get one pass that removes duplicates across personas, drops anything generic enough to apply to any website, and caps to the highest-value set per stage.

## 5. Model tiering

Navigation and review currently share one model. Split them: keep the fast/cheap model for the plan-act loop, and use a stronger multimodal model for the council and the journey diagnosis, where taste and precision are the entire product. Configurable via env so you can point both at OpenRouter.

## Technical notes

- `agent-worker/src/friction.js`: extend `PAGE_DIGEST_SCRIPT` to return a `geometry` map (`ref -> x/y/w/h/selector`) in the same evaluate that assigns refs; `RESOLVE_REF_SCRIPT` becomes a pure lookup against that map.
- `agent-worker/src/agent.js`: freeze the geometry map onto the stage in `captureStage`; add a one-shot vertical classification before the loop and thread the brief through to the reviewer.
- `agent-worker/src/ux-review.js`: becomes the council — per-persona prompts sharing one digest/screenshot, vertical brief injected, evidence binding + dedupe. Schemas stay permissive with normalisation in code.
- New `agent-worker/src/journey-review.js` for the run-level diagnosis.
- `src/lib/audit-schema.ts`: add `persona`, `recommendation`, `impact`, `rect` to the friction point schema (all optional so existing stored reports still parse); add a `journey_diagnosis` block to the report.
- `src/components/audit/ReportDashboard.tsx`: rect-based highlight box, edge-aware badge placement, crop-to-element focus mode, persona badge and recommendation/rewrite in the finding card.
- `src/components/audit/ExecutiveSummary.tsx`: render the journey diagnosis when present, fall back to the current derived summary.

## What this does not change

The measured layer (vitals, tap targets, contrast, console errors, bot-wall detection) stays exactly as is — it is the honest floor under the judgement layer.
