# Hotel Desk — multi-tenant hotel management

A web app for running hotels, built for Nigeria first (base currency NGN, ₦) and then the rest of Africa. One account (tenant) can hold several properties. It covers reservations and availability, front desk (check-in, walk-in, move, extend, check-out), room board and room blocks, folios with an immutable ledger, approvals, invoices, housekeeping, maintenance, guest service, guests, business-date rollover, reports and CSV exports, admin (staff, roles, approval limits, audit log, subscription) and a message outbox.

Payments are **recorded, not processed** — money is taken outside the system and entered here.

Start with `docs/architecture.md`, then `docs/known-issues.md`.

## Stack

- React 19 + TypeScript, TanStack Start v1 (file routes in `src/routes`, server functions), Vite
- Tailwind CSS v4 (tokens in `src/styles.css`), shadcn/ui components in `src/components/ui`
- Supabase (Postgres, Auth, RLS, pg_cron). Business rules live in Postgres functions called with `supabase.rpc(...)`
- TanStack Query for data fetching
- Hosting: Vercel (Nitro `vercel` preset). No Lovable dependency.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in (see below)
npm run dev                  # http://localhost:8080
```

`.env.local` is git-ignored. Never commit real keys.

## Environment variables

Browser (anything starting with `VITE_` reaches the browser, so only public values):

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (public) key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (informational) |

Server only (server functions, never exposed to the browser):

| Name | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Same values as above, read on the server |
| `SUPABASE_SERVICE_ROLE_KEY` | Staff invites and outbox processing |
| `RESEND_API_KEY` | Email for the outbox (Resend). Without it, email stays pending |
| `OUTBOX_FROM_EMAIL` | Sender, for example `Hotel <desk@yourdomain>`, on a Resend-verified domain |

## Database

- Canonical schema: `supabase/migrations/*.sql` (timestamped). Never edit an applied migration; add a new one.
- Local: `supabase start` (Docker). Remote: `supabase db push --linked`.
- The Supabase CLI reads `SUPABASE_PROJECT_ID` from the environment as the project to use. Do not keep an old one in a `.env` file.

## Tests

```bash
scripts/test-db.sh
```

Rebuilds the local Supabase database from the migrations, loads test fixtures and runs every file in `supabase/tests/db`. Every check prints ok or not ok, tagged with its requirement. It refuses to run against a non-local database. Open failures are listed in `docs/status-report.md`.

- TypeScript: `npm run typecheck`. Lint: `npm run lint`.
- No frontend unit or end-to-end tests yet.

## Deploy

- Frontend and server functions: Vercel. `npm run build` produces `.vercel/output` (Build Output API).
- Database: `supabase db push --linked`. Both pg_cron jobs (business date roll, subscription clock) are created by migrations. Enable the pg_cron extension on the project first.
- Auth: email and password with email confirmation. Set the Site URL and redirect URLs to the deployed origin.

## Docs

- `docs/status-report.md`: audit, test results, open failures, plan
- `docs/decisions.md`: decisions log
- `docs/architecture.md`, `docs/data-model.md`, `docs/functions.md`, `docs/screens.md`: written by the Lovable build; `functions.md` predates the fixes of 30 Sep 2026
- `docs/known-issues.md`: what is unfinished or doubtful
- `docs/lovable-notes.md`: history of the Lovable setup (kept for reference)
- `AGENTS.md`: one-line architecture rules
