# Public marketing site + gated console + shareable read-only reports

Three parts: a real marketing home page anyone can see, the working product moved behind an invite-only login, and a send-anywhere read-only report link you use as the door-opener.

## 1. Marketing page at `/` (public)

Same visual language as the console — mono labels, tiles, severity colors — so the marketing page *is* the proof. Sections, in order:

1. **Hero.** Positioning line: *"Your checkout is leaking revenue. We'll show you where — pixel by pixel."* Sub: an agent walks your store the way a shopper does — category, product, cart, guest checkout — and reports the copy, cost surprises, effort and speed problems that kill orders. Primary CTA "See a live sample report", secondary "Request access". Right side: a real captured screenshot with the numbered finding pins animating in — the money shot, taken from an existing run.
2. **The problem, in one line of proof.** Three stat tiles from actual runs (stages walked, findings surfaced, console errors caught) — not invented benchmarks.
3. **What we look at.** Four cards mapped to the real pillars: Copy & clarity, Cost & surprise (late fees, pre-ticked add-ons), Effort (steps, forms, variant traps), Speed & stability (LCP/CLS, errors) — each with one concrete example finding pulled from the fixtures.
4. **How it works.** Three steps: point at any page → the agent finds its own way to cart and guest checkout → you get a scored report pinned to the pixels. Emphasize: no tag, no code, no access to your site needed.
5. **Sample reports.** The existing fixture rail, restyled as feature cards with the site capture; each opens a read-only report view so a visitor can explore a full audit without an account.
6. **Why it's different.** Short contrast block: page-speed tools grade a URL; this walks the purchase. Scores come from a fixed rubric, not a model's opinion; every finding is anchored to the exact element in the exact screenshot.
7. **CTA band.** "Want this run on your store?" → email/contact CTA. Footer with the rubric/pins honesty line already on the site.

Copy rules: one idea per section, verbs over adjectives, no "AI-powered" filler, no invented customer logos, testimonials, or metrics.

## 2. Login (invite-only, simple)

- New public `/auth` page: email + password sign-in, plus Google. No sign-up form — you create accounts from the backend, so nobody can self-register.
- The console moves behind the gate: `/app` (run form + recent audits), `/app/audit/$runId`, `/app/audit/live`.
- Signed-in header shows the account email and a sign-out button.


## 3. Shareable read-only report link

- From any finished report, a **Share** button mints a link like `/r/9f3c2a…` (random, unguessable token). You copy it and send it.
- What the recipient sees at that link:
  - The report dashboard in read-only mode: findings, evidence, screenshots, score, metrics.
  - No run form, no rerun, no delete, no links into the app, no nav back to the console.
  - A branded footer CTA ("Audited by Checkout Forensic — talk to us") so it works as outreach.
- Link management (on the report page, signed in): copy link, see view count and last viewed, set optional expiry, revoke.
- Shared pages are `noindex` and carry per-report title/description so a pasted link previews with the domain audited.

## 4. Data + security

- `share_links` table: `token` (primary), `run_id`, `created_by`, `created_at`, `expires_at`, `revoked`, `view_count`, `last_viewed_at`.
- Tighten `audit_runs`: today anyone can read, insert and delete it. New policies — read/write only for authenticated users; anonymous access removed entirely.
- The public share route does **not** query the table as an anonymous user. A server function takes the token, checks it is live and unexpired, then returns just that one report and bumps the view counter. Without a valid token there is no path to any data.
- The screenshot/thumbnail endpoint gets the same treatment: it only serves images for a run reachable through a valid share token or a signed-in session.

## Notes on later monetization

This shape leaves room for plans without rework: `share_links` already ties a report to a person, and the protected layout is where a subscription/seat check would slot in. Nothing here needs to be undone to add billing.

## Technical detail

- Supabase email/password + Google provider; the managed `_authenticated` layout gates the subtree client-side.
- Share reads go through a public `createServerFn` using the publishable key with a token-scoped policy; report writes and the run list use `requireSupabaseAuth`.
- `ReportDashboard` gains a `readOnly` prop that hides interactive/navigational chrome; the evidence viewer and findings rail stay fully interactive.
- Marketing page is a public SSR route with its own `head()` metadata and OG tags; fixture sample reports render through the same read-only view as shared links, so there is one report surface to maintain.
- Existing `/audit/*` paths keep working via redirects into `/app/audit/*` so nothing you've already sent breaks.

