# Implementation Plan — PayRequest

**Feature:** `001-payment-requests`
**Spec:** [`spec.md`](./spec.md)
**Constitution:** [`../../.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

---

## 1. Tech Stack

| Layer           | Choice                                   | Why                                                                 |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Framework       | Next.js 14 (App Router)                  | Server components + route handlers in one place; Vercel-native.     |
| Language        | TypeScript, `strict: true`, no `any`     | Catches money-unit bugs at compile time.                            |
| DB + Auth + RLS | Supabase (managed Postgres)              | RLS out of the box; MCP server drives schema from Claude.           |
| SSR auth        | `@supabase/ssr`                          | Correct cookie handling for App Router.                             |
| Styling         | Tailwind CSS + shadcn/ui                 | Utility-first + accessible primitives. Matches fintech design.      |
| Validation      | Zod                                      | Same schema on client and server per Principle 3.                   |
| E2E testing     | Playwright (`@playwright/test`)          | Video + trace + screenshot built in.                                |
| Hosting         | Vercel                                   | Zero-config Next deploy; preview per PR.                            |

**Explicit non-choices:** no ORM (direct Supabase client), no state
library (server components + React `useState`), no CSS-in-JS (Tailwind
only), no animation library (Tailwind transitions + CSS keyframes).

---

## 2. Architecture Overview

```
         ┌──────────────────────── Browser ─────────────────────────┐
         │                                                          │
         │  React Server Components  ─┐                             │
         │  Client Components (forms) │ via /api/* route handlers   │
         │                            │                             │
         └────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
         ┌──────────────────────── Next.js (Vercel) ────────────────┐
         │                                                          │
         │  middleware.ts          →  refresh Supabase session      │
         │  (protected) layout     →  require session or redirect   │
         │  app/api/requests/*     →  Zod-validate + query Supabase │
         │  lib/supabase/server.ts →  server-side Supabase client   │
         │  lib/supabase/client.ts →  browser-side Supabase client  │
         │                                                          │
         └──────────────────────────────────────────────────────────┘
                                      │
                                      ▼
         ┌──────────────────────── Supabase ────────────────────────┐
         │                                                          │
         │  Postgres:                                               │
         │    - profiles (RLS: self-read)                           │
         │    - payment_requests (RLS: sender_id OR recipient_id)   │
         │    - trigger: auth.users insert → profiles               │
         │  Auth: email + password                                  │
         │                                                          │
         └──────────────────────────────────────────────────────────┘
```

---

## 3. File Layout

```
src/
├── app/
│   ├── (protected)/
│   │   ├── layout.tsx              ← redirects unauth'd users to /login
│   │   ├── dashboard/
│   │   │   └── page.tsx            ← incoming/outgoing tabs
│   │   ├── requests/
│   │   │   ├── new/
│   │   │   │   └── page.tsx        ← create-request form
│   │   │   └── [id]/
│   │   │       └── page.tsx        ← detail + pay/decline/cancel
│   │   └── signout/
│   │       └── route.ts            ← POST signs out, redirects to /login
│   ├── api/
│   │   ├── requests/
│   │   │   ├── route.ts            ← GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts        ← GET detail
│   │   │       ├── pay/route.ts    ← POST pay
│   │   │       ├── decline/route.ts← POST decline
│   │   │       └── cancel/route.ts ← POST cancel
│   │   └── public/
│   │       └── [link]/route.ts     ← GET (no auth) public view
│   ├── login/
│   │   └── page.tsx                ← email + password form
│   ├── pay/
│   │   └── [link]/page.tsx         ← public pay page
│   ├── layout.tsx                  ← root layout (fonts, globals)
│   ├── page.tsx                    ← marketing/redirect
│   └── globals.css                 ← Tailwind base + design tokens
├── components/
│   ├── ui/                         ← shadcn/ui primitives
│   ├── RequestCard.tsx
│   ├── StatusBadge.tsx
│   ├── AmountInput.tsx             ← dollar input, emits cents
│   ├── AmountDisplay.tsx           ← cents → "$50.00"
│   ├── ExpirationCountdown.tsx     ← live "expires in 3d 4h"
│   ├── RequestActions.tsx          ← Pay/Decline/Cancel buttons
│   └── EmptyState.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← browser Supabase client
│   │   └── server.ts               ← server Supabase client + middleware helper
│   ├── money.ts                    ← dollars↔cents, format
│   ├── validators.ts               ← Zod schemas shared client+server
│   └── types.ts                    ← domain types
├── middleware.ts                   ← refreshes session cookie on every req
└── (supabase-schema.sql at repo root)

tests/
├── payment-flow.spec.ts            ← full E2E suite
└── fixtures/
    └── users.ts                    ← seeded credentials
```

---

## 4. API Contract

Full contract in [`contracts/api.md`](./contracts/api.md). Seven
endpoints:

| Method | Path                              | Auth  | Purpose                    |
| ------ | --------------------------------- | ----- | -------------------------- |
| GET    | `/api/requests`                   | Req'd | List outgoing+incoming     |
| POST   | `/api/requests`                   | Req'd | Create request             |
| GET    | `/api/requests/[id]`              | Req'd | Request detail             |
| POST   | `/api/requests/[id]/pay`          | Req'd | Transition to paid         |
| POST   | `/api/requests/[id]/decline`      | Req'd | Transition to declined     |
| POST   | `/api/requests/[id]/cancel`       | Req'd | Transition to cancelled    |
| GET    | `/api/public/[link]`              | None  | Redacted public view       |

---

## 5. Design Direction

Clean fintech. Reference feel: Mercury, Linear, Ramp.

- **Palette:** zinc/slate neutral base; **one** accent — emerald
  `#10b981` — for primary actions and `paid`. Status colors are
  semantic-only: green (paid), amber (pending), red (declined), gray
  (cancelled/expired).
- **Typography:** Geist Sans (single family). Tabular numerals for all
  money (`font-variant-numeric: tabular-nums`). Tight tracking on large
  numbers.
- **Radii:** `rounded-xl` on cards, `rounded-lg` on inputs/buttons.
- **Shadows:** subtle — `shadow-sm` baseline, no heavy drop shadows.
- **Spacing:** generous. Dashboard cards use `p-6 gap-4`.
- **No emoji** in product UI. No gradients. No purple.
- **Mobile-first**: all flows work on 375×667; desktop is
  `max-w-3xl mx-auto`.

Enforced by the `frontend-design` skill, which is read before any
`.tsx` write (see CLAUDE.md).

---

## 6. Security Model

- **Auth:** Supabase email + password. Cookies only (no tokens in
  `localStorage`). `middleware.ts` refreshes the session on every
  request so server components see a live user.
- **RLS:** both tables have `ENABLE ROW LEVEL SECURITY`. Policies in
  `data-model.md`. No policy is missing `WITH CHECK` on an
  `INSERT`/`UPDATE`.
- **Principle 4 enforcement:** every mutation handler issues
  `UPDATE … WHERE id = $id AND status = 'pending' AND expires_at > now()`
  and inspects the affected-row count. Zero rows → `409`/`410`.
- **Input validation:** Zod schema in `lib/validators.ts`. Same schema
  re-used by the client form component and the server route handler.
- **Public endpoint:** `/api/public/[link]` returns a redacted record
  (no IDs, no recipient email). The page it feeds shows sender's email
  only because that's the social contract of a shareable link.
- **Secrets:** `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the client. Service-role key
  never leaves the Supabase dashboard; it is not needed for this app.

---

## 7. Testing Strategy

- **No unit tests** in the MVP. Zod schemas are themselves contracts;
  the compiler + RLS + E2E coverage is the test triangle.
- **Integration/E2E** via Playwright (`tests/payment-flow.spec.ts`):
  1. Login as user A.
  2. Create request for user B, $25.
  3. Verify it appears in A's outgoing tab as `pending`.
  4. Copy shareable link.
  5. Sign out; open the link; see the public read-only view.
  6. Log in as user B; see the request in the incoming tab.
  7. Click Pay; observe 2-second loading; observe `paid` badge.
  8. Log back in as A; see the request flipped to `paid`.
  9. Create a second request; B declines; A sees `declined`.
  10. Create a third request; A cancels; list shows `cancelled`.
- **Video/trace/screenshot** on for all runs. `test-results/` carries
  the artifact the assignment asks for.

---

## 8. Deployment

- **GitHub:** `github.com/ozlemnurazlioglu/lovie-payment-task`, branch
  `main`. (Target fixed in CLAUDE.md — do not change.)
- **Vercel:** scope `ozlemnurnazlioglu2002-9289s-projects`. Production
  deploys via `vercel --prod` or Git integration. Env vars:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Supabase:** project ref `nyupxgpkqjwskovdrhpf`. Schema applied via
  Supabase MCP in Step 4.

No CI pipeline for MVP — Playwright runs locally, video attached to
README. Vercel handles build + deploy.

---

## 9. Open Questions — None

All open questions from the spec have landed in §14 (Deferred
Decisions) of the spec, with explicit MVP behavior. Nothing is
blocking implementation.
