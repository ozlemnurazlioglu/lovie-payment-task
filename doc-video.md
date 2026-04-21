# PayRequest — Video Recording Script

**Target duration:** ~60 minutes
**Language:** English
**Format:** You read the narration aloud, Claude executes the action.

---

## 🎙️ Opening Narration (read aloud)

> "Hey — I'm building a peer-to-peer payment request feature, Venmo style, using a fully AI-native, spec-driven workflow. Before I start coding, let me quickly show you the tooling that makes this possible.
>
> **I'm running Claude Code with four MCP servers connected.**
> *Supabase MCP* lets the agent run SQL, apply migrations, and inspect my database directly from chat.
> *Playwright MCP* gives it a real browser — it can navigate, fill forms, and click through the app for visual verification.
> *Context7 MCP* pulls live, version-accurate documentation for any library I touch, so the agent never guesses an API.
> And *Vercel MCP* handles the deployment at the end.
>
> **On top of that I've installed three plugins:** *frontend-design*, *context7*, and *supabase* — they wire the MCPs in and bring the skills along with them.
>
> **Two of those skills do the heavy lifting.** The *frontend-design* skill enforces a clean, minimal, fintech-grade UI — no generic AI look. The *supabase-postgres-best-practices* skill guides schema, indexes, and row-level security so the database is production-safe from day one.
>
> **And finally, automation.** I've wired up two Claude Code hooks — a *PostToolUse* hook that auto-runs Prettier and ESLint on every file edit, and a *Stop* hook that runs a TypeScript check at the end of every response. So the code stays clean and type-safe without me thinking about it.
>
> Alright — specs first, code second. Let's build."

---

## ⚠️ MANDATORY RULES FOR CLAUDE (READ FIRST — NON-NEGOTIABLE)

When executing this script, Claude **MUST** follow these rules at all times. These rules override any other instinct to be helpful or efficient.

### Rule 1 — One step at a time. STOP and ASK after every step.

- Execute **exactly one step** from the script, then **STOP**.
- After finishing a step, explicitly ask the user: **"Step X is complete. Shall I proceed to Step X+1?"**
- **DO NOT** start the next step until the user explicitly confirms (e.g. "yes", "go", "devam", "evet").
- This applies to every single step, including sub-actions inside a step if the user asks to slow down.
- Never chain multiple steps together, even if they seem trivially related.

### Rule 2 — Explain every step in English before executing it. MANDATORY.

- Before running any action in a step, Claude **MUST** output a short English explanation of:
  1. **What** this step is going to do
  2. **Why** it matters for the project
  3. **Which** tools / files / commands will be touched
- The explanation must be in **English**, regardless of the language the user is chatting in.
- Only after the English explanation is shown, Claude may execute the tool calls for that step.
- After execution, briefly summarize the result in English, then stop and apply Rule 1.

**If Claude violates either of these two rules, the user will stop the recording and the workflow is broken. Treat them as hard constraints.**

---

## Step 1 — Intro: The MCP Stack

🎙️ **Narration (EN):**
> "Before I start building, let me show you the tooling I'm using. I'm running Claude Code with four Model Context Protocol servers connected. Supabase MCP lets Claude run SQL and inspect my database directly. Playwright MCP gives Claude a real browser it can click through for visual verification. Context7 pulls live documentation for any library I touch. And GitHub MCP handles the repo. Together, these turn Claude into a full-stack agent instead of just a code generator."

⚙️ **Action:**
- Run `/mcp` in Claude Code to list connected servers.
- Briefly point to each one.

👀 **Show on screen:**
- The list of active MCP servers in Claude Code.

---

## Step 2 — Project Setup: Spec-Kit, Supabase MCP, Hooks

🎙️ **Narration (EN):**
> "First I set up the scaffolding. I install GitHub Spec-Kit so Claude follows the constitution, spec, plan, and tasks workflow. I confirm the Supabase MCP server is configured with my project reference. And I set up Claude Code hooks that auto-run Prettier and ESLint on every file edit and TypeScript checks on every response — so the code stays clean without me thinking about it."

⚙️ **Action:**
- Run `uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude`.
- Verify Supabase MCP connection: run a quick `list_tables` call.
- Open `.claude/settings.json` and add `PostToolUse` hooks for `prettier --write` and `eslint --fix`, plus a `Stop` hook for `tsc --noEmit`.

👀 **Show on screen:**
- `.specify/` directory tree, `.claude/settings.json` with hooks, Supabase MCP responding.

---

## Step 3 — Spec Writing: Constitution, Spec, Plan, Tasks

🎙️ **Narration (EN):**
> "Now the language-mastery part. I write the constitution first — five non-negotiable principles, because this is fintech: amounts are always integer cents, row-level security is mandatory, inputs are validated on both sides, status transitions are race-condition safe, and requests expire after seven days. Then I run `/specify` to describe the feature, `/plan` to turn it into a technical plan, and `/tasks` to break it into concrete work items."

⚙️ **Action:**
- Edit `.specify/memory/constitution.md` with the five fintech principles.
- Run `/specify` with a detailed prompt: request creation, dashboard (incoming/outgoing), pay/decline/cancel, 2-3 second payment simulation, 7-day expiration, shareable link, auth.
- Run `/plan` with the stack: Next.js 14 App Router, TypeScript strict, Supabase, Tailwind + shadcn, Playwright.
- Run `/tasks`.

