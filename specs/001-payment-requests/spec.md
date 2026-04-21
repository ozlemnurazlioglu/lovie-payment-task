# Feature Spec — PayRequest (Peer-to-Peer Payment Requests)

**Feature ID:** `001-payment-requests`
**Owner:** Product
**Status:** Approved for implementation
**Constitution:** [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

---

## 1. Summary

PayRequest is a peer-to-peer payment **request** feature for a consumer
fintech app. A signed-in user creates a request addressed to another user
by email, naming an amount and an optional note. The recipient sees the
request in their dashboard and can **pay** it (simulated — 2–3 second
processing animation, then a `paid` confirmation), **decline** it, or ignore
it until it expires. The sender can **cancel** a request while it is still
pending. Every request has a public **shareable link** so the recipient can
open and act on it without having to find it inside the app.

This feature is a spec-driven rebuild of the classic Venmo / Cash App
"Request" button. It is deliberately scoped to the request lifecycle only —
there is no wallet, no settled-funds tracking, no chat, no social feed.

---

## 2. Goals / Non-goals

### Goals

- Let any signed-in user request money from any other user by email.
- Give both sides a single, trustworthy view of a request's status.
- Simulate a payment flow that is indistinguishable from the real thing at
  the UI layer — loading state, success confirmation, immediate status
  update in both dashboards.
- Expire requests automatically after seven days.
- Produce a shareable link that works without authentication for viewing,
  but requires authentication to act on.

### Non-goals

- Real money movement, bank-account linking, or card tokenization.
- Partial payments, installment plans, or request editing.
- Group requests (split-the-bill). A request has exactly one sender and one
  recipient.
- Push notifications, email notifications, or SMS.
- Profile pictures, avatars, nicknames, or any social feature beyond email.
- Internationalization. All amounts are USD; all copy is English.

---

## 3. Personas & Roles

- **Sender (Requester)** — The signed-in user who creates a request. Owns
  the request record; can cancel while pending.
- **Recipient (Payer)** — The signed-in user whose email appears on the
  request. Can pay or decline while the request is pending and unexpired.
- **Guest** — Anyone opening a shareable link without signing in. Sees
  read-only request details. Must sign in (or create an account) to act.

---

## 4. User Stories

1. **Create request.** As a **sender**, I want to enter a recipient email,
   an amount, and an optional note, so I can ask a friend for money they
   owe me.
2. **See incoming.** As a **recipient**, I want to see all pending requests
   addressed to me in one tab of my dashboard, so I don't miss any.
3. **See outgoing.** As a **sender**, I want to see all requests I've sent
   in the other tab, with their current status, so I know who still owes
   me.
4. **Pay.** As a **recipient**, I want to tap "Pay" and watch a 2–3 second
   processing animation, then see a success confirmation, so the
   interaction feels like a real payment.
5. **Decline.** As a **recipient**, I want to decline a request so the
   sender sees I'm not paying.
6. **Cancel.** As a **sender**, I want to cancel a request I sent by
   mistake, as long as it hasn't been paid or declined yet.
7. **Shareable link.** As a **sender**, I want to copy a public link to
   the request so I can paste it into WhatsApp without hunting for the
   recipient's email inside the app.
8. **Auto-expire.** As a **sender**, I want pending requests to auto-expire
   after 7 days, so they don't linger forever as dead social debt.
9. **Filter and search.** As either party, I want to filter by status and
   search by counterparty email, so I can find a specific request in a
   long list.

---

## 5. Functional Requirements

Numbered so they can be referenced in tests and tasks.

**FR-1 — Request creation**
Sender submits `{ recipient_email, amount_cents, note? }`. Server creates
a `payment_requests` row with `status = 'pending'`,
`created_at = now()`, `expires_at = now() + 7 days`, and a fresh
`shareable_link UUID`. Responds with the full request object.

**FR-2 — Self-request prevention**
If `recipient_email` equals the authenticated user's own email, the
server rejects with `400 Bad Request` and a human-readable message.

**FR-3 — Recipient existence**
If no user with `recipient_email` exists yet, the request is still
created, but in a separate sub-state: `recipient_user_id` is null. The
recipient will "attach" to it the first time they sign in with that
email. (MVP deferral: see §14.)

**FR-4 — Amount bounds**
Amount must satisfy `1 ≤ amount_cents ≤ 1_000_000` (i.e. $0.01 to
$10,000.00). Outside that range → `400`.

**FR-5 — Note length**
Note is optional. If provided, trimmed length must be ≤ 280 characters.
Otherwise → `400`.

**FR-6 — List requests**
Authenticated `GET /api/requests` returns two arrays:
`{ outgoing: [...], incoming: [...] }`. Both sorted by `created_at DESC`.
Honors optional query params `?status=pending|paid|declined|expired|cancelled`
and `?q=<email-or-note-substring>`.

**FR-7 — Request detail**
Authenticated `GET /api/requests/:id` returns the full request iff the
caller is sender or recipient. Otherwise `403`.

**FR-8 — Pay**
`POST /api/requests/:id/pay` by the recipient transitions `pending →
paid` atomically. The handler sleeps 2 seconds server-side to simulate
processing (the UI also animates). Expired → `410`. Non-pending →
`409`. Not recipient → `403`.

**FR-9 — Decline**
`POST /api/requests/:id/decline` by the recipient transitions
`pending → declined`. Same error contract as Pay, minus the 2-second
sleep.

**FR-10 — Cancel**
`POST /api/requests/:id/cancel` by the sender transitions
`pending → cancelled`. Same error contract as Decline. Not sender →
`403`.

**FR-11 — Shareable link (public view)**
`GET /api/public/:link` returns a redacted view: amount, note,
sender_email, status, expires_at. No auth required. Unknown link →
`404`. Expired and terminal states still return the record (read-only)
so the recipient sees why their action won't work.

**FR-12 — Shareable link (public pay)**
The `/pay/:link` page is public-readable but gated: action buttons are
disabled until the user signs in. After signing in, if the signed-in
email matches the recipient, the page calls `/api/requests/:id/pay` (or
`decline`). If it doesn't match, the page shows a "this request isn't
addressed to you" error.

**FR-13 — Expiration enforcement**
No mutation accepts an expired request. The server enforces
`expires_at > now()` in every `UPDATE` guard. Expired requests render
in the UI with a distinct badge and disabled actions.

**FR-14 — Countdown**
The detail page shows a live countdown (e.g. "expires in 3d 4h").
The countdown is recomputed client-side from `expires_at`.

**FR-15 — Terminal states are terminal**
Once a request is `paid`, `declined`, `cancelled`, or `expired`, no
further transitions are allowed. `409` on any mutation.

---

## 6. Data Model (abbreviated)

Full schema in [`data-model.md`](./data-model.md).

- `profiles (id uuid PK → auth.users, email citext unique, display_name,
  created_at)`
- `payment_requests (id uuid PK, sender_id uuid FK → profiles, recipient_email
  citext, recipient_id uuid FK → profiles nullable, amount_cents integer
  CHECK > 0, note text, status enum, created_at, expires_at, paid_at,
  shareable_link uuid unique)`

---

## 7. States & Transitions

```
                    create
                       │
                       ▼
                  ┌─────────┐
                  │ pending │
                  └────┬────┘
        ┌──────────────┼──────────────┬──────────────┐
        │ pay          │ decline      │ cancel       │ 7d elapsed
        ▼              ▼              ▼              ▼
   ┌────────┐     ┌──────────┐   ┌──────────┐   ┌─────────┐
   │  paid  │     │ declined │   │cancelled │   │ expired │
   └────────┘     └──────────┘   └──────────┘   └─────────┘
```

All four terminal states are absorbing — no transitions out.

---

## 8. Validation Rules

| Field             | Client                                      | Server (Zod)                                     | DB (CHECK)             |
| ----------------- | ------------------------------------------- | ------------------------------------------------ | ---------------------- |
| `recipient_email` | required, RFC-5322 shape, ≠ own email       | `z.string().email().toLowerCase()`, ≠ caller     | `citext`, non-empty    |
| `amount_cents`    | integer, 1 ≤ x ≤ 1_000_000                  | `z.number().int().min(1).max(1_000_000)`         | `CHECK (> 0)`          |
| `note`            | optional, trimmed, ≤ 280 chars              | `z.string().max(280).optional()`                 | `CHECK (length ≤ 280)` |

Dollar amounts entered as `"50.00"` in the UI are converted to cents
(`5000`) client-side before submission. The server never accepts
dollar-decimal input.

---

## 9. Error Handling

| Condition                             | HTTP | Body shape                                   |
| ------------------------------------- | ---- | -------------------------------------------- |
| Missing/invalid auth                  | 401  | `{ error: "unauthenticated" }`               |
| Validation failure                    | 400  | `{ error: "validation", issues: [...] }`     |
| Not your request                      | 403  | `{ error: "forbidden" }`                     |
| Request not found / link not found    | 404  | `{ error: "not_found" }`                     |
| Already terminal (paid/declined/…)    | 409  | `{ error: "conflict", status: <terminal> }`  |
| Expired                               | 410  | `{ error: "expired" }`                       |
| Unexpected server error               | 500  | `{ error: "server" }` (log details server)   |

---

## 10. Edge Cases

- **Recipient signs up later.** A request created before the recipient
  existed attaches by email on their first login (see §14).
- **Two tabs, double-tap Pay.** One wins, one gets `409` (Principle 4).
- **Sender cancels while recipient is paying.** One of them wins
  deterministically; the other sees `409`.
- **Clock skew on the countdown.** Client computes countdown from
  `expires_at`; server authoritatively rejects any mutation at or after
  expiry regardless of what the client thinks.
- **Extremely long notes / emoji / RTL.** Truncate at 280 code points
  (not bytes). Display with CSS `word-break: break-word`.
- **Self-request attempt.** Blocked at FR-2 with a friendly message.
- **Invalid shareable-link UUID shape in URL.** `404`, not `400` — we
  don't disclose whether the format was valid.

---

## 11. UX Requirements

See [`plan.md`](./plan.md) §5 for design direction. Spec-level
requirements:

- Mobile-first. All flows must be one-handed on a 375px viewport.
- Amounts are displayed with tabular numerals and two decimal places.
- Status badges use semantic colors only: green (paid), amber
  (pending), red (declined), gray (expired/cancelled).
- Loading states for every async action. "Pay" in particular shows a
  2–3 second indeterminate animation, then the success confirmation.
- Empty states for dashboard tabs with a friendly prompt to create a
  request (outgoing) or explanatory copy (incoming).

---

## 12. Accessibility

- WCAG 2.1 AA contrast on all text and status badges.
- Every interactive element is keyboard-reachable with a visible focus
  ring.
- Status changes announce via `aria-live="polite"`.
- Amount input is `inputMode="decimal"` on mobile.
- No reliance on color alone — every status badge pairs color with
  text.

---

## 13. Security

- All data access goes through Supabase with RLS policies matching the
  table definitions in `data-model.md`.
- Shareable links are unguessable v4 UUIDs (122 bits of randomness).
- The public `/api/public/:link` endpoint returns a redacted record
  (no `recipient_email`, no internal IDs).
- No secrets in the client bundle. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is
  the only Supabase key shipped to the browser; it is RLS-gated.
- Cookies are `HttpOnly`, `Secure` (prod), `SameSite=Lax`.

---

## 14. Deferred Decisions (explicit)

- **FR-3 attach-on-login.** MVP creates the request even if the
  recipient doesn't exist yet, but the recipient won't see it in their
  incoming tab until they sign up and a server-side backfill matches
  them by email. For the demo, both test accounts already exist, so
  this path is not exercised. Tracked for post-MVP.
- **Partial payments.** Deferred to v2.
- **Notification channels.** Deferred to v2.

---

## 15. Out of Scope

Real money movement; bank/card linking; KYC; tax reporting;
multi-currency; fraud/AML; audit trails beyond database
`created_at/paid_at`; admin console; i18n.

---

## 16. Acceptance Criteria

- All functional requirements (FR-1 … FR-15) have a corresponding
  Playwright test that exercises the happy path.
- Each error branch (`400`, `403`, `404`, `409`, `410`) has at least one
  integration test hitting the route directly.
- The Playwright suite produces a video recording of the full user
  flow: login → create → share → recipient pays → sender dashboard
  updates → decline flow → cancel flow.
- The live Vercel deployment serves the app at a URL that works without
  local setup, authenticated with the two seed test users.
