# Checkout Forensic — Agent Worker

The Lovable app runs on an edge runtime, which cannot host a real browser or a long-lived session. This is the Node half: it drives a real Chrome in Browserbase from a starting URL through to a cart or booking summary, and returns a report in the exact shape the dashboard renders.

## What makes this agent different

This is **not a LangChain / LangGraph agent**. It is a custom agentic orchestration built with the Vercel AI SDK (`ai`) and an explicit **Observe → Plan → Act** loop. The model is asked to pick one action at a time from a constrained set, while deterministic code handles measurement, state tracking, and recovery.

## Run locally

```bash
cd agent-worker
npm install
export BROWSERBASE_API_KEY=bb_live_...        # your Browserbase key
export BROWSERBASE_API_KEYS=k1,k2               # optional: rotate across free accounts
export OPENAI_API_KEY=sk-...                    # OpenAI key, or an OpenRouter key
export OPENAI_BASE_URL=                         # optional: https://openrouter.ai/api/v1
export STAGEHAND_MODEL=gpt-4.1-mini             # navigation: cheap + fast
export UX_REVIEW_MODEL=gpt-4.1                  # per-page review council: needs vision + taste
export JOURNEY_REVIEW_MODEL=                    # optional: run-level diagnosis (defaults to UX_REVIEW_MODEL)
export AGENT_SCROLL_STEPS=12                    # scroll pass: max viewport steps per page
export AGENT_SCROLL_SETTLE_MS=250               # pause per step, so lazy media can decode
export AGENT_SCROLL_BUDGET_MS=8000              # hard cap per page — this is billed browser time
node src/cli.js "https://store.com/products/thing"
```

The CLI prints a readable summary of the report to the terminal.

### The scroll pass

Every stage is scrolled top to bottom before it is captured. This is what makes
the rest of the capture honest: lazy images get a chance to decode (so the
screenshot shows product photography instead of grey boxes), layout shift that
happens *after* load becomes observable, and pinned bars, infinite scroll and
the true depth of the buying action can be measured rather than guessed. The
page is returned to the top before the screenshot is taken. Pop-ups are
photographed and read before they are dismissed, so their copy, timing and how
hard they make saying "no" become part of the audit rather than noise.


## Deploy on Render

- **Type:** Web Service (free tier sleeps when idle)
- **Root directory:** `agent-worker`
- **Build:** `npm install`
- **Start:** `npm start`
- **Env vars:** `BROWSERBASE_API_KEY`, `OPENAI_API_KEY`, `AGENT_SHARED_SECRET`
- **Optional:** `BROWSERBASE_PROXIES=true` (paid plan) and `BROWSERBASE_STEALTH=true` (Enterprise "Verified mode"). Leave both unset on the free plan — requesting them there makes session creation fail with 402/403.

Then `POST /run` with `{ "url": "..." }` and an `Authorization: Bearer <AGENT_SHARED_SECRET>` header. It returns `202 { "job_id": "..." }` immediately — a journey takes 1–3 minutes, longer than the 100s edge timeout in front of Render (that's the HTTP 524 the app used to show). Poll `GET /run/:job_id` for `{ status, steps, elapsed_ms, report }`; the `steps` array streams the agent's live log while the run is still going.

## Endpoints

- `GET /health` — liveness probe
- `POST /run` — start a journey; body `{ url: string }`; returns `{ job_id: string }`
- `GET /run/:job_id` — poll status; returns `{ status, steps, elapsed_ms, error, report }`

## The agent loop

1. **Install observers** — LCP, CLS, long-task, and console-error listeners are injected before navigation.
2. **Observe** — Capture a full-page screenshot, DOM metrics, and accessibility tree.
3. **Classify** — Identify the current page type (listing, product, variant, mini-cart, cart, form, summary, etc.).
4. **Plan** — The LLM picks one next action (click, type, scroll, dismiss, navigate) from a constrained set.
5. **Act** — Execute via Stagehand, wait for the page to settle, and repeat.
6. **Audit** — After each stage, run deterministic friction rules and a vision LLM review, then continue.
7. **Recover** — Interstitials (cookie banners, popups) are cleared by a multimodal dismissal strategy.

## Key rotation

Multiple Browserbase keys can be supplied:

```bash
BROWSERBASE_API_KEYS=bb_live_account1,bb_live_account2
```

Each run starts at the next key round-robin. If a key returns 401/402/403/429, the worker automatically falls forward to the next key and emits a `system` step: `Using cloud browser account ...abc123`. Only when every key fails do you get a plain-English error.

## Targets that work

Shopify, WooCommerce, BigCommerce, and most mid-market storefronts run clean. Walmart, Target, and Amazon serve bot-protection challenges; `proxies: true` and `advancedStealth` improve the odds but nothing guarantees them. A blocked run is recorded as `status: "partial"` with a `blocked_reason` rather than a crash.

## Extending the agent

The loop is domain-agnostic. To add a new journey shape, change the `page classifier` and `planner prompt` in `src/agent.js`; the rest of the engine (metrics, friction rules, recovery, screenshots) stays the same.
