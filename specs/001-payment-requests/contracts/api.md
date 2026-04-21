# API Contract — PayRequest

All endpoints live under `src/app/api/`. All responses are JSON
unless noted. All timestamps are ISO-8601 strings in UTC.

Common error shape (see spec §9):

```ts
type ErrorBody =
  | { error: 'unauthenticated' }
  | { error: 'validation'; issues: Array<{ path: string; message: string }> }
  | { error: 'forbidden' }
  | { error: 'not_found' }
  | { error: 'conflict'; status: 'paid' | 'declined' | 'cancelled' }
  | { error: 'expired' }
  | { error: 'server' };
```

Common success shape for a single request:

```ts
type PaymentRequest = {
  id: string;                 // uuid
  sender_id: string;          // uuid
  sender_email: string;       // joined from profiles
  recipient_email: string;
  recipient_id: string | null;
  amount_cents: number;
  note: string | null;
  status: 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  shareable_link: string;     // uuid
};
```

---

## 1. `GET /api/requests`

**Auth:** required.
**Query params:**

- `status` (optional) — one of the five enum values.
- `q` (optional) — case-insensitive substring matched against
  `recipient_email`, `sender_email`, and `note`.

**200:**

```ts
{
  outgoing: PaymentRequest[];   // where sender_id = me
  incoming: PaymentRequest[];   // where recipient_id = me OR recipient_email = my email
}
```

Each array sorted `created_at DESC`, capped at 100.

**401** if no session.

---

## 2. `POST /api/requests`

**Auth:** required.
**Body:**

```ts
{
  recipient_email: string;   // email
  amount_cents: number;      // integer, 1..1_000_000
  note?: string;             // ≤ 280 chars
}
```

**201:** `PaymentRequest` (the newly created row).

**400:**

- `validation` — malformed input.
- shape `{ error: 'validation', issues: [{ path: 'recipient_email',
  message: 'Cannot request money from yourself' }] }` for self-requests.

**401** if no session.

---

## 3. `GET /api/requests/[id]`

**Auth:** required.

**200:** `PaymentRequest`.

**403** if the caller is neither sender nor recipient.
**404** if the id doesn't exist (or RLS hides it — same externally).

---

## 4. `POST /api/requests/[id]/pay`

**Auth:** required. Caller must be recipient.

**Behavior:**

1. Verify the request is the caller's (otherwise 403).
2. `UPDATE payment_requests SET status='paid', paid_at=now() WHERE id=$id
   AND status='pending' AND expires_at > now() RETURNING *`.
3. If 0 rows affected:
   - Re-read the row to distinguish terminal state vs expired vs not found.
   - Return `409` (terminal) or `410` (expired) or `404`.
4. Else sleep 2000ms then return the updated row.

**200:** updated `PaymentRequest`.
**403 / 404 / 409 / 410** per spec §9.

---

## 5. `POST /api/requests/[id]/decline`

**Auth:** required. Caller must be recipient.

**Behavior:** same as Pay but without the 2-second sleep and setting
`status='declined'`; `paid_at` is not touched.

**200:** updated `PaymentRequest`.
**403 / 404 / 409 / 410** per spec §9.

---

## 6. `POST /api/requests/[id]/cancel`

**Auth:** required. Caller must be sender.

**Behavior:** `UPDATE … SET status='cancelled' WHERE id=$id AND
sender_id = $me AND status='pending'`. No `expires_at` guard — you
can still cancel an expired pending request, though that's cosmetic.

**200:** updated `PaymentRequest`.
**403** if not sender.
**404** if id doesn't exist.
**409** if already terminal.

---

## 7. `GET /api/public/[link]`

**Auth:** none.

**200:**

```ts
{
  amount_cents: number;
  note: string | null;
  sender_email: string;
  status: 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';
  expires_at: string;
}
```

**404** if `link` isn't a valid UUID or doesn't match any row.

The endpoint is intentionally world-readable: the shareable_link UUID
itself is the capability. We do not return `id`, `recipient_email`, or
`recipient_id` to avoid leaking more than the share itself implies.
