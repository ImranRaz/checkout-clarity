# CoherentX

**Conversion forensics for the entire customer journey.**

CoherentX is an autonomous audit platform that evaluates how a real shopper, guest, or traveler experiences your site — from first landing page through search, product detail, cart, and guest checkout. Drop in any URL and one or more specialized agents will inspect the live site, capture evidence, and return a prioritized, shareable report with exact screenshots and measurable fixes.

It is built as a production-grade, multi-agent product: a full-stack React frontend, a remote browser worker, deterministic scoring, multi-modal reasoning, and persistent audit history.

---

## What it does

1. **Funnel Agent** — Drives a real Chrome session through your site (homepage → category/search → product/detail → cart/booking summary). It captures screenshots, measures Web Vitals, records console errors, and runs deterministic UX/friction rules at every stage.
2. **Reputation Agent** — Browser-free research across customer review sources. It profiles the brand, discovers where people are talking, clusters praise and complaints, and surfaces the themes that actually hurt conversion.
3. **Synthesis** — Cross-references funnel findings with reputation themes so you can see problems from both sides: what the site does to shoppers *and* what shoppers say about you.
4. **Executive summary** — Scores are grouped into four pillars (Clarity, Trust, Effort, Speed) across stages, with the weakest link and the single best fix to make first.
5. **Shareable reports** — Every audit gets a permalink, a read-only share link for prospects, and a PDF export.
6. **Persistent history** — Runs are saved to Lovable Cloud so you can compare improvements over time.

The platform works across industries: DTC e-commerce, marketplaces, cruise and travel booking, hospitality, SaaS trials, and any other multi-step conversion funnel.

---

## The agents

### Funnel Agent (browser-based)

A custom **Observe → Plan → Act** loop built on the Vercel AI SDK and Stagehand. It is not a LangChain/LangGraph wrapper — the orchestration is explicit TypeScript so every decision is inspectable.

1. **Observe** — Screenshot, accessibility tree, DOM metrics, console errors, Web Vitals.
2. **Classify** — Identify the current stage (listing, product detail, variant picker, mini-cart, cart summary, booking form).
3. **Plan** — Ask the LLM for the single best next action to move toward a completed cart or booking.
4. **Act** — Execute via accessibility-aware targeting, wait for the page to settle, and loop.
5. **Recover** — Detect and dismiss interstitials (cookie banners, newsletters, popups, age gates).
6. **Audit** — Run deterministic friction rules and a vision UX review after each meaningful stage.

The agent is domain-agnostic: the same engine drives a sneaker PDP, a furniture category, or a multi-step cruise booking funnel. Partial runs are still scored provisionally so you never waste Browserbase minutes.

### Reputation Agent (browser-free)

Uses HTTP research and LLM analysis to build a Voice-of-Customer report without opening a browser.

- Profiles the homepage to extract brand, category, and location.
- Discovers review sources across the web, prioritizing category-specific platforms and local listings.
- Aggregates ratings, volume, and trend direction.
- Clusters praise and complaint themes with representative quotes.
- Cross-references complaints with funnel findings (e.g., “shoppers say sizing is confusing, and the size guide is 78% down the product page”).

### Discovery Agent (roadmap)

A planned third agent focused on **Answer Engine Optimization (AEO)** and **Generative Engine Optimization (GEO)**: measuring whether your brand is cited inside ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews, plus the classic SEO hygiene that makes citation possible.

---

## Architecture

### Frontend

- **Framework:** TanStack Start v1 (React 19, full-stack, edge-first)
- **Styling:** Tailwind CSS v4 + shadcn/ui primitives
- **Design:** Warm paper background with deep teal primary, Bricolage Grotesque headings + IBM Plex Mono for technical data
- **Hosting:** Lovable Cloud / edge runtime

### Backend / Data

- **Database:** Lovable Cloud (Supabase) — `audit_runs` table with row-level security
- **Server functions:** `createServerFn` from `@tanstack/react-start` for app-internal calls
- **Public APIs:** TanStack server routes under `src/routes/api/public/*` for webhooks, probes, and thumbnails

### Browser Agent Worker

- **Runtime:** Node.js 20+ (the Lovable edge runtime cannot host a real browser)
- **Browser:** Browserbase + Stagehand (remote Chrome with CDP)
- **Model interface:** Vercel AI SDK with OpenAI-compatible models
- **Deployment:** Render web service (or local via the CLI)

The frontend and worker communicate via a long-poll job API: `POST /run` returns a `job_id`, then `GET /run/:job_id` streams step logs and the final report.

---

## Key design decisions

- **No coordinate guessing.** Clicks are resolved via Stagehand's accessibility-aware targeting, not raw x/y coordinates from a vision model.
- **Reproducible scoring.** Scores are computed deterministically in code from real measurements, not by asking an LLM to guess a number.
- **Fixture-first fallback.** Curated demo audits keep the portfolio UI presentable even when browser minutes are exhausted.
- **Key rotation.** Multiple Browserbase API keys are supported for both preflight checks and live agent runs.
- **Error transparency.** Quota errors, bot blocks, and closed browser sessions are surfaced in plain English in the live terminal.
- **Partial-run safety.** If a session is interrupted, the captured stages are still scored and saved instead of returning a blank failure.

---

## Running locally

### Frontend

```bash
npm install
npm run dev
```

The app runs on Vite and expects the Supabase environment variables from `.env` (see `.env.example`).

### Agent worker

```bash
cd agent-worker
npm install
export BROWSERBASE_API_KEY="bb_live_..."
export OPENAI_API_KEY="sk-..."
export AGENT_SHARED_SECRET="any-shared-secret"
node src/cli.js "https://example.com/products/thing"
```

For the full local server with job polling:

```bash
cd agent-worker
npm install
export AGENT_SHARED_SECRET="any-shared-secret"
npm start
```

Expose `localhost:3000` through a tunnel (ngrok / Cloudflare Quick Tunnel) and set the tunnel URL as `AGENT_WORKER_URL` in your Lovable Cloud secrets to have the frontend talk to your local worker.

---

## Security notes

- No API keys, bearer tokens, or browser keys are hardcoded in the source.
- Secrets are stored in **Lovable Cloud secrets** (or Render environment variables for the worker) and read inside server handlers at runtime.
- Before making the repository public, remove `.env` from git tracking if it exists:

  ```bash
  git rm --cached .env
  git commit -m "chore: remove .env from tracking"
  ```

  If a project ID or secret has already been pushed and you want to scrub it from history, use `git filter-repo` or BFG Repo-Cleaner on a private clone before switching the repository public.

---

## Why this project is useful

- **Portfolio piece:** Shows how to architect a full multi-agent product — not just a chatbot, but agents that research, browse, reason, score, and report back.
- **Thought leadership:** Demonstrates the difference between deterministic evaluation and LLM reasoning, and why a hybrid approach is right for audit and scoring products.
- **Reusable pattern:** The Observe-Plan-Act loop + worker split can be adapted to any other browser-automation agent (research, QA, compliance, etc.).

---

## Built with

- [Lovable](https://lovable.dev) — AI-assisted product builder
- [TanStack Start](https://tanstack.com/start) — full-stack React framework
- [Browserbase](https://browserbase.com) — remote Chrome infrastructure
- [Stagehand](https://stagehand.dev) — AI web browsing framework
- [Vercel AI SDK](https://sdk.vercel.ai) — model interface and structured outputs
- [Lovable Cloud](https://lovable.dev) — backend, auth, and storage

---

## Live site

- **Marketing site:** https://www.coherentx.com

---

## Development

Prefer working locally? You need Node.js 20+ and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
