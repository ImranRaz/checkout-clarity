# CoherentX

**CoherentX** is an autonomous conversion-friction audit agent for e-commerce and booking funnels. Drop in any product URL — Shopify, WooCommerce, cruise lines, travel bookings — and the agent navigates the real site, captures screenshots, measures performance, and surfaces prioritized UX friction points with exact visual evidence.

Built to demonstrate **agentic orchestration** end-to-end: a production-grade frontend, a remote browser worker, deterministic scoring, multi-modal reasoning, and persistent audit history.

---

## What it does

1. **Preflight check** — The app probes the target URL with Browserbase's fetch/search APIs, classifies the site type, and detects bot protection before spending a full browser session.
2. **Live agent journey** — A remote Node worker opens a real Chrome via Browserbase + Stagehand and navigates freely toward the cart or booking summary.
3. **Multi-stage capture** — Screenshots and technical metrics are collected for each meaningful stage (category → product → variant → cart, or search → results → detail → summary for cruises).
4. **Deterministic friction audit** — Every finding is measured in the DOM (bounding boxes, contrast ratios, timing, console errors) and pinned to the exact screenshot location.
5. **Vision UX review** — A vision-capable LLM reviews the captured pages to catch surface-level issues a DOM-only scan would miss.
6. **Executive summary** — Scores are grouped into four pillars (Clarity, Trust, Effort, Speed) across stages, with the weakest link and the single best fix to make first.
7. **Persistent history** — Live audit runs are saved to Lovable Cloud, so users can compare improvements over time.

---

## Architecture

This is a **custom-built agentic system**, not a LangChain / LangGraph agent. The orchestration is written in plain TypeScript/JavaScript using the **Vercel AI SDK** (`ai`) for the model interface, with an explicit **Observe → Plan → Act** loop that decides the next action based on the current page state.

### Frontend
- **Framework:** TanStack Start v1 (React 19, full-stack, edge-first)
- **Styling:** Tailwind CSS v4 + shadcn/ui primitives
- **Design:** Warm paper background with deep teal primary, Bricolage Grotesque headings + IBM Plex Mono for technical data
- **Hosting:** Lovable Cloud / edge runtime

### Backend / Data
- **Database:** Lovable Cloud (Supabase) — `audit_runs` table with row-level security
- **Server functions:** `createServerFn` from `@tanstack/react-start` for app-internal calls
- **Public APIs:** TanStack server routes under `src/routes/api/public/*` for webhooks / probes

### Browser Agent Worker
- **Runtime:** Node.js 20+ (the Lovable edge runtime cannot host a real browser)
- **Browser:** Browserbase + Stagehand (remote Chrome with CDP)
- **Model interface:** Vercel AI SDK with OpenAI-compatible models (`gpt-4o-mini`, etc.)
- **Deployment:** Render web service (or local via the CLI)

The frontend and worker communicate via a long-poll job API: `POST /run` returns a `job_id`, then `GET /run/:job_id` streams step logs and the final report.

---

## The agent loop

1. **Observe** — Snapshot the current page (screenshot + accessibility tree + DOM metrics + console errors + Web Vitals).
2. **Classify** — Determine whether the page is a listing, product detail, variant picker, mini-cart, cart summary, or booking form.
3. **Plan** — Ask the LLM: *"Given this stage, what is the single best next action to get closer to an item being in the cart / booking summary?"* Options are click, type, scroll, dismiss overlay, or navigate to a known route.
4. **Act** — Execute the chosen action via Stagehand, wait for the page to settle, and loop.
5. **Recover** — If blocked by an interstitial (cookie banner, newsletter popup, age gate), the agent runs a multimodal dismissal strategy before continuing.
6. **Audit** — After each stage, run deterministic friction rules and a vision UX review, then move to the next stage.

The loop is **domain-agnostic** — the same engine drives a sneaker product page, a furniture category, or a multi-step cruise booking funnel.

---

## Key design decisions

- **No coordinate guessing.** Clicks are resolved via Stagehand's accessibility-aware targeting, not raw x/y coordinates from a vision model.
- **Reproducible scoring.** The Forensic Score and pillar scores are computed deterministically in code from real measurements, not by asking an LLM to guess a number.
- **Fixture-first fallback.** The app ships with curated demo audits so the portfolio UI is always presentable even if browser minutes are exhausted.
- **Key rotation.** Both the preflight calls and the live agent support multiple Browserbase API keys, so testing can rotate across free accounts without manual switching.
- **Error transparency.** Browserbase quota errors (402 out-of-minutes) and bot blocks are surfaced in plain English in the live terminal, not buried as cryptic CDP failures.

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
- The tracked `.env` file in earlier commits contained only Supabase **publishable** keys and project metadata. Before making the repository public, remove `.env` from git tracking:

  ```bash
  git rm --cached .env
  git commit -m "chore: remove .env from tracking"
  ```

  If the project ID has already been pushed and you want to scrub it from history, use `git filter-repo` or BFG Repo-Cleaner on a private clone before switching the repository public.

---

## Why this project is useful

- **Portfolio piece:** Shows the ability to architect a full AI-agent product — not just a chatbot, but an agent that drives a real browser, makes decisions, and reports back.
- **Thought leadership:** Demonstrates the difference between deterministic evaluation and LLM reasoning, and why a hybrid approach is right for audit/scoring products.
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

## Project links

- **Lovable editor:** https://lovable.dev/projects/4abd7517-d555-471c-9133-3f63dd37e68d
- **Live preview:** https://id-preview--4abd7517-d555-471c-9133-3f63dd37e68d.lovable.app

This project was built with [Lovable](https://lovable.dev).

## Continue developing

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4abd7517-d555-471c-9133-3f63dd37e68d).

- **Ship faster:** describe what you want to build and Lovable handles the code.
- **Stay in sync:** every change made in Lovable is committed straight to this repository.
- **Full ownership:** this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development (local)

Prefer working locally? You need Node.js 20+ and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
