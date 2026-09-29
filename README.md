# Hotel Desk — multi-tenant hotel management

A web app for running hotels, built for Nigeria first (base currency NGN, ₦) and then the rest of Africa. One account (tenant) can hold several properties. It covers reservations and availability, front desk (check-in, walk-in, move, extend, check-out), room board and room blocks, folios with an immutable ledger, approvals, invoices, housekeeping, maintenance, guest service, guests, business-date rollover, reports and CSV exports, admin (staff, roles, approval limits, audit log, subscription) and a message outbox.

Payments are **recorded, not processed** — money is taken outside the system and entered here.

Start with `docs/architecture.md`, then `docs/known-issues.md`.

## Stack

- React 19 + TypeScript, TanStack Start v1 (file routes in `src/routes`, server functions), Vite 7
- Tailwind CSS v4 (tokens in `src/styles.css`), shadcn/ui components in `src/components/ui`
- Supabase (Postgres, Auth, RLS, pg_cron) — business rules live in Postgres functions called with `supabase.rpc(...)`
- TanStack Query for data fetching

## Run locally

```bash
bun install          # or npm install
cp .env.example .env # then fill in (see below)
bun run dev          # http://localhost:8080
```

You need a Supabase project with the migrations applied (see *Database* below).

## Environment variables

Browser (Vite, public):

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (informational) |

Server only (server functions, never exposed to the browser):

| Name | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Same values as above, read on the server |
| `SUPABASE_SERVICE_ROLE_KEY` | Staff invites (creates auth users) and outbox processing |
| `RESEND_API_KEY` | Email sending for the outbox. Not set yet — email stays pending |
| `OUTBOX_FROM_EMAIL` | Optional sender, e.g. `Hotel <desk@yourdomain>` (domain verified in Resend) |
| `LOVABLE_API_KEY` | Only used by the Lovable connector gateway path for Resend; see `docs/lovable-notes.md` |

## Database

- Canonical schema: `supabase/migrations/*.sql` (timestamped). They run in order on an empty Supabase database: `supabase db reset` locally or `supabase db push` to a project.
- `drizzle/migrations` is a duplicate kept only because Lovable's migration tool writes there. See `docs/lovable-notes.md`.
- Edit the schema only by adding a new migration. Never edit applied ones.

## Tests

```bash
# Replays all migrations on a fresh plain-Postgres database (with a small Supabase stub)
# and runs the SQL tests in supabase/tests.
DATABASE_URL=postgresql://postgres@localhost:5432/postgres scripts/check-migrations.sh
```

- `supabase/tests/tenant_isolation.sql` — proves hotel A cannot read hotel B's rows. Also runnable directly against a Supabase database: `psql "$DATABASE_URL" -f supabase/tests/tenant_isolation.sql` (rolls back).
- TypeScript: `bunx tsc --noEmit`. Lint: `bun run lint`.
- There are **no** frontend unit tests and no end-to-end tests. See known issues.

## Deploy

- Frontend/server: `bun run build` produces a Cloudflare-Workers-style bundle (TanStack Start). On Lovable, click Publish. Elsewhere, deploy to Cloudflare Workers or change the TanStack Start target (see `docs/lovable-notes.md`).
- Database: apply `supabase/migrations` to the target project (`supabase db push`). The pg_cron job is created by migration `20260929170000_schedule_business_date_rollover.sql`.
- Auth: enable email/password with email confirmation; set Site URL and redirect URLs to the deployed origin.

## Docs

- `docs/architecture.md` — layers, tenants, permissions, ledger, availability, business date, jobs
- `docs/data-model.md` — tables, views, relationship diagram
- `docs/functions.md` — every database function (generated from the migrations)
- `docs/screens.md` — every screen, route and what it calls
- `docs/known-issues.md` — what is unfinished or doubtful
- `docs/lovable-notes.md` — what changes when leaving Lovable
- `AGENTS.md` — one-line architecture rules
