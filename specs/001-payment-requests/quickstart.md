# Quickstart — PayRequest

Getting the project running locally. Assumes Node 20+ and a Supabase
project already provisioned.

---

## 1. Clone

```bash
git clone https://github.com/ozlemnurazlioglu/lovie-payment-task.git
cd lovie-payment-task
```

## 2. Env vars

```bash
cp .env.local.example .env.local
```

Fill:

```
NEXT_PUBLIC_SUPABASE_URL=https://nyupxgpkqjwskovdrhpf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

## 3. Install

```bash
npm install
```

## 4. Database

Schema is applied via Supabase MCP during development (Step 4 of the
workflow). For a fresh Supabase project, apply `supabase-schema.sql`
through the dashboard SQL editor **or** (if you have the Supabase CLI)
via `supabase db push`.

Seed users:

- `ozlemnurnazlioglu2002@gmail.com` / `test123`
- `ozlemtest@gmail.com` / `test123`

## 5. Run

```bash
npm run dev
```

Visit <http://localhost:3000>.

## 6. Tests

```bash
npx playwright install        # once
npx playwright test           # runs E2E + records video
```

Videos and traces land under `test-results/`.

## 7. Deploy

```bash
vercel --prod
```

Ensure the Vercel project has `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` configured under Environment
Variables.
