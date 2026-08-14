# Add a real scroll pass to every audited page

You're right — we don't scroll. Today each stage is: land, wait, screenshot full page, read the DOM, move on. The full-page screenshot makes it *look* like the whole page was examined, but nothing below the fold was ever rendered in a viewport, so lazy content, sticky behaviour, and scroll-triggered jank are invisible to us. A human auditor scrolls first and forms half their opinion during that scroll.

## What the scroll sweep does

Before capture, at every stage, the agent scrolls the page in viewport-height steps to the bottom (capped by time and by a max page height so an infinite feed can't run away), pausing briefly at each step, then returns to the top before the screenshot.

While it scrolls, it records evidence rather than impressions:

- **Lazy media that never resolves** — images/iframes still without a loaded source after they've been in view, plus how long the slowest ones took.
- **Layout shift during scroll** — CLS accumulated *after* the initial load, attributed to the scroll position where it happened. This is the classic "I went to tap and the page jumped" defect and we currently can't see it.
- **Content depth vs. decision depth** — total page height in viewports, and how far down the primary CTA / price / add-to-cart sits. On a long page, a buying decision buried at 4.5 screens is a finding.
- **Sticky elements** — whether a persistent CTA or nav exists on a long page (its absence is a finding on tall pages), and whether a sticky bar or floating chat widget covers content or the primary action.
- **Infinite scroll / pagination** — detected by height growth after reaching the bottom; noted because it breaks footer access and back-navigation.
- **Scroll jank** — long tasks recorded during the sweep, so "the page stutters when you scroll" becomes a measured number.
- **Below-fold text** — the digest currently favours above-fold content. After the sweep the full post-lazy-load text is captured, which is what makes the copy and trust reviewers able to say "the returns policy *is* on the page, just at 80% depth" instead of "missing".

## How it changes the report

- New measured friction points from the sweep (lazy failures, post-load shift, buried CTA, occluding sticky bar, missing sticky CTA on a long page) sit alongside the existing vitals/tap-target/contrast checks — the honest measured layer, not model opinion.
- Each stage gains a small **scroll profile** (page height in viewports, depth of the primary CTA, shift after load, lazy failures) that the council reviewers receive in their prompt. That's what lets the strategist say "price appears at 62% depth, below three marketing modules" and the copy director judge sections it previously never saw.
- The journey diagnosis gains a scroll dimension: how much scrolling the funnel demands overall, and where a motivated buyer runs out of patience.

## Cost control

The sweep is bounded: max ~12 viewport steps, ~250ms settle each, hard 8s budget per stage, skipped entirely on pages shorter than 1.5 viewports. Worst case it adds a few seconds per stage, and it replaces the blind `waitForTimeout` we already pay for after navigation. It also *improves* full-page screenshots on lazy-loading sites, where we currently capture grey placeholder boxes.

## Technical notes

- New `agent-worker/src/scroll.js`: `SCROLL_INIT` (installs a PerformanceObserver for layout-shift and longtask before the sweep), `SCROLL_STEP`, and `SCROLL_REPORT` scripts, plus a `scrollSweep(page)` driver that returns the scroll profile and evidence.
- `agent-worker/src/agent.js`: run `scrollSweep` inside `captureStage` before the `Promise.all`, return to top, then screenshot. Attach `scroll_profile` to the stage and thread it into the reviewer call and the journey review.
- `agent-worker/src/friction.js`: add scroll-derived checks to the measured pass (lazy failures, post-load CLS, CTA depth, sticky occlusion) using the sweep result; capture `page_text` after the sweep so below-fold copy is present.
- `agent-worker/src/ux-review.js` / `journey-review.js`: include the scroll profile in the prompt context.
- `src/lib/audit-schema.ts`: optional `scroll_profile` on the stage.
- `src/components/audit/ReportDashboard.tsx`: show the scroll profile as a compact strip on the technical tile (page height in viewports, CTA depth, shift after load, lazy failures).
