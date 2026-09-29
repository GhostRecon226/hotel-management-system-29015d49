# Known issues

Blunt list. Nothing here is hidden elsewhere.

## Testing
- **Almost nothing has been tested end to end.** Every module compiled and the migrations replay cleanly on an empty database (`scripts/check-migrations.sh`), but no one has walked a booking → check-in → charges → payment → check-out → invoice flow in a browser with real data.
- The only automated test is `supabase/tests/tenant_isolation.sql`. There are no tests for the ledger, tax maths, availability races, approvals, SOD, rollover or RLS on the later tables.
- Concurrency (two clerks booking the last room) relies on an advisory lock and was never load-tested.
- Authenticated screens after the design restyle (Setup, Guests and everything built later) were not visually checked.

## Money and tax
- **Nigerian tax defaults are guesses** (service charge 10%, VAT 7.5% on net + service charge, state levy 0%). They are marked unverified. Confirm with an accountant before any real use.
- Cancellation and no-show fees are calculated on the reservation but **not posted to a folio**.
- Early departure does not recalculate the reservation total; unused nights are just removed.
- Discounts, adjustments and service-request charges are in base currency only.
- Refunds are capped at the folio's credit balance. A discount must be reversed before its charge can be transferred.
- Check-out with an approved balance leaves unsettled folios open with no follow-up/collections process.
- `numeric(20,4)` everywhere but tax lines round to 2 dp; rounding remainder goes on the last line. Check this matches the accountant's expectations.

## Scheduling and messaging
- Rollover pg_cron runs every 5 minutes (288 runs/day). A real rollover has **not been observed**; the first scheduled run found no property due.
- `daily_stats` is only written by rollovers; there is no backfill, so KPIs start empty.
- **Email is not connected.** Booking confirmations and approval alerts sit in `notification_outbox` as `pending` until `RESEND_API_KEY` is set. `OUTBOX_FROM_EMAIL` must be on a Resend-verified domain.
- **No outbox schedule.** Sending runs only from Admin → Messages → Run now. When email is connected, add a scheduled caller (e.g. a pg_cron + `pg_net` call to a `/api/public/...` route that verifies a secret and runs `processOutbox()`).
- SMS and WhatsApp are stubs: messages are marked failed "not set up yet".
- The notification bell polls every 60 s instead of using realtime.

## Features that are partial
- Forgot password / reset password is not built. Google sign-in is not built.
- Dark theme tokens exist but there is no toggle.
- Hold room blocks reduce availability only when approved; OOO/OOS/hold all behave the same for availability.
- Stayover tasks are created only by the rollover. No auto tickets from failed inspections. Housekeeping checklists are generic starter lists.
- Service request categories were invented; service requests are only for in-house guests.
- Guest stay history is basic; no guest-level service/maintenance history.
- Reservation settings (max stay 30 nights, 24 h tentative hold) are columns on `properties` but have no Setup screen.
- Staff invite falls back to a temporary password shown once when the invite email fails. That is convenient but weak.
- Admin "Subscription" is read-only; there is no billing integration. Status changes are manual SQL.

## Hacky or doubtful
- `housekeeping_tasks` is deprecated (replaced by `hk_tasks`) but still in the schema because tables are never dropped.
- Frontend calls to views/rpc use `(supabase.from as any)` / a `callRpc` wrapper, so many are untyped. `src/integrations/supabase/types.ts` is generated but not used strictly.
- `docs/functions.md` permission/error columns were extracted by regex from function bodies. Helpers that check permissions indirectly (e.g. via a row's property) may show fewer keys than they really need. Read the function when it matters.
- Migrations exist twice (`supabase/migrations` canonical, `drizzle/migrations` from the Lovable tool). Keep only one after leaving Lovable.
- `pg_cron` is required by one migration; plain Postgres without it fails there (the check script stubs it).
- Some UI lists are capped (e.g. 200 folios) with no pagination.
- `bulk_add_rooms` is capped at 500 rooms per call.
- Some `package.json` dependencies from the starter template may be unused (recharts is used; others like embla/cmdk/vaul/react-day-picker/input-otp/resizable-panels likely not). Their UI wrappers were deleted; the packages were left in place to avoid lockfile churn.
