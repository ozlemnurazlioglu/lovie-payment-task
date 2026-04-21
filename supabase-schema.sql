-- =============================================================================
-- PayRequest — Database Schema
-- Feature: 001-payment-requests
-- Target Supabase project ref: nyupxgpkqjwskovdrhpf
-- Human-readable contract: specs/001-payment-requests/data-model.md
-- Constitution:              .specify/memory/constitution.md
--
-- Follows Supabase Postgres best practices:
--   - auth.uid() wrapped in (SELECT auth.uid()) inside RLS policies
--   - STABLE SECURITY DEFINER helper for per-query email lookup
--   - Indexes on every FK column; partial indexes where applicable
--   - CHECK constraints enforce monetary/length/no-self-request invariants
--   - SECURITY DEFINER functions use SET search_path = ''
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.request_status AS ENUM (
    'pending', 'paid', 'declined', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. profiles — one-to-one with auth.users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        citext NOT NULL UNIQUE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'User profile mirrored from auth.users by the on_auth_user_created trigger.';

-- -----------------------------------------------------------------------------
-- 4. payment_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email  citext NOT NULL,
  recipient_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_cents     integer NOT NULL,
  note             text,
  status           public.request_status NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  paid_at          timestamptz,
  shareable_link   uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  CONSTRAINT amount_bounds
    CHECK (amount_cents > 0 AND amount_cents <= 1000000),
  CONSTRAINT note_length
    CHECK (note IS NULL OR char_length(note) <= 280),
  CONSTRAINT no_self_request
    CHECK (recipient_id IS NULL OR recipient_id <> sender_id)
);

COMMENT ON TABLE public.payment_requests IS
  'One row per P2P payment request. See specs/001-payment-requests/data-model.md.';
COMMENT ON COLUMN public.payment_requests.amount_cents IS
  'Amount in integer cents (constitution Principle 1). $50.00 = 5000.';

-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS payment_requests_sender_idx
  ON public.payment_requests (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_requests_recipient_idx
  ON public.payment_requests (recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_requests_recipient_email_idx
  ON public.payment_requests (recipient_email)
  WHERE recipient_id IS NULL;

CREATE INDEX IF NOT EXISTS payment_requests_expiry_idx
  ON public.payment_requests (expires_at)
  WHERE status = 'pending';

-- (shareable_link has a unique index courtesy of the UNIQUE constraint.)
-- (profiles.email has a unique index courtesy of the UNIQUE constraint.)

-- -----------------------------------------------------------------------------
-- 6. Helper: STABLE SECURITY DEFINER per-query email lookup for RLS
--    Avoids an inline subquery to profiles in every policy clause.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS citext
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT email FROM public.profiles WHERE id = (SELECT auth.uid())
$$;

-- -----------------------------------------------------------------------------
-- 7. Trigger: on new auth.users row, insert into profiles and attach any
--    pending requests previously created for this email.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;

  -- Attach-on-login: link pending requests addressed to this email.
  UPDATE public.payment_requests
     SET recipient_id = NEW.id
   WHERE recipient_email = NEW.email
     AND recipient_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 8. RLS — profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: authenticated read" ON public.profiles;
CREATE POLICY "profiles: authenticated read"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE policies. Trigger handles inserts.

-- -----------------------------------------------------------------------------
-- 9. RLS — payment_requests
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: sender, resolved recipient, or email-matched recipient.
DROP POLICY IF EXISTS "requests: parties can select" ON public.payment_requests;
CREATE POLICY "requests: parties can select"
  ON public.payment_requests
  FOR SELECT
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    OR recipient_id = (SELECT auth.uid())
    OR recipient_email = (SELECT public.current_user_email())
  );

-- INSERT: the sender must be the authenticated user; no self-request.
DROP POLICY IF EXISTS "requests: sender can insert" ON public.payment_requests;
CREATE POLICY "requests: sender can insert"
  ON public.payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND recipient_email <> (SELECT public.current_user_email())
  );

-- UPDATE: only the parties can touch the row at all. The application
-- layer enforces legal status transitions (constitution Principle 4).
DROP POLICY IF EXISTS "requests: parties can update" ON public.payment_requests;
CREATE POLICY "requests: parties can update"
  ON public.payment_requests
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    OR recipient_id = (SELECT auth.uid())
    OR recipient_email = (SELECT public.current_user_email())
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    OR recipient_id = (SELECT auth.uid())
    OR recipient_email = (SELECT public.current_user_email())
  );

-- No DELETE policy — deletes are not a user operation in this app.

-- -----------------------------------------------------------------------------
-- 10. Public shareable-link endpoint
--
--   GET /api/public/[link] uses the anon key. Rather than a permissive RLS
--   policy, we expose a narrow SECURITY DEFINER function that returns only
--   the redacted projection described in spec.md §7 / data-model.md.
--   Knowledge of the shareable_link UUID IS the authorization.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_request(link_id uuid)
RETURNS TABLE (
  amount_cents integer,
  note text,
  sender_email citext,
  status public.request_status,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT pr.amount_cents,
         pr.note,
         p.email AS sender_email,
         pr.status,
         pr.expires_at
    FROM public.payment_requests pr
    JOIN public.profiles p ON p.id = pr.sender_id
   WHERE pr.shareable_link = link_id
$$;

REVOKE ALL ON FUNCTION public.get_public_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_request(uuid) TO anon, authenticated;
