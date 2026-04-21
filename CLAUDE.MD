# PayRequest — Project Instructions for Claude Code

## ⚠️ Authoritative Workflow — `doc-video.md`

- `doc-video.md` is the **authoritative step-by-step workflow script** for this project. It is no longer confidential — read it, follow it, and execute against it.
- Two rules from `doc-video.md` are **hard constraints** and override any instinct to be efficient:
  1. **One step at a time.** Execute exactly one step, then STOP and ask `"Step X is complete. Shall I proceed to Step X+1?"`. Never chain steps.
  2. **Explain every step in English before executing it.** Output a short English block covering (1) What the step does, (2) Why it matters, (3) Which tools/files/commands will be touched — regardless of the chat language. Only after that, run the tool calls. After execution, summarize the result in English and stop.
- The 8 canonical steps are:
  1. Intro: the MCP stack
  2. Project setup: Spec-Kit, Supabase MCP, hooks
  3. Spec writing: constitution, spec, plan, tasks
  4. Database via Supabase MCP
  5. Auth (email + password)
  6. Feature build: API routes + UI
  7. Playwright MCP + automated E2E tests
  8. Final: E2E run, screenshots, Vercel deploy, README
- If the user's request maps to one of these steps, follow that step's action list in `doc-video.md` exactly.

## Project Overview

P2P payment request app (like Venmo). Users create, pay, decline, and cancel payment requests.

## Deployment Targets (Authoritative — Do Not Change)

These are the **only** targets for this project. Never create a new repo, Supabase project, or Vercel project. Always push / deploy / migrate to exactly these:

- **GitHub repo:** `https://github.com/ozlemnurazlioglu/lovie-payment-task`
  - Remote name: `origin`
  - Default branch: `main`
  - All commits and pushes go here.
- **Vercel account/scope:** `https://vercel.com/ozlemnurnazlioglu2002-9289s-projects`
  - Production deploys must land under this scope.
  - Required env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and any server-only keys the code needs).
- **Supabase project:**
  - Dashboard: `https://supabase.com/dashboard/project/nyupxgpkqjwskovdrhpf/editor`
  - Project ref: `nyupxgpkqjwskovdrhpf`
  - All `mcp__supabase__apply_migration`, `list_tables`, and `execute_sql` calls MUST target this project ref. Never run migrations against any other project.

Before any deploy, push, or migration step, verify the target matches one of the above. If it does not, stop and ask the user.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript (strict)
- **Backend:** Supabase (PostgreSQL + Row Level Security + Auth)
- **Styling:** Tailwind CSS + shadcn/ui
- **Testing:** Playwright (E2E + video recording)

## Architecture Rules

### Fintech — Non-Negotiable

- Amounts **ALWAYS** stored as `INTEGER` (cents). `$50.00 = 5000`. **NEVER** use floats for money.
- Row Level Security on all tables. Users can only see their own data.
- Validate inputs on **BOTH** client and server. Never trust the client alone.
- Race condition protection: always use `WHERE status = 'pending'` before status changes.
- Correct HTTP codes: `400` (bad input), `403` (no access), `404` (not found), `410` (expired).
- Requests expire after **7 days** if not paid or declined. Expired requests cannot be paid.

### Code Style

- TypeScript strict mode. **No `any` types.**
- Use shadcn/ui components (Button, Input, Card, Badge, Tabs, etc.).
- Tailwind for all styling. No inline styles.
- Hooks auto-run Prettier + ESLint on every edit. TypeScript check on every response.

### Design Direction — Clean & Elegant

> **Skill trigger:** Before writing or editing **any** `.tsx`, `.jsx`, Tailwind class, or design-related file, you MUST first read and follow the `frontend-design` skill. No exceptions.

- The UI must feel **minimal, calm, and polished** — not generic "AI-looking" shadcn defaults. Think a modern fintech brand (Mercury / Linear / Ramp): lots of whitespace, one accent color, consistent radii, soft shadows, no emoji noise.
- Typography: one sans-serif (Geist Sans or Inter), tight letter-spacing on large numbers, tabular numerals for all money displays.
- Color: neutral base (zinc/slate), **one** accent color for primary actions and status positives. Status colors are semantic only (green = paid, amber = pending, red = declined, gray = expired/cancelled).
- Mobile-first, responsive, accessible (WCAG AA contrast, focus rings, semantic HTML).
- **Use the `frontend-design` skill** whenever building or reviewing any page, component, or layout. Read and follow it before writing TSX.

## Required Skills — MANDATORY USAGE (Non-Negotiable)

Two skills are **required** on this project. You must read them **before** doing the matching kind of work, every time. Do not rely on memory from earlier in the session — re-read if unsure.

### 1. `frontend-design` skill

