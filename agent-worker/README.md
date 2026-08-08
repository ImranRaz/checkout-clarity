# Checkout Forensic — agent worker

The Lovable app runs on an edge runtime, which cannot host a browser or a
long-lived session. This is the Node half: it drives a real Chrome in
Browserbase from a product URL through to the cart and returns a report in the
exact shape the dashboard already renders.

## Run locally

```bash
cd agent-worker
npm install
export BROWSERBASE_API_KEY=...     # your Browserbase key
export OPENAI_API_KEY=...          # OpenAI key, or an OpenRouter key
export OPENAI_BASE_URL=            # optional: set to https://openrouter.ai/api/v1 for OpenRouter
node src/cli.js "https://store.com/products/thing"
```

## Deploy on Render

- Type: **Web Service** (free tier is fine for demos; it sleeps when idle)
- Root directory: `agent-worker`
- Build: `npm install`
- Start: `npm start`
- Env vars: `BROWSERBASE_API_KEY`, `OPENAI_API_KEY`, `AGENT_SHARED_SECRET`
- Optional: `BROWSERBASE_PROXIES=true` (paid plan) and `BROWSERBASE_STEALTH=true`
  (Enterprise "Verified mode"). Leave both unset on the free plan — requesting
  them there makes session creation fail with 402/403.

Then `POST /run` with `{ "url": "..." }` and an
`Authorization: Bearer <AGENT_SHARED_SECRET>` header.

## What it does per stage

1. Installs LCP / CLS / long-task observers *before* navigation.
2. Classifies the page (category, product, variant, mini-cart, cart).
3. Runs a deterministic in-page friction audit that returns each finding with
   the offending element's bounding box — pins are measured, not guessed.
4. Screenshots full page, then asks for the single next action toward a cart
   containing an item, and repeats (max 8 steps).

## Targets that work

Shopify, WooCommerce, BigCommerce and most mid-market storefronts run clean.
Walmart, Target and Amazon serve bot-protection challenges; `proxies: true`
and `advancedStealth` improve the odds but nothing guarantees them, and a
blocked run is recorded as `status: "partial"` with a `blocked_reason` rather
than a crash.
