# PayRequest — Constitution

> Five non-negotiable principles. Every implementation decision, code review,
> and PR in this repository must comply with this document. When a principle
> conflicts with convenience, speed, or cleverness — the principle wins.

---

## Principle 1 — Monetary Integrity

**All monetary amounts are stored as `INTEGER` cents. Floats and decimals are
prohibited anywhere in the money path: database, API payloads, validators,
business logic, and tests.**

- `$50.00` is `5000`. `$0.01` is `1`. Zero and negative amounts are rejected
  at the validator boundary.
- Display conversion (cents → `"$50.00"`) happens only in the presentation
  layer and only through a single shared helper.
- Parsing user input (e.g. `"50"` or `"50.00"`) converts to an integer exactly
  once, at the edge, using deterministic rounding. Any float that exists even
  transiently is a bug.

*Rationale:* IEEE-754 floats misrepresent decimals like `0.1 + 0.2`. In a
fintech context those rounding errors accumulate and become real money that
doesn't reconcile. The integer-cents discipline is the cheapest,
most-established defense.

---

## Principle 2 — Row-Level Security Is Mandatory

**Every table that contains user data has Row Level Security (RLS) enabled
with explicit `USING` and `WITH CHECK` policies. No user, under any condition,
may read or write another user's data.**

- RLS is turned on in the same migration that creates the table — never in a
  follow-up.
- The anon and authenticated API keys are both untrusted. The database is the
  final authority on authorization; the application layer is a convenience,
  not a shield.
- Service-role keys are used only in explicit server-to-server contexts and
  never in code paths that handle unauthenticated requests.

*Rationale:* A bug in our application code (missing `WHERE user_id = $me`,
mis-parsed JWT, leaky ORM) must not become a privacy breach. RLS makes the
database refuse the query regardless of what the app does.

---

## Principle 3 — Inputs Are Validated On Both Sides

**Every mutating endpoint validates its input with a Zod schema on the
server. The same schema — or a structurally identical one — also runs on the
client. The client validator is for UX; the server validator is the
authority.**

- Client-side validation gives instant feedback and prevents obvious
  round-trips. It may never be trusted.
- Server-side validation runs inside the route handler before any database
  call. On failure the handler returns `400` with a machine-readable error
  shape (field → message).
- Validators are defined once and imported by both sides where possible.

*Rationale:* Anything the client enforces, an attacker can bypass with
`curl`. Anything the server enforces without client support gives users a
hostile experience. Both are required; they are not alternatives.

---

## Principle 4 — Status Transitions Are Race-Condition Safe

**Any mutation that depends on the current status of a request must perform
the check and the update in a single SQL statement, guarded by a `WHERE`
clause on the expected status. "Read then write" is forbidden for status
transitions.**

- Pay, decline, cancel, and expire all issue `UPDATE … SET status = $new
  WHERE id = $id AND status = 'pending'` and check the affected-row count.
- If zero rows are affected, the handler returns `409 Conflict` (already in a
  terminal state) or `410 Gone` (expired) — never silently succeeds.
- The database, not the application, resolves concurrent mutations. Two
  users racing to pay and decline the same request: exactly one wins; the
  other sees a deterministic error.

*Rationale:* In any real fintech app, two tabs, a double-tap, or a shareable
link passed around a group chat will produce concurrent writes against the
same row. Losing money, double-paying, or showing inconsistent status in the
two dashboards is not recoverable by apology.

---

## Principle 5 — Requests Have A Time-Bounded Lifecycle

**Every payment request carries an `expires_at` timestamp set to
`created_at + 7 days`. Requests past their expiration cannot be paid and
cannot be resurrected. Expiration is enforced at the database level, not
only at the UI level.**

- The `pay` and `accept` mutations add `AND expires_at > now()` to the guard
  clause described in Principle 4. An expired request returns `410 Gone`.
- Expiration transitions can happen lazily (computed on read) or eagerly (a
  scheduled job flips `status` to `expired`). Either is acceptable; both
  enforce the same user-visible behavior.
- Cancelled or paid requests are terminal regardless of `expires_at`.

*Rationale:* Open-ended payment requests become awkward social debt and a
vector for phishing-style reactivation. Seven days is a convention
(consistent with consumer P2P apps) and a forcing function: the sender
re-engages or the request dies.

---

## Scope

These five principles apply to the PayRequest feature and to every future
feature added to this repository. They are enforced by a combination of
code review, type-level constraints, integration tests, and the Playwright
E2E suite.

## Amendments

The constitution may only be amended by a pull request whose description
explains:

1. Which principle is changing and how.
2. What scenario motivated the change.
3. What new tests or policies enforce the amended principle.

Commits that would violate a principle (float money, missing RLS, client-only
validation, unguarded status update, unbounded expiration) must be blocked
in review.
