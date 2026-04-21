# Data Model — PayRequest

All DDL lives in `supabase-schema.sql` at the repo root and is applied
via Supabase MCP `apply_migration` in Step 4. This document is the
human-readable contract.

---

## Extensions

- `pgcrypto` — for `gen_random_uuid()`
- `citext` — for case-insensitive email storage

---

## Enums

```sql
CREATE TYPE request_status AS ENUM (
  'pending',
  'paid',
  'declined',
  'cancelled',
  'expired'
);
```

---

## Table: `profiles`

Mirrors `auth.users` one-to-one. Populated by a trigger on insert.

| Column       | Type          | Notes                                   |
| ------------ | ------------- | --------------------------------------- |
| `id`         | `uuid` PK     | FK → `auth.users(id)` ON DELETE CASCADE |
| `email`      | `citext`      | NOT NULL, UNIQUE                        |
| `display_name` | `text`      | NULL allowed; falls back to email       |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`                |

### Trigger — `on_auth_user_created`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### RLS — `profiles`

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile and any profile that is the
-- counterparty on a request they participate in. For MVP we simplify
-- to "any authenticated user can SELECT any profile by id or email",
-- which is OK given that the table only stores email + display name
-- and there is no sensitive field here. Tighten in v2 if the table
-- grows PII.
CREATE POLICY "profiles: authenticated read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- No client-side inserts/updates/deletes. Trigger handles inserts.
-- Updates to display_name are out of MVP scope.
```

---

## Table: `payment_requests`

One row per payment request.

| Column               | Type             | Notes                                                                    |
| -------------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`                 | `uuid` PK        | `DEFAULT gen_random_uuid()`                                              |
| `sender_id`          | `uuid`           | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE                         |
| `recipient_email`    | `citext`         | NOT NULL                                                                 |
| `recipient_id`       | `uuid`           | NULLABLE, FK → `profiles(id)` ON DELETE SET NULL. Filled on recipient-match. |
| `amount_cents`       | `integer`        | NOT NULL, `CHECK (amount_cents > 0 AND amount_cents <= 1000000)`         |
| `note`               | `text`           | NULL or length ≤ 280                                                     |
| `status`             | `request_status` | NOT NULL DEFAULT `'pending'`                                             |
| `created_at`         | `timestamptz`    | NOT NULL DEFAULT `now()`                                                 |
| `expires_at`         | `timestamptz`    | NOT NULL DEFAULT `now() + interval '7 days'`                             |
| `paid_at`            | `timestamptz`    | NULLABLE; filled on pay transition                                       |
| `shareable_link`     | `uuid`           | NOT NULL UNIQUE DEFAULT `gen_random_uuid()`                              |

### Constraints

```sql
ALTER TABLE public.payment_requests
  ADD CONSTRAINT note_length CHECK (note IS NULL OR char_length(note) <= 280);

ALTER TABLE public.payment_requests
  ADD CONSTRAINT no_self_request
  CHECK (recipient_id IS NULL OR recipient_id <> sender_id);
```

### Indexes

```sql
CREATE INDEX payment_requests_sender_idx
  ON public.payment_requests (sender_id, created_at DESC);

CREATE INDEX payment_requests_recipient_idx
  ON public.payment_requests (recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX payment_requests_recipient_email_idx
  ON public.payment_requests (recipient_email)
  WHERE recipient_id IS NULL;

CREATE INDEX payment_requests_expiry_idx
  ON public.payment_requests (status, expires_at)
  WHERE status = 'pending';

-- shareable_link already has a unique index from the UNIQUE constraint.
```

### RLS — `payment_requests`

```sql
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: sender or recipient can read.
CREATE POLICY "requests: parties can select"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR recipient_email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- INSERT: sender must be the authenticated user; no self-request.
CREATE POLICY "requests: sender can insert"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND recipient_email <> (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: only the two parties, and only to a legal next state.
-- The route handler is primarily responsible for legal transitions
-- (Principle 4). RLS's job here is to prevent third parties from
-- touching the row at all.
CREATE POLICY "requests: parties can update"
  ON public.payment_requests FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR recipient_email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR recipient_email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- No DELETE policy — deletes are not a user operation in this app.
```

### Recipient attach on login (deferred)

If a request is created for an email that doesn't yet have a profile
(i.e. `recipient_id IS NULL`), we intend to backfill `recipient_id`
the first time that email signs in. Two shapes are possible:

1. Extend the `handle_new_user` trigger to `UPDATE payment_requests
   SET recipient_id = NEW.id WHERE recipient_email = NEW.email AND
   recipient_id IS NULL`.
2. Run the same `UPDATE` in `on_first_login` at the app level.

MVP uses (1). Both seed users already exist, so the code path is
exercised only by the trigger definition; no UI reflects this case
yet.

---

## Public view (conceptual)

The `/api/public/[link]` endpoint returns a redacted projection:

```ts
type PublicRequestView = {
  amount_cents: number;
  note: string | null;
  sender_email: string;     // joined from profiles
  status: 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';
  expires_at: string;       // ISO8601
};
```

This is computed by the route handler, not a database view — the view
layer isn't needed and would make RLS messier. The handler uses the
service-role key? **No.** It uses the anon key, because
`shareable_link` is itself the authorization token: knowledge of the
UUID is enough to authorize a read. RLS would need an anonymous-read
policy to support this, or we special-case it in the handler with a
server-side Supabase client bound to the anon key and a plain
`SELECT`. We pick the handler approach and document that the
shareable-link endpoint is intentionally world-readable given the
link.
