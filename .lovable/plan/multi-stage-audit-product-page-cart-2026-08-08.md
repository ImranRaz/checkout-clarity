# Multi-stage audit: product page → cart

Right now a report is one page (the cart) with one screenshot. That misses half the value: the product page is where "can I even figure out how to buy this" is decided, and real journeys vary — sometimes PDP → cart in one click, sometimes PDP → variant picker → mini-cart → cart.

## 1. A report becomes a journey of stages

Instead of one `screenshot` + one `technical_metrics` + one flat friction list, a report holds an ordered list of **stages**. Each stage is a page the agent actually landed on, and carries its own capture, metrics, and findings.

```text
Report: wayfarer-outdoor.com
├── Stage 1  Product page        capture · metrics · 5 findings
├── Stage 2  Mini-cart drawer    capture · metrics · 2 findings   (optional, varies by site)
└── Stage 3  Cart                capture · metrics · 4 findings
```

Stage kinds: `category`, `product`, `variant`, `mini-cart`, `cart`. A run records only the stages it actually reached, so a 2-step site shows 2 stages and a 4-step site shows 4 — no empty placeholders. The transition between stages is recorded too (what was clicked, how long the navigation took), because "the add-to-cart button took 3 clicks to find" is itself a finding.

Product-page findings get their own checks, distinct from cart checks:
- Is the primary add-to-cart affordance unambiguous, above the fold, and single?
- Variant/size selection: required-but-unmarked, out-of-stock handling, error copy.
- Quantity control: present, reachable, keyboard-operable, sane bounds.
- Price, shipping, and returns legibility at the decision point.
- Multi-product pages (bundles, "complete the look"): does the real buy button compete with secondary ones?

Scoring rolls up per stage and then to a single total, so the dashboard can say "product page 74, cart 58" instead of one opaque number.

## 2. Fixing the up-and-down scroll problem

The current viewer makes you hunt: a tall screenshot in a short box, pins somewhere off-screen. With three captures that gets worse, not better. The fix is to stop treating the capture as a page to scroll and start treating it as evidence to jump to.

The report view becomes a two-pane workspace:

```text
┌───────────────────────────┬──────────────────────────────┐
│  FINDINGS (left rail)     │  EVIDENCE (right, sticky)    │
│                           │                              │
│  ▸ Product page      74   │   ┌────────────────────┐     │
│    ● Variant not marked   │   │  cropped region    │     │
│    ● Qty stepper 18px     │   │  around the pin,   │     │
│    ● Two buy buttons      │   │  zoomed + outlined │     │
│  ▾ Mini-cart         81   │   └────────────────────┘     │
│  ▾ Cart              58   │   [ ▭ full page ] [ ⤢ zoom ] │
└───────────────────────────┴──────────────────────────────┘
```

- Selecting a finding **crops and scales the capture to that pin's neighbourhood** and draws a box on the offending element. No scrolling to find anything — the evidence comes to you.
- Switching stages switches the capture. Findings stay grouped under their stage heading, so it is always obvious which page a problem belongs to.
- A **full page** toggle drops back to the whole capture with all pins, for people who want the overview. A thin scroll-rail beside it marks pin positions so the tall-image case still has orientation.
- Keyboard: `J`/`K` (or arrow keys) walk findings across stages in order, which is how anyone actually reviews a list like this.
- Stage strip along the top: thumbnail per stage with its score and finding count — the journey at a glance, click to jump.

## 3. What gets built

New fixtures: three complete journeys with product-page captures added (a 2-stage site, a 3-stage site with a mini-cart drawer, a 4-stage site), plus the blocked run which now honestly shows one failed stage.

## Technical notes

- `src/lib/audit-schema.ts`: add `stageSchema` (kind, label, url, screenshot, technical_metrics, friction points, transition-in). `auditReportSchema` gains `stages: stageSchema[]`; the top-level `screenshot`/`technical_metrics`/`ux_friction_points` fields are removed, and `reached_step` derives from the last stage.
- `src/lib/scoring.ts`: `scoreStage()` for per-stage totals plus a weighted roll-up (cart weighted heaviest, product page next). Partial runs still refuse to print a headline score.
- `src/lib/fixtures.ts`: rewritten to the stage shape, with terminal logs extended to narrate each hop (`Add to Cart clicked → drawer opened in 340 ms`).
- `src/components/audit/ReportDashboard.tsx`: split into `StageStrip`, `FindingsRail`, and `EvidenceViewer` (crop/zoom math from pin percentage + a fixed viewport window, CSS transform on the image, no canvas).
- `src/routes/report.$reportId.tsx` and `audit.$runId.tsx`: pass stages through; deep-link a finding via `?stage=cart&finding=3` so a specific problem is shareable.
- `src/lib/audit-runner.ts` stays the seam — a live hosted-browser run fills the same stage array.
- New generated fixture screenshots for the product-page and mini-cart stages.
