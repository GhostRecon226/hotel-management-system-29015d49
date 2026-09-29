# Architecture

## Layers

```text
Browser (React, TanStack Router/Query, shadcn/ui)
  |  supabase-js: rpc(...) for every write, select on tables/views for reads (RLS)
  |  TanStack server functions for: staff invite, outbox run, CSV export
  v
Postgres (Supabase)
  public.*  API functions (security definer) + tables + security_invoker views
  app.*     helpers: tenant/permission checks, posting, availability, rollover
  RLS       tenant + property scoping on every table
  triggers  audit, immutability, read-only mode, plan limits, integrity
  pg_cron   business-date-rollover every 5 minutes
```

- **Rules live in Postgres.** The UI never computes money, availability, balances or KPIs; it calls a function or reads a view.
- **Reads**: tables/views through RLS `SELECT` policies. **Writes**: only through `public.*` functions; direct `INSERT/UPDATE/DELETE` from clients is denied by RLS (no write policies).
- **Errors** are raised as `[E_CODE] Plain message`. `src/lib/errors.ts` strips the code for display; some screens branch on the code (e.g. `E_SOD`).
- **Client data layer**: one file per module in `src/lib/*.tsx` (hooks + dialogs). `src/lib/access.tsx` holds the permission context.

## Tenant model

- `tenants` (the business) → `properties` (hotels) → everything else. Every business table carries `tenant_id`; most carry `property_id`.
- A user is one `profiles` row (id = `auth.users.id`) belonging to exactly one tenant. Access to a property comes from `user_property_roles`.
- **Guests are tenant-scoped** (shared across a tenant's properties).
- Helpers in `app`: `app.my_tenant()`, `app.has_property_access(property)`. RLS policies call them; they are `security definer` to avoid RLS recursion.
- `create_hotel` creates tenant, trial subscription, first property, profile and SYSADMIN assignment in one call. An `AFTER INSERT` trigger on `properties` seeds charge codes, payment methods, document sequences and (unverified) Nigerian taxes.
- **Subscriptions / read-only**: `tenant_subscriptions.status` expired or suspended makes the tenant read-only. Every data-changing function calls `app.assert_writable()` (raises `E_READ_ONLY`); `enforce_writable` triggers also guard tables. Settlement and check-out functions set `app.settlement=on` so they still work.
- **Plan limits**: triggers raise `E_PLAN_LIMIT` when rooms, properties or users exceed `plans`.

## Permission model

- `permissions` is a catalogue of 68 keys (`module.action`, modules: setup, reservations, front_office, rooms, housekeeping, maintenance, service, guests, finance, reports, admin).
- `roles`: 10 system roles (tenant_id null, read-only: SYSADMIN, GM, FOM, FDO, RES, HKS, RA, MNT, CASHIER, ACCT) plus tenant custom roles copied from them.
- `role_permissions.grant_level`: **Y** allowed, **L** allowed up to `approval_limits.max_amount` (no row = 0), **O** own records only.
- `user_property_roles` gives a user a role per property.
- DB checks: `app.can(key, property)`, `app.require(key, property)` (raises `E_FORBIDDEN`), `app.require_any`, `app.approval_limit(key, property)`.
- Admin rules: nobody can grant a permission/limit they do not hold (`E_ESCALATION`), the last active SYSADMIN cannot be removed/disabled (`E_LAST_ADMIN`), system roles are immutable (`E_SYSTEM_ROLE`).
- Frontend: `public.my_context()` returns profile, tenant, subscription/writable state, properties and permission keys per property in **one call**. `AccessProvider` stores it; `useAccess().can(key)` / `<Can>` hide menu items and buttons. Hiding is cosmetic — the database enforces.
- Segregation of duties (`E_SOD` + CHECK constraints): approver ≠ requester, inspector ≠ cleaner, ticket closer ≠ resolver.

## Ledger rules

- `folio_transactions` and `folio_tax_lines` are **insert-only**; a trigger raises `E_IMMUTABLE` on update/delete.
- Signed amounts: charges +, payments −. Discounts/refunds/reversals/transfers are their own rows.
- Balances only from `v_folio_balances`; nothing stores a total.
- Every posting function requires an **idempotency key** (unique per tenant). Replays return the existing row. System keys: `room:<reservation>:<date>` (nightly room charge), `svc:<id>` (service request), `approval:<id>` (approved request).
- Reversal = mirror row linked by `original_id`; a partial unique index means a row is reversed or transferred once (`E_ALREADY_REVERSED`).
- Transfer = "out" row on the source folio + "in" row on the target folio of the same stay.
- Charges go through `calculate_tax` (ordered, optionally compounding lines; each line rounded to 2 dp; remainder on the last line) and store tax lines.
- Foreign currency: `fx_rate` and `base_amount` stored at posting time from `exchange_rates`.
- Closed folios reject postings (`E_FOLIO_CLOSED`); reopening needs a permission and reason.
- Discounts post at once within the user's limit; above it, and for every adjustment, reversal and refund, an `approvals` row is created and `decide_approval` posts on approval.
- Invoices are insert-only snapshots numbered from `document_sequences`.
- Money type is `numeric(20,4)`.

## Availability

- Each booked night is a `reservation_nights` row. A night counts against inventory when its reservation is `confirmed`, `checked_in`, or `tentative` with an unexpired `hold_until`.
- `app.availability(property, room_type, from, to)` = active rooms of the type − approved `room_blocks` covering the night − counted nights.
- Bookings take an advisory lock per property + room type and call `app.assert_available` (`E_NO_AVAILABILITY`), so the last room cannot be sold twice.
- Room assignment: `room_assignments` has an exclusion constraint on active rows (no double assignment); released rows are kept. Blocked rooms cannot be assigned (`E_ROOM_BLOCKED`).
- Room blocks reduce availability only once approved and are refused if they would oversell any night (`E_OVERSOLD`).
- Room condition (clean/dirty/inspected/out_of_order), occupancy (`is_occupied`) and sellability (derived in `v_room_board`) are separate.

## Business date

- Each property has `business_date` and `rollover_time` (default 03:00 in the property timezone). A trigger blocks any other change to `business_date`.
- `app.run_due_rollovers()` finds properties whose local time has passed the rollover time for the next date and calls `app.roll_property` for each.
- `app.roll_property` runs in a sub-transaction: post room charges for in-house stays, expire tentative holds, mark no-shows, advance the date, create stayover housekeeping tasks, write `daily_stats`. Each step is idempotent. On failure everything rolls back, a `business_date_log` row with the error is written, and users with `fin.nightaudit.run` are notified once.
- Admin → Business date has a manual "Run now" (`run_due_rollovers_now`).
- Dashboard and reports read `dashboard_summary`, `v_kpi_daily` and `report_*` functions.

## Scheduled jobs

| Job | Schedule | What | Where defined |
|---|---|---|---|
| `business-date-rollover` (pg_cron) | every 5 min (288 runs/day) | `select app.run_due_rollovers()` | `supabase/migrations/20260929170000_schedule_business_date_rollover.sql` |
| Outbox sender | **none** | `processOutbox()` in `src/lib/outbox.server.ts` | Manual only: Admin → Messages → Run now |

## Outbox and exports

- `app.enqueue_message` inserts into `notification_outbox` with a per-tenant dedupe key (reservation confirmations, approval alerts).
- `src/lib/outbox.server.ts` claims batches via `outbox_claim`, sends email through Resend, and records the result via `outbox_mark` with exponential back-off. SMS/WhatsApp are stubs.
- CSV exports: `src/lib/exports.functions.ts` → `public.export_data` (permission `rpt.export`, writes an audit row).
