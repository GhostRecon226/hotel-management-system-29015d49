# Known issues

Blunt list. Nothing here is hidden elsewhere.

## Testing
- **Almost nothing has been tested end to end.** Every module compiled and the migrations replay cleanly on an empty database (`scripts/check-migrations.sh`), but no one has walked a booking → check-in → charges → payment → check-out → invoice flow in a browser with real data.
- Database tests now live in `supabase/tests/db` and run on local Supabase with `scripts/test-db.sh` (370 checks on 30 Sep 2026). Open failures are listed in `docs/status-report.md`.
- Concurrency (two clerks booking the last room) relies on an advisory lock and was never load-tested.
- Authenticated screens after the design restyle (Setup, Guests and everything built later) were not visually checked.

## Money and tax
- **Nigerian tax defaults are guesses** (service charge 10%, VAT 7.5% on net + service charge, state levy 0%). They are marked unverified. Confirm with an accountant before any real use.
- Cancellation and no-show fees are posted to the main folio once (fixed 30 Sep 2026). Free-cancellation days are set per rate plan, but the rate plan screen does not show the field yet.
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
- Staff invite: no temporary passwords. If the invite email fails, nothing is created. Unaccepted invites can be sent again from Admin, Staff.
- Admin "Subscription" is read-only; there is no billing integration. A daily clock expires trials and suspends unpaid hotels; activation is manual through `app.platform_set_subscription` (decision 5e).

## Hacky or doubtful
- `housekeeping_tasks` is deprecated (replaced by `hk_tasks`) but still in the schema because tables are never dropped.
- Frontend calls to views/rpc use `(supabase.from as any)` / a `callRpc` wrapper, so many are untyped. `src/integrations/supabase/types.ts` is generated but not used strictly.
- `docs/functions.md` permission/error columns were extracted by regex from function bodies. Helpers that check permissions indirectly (e.g. via a row's property) may show fewer keys than they really need. Read the function when it matters.
- Migrations exist twice (`supabase/migrations` canonical, `drizzle/migrations` from the Lovable tool). Keep only one after leaving Lovable.
- `pg_cron` is required by one migration; plain Postgres without it fails there (the check script stubs it).
- Some UI lists are capped (e.g. 200 folios) with no pagination.
- `bulk_add_rooms` is capped at 500 rooms per call.
- Some `package.json` dependencies from the starter template may be unused (recharts is used; others like embla/cmdk/vaul/react-day-picker/input-otp/resizable-panels likely not). Their UI wrappers were deleted; the packages were left in place to avoid lockfile churn.

## Sign-in and Create your hotel (fixed 30 Sep 2026)

Two bugs stopped the first real signup on the live project. Both are fixed on branch `claude/audit-status-report`, and browser tests in `e2e/sign-in.spec.ts` (`npm run test:e2e`, local Supabase only) cover the three flows.

1. **Blank page after the email link or sign-in.** Console: "Uncaught undefined" in `MatchInnerImpl`, no network error. Cause: Supabase announces `SIGNED_IN` again when it reads the session from the confirmation link, on sign-in and on tab focus. The root listener in `src/routes/__root.tsx` reloaded the router and cancelled the in-flight `my_context` check while the route guards were redirecting from `/dashboard` to `/create-hotel`. The guard failed with an empty error and nothing rendered. Fix: the listener no longer reloads on sign-in (navigation already runs the guards). It resets only when a different user signs in, and on sign-out it clears cached data.
2. **Create hotel stuck on "Creating…".** `create_hotel` succeeded (the hotel, property, trial, roles and Nigerian defaults were all created), but the page only marked the cached context stale before navigating. The dashboard guard read the stale `has_hotel = false` and sent the user back to the same page, so it never re-rendered. Fix: the page fetches the fresh context before navigating, both guards revalidate stale context, and the button is always released.

Lesson: route guards that read cached React Query data must revalidate, and auth listeners must not reload the router during a navigation.
