# Research — PayRequest

Decisions recorded here are the outcome of the spec-writing phase.
They exist to keep `plan.md` and `tasks.md` decisive and short.

---

## R-1 — Why email + password auth, not magic link

The assignment allows either. Magic links are lovely for real users, but
in this project they are a trap:

1. Supabase rate-limits magic-link sends. The Playwright suite logs in
   ~4 times per run; across local iteration, CI, and demo recordings,
   the rate limit is trivially hit.
2. Magic links require clicking from an inbox. That means either
   asking Playwright to read email (fragile), or using an intercept
   (non-representative of the production path).
3. Email + password is a single form submit — deterministic, fast, and
   idiomatic Playwright.

Security parity is not a concern for a demo app with two seed users.

**Decision:** email + password.

---

## R-2 — Why integer cents, not `numeric(10,2)`

Both would be correct in isolation. We picked `INTEGER` because:

1. The constitution says so (Principle 1).
2. Integer math is exact in every language we touch (JS, TS, SQL), so
   there is no impedance mismatch when the value crosses layers.
3. The amount ceiling ($10,000 = 1,000,000 cents) fits comfortably in
   a 32-bit signed integer, with room for the extension we don't plan
   to build.

**Decision:** `amount_cents INTEGER CHECK (amount_cents > 0)`.

---

## R-3 — Why a status enum, not a status table

A table would let us add columns like `label` or `color` per status,
and would let us change the list without a migration. We don't need
either — the five statuses are final per the spec, and their UI
representation is hardcoded in `StatusBadge`. An enum gives us
exhaustiveness checking in TypeScript via codegen or manual mirroring.

**Decision:** Postgres enum `request_status`.

---

## R-4 — Why `expires_at` stored, not computed

We considered computing `created_at + interval '7 days'` on read. But:

1. Storing it lets us index `(status, expires_at)` for an efficient
   sweeper job, should we add one.
2. If the expiration policy ever needs to vary (e.g. 14 days for
   first-time users), the field has to be per-row anyway.
3. Storage cost is 8 bytes.

**Decision:** store `expires_at TIMESTAMPTZ NOT NULL`.

---

## R-5 — Shareable link: UUID v4 vs nanoid

Either is unguessable. UUID v4 wins because:

1. Postgres has a native `uuid` type and `gen_random_uuid()` from
   `pgcrypto`, so generation happens at the DB level without app-side
   helpers.
2. The `uuid` type is 16 bytes and comes with an indexable equality
   check — nanoid would be a `text` column with no special support.
3. Nothing about the URL demands a shorter token; shareable links are
   copy-pasted, not typed.

**Decision:** `shareable_link UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`.

---

## R-6 — Pay simulation: client-side delay, server-side delay, or both

The constitution doesn't require a real payment integration. But the
spec says the user should see a 2–3 second processing state that
feels like a real payment.

We do it **server-side**. Reasons:

1. If the delay is client-only, a user could bypass it by curling the
   endpoint directly — which then commits instantly with no
   "processing" experience. For a recorded demo, that's fine. For a
   test of "does this feel like a real payment", that's a regression.
2. Server-side sleep is one line (`await new Promise(r => setTimeout(r, 2000))`).
3. Playwright's video will capture the loading animation as a real
   round-trip, which reads better in the demo.

**Decision:** 2-second server-side sleep inside `POST /pay`. The UI
also shows an optimistic loading indicator starting on submit.

---

## R-7 — Sorting and pagination

MVP shows all requests for the user (both directions) with no
pagination. With the seed data and demo usage, list length is
bounded at low tens. A future iteration would add
`created_at < cursor` keyset pagination; until then, an `ORDER BY
created_at DESC LIMIT 100` keeps the worst case sane.

**Decision:** client-side filter + search over a 100-row server-side
cap. No pagination UI.

---

## R-8 — Where to enforce Principle 4

The race-safe guard can live in:

1. Application code (`UPDATE … WHERE status = 'pending'` in the
   route handler).
2. A Postgres trigger that raises an exception on an invalid
   transition.
3. Both.

We pick (1) only. The handler is the only caller, we control it
end-to-end, and a trigger adds complexity (and a failure path that
looks like a 500 instead of a 409 to the client). If we ever add a
second caller (admin tool, backfill job), we'll promote the guard to
a trigger.

**Decision:** guarded `UPDATE` in route handlers; check
`rowsAffected`.

---

## R-9 — Server component vs client component boundaries

All pages are server components by default. Components become client
components (`"use client"`) only when they need:

- form state or input (`AmountInput`, `LoginForm`, create form)
- timers / countdowns (`ExpirationCountdown`)
- click-driven async with optimistic UI (`RequestActions`)

The dashboard page is a server component that fetches data via the
server Supabase client and renders `RequestCard`s (server). Tabs are
provided by a client component that wraps server-rendered lists.

**Decision:** server-first, client only for interactivity.

---

## R-10 — Vercel deployment

Vercel project lives under
`ozlemnurnazlioglu2002-9289s-projects` per CLAUDE.md. Env vars set
in the project's Environment settings. No custom CI — Vercel's Git
integration runs the build on push. We'll also keep `vercel --prod`
as a manual fallback for the recording.

**Decision:** Git-integrated deploy, `main` → production.