- **Purpose:** Produce distinctive, fintech-grade UI; avoid generic AI aesthetics.
- **Location:** Provided by the `frontend-design` plugin. Find its `SKILL.md` via the agent skills listing.
- **Read BEFORE any of these actions:**
  - Creating or editing any `.tsx` / `.jsx` file in `src/app/**` or `src/components/**`.
  - Writing or changing any Tailwind class, shadcn/ui component usage, layout, spacing, typography, or color choice.
  - Designing pages: `login`, `dashboard`, `requests/new`, `requests/[id]`, `pay/[link]`.
  - Designing shared components: `RequestCard`, `StatusBadge`, `AmountInput`, `ExpirationCountdown`, nav, empty states.
- **Enforcement:** If you are about to write TSX and have not read this skill in the current response, stop and read it first.

### 2. `supabase-postgres-best-practices` skill

- **Purpose:** Production-safe Postgres schema, indexes, RLS, and query patterns.
- **Location:** Provided by the `supabase` plugin. Find its `SKILL.md` via the agent skills listing.
- **Read BEFORE any of these actions:**
  - Writing or editing `supabase-schema.sql` or any `.sql` file.
  - Calling `mcp__supabase__apply_migration`, `mcp__supabase__execute_sql`, or any schema-modifying MCP tool.
  - Designing or changing tables (`profiles`, `payment_requests`), enums, triggers, functions, indexes, or RLS policies.
  - Writing server-side Supabase queries that depend on RLS correctness.
- **Enforcement:** If you are about to touch SQL or a Supabase MCP schema call and have not read this skill in the current response, stop and read it first.

### Other tooling (not skills, but mandatory in their domains)

- **Context7 MCP** → Call it **whenever** touching an external library's API (Next.js 14 App Router, `@supabase/ssr`, shadcn/ui, Playwright, Zod, etc.) to pull version-accurate docs. Prefer Context7 over web search for library usage questions.
- **Supabase MCP** → All database operations (schema apply, list_tables, execute_sql, seed data). Never hand-edit the DB in the dashboard during this project. Always target project ref `nyupxgpkqjwskovdrhpf` (see Deployment Targets).
- **Playwright MCP** → Visual verification during development (driving a real browser to click through flows).
- **GitHub MCP** → Repo, commits, pushes. Target repo: `ozlemnurazlioglu/lovie-payment-task` only.

## Auth

- Email + password login (not magic link — rate limits break testing).
- Test accounts:
  - `ozlemnurnazlioglu2002@gmail.com`
  - `ozlemtest@gmail.com`
- Password for both: `test123`

## Database

> **Skill trigger:** Before writing `supabase-schema.sql`, any migration, RLS policy, index, or SQL in this project, you MUST first read and follow the `supabase-postgres-best-practices` skill. No exceptions.

- `profiles` table — synced from `auth.users` via trigger.
- `payment_requests` table — `amount INTEGER`, `status` enum, `shareable_link UUID`.
- Status enum: `pending`, `paid`, `declined`, `expired`, `cancelled`.
- Schema in `supabase-schema.sql`.
- Target Supabase project ref: `nyupxgpkqjwskovdrhpf` (see Deployment Targets).

## Testing

- Playwright E2E with `video: 'on'`, `screenshot: 'on'`, `trace: 'on'`.
- Test files in `tests/`.
- Use Playwright MCP for visual browser testing.

## MCP Servers

- **Supabase MCP** — run SQL, check data from terminal.
- **Playwright MCP** — visual browser testing.
- **Context7** — pull latest library docs.
- **GitHub MCP** — version control.

## Spec-Kit Workflow

- Constitution: `.specify/memory/constitution.md`
- Spec: `specs/001-payment-requests/spec.md`
- Plan: `specs/001-payment-requests/plan.md`
- Tasks: `specs/001-payment-requests/tasks.md`

## File Structure

```
src/app/(protected)/    — Auth-required pages (dashboard, requests)
src/app/api/requests/   — 7 API routes
src/app/login/          — Login page
src/app/pay/[link]/     — Public shareable link page
src/components/         — UI components
src/lib/                — Supabase clients, types, validators
src/middleware.ts       — Auth guard
```

<!-- SPECKIT START -->
Active feature: **PayRequest** (branch `001-payment-requests`).

Source of truth for this feature:
- Spec: [`specs/001-payment-requests/spec.md`](specs/001-payment-requests/spec.md)
- Plan: [`specs/001-payment-requests/plan.md`](specs/001-payment-requests/plan.md)
- Research: [`specs/001-payment-requests/research.md`](specs/001-payment-requests/research.md)
- Data model: [`specs/001-payment-requests/data-model.md`](specs/001-payment-requests/data-model.md)
- API contract: [`specs/001-payment-requests/contracts/api.md`](specs/001-payment-requests/contracts/api.md)
- Quickstart: [`specs/001-payment-requests/quickstart.md`](specs/001-payment-requests/quickstart.md)
- Constitution: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

Read the plan before writing any code; read the constitution before making architectural decisions.
<!-- SPECKIT END -->
