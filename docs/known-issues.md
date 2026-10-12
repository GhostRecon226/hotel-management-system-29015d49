# Known issues

Blunt list. Nothing here is hidden elsewhere.

## Testing
- Every screen was clicked through on the local copy with a demo hotel (`scripts/seed-demo.sh`) on 30 Sep 2026. Not yet on the real project.
- Database tests live in `supabase/tests/db` and run on local Supabase with `scripts/test-db.sh`. Every pull request must end with `ALL OK` in CI. The 21 failures listed on 30 Sep 2026 in `docs/status-report.md` are fixed. Only the history there is old.
- Concurrency (two clerks booking the last room) is load-tested by `supabase/tests/concurrency/last_room.sh` (NFR-006, 7 Oct 2026): 8 sessions at once. It is not yet proved at hotel-group scale or on the live project.
- Authenticated screens after the design restyle (Setup, Guests and everything built later) were not visually checked.

## Phones and tablets (11 Oct 2026)
- Checked with Chromium at 360, 390, 768 and 1024 pixels wide on a busy demo hotel: every screen, the public site and the main pop-up forms (`e2e/phone-layout.spec.ts`, NFR-008; `e2e/responsive-audit.spec.ts` takes screenshots). **Not yet tried on a real iPhone, a real Android phone or Safari.** Do this before the first pilot hotel.
- Under 768 pixels every table is a stack of cards. The 7 widest tables are cards under 1280 pixels too. Comparing many days side by side is easier on a wide screen.
- The room availability calendar and the downtime pack are true grids. They scroll sideways inside their own box on purpose.
- The business date chip in the top bar is hidden on a phone (no room). The dashboard and the Front Desk show the date.
- Printing is unchanged. Cards apply to screens only.
- `e2e/rooms-add.spec.ts` is intermittent on a busy machine: it reads the room list the moment the "rooms added" message appears, before the list has refreshed. It passed 4 of 4 on untouched `main` and failed on some runs after the phone changes, then passed again. Not changed (needs Peter's yes).

## Money and tax
- **Nigerian tax defaults are guesses** (service charge 10%, VAT 7.5% on net + service charge, state levy 0%). They are marked unverified. Confirm with an accountant before any real use.
- Cancellation and no-show fees are posted to the main folio once (fixed 30 Sep 2026). Free-cancellation days are set per rate plan on the rate plan screen (default 2).
- Discounts, adjustments and service-request charges are in base currency only.
- Refunds are capped at the folio's credit balance. A discount must be reversed before its charge can be transferred.
- Check-out with an approved balance leaves the folio open. Finance follows it up in Reports, Collections (FIN-021), where each call or promise is logged.
- `numeric(20,4)` everywhere but tax lines round to 2 dp; the rounding remainder goes on the last tax that has a rate. On odd amounts an invoice's net and taxable figures can differ from the folio by 1 kobo. Check this with the accountant.

## Scheduling and messaging
- Rollover pg_cron runs every 5 minutes (288 runs/day). A roll has been run by hand on the local copy and checked (charges, no-shows, stayover tasks, KPIs). A scheduled roll has not been observed on the real project yet.
- `daily_stats` is only written by rollovers; there is no backfill, so KPIs start empty.
- **Email is not connected.** Booking confirmations and approval alerts sit in `notification_outbox` as `pending` until `RESEND_API_KEY` is set. `OUTBOX_FROM_EMAIL` must be on a Resend-verified domain.
- **Outbox schedule built, not switched on (2 Oct 2026).** `GET /api/cron/outbox` sends due messages for all hotels; Vercel Cron calls it every 5 minutes (set in `vite.config.ts`, needs Vercel Pro). It refuses every call until `CRON_SECRET` is set, and emails stay queued until `RESEND_API_KEY` is set. Admin → Messages → Run now still works for one hotel.
- SMS and WhatsApp are stubs: messages are marked failed "not set up yet".
- The notification bell polls every 60 s instead of using realtime.

## Features that are partial
- Forgot password works (1 Oct 2026): Sign in > Forgot password? emails a one-hour link to /reset-password. On a live project, Supabase > Authentication > URL Configuration must allow `<app address>/reset-password` (or `<app address>/**`), otherwise the link lands on the Site URL instead. Google sign-in is not built.
- Change password inside the app (QA-19, 11 Oct 2026): account menu, Change password. It asks for the current password first and needs no email. The Create account tab exists on the sign-in page. Google sign-in and a dark theme are not built.
- Dark theme tokens exist but there is no toggle.
- Hold room blocks reduce availability only when approved; OOO/OOS/hold all behave the same for availability.
- Stayover tasks are created only by the rollover. No auto tickets from failed inspections. Housekeeping checklists are generic starter lists.
- Service request categories were invented; service requests are only for in-house guests.
- Front desk officers cannot cancel or reinstate a booking (only managers hold the right). Room attendants cannot be given service requests, so laundry or room service goes to front desk staff. Both are by design today; the dry run should say if hotels want them changed.
- Guest stay history is basic; no guest-level service/maintenance history.
- Reservation settings (longest stay, tentative hold hours) have a Setup screen since 8 Oct 2026 (SET-012).
- Staff invite: no temporary passwords. If the invite email fails, nothing is created. Unaccepted invites can be sent again from Admin, Staff.
- Billing is built (PLT-011, PLT-012: Paystack payment, webhook, cancel) but not switched on. It needs `PAYSTACK_SECRET_KEY` in Vercel and the webhook address set in Paystack, and plan prices are in the plans table (A16, PLT-017) but the public pricing page does not show them yet. Until then a daily clock expires trials and suspends unpaid hotels, and platform staff activate pilots by hand in the platform console (decision 5e, PLT-008).

## Hacky or doubtful
- `housekeeping_tasks` is deprecated (replaced by `hk_tasks`) but still in the schema because tables are never dropped.
- Frontend calls to views/rpc use `(supabase.from as any)` / a `callRpc` wrapper, so many are untyped. `src/integrations/supabase/types.ts` is generated but not used strictly.
- `docs/functions.md` permission/error columns were extracted by regex from function bodies. Helpers that check permissions indirectly (e.g. via a row's property) may show fewer keys than they really need. Read the function when it matters.
- `pg_cron` is required by one migration; plain Postgres without it fails there (the check script stubs it).
- Some UI lists are capped (e.g. 200 folios) with no pagination.
- `bulk_add_rooms` is capped at 500 rooms per call.
- Some `package.json` dependencies from the starter template may be unused (recharts is used; others like embla/cmdk/vaul/react-day-picker/input-otp/resizable-panels likely not). Their UI wrappers were deleted; the packages were left in place to avoid lockfile churn.

## Sign-in and Create your hotel (fixed 30 Sep 2026)

Two bugs stopped the first real signup on the live project. Both are fixed on branch `claude/audit-status-report`, and browser tests in `e2e/sign-in.spec.ts` (`npm run test:e2e`, local Supabase only) cover the three flows.

1. **Blank page after the email link or sign-in.** Console: "Uncaught undefined" in `MatchInnerImpl`, no network error. Cause: Supabase announces `SIGNED_IN` again when it reads the session from the confirmation link, on sign-in and on tab focus. The root listener in `src/routes/__root.tsx` reloaded the router and cancelled the in-flight `my_context` check while the route guards were redirecting from `/dashboard` to `/create-hotel`. The guard failed with an empty error and nothing rendered. Fix: the listener no longer reloads on sign-in (navigation already runs the guards). It resets only when a different user signs in, and on sign-out it clears cached data.
2. **Create hotel stuck on "Creating…".** `create_hotel` succeeded (the hotel, property, trial, roles and Nigerian defaults were all created), but the page only marked the cached context stale before navigating. The dashboard guard read the stale `has_hotel = false` and sent the user back to the same page, so it never re-rendered. Fix: the page fetches the fresh context before navigating, both guards revalidate stale context, and the button is always released.

Lesson: route guards that read cached React Query data must revalidate, and auth listeners must not reload the router during a navigation.

## Slow first load (fixed 1 Oct 2026)

On a slow first load, a click on Sign in before the page had started up made the browser submit the form itself (a reload to `/auth?`), and text typed before start-up was lost. This made one browser test flaky. The sign-in and Create hotel forms are now locked until the page is ready. Still open: React reported a "hydration mismatch" on the first load of `/auth` once in about ten cold starts. It does no harm now that the form is locked, but the cause is not found yet.

## New guest inside the booking form (fixed 1 Oct 2026)

Found in the hand test on the live project. Saving a new guest from inside the booking form also submitted the booking behind it, before a guest was chosen, and the database refused it with "Guest not found". The walk-in pop-up had the same fault. Cause: React passes a pop-up's submit up to the form it was opened from, even though the pop-up is drawn elsewhere on the page. The shared pop-up form (`FormDialog`) now keeps its submit to itself. The guest box also showed "New guest" instead of the name; it now shows the name. Only these two screens open a pop-up form inside another form. Browser tests in `e2e/desk-journey.spec.ts` click through new guest, booking, check-in, charge, payment and check-out, and check the walk-in case.

## Security: TanStack Start CVE-2026-102989 (fixed 2 Oct 2026)

Vercel refused the first build because `@tanstack/react-start` 1.168.32 is in the range affected by CVE-2026-102989 (GHSA-qx66-fv34-fjm8, critical, disclosed 30 Sep 2026): a crafted link to a server-function address (`/_serverFn/...`) could make an app return the attacker's page from its own address. Upgraded to `@tanstack/react-start` 1.168.60 (with `@tanstack/start-server-core` 1.169.39, `@tanstack/react-router` 1.170.41, `@tanstack/router-plugin` 1.168.42). The Vercel override `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS` is not used. `e2e/security.spec.ts` fails if a vulnerable version comes back and checks that a crafted server-function link cannot put a page or script on our address. Note: on 2 Oct 2026 neither `npm audit`, OSV nor GitHub's global advisory list knew this advisory yet, so a clean audit is not proof; Vercel's build check is a useful second line.
