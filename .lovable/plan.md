# Checkout Forensic — Fixture-Driven Build

Build the complete product experience end to end, driven by realistic fixture reports instead of a live headless browser. Every screen, animation, and data shape is final; wiring a real browser service later becomes a single swap behind one interface.

## What changes from your PRD

The stack here is TanStack Start on an edge runtime, not Next.js. Practical consequences:

- Server Actions become `createServerFn`; the streaming route becomes a server route.
- No OpenRouter key needed — AI runs through the built-in gateway with the same Vercel AI SDK calls.
- Playwright cannot run in this runtime at all. When you go live it must be a hosted browser service (Browserless/Browserbase) over WebSocket. The plan keeps that boundary clean so it's a drop-in later.

Design stays enterprise light mode and high trust, but with a distinctive palette and type pairing rather than the off-white + Inter + `#6366F1` combination, which currently reads as default AI output.

## Scope of this build

**Phase 1 — Input**
Full-bleed hero with a single large URL field and a "Run Forensic Audit" primary action. Below the fold, a horizontal rail of recent audits with domain, score, and timestamp.

**Phase 2 — Thinking UI**
On submit the input morphs into a terminal panel. Log lines stream in on realistic staggered timings (not instant), covering navigate → locate cart button → click → advance to cart → capture metrics and console → vision analysis. Each line is tagged by actor (`System`, `Browser`, `Vision`) with a distinct color. A visible run timer and a step progress indicator sit in the terminal chrome.

**Phase 3 — Bento dashboard**
Terminal fades, dashboard staggers in.
- Large tile: full-page screenshot in a scroll container with numbered pins absolutely positioned by percentage. Hovering a pin highlights its insight; hovering an insight highlights its pin.
- Technical Health tile: load metrics, transfer size, console errors, blocked/slow resources — in monospace.
- UX/CRO Insights tile: numbered list matching the pins, each with a severity chip and expandable detail.
- Score tile: overall score with a breakdown of how it was computed.

**Also included**
- A "partial audit" fixture state — the agent gets blocked before the cart. This is the most common real-world outcome and the UI must handle it gracefully rather than error out.
- Shareable report route (`/report/$id`) so any fixture report has its own URL and metadata.

## Key design decisions

**Score is computed, not guessed.** A rubric in code turns measured signals into the 0-100 number, so the same page always scores the same. An LLM-invented score undercuts the "forensic" framing. The dashboard shows the breakdown.

**Pins come from geometry, not vision guesses.** The report schema keeps `x_percentage`/`y_percentage`, but the intended production path is: the model names the offending element, code reads its bounding box and derives the pin. Asking a model to eyeball percentages on an image is the most fragile part of the original design.

**Selectors over coordinates.** When the browser is wired up, the locate step should hand the model an accessibility-tree candidate list and take back a selector, with coordinate-clicking only as fallback. Far higher success rate, same agentic story.

**Metrics named honestly.** `window.performance.timing` is deprecated and TTI isn't measurable from it. The schema uses Navigation Timing L2 / PerformanceObserver fields (LCP, CLS, TBT, DOM content loaded, transfer size).

## Technical notes

- `src/lib/audit-schema.ts` — zod schema + inferred `ForensicAuditReport` type, shared by fixtures, UI, and the eventual live path.
- `src/lib/fixtures/` — 3-4 complete reports including one partial/blocked run.
- `src/lib/audit-runner.ts` — one `runAudit(url)` interface. Fixture implementation now; hosted-browser implementation later, same signature, no UI changes.
- `src/lib/scoring.ts` — deterministic rubric.
- Routes: `/` (input + recents), `/audit/$runId` (terminal → dashboard), `/report/$id` (shareable result). Each gets its own `head()`.
- Screenshots: generated fixture images in `src/assets/`, imported directly.
- Motion via Motion for React: staggered tile entrance, terminal line-by-line, `-translate-y-0.5` plus shadow on primary hover.

## Not in this build

Live browsing, the AI call, persistence, and auth. When you're ready, the next step is a hosted browser account plus a Cloud-backed job table — `runAudit` is the only file that changes shape, and the mock reports stay as demo mode.
