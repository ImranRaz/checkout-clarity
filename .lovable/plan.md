# Gated app + shareable read-only reports

Two things: lock the product behind a login only you can hand out, and add a public "here's what I found on your site" link that shows one report and nothing else.

## 1. Login (invite-only, simple)

- New public `/auth` page: email + password sign-in, plus Google. No public sign-up form — accounts are created by you from the backend, so nobody can self-register.
- Everything that is the product moves behind the gate: the home page (run form, recent audits, samples) and the live run page.
  - `/` becomes a small public marketing landing with a "Sign in" button.
  - The real console moves to `/app` (dashboard), `/app/audit/$runId`, `/app/audit/live`, all under the protected layout.
- Signed-in header shows the account email and a sign-out button.

## 2. Shareable read-only report link

- From any finished report, a **Share** button mints a link like `/r/9f3c2a…` (random, unguessable token). You copy it and send it.
- What the recipient sees at that link:
  - The report dashboard in read-only mode: findings, evidence, screenshots, score, metrics.
  - No run form, no rerun, no delete, no links into the app, no nav back to the console.
  - A branded footer CTA ("Audited by Checkout Forensic — talk to us") so it works as outreach.
- Link management (on the report page, signed in): copy link, see view count and last viewed, set optional expiry, revoke.
- Shared pages are `noindex` and carry per-report title/description so a pasted link previews with the domain audited.

## 3. Data + security

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