👀 **Show on screen:**
- Scroll through `constitution.md`, `spec.md`, `plan.md`, `tasks.md` in sequence.

---

## Step 4 — Database with Supabase MCP

🎙️ **Narration (EN):**
> "With the spec locked down, I build the database directly through the Supabase MCP. Two tables: `profiles`, synced from `auth.users` via a trigger, and `payment_requests`, where amount is an integer in cents, status is an enum, and every row has an `expires_at` timestamp. Row-level security is enabled on both tables so users can only read and modify their own data. Claude applies the migration straight from the chat — no switching to the Supabase dashboard."

⚙️ **Action:**
- Write `supabase-schema.sql`.
- Call `mcp__supabase__apply_migration` with the full schema: tables, enum, trigger, RLS policies.
- Call `mcp__supabase__list_tables` to verify.

👀 **Show on screen:**
- The SQL file (highlight `amount INTEGER` and RLS policies), then the MCP response confirming tables exist.

---

## Step 5 — Auth

🎙️ **Narration (EN):**
> "Next, authentication. I'm using email and password instead of magic links, because magic-link rate limits break end-to-end tests. I create two Supabase clients — one for the browser, one for server components — plus a middleware that redirects unauthenticated users away from protected routes. Then a login page and a sign-out action."

⚙️ **Action:**
- Create `src/lib/supabase/client.ts` and `server.ts`.
- Create `src/middleware.ts` guarding `(protected)` routes.
- Build `src/app/login/page.tsx` with email + password form and error handling.
- Create test users via Supabase MCP `execute_sql`.

👀 **Show on screen:**
- Middleware redirect logic, login page rendering, successful login redirecting to dashboard.

---

## Step 6 — Build the Feature: API Routes + UI

🎙️ **Narration (EN):**
> "Now the feature itself. On the backend: seven API routes — list, create, detail, pay, decline, cancel, and a public shareable-link endpoint. Every mutation is race-condition safe with a `WHERE status = 'pending'` guard, and every handler returns the right HTTP code — 400, 403, 404, or 410 for expired. On the frontend: a dashboard with tabs for incoming and outgoing, a create-request form that converts dollars into integer cents, a request detail page with pay, decline, and cancel actions, and a public payment page for the shareable link."

⚙️ **Action:**
- Create API routes under `src/app/api/requests/` and `src/app/api/public/[link]/`.
- Add `src/lib/validators.ts` with Zod schemas.
- Build UI pages: `(protected)/dashboard`, `requests/new`, `requests/[id]`, `pay/[link]`.
- Shared components: `RequestCard`, `StatusBadge`, `AmountInput`, `ExpirationCountdown`.

👀 **Show on screen:**
- Pay route showing the race-safe update and 410 for expired. Dashboard rendering live data.

---

## Step 7 — Playwright MCP: Visual Testing

🎙️ **Narration (EN):**
> "For testing I use Playwright two ways. First, the Playwright MCP lets Claude drive a real browser to visually verify the app — it opens the login page, signs in, creates a request, and checks the dashboard updated. This catches things that unit tests miss. Then I write a proper Playwright test suite with video, screenshot, and trace recording turned on, which is exactly what the assignment asks for."

⚙️ **Action:**
- Use Playwright MCP: `browser_navigate` to the dev URL, `browser_fill_form` to log in, `browser_click` through the create-request flow, `browser_snapshot` to verify the dashboard.
- Install Playwright test runner: `npm i -D @playwright/test && npx playwright install`.
- Write `playwright.config.ts` with `video: 'on'`, `screenshot: 'on'`, `trace: 'on'`.
- Write `tests/payment-flow.spec.ts`: login → create → pay → decline → cancel → shareable link.

👀 **Show on screen:**
- Playwright MCP browser executing actions live. Then the Playwright test file.

---

## Step 8 — Final: E2E Run, Screenshots, Vercel, README

🎙️ **Narration (EN):**
> "Final stretch. I run the Playwright suite — it auto-records a video of every test, which satisfies the automated screen recording requirement. I capture a few UI screenshots for the README. I push to GitHub, deploy to Vercel, and add the Supabase environment variables so the live demo works. Finally, the README — project overview, live demo URL, setup instructions, how to run the tests, tech stack, and AI tools used."

⚙️ **Action:**
- Run `npx playwright test`. Open the generated video in `test-results/`.
- Take dashboard and request-detail screenshots, save under `docs/screenshots/`.
- `git init`, commit, push to GitHub.
- Deploy: `vercel --prod`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Write `README.md` with overview, live URL, setup, test instructions, tech stack, AI tools, assumptions.

👀 **Show on screen:**
- Green Playwright output, auto-recorded video playing, Vercel live URL in the browser, rendered README on GitHub.

---

## Outro (optional, silent)

- Live demo doing one full end-to-end flow
- Playwright test video in the corner
- GitHub repo on screen

---

## Recording tips

- Keep one terminal + one editor tab visible at all times.
- Pause 2-3 seconds between steps for easier editing.
- While Claude generates a long file, narrate the **why** instead of waiting silently.
- If something breaks, say "let me debug" out loud — it shows real workflow, don't cut.
