# Tasks — PayRequest

Ordered, concrete. Each item is sized for a single atomic commit.

---

## A. Setup

- [ ] A1 — Initialize Next.js 14 App Router project (`package.json`,
      `tsconfig.json` with `strict: true`, `next.config.mjs`).
- [ ] A2 — Install deps: `next`, `react`, `react-dom`, `@supabase/ssr`,
      `@supabase/supabase-js`, `zod`, `clsx`, `tailwind-merge`,
      `lucide-react`, `class-variance-authority`.
- [ ] A3 — Install dev deps: `typescript`, `@types/node`,
      `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`,
      `autoprefixer`, `prettier`, `prettier-plugin-tailwindcss`,
      `eslint`, `eslint-config-next`, `@playwright/test`.
- [ ] A4 — Configure Tailwind (`tailwind.config.ts`) with the design
      tokens from `plan.md` §5 (zinc base + emerald accent, Geist
      Sans).
- [ ] A5 — Install shadcn/ui primitives used: button, card, input,
      label, textarea, badge, tabs, dialog, toast.
- [ ] A6 — Add `.env.local.example` and `.env.local` with
      `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## B. Database (Step 4)

- [ ] B1 — Write `supabase-schema.sql`: `profiles` table,
      `payment_requests` table, `request_status` enum,
      `on_auth_user_created` trigger → `profiles`.
- [ ] B2 — Enable RLS and write policies per `data-model.md`.
- [ ] B3 — Add composite indexes: `(sender_id, created_at desc)`,
      `(recipient_id, created_at desc)`, `(status, expires_at)`,
      `(shareable_link)`.
- [ ] B4 — Apply migration via Supabase MCP
      `apply_migration(project_id='nyupxgpkqjwskovdrhpf', …)`.
- [ ] B5 — Verify with MCP `list_tables` and `execute_sql` (row count
      zero on both tables).
- [ ] B6 — Create two seed users via Supabase Auth Admin:
      `ozlemnurnazlioglu2002@gmail.com` and
      `ozlemtest@gmail.com`, password `test123`, both with `email_confirm`.

## C. Auth (Step 5)

- [ ] C1 — `src/lib/supabase/client.ts` (`createBrowserClient`).
- [ ] C2 — `src/lib/supabase/server.ts` (`createServerClient` with
      cookie read/write helpers for route handlers, RSC, middleware).
- [ ] C3 — `src/middleware.ts` refreshes session on every request and
      redirects unauthenticated access to `/(protected)/**` → `/login`.
- [ ] C4 — `src/app/login/page.tsx`: email + password form, submit
      calls server action / route, friendly error on bad credentials.
- [ ] C5 — `src/app/signout/route.ts`: POST-only, clears session,
      redirects to `/login`.
- [ ] C6 — `src/app/(protected)/layout.tsx`: server-side guard
      (fetches `auth.user`, redirects if null).

## D. Shared libraries

- [ ] D1 — `src/lib/money.ts`: `toCents(dollarString)`,
      `formatCents(n)`, `centsToDollarInput(n)`.
- [ ] D2 — `src/lib/validators.ts`: `createRequestSchema`,
      `requestIdSchema`, `shareLinkSchema`.
- [ ] D3 — `src/lib/types.ts`: `PaymentRequest`, `RequestStatus`,
      `Profile`, `PublicRequestView`.

## E. API routes (Step 6 — backend)

- [ ] E1 — `GET /api/requests`: returns `{ outgoing, incoming }` for
      authenticated user. Honors `status` and `q` query params.
- [ ] E2 — `POST /api/requests`: validate body, block self-requests,
      insert row with `expires_at = now() + interval '7 days'` and a
      fresh `shareable_link`.
- [ ] E3 — `GET /api/requests/[id]`: detail for sender or recipient;
      403 otherwise.
- [ ] E4 — `POST /api/requests/[id]/pay`: race-safe update; 2-second
      server sleep; success returns updated row; errors per spec §9.
- [ ] E5 — `POST /api/requests/[id]/decline`: race-safe update.
- [ ] E6 — `POST /api/requests/[id]/cancel`: race-safe update; only
      sender.
- [ ] E7 — `GET /api/public/[link]`: public, redacted; includes
      sender_email for social context; 404 on unknown link.
- [ ] E8 — Central error helper to emit the exact response shapes from
      spec §9.

## F. UI (Step 6 — frontend)

- [ ] F1 — `src/components/StatusBadge.tsx`: semantic color + text.
- [ ] F2 — `src/components/AmountInput.tsx`: dollar-shaped input
      emitting integer cents via `onChange`.
- [ ] F3 — `src/components/AmountDisplay.tsx`: cents → `$50.00`
      w/ tabular numerals.
- [ ] F4 — `src/components/ExpirationCountdown.tsx`: live countdown,
      updates every 30s, handles expired state.
- [ ] F5 — `src/components/RequestCard.tsx`: compact row for lists.
- [ ] F6 — `src/components/RequestActions.tsx`: Pay/Decline/Cancel
      buttons with loading states (2s Pay animation).
- [ ] F7 — `src/components/EmptyState.tsx`.
- [ ] F8 — `src/app/(protected)/dashboard/page.tsx`: Tabs (Incoming /
      Outgoing), filter + search, list of RequestCards.
- [ ] F9 — `src/app/(protected)/requests/new/page.tsx`: create form.
- [ ] F10 — `src/app/(protected)/requests/[id]/page.tsx`: detail with
      actions.
- [ ] F11 — `src/app/pay/[link]/page.tsx`: public pay page.
- [ ] F12 — `src/app/page.tsx`: root — redirects signed-in users to
      `/dashboard`, signed-out users to `/login`.

## G. Testing (Step 7)

- [ ] G1 — `playwright.config.ts` with `video: 'on'`,
      `screenshot: 'only-on-failure'`, `trace: 'on'`,
      `baseURL: http://localhost:3000`, `webServer.command = 'npm run dev'`.
- [ ] G2 — `tests/payment-flow.spec.ts` — the full flow listed in
      plan §7.
- [ ] G3 — Run `npx playwright test`; check generated video under
      `test-results/`.

## H. Deploy & docs (Step 8)

- [ ] H1 — Screenshots of dashboard, detail, pay-flow under
      `docs/screenshots/`.
- [ ] H2 — `README.md`: overview, live URL, setup, test commands,
      tech stack, AI tools used, assumptions.
- [ ] H3 — Initial commit, push to
      `github.com/ozlemnurazlioglu/lovie-payment-task` `main`.
- [ ] H4 — `vercel --prod` under scope
      `ozlemnurnazlioglu2002-9289s-projects` with env vars set.
- [ ] H5 — Verify live URL loads and login works.

---

## Sequencing

A → B → C → (D in parallel with E) → F → G → H.
`lib/validators.ts` (D2) is required by every E handler and the
create form (F9), so it must land early.
