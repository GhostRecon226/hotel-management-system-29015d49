# Hotel Desk: full assessment, 5 October 2026

Read-only review. No code, migration, data or setting was changed. No command ran against the live database; the repository stayed linked to the practice project (`vxkresricneodgvqphrn`). Written by Claude Code for Peter, in stages, so each part is saved as it is finished.

How to read it:
- Sizes: S = up to 2 days, M = up to 2 weeks, L = more than 2 weeks.
- Ratings: GREEN = a hotel can rely on it; AMBER = works with gaps; RED = not safe or not usable.
- Every claim names its evidence (file, test, table, function or command). UNVERIFIED marks what I could not check.
- "Code at" means branch `main`, commit `f94222b` (stage 1 and 2 merged and live).

Status of each part: Part 1 done. Part 2 modules 1 to 12 done, 13 to 19 in progress.

---

## Part 1. Health check

### 1.1 Database tests

Command: `scripts/test-db.sh` (local Supabase in Docker, rebuilt from the 45 migrations, then the upgrade test from the live state of 30 Sep).

| Result | Count |
|---|---|
| Checks passed | 648 (619 in 15 test files, plus 29 upgrade checks) |
| Checks failed | 12, all known, none new |

The 12 known failures. "Hotel feels it" means a hotel would notice in normal use.

| # | Test (file) | Root cause in one line | Hotel feels it | Fix size |
|---|---|---|---|---|
| 1 | FO-003 check-in needs the registration card accepted (`13_reservations.sql`) | Check-in has no "guest accepted the registration card" step; `check_in` takes the card details but no acceptance flag. | Yes. Front desk still prints and files a paper card. | S (flag), M (with signature capture) |
| 2 | FO-007 complimentary upgrade keeps the booked rate (`13_reservations.sql`) | No function moves a booking to a better room type while keeping the price; `move_room` re-prices or refuses. | Yes. Upgrades are daily practice. | M |
| 3 | FO-008 an in-house stay can be shortened (`13_reservations.sql`) | `extend_stay` only allows later dates ("must be after ..."). | Yes. A guest who says "I leave tomorrow, not Friday" cannot be changed until check-out. | S |
| 4 | FO-008 shortening removes unused nights (`13_reservations.sql`) | Same cause as 3: nights stay booked until check-out. | Yes. Availability shows the room as taken. | (same fix as 3) |
| 5 | HK-002 a task assigned to nobody cannot be started (`14_lifecycle.sql`) | `start_hk_task` does not check that the task has an assignee. | Slightly. Work can start with no name on it. | S |
| 6 | HK-003 attendant is told about a failed inspection (`14_lifecycle.sql`) | `inspect_hk_task` writes no notification for the attendant. | Yes. The attendant does not know the room must be cleaned again. | S |
| 7 | ROOM-004 a manual "dirty" override needs a reason (`14_lifecycle.sql`) | `set_room_condition` accepts an empty reason. | Slightly. Weaker audit of room status changes. | S |
| 8 | PLT-007 a hotel can add another property (`15_accounts.sql`) | No function creates a second property; the property limit can never apply. | Only hotel groups. | M |
| 9 | PLT-004 a Ghana property uses cedi (`17_more_features.sql`) | `app.seed_property_defaults` seeds Nigerian currency and taxes for every country. | Only outside Nigeria. | S |
| 10 | RES-013 an arrival-ready flag exists (`17_more_features.sql`) | Not built: no flag that says "room, deposit and documents are ready". | Yes, mildly. Front desk checks each arrival by hand. | S |
| 11 | HK-002 an attendant sees only their own tasks (`17_more_features.sql`) | The `hk_tasks` read rule shows every task of the property. | Yes, mildly. Attendants see colleagues' lists. | S |
| 12 | SET-008 inspection can be switched off per property (`17_more_features.sql`) | Every completed task waits for an inspection; there is no property setting. | Yes for small hotels without a supervisor: rooms stay "waiting inspection". | S |

### 1.2 Other checks

| Check | Command | Result |
|---|---|---|
| Browser tests | `npx playwright test` | PASS, 28 of 28 |
| Type check | `npm run typecheck` | PASS |
| Money in browser code | `npm run check:money` | PASS ("no money arithmetic in browser code") |
| Colour contrast | `npm run check:contrast` | PASS (all text pairs meet WCAG AA 4.5:1) |
| Public page blanks | `check:confirm` (only on branch `claude/public-pages`; run in a temporary copy) | FAIL by design: 21 `[TO CONFIRM]` blanks (about 2, contact 4, privacy 8, terms 4, faq 3). That branch cannot build until they are filled. |
| Production build | `npm run build` | PASS, with warnings: 7 uses of the deprecated `createServerFn().inputValidator()` (`src/lib/invite.functions.ts`, `exports.functions.ts`, `id-photos.functions.ts`); Vite says `vite-tsconfig-paths` is no longer needed; the charts library `recharts` adds 561 KB (102 KB compressed) to the server bundle. |
| Known vulnerabilities | `npm audit` | PASS, 0 vulnerabilities |
| Outdated packages | `npm outdated` | 17 behind. Major versions waiting: eslint 10, TypeScript 7, zod 4, recharts 3, lucide-react 1, react-day-picker 10, @vitejs/plugin-react 6. Nitro is a beta build (3.0.260603-beta). None is a security fix. |
| Dependabot alerts | `gh api` | UNVERIFIED. The GitHub command-line tool is not installed on this Mac and the repository is private. Look at: repository > Security > Dependabot alerts. |

### 1.3 Migrations and docs

**Migrations.** The folder has 45 files. The practice project records the same 45, one to one (`supabase migration list --linked`, practice). Live was confirmed at 45 on 7 Oct after the stage 1 and 2 release (fingerprint check). Not re-run today because this task forbids live commands.

**Docs out of date:**

| Doc | What is wrong | Evidence |
|---|---|---|
| `docs/data-model.md` | Lists none of the 36 error codes the database raises (for example `E_ROOM_TAKEN`, `E_ID_PHOTO_REQUIRED`, `E_PLAN_LIMIT`). | `grep app.fail('E_` in migrations gives 36 codes; `grep E_` in the doc gives 0. |
| `docs/decisions.md` | No entries for the 6 Oct decisions: free-text room labels, ID photos, the Allow switch, the 12-month keep period, delete rules. | `grep` for "6 Oct", "ROOM-005", "ID photo" finds nothing. |
| `docs/status-report.md` | The long requirement table (written 30 Sep) still marks DAY-003, DAY-006 and FIN-015 "Missing" although they are built and tested (DAY-003: 14 checks, DAY-006: 23 checks, FIN-015: 6 checks, all passing). The short "fixed" tables in the same file are correct. | Lines about 404, 413, 416 against `14_lifecycle.sql`, `19_same_day.sql`, `12_ledger.sql`. |
| `docs/setup-checklist.md` | Section C (practice project) shows nothing ticked, but the practice project exists with all 45 migrations. Sections A, B, D, G, H are untouched. E: 4 of 11 done; F: 1 of 4. | Tick count per section; practice migration list. |
| `docs/functions.md` | Missing 19 of the 139 browser-callable functions: `add_rooms_named`, `add_rooms_range`, `begin_id_photo_upload`, `finish_id_photo_upload`, `open_id_photo`, `list_id_photos`, `delete_id_photo`, `get_id_photo_settings`, `set_id_photo_settings`, `cancel_subscription`, `checkout_outstanding`, `kpi_summary`, `post_check_out_charge`, `preview_check_out_charge`, `preview_charge`, `preview_reservation_fee`, `require_permission`, `update_my_profile`, `waive_same_day_charge`. Function bodies changed since 30 Sep are also not reflected. | Names in the doc compared with the practice function list. |
| `AGENTS.md` | Says colour tokens live in `src/styles.css` (now `src/theme.css`) and names `/design` as the reference screen (deleted on `claude/public-pages`, still on main). | `AGENTS.md` line 14; `src/theme.css`. |

### 1.4 Requirements against tests

Source: the requirement table in `docs/status-report.md` (113 rows, the copy of the R1 workbook kept with this app). The workbook itself (`hms-reference-backend/docs/HMS_R1_Requirements.xlsx`) could not be parsed by my reader: UNVERIFIED that the two match row for row.

- **Rows with no test tag (14):** ADM-009 exports, DAY-005 night audit gate, FIN-016 cashier shifts, GST-006 feedback, PLT-009 platform staff role, PLT-010 break-glass access, PLT-012 subscription billing, RES-012 groups, RPT-002 live views, RPT-003 figures trace to the ledger, RPT-004 report screens, SET-002 room types, SET-003 room inventory, SET-006 charge codes and payment methods. Of these, SET-002, SET-003, SET-006 and RPT-002 are used by every other test, so they are covered indirectly, not by name.
- **Test tags with no row (1):** DAY-006b (same-day check-out charge, 28 checks in `21_same_day_checkout.sql`). Add a row.
- **Rows marked done that do not work:** none. Every failing test belongs to a row marked "Partly built" or "Missing".
- **Rows marked "Missing" that do work:** DAY-003, DAY-006, FIN-015 (see 1.3).
- **Totals in the table:** 72 built and works, 24 partly built, 9 missing (3 of them wrongly), 8 built but untested.

### 1.5 Security and rule hygiene

The rules below are the 10 rules in `hms-reference-backend/CLAUDE.md`. This repository has no `CLAUDE.md`; its own rules are in `AGENTS.md`. I checked the 10 rules against this app on the practice database (same schema as live).

| Rule | Check | Result |
|---|---|---|
| 1 Never edit a pushed migration | `supabase migration list` shows every local file recorded remotely with the same version; the stage 1 and 2 releases added new files only. | PASS. (A byte-for-byte check of old files against what live ran is not possible from migration history; UNVERIFIED beyond file names.) |
| 2 Every table has `tenant_id` and row-level security | 46 tables; all 46 have row-level security on. 3 have no `tenant_id`: `tenants` (the hotel list itself), `plans` and `permissions` (shared reference lists). | PASS (the 3 are correct by design). |
| 3 Helpers in `app`, callable functions in `public`, only `public` granted | No `app` function is callable by signed-in users (stage checks). | PASS, with one exception: the `btree_gist` extension is installed in `public`, so about 200 of its internal functions (`gbt_*`, `*_dist`) are callable by signed-in users. They read no hotel data. Supabase's linter calls this "extension in public". Fix: move the extension to the `extensions` schema. Size S. |
| 4 Security definer, fixed search path, permission check first | All 139 of our own browser-callable functions are security definer with a fixed search path. 13 do not call `app.can` or `app.require` directly; each one's first step is `app.reservation_for_write(id, 'permission')` or `app.mnt_ticket_for_write`, which check the hotel and the permission (`20260929101000_reservations.sql` line 245). | PASS. |
| 5 Errors through `app.fail`, codes in `docs/data-model.md` | All raised errors use `app.fail`. The doc lists none of the 36 codes. | FAIL on the doc half. Size S. |
| 6 Ledger never updated or deleted | Triggers block UPDATE, DELETE and TRUNCATE on `folio_transactions`, `folio_tax_lines`, `audit_events` (`20261001100000_lock_ledger_and_audit.sql`); tested in `12_ledger.sql` and the upgrade test. | PASS. |
| 7 Every money or stock write takes an idempotency key | `folio_transactions`, `invoices`, `reservations`, `approvals` have `idempotency_key NOT NULL` and a unique (hotel, key) constraint, so the database itself refuses a second row with the same key. 4 browser functions take the key from the screen (`post_charge`, `post_payment`, `apply_discount`, `issue_invoice`); 5 build a fixed key themselves (`room:<booking>:<date>`, `svc:<id>`, `approval:<id>`). The same-day charge makes a fresh key only after a reversal, under a lock on the booking (`app.insert_same_day_charge`). | PASS. No stock or inventory module exists yet. |
| 8 Default-deny grants | Signed-out visitors have no rights on any table. Signed-in users have no insert, update or delete right on any table; they read through row-level security only. `guest_documents` and `guest_document_files` have no read right at all (numbers and photos only through functions). | PASS. |
| 9 Every new function has a test; every requirement has a workbook row | 14 requirement rows have no test tag (1.4). The workbook tool `reqs_data.py` lives only in the reference repo and is not used here. | PARTIAL. The rule does not fit this repo as written. |
| 10 Seed data from `data_perm.py` | Not used here: reference data is seeded inside the migrations. | NOT APPLICABLE to this repo. |

**Secrets in the repository:** none found. A scan of every tracked file for Supabase secret keys, service-role tokens, Resend keys, live payment keys and database passwords found nothing; the only `.env` file tracked is `.env.example` with empty values.

### 1.6 Known leftovers

| Item | State | Evidence |
|---|---|---|
| DAY-006 same-day charge | Built and live: one night charged at check-in for a same-day stay, and at check-out for an overnight stay that leaves on the arrival day (DAY-006b); managers can waive with a reason. The requirement table still says "Missing" (doc only). | `19_same_day.sql`, `21_same_day_checkout.sql` |
| A16 plan tiers and prices | Open. Four plans exist with room, property and user limits (`public.plans`, 4 rows) but no prices and no billing (PLT-012 missing). | practice `plans` count |
| A14 cloud region and data protection advice | Open. The data sits in Ireland (EU); legal advice under the NDPA 2023 is pending; 3 privacy blanks depend on it. | `docs/decisions.md`, privacy blanks |
| A11 tax seed sign-off | Open. Service charge 10% and VAT 7.5% are placeholders until the accountant confirms; `docs/accountant-brief.md` lists the questions. | `docs/accountant-brief.md` |
| Copied roles do not get new permissions | By design: a hotel's copied role keeps the permissions it had. Live has no copied roles today (checked 7 Oct), so nobody is affected yet. No warning on screen when new permissions arrive. | live roles check, 7 Oct |
| Check-in form loses typed data after a reload | Seen once on practice. The form keeps what was typed only in the open page. No draft saving. | practice test, 7 Oct |
| `rls_auto_enable` difference | Live has a Supabase-made event trigger that switches on row-level security for new tables; practice does not. Harmless. | fingerprint diff, 7 Oct |
| Setup checklist A to F | A 0/3, B 0/3 (no own domain yet), C 0/10 ticked (practice project done in fact), D 0/7 (no Resend email yet), E 4/11, F 1/4. | `docs/setup-checklist.md` |
| Email sender every 5 minutes | Off while on Vercel Hobby; booking confirmations and alerts queue and are not sent. | `vite.config.ts`, deployment plan 4.4 |
| Public pages | Built on `claude/public-pages`, not merged; 21 blanks. | check:confirm |
| Vercel Authentication on the long team address | Still on for `...-peters-projects-ee85d5d5.vercel.app`; the short live address is open. | earlier curl checks |

---

## Part 2. Module by module

Test counts come from tags in `supabase/tests/db` (for example 54 checks tagged `[PLT-...]`) and the 28 browser tests in `e2e/`.

### Module 1. Platform and tenancy

- **What exists:** tables `tenants`, `properties`, `plans` (4 plans: Starter 20 rooms, 1 property, 10 users; Standard 60, 1, 25; Pro 150, 3, 60; Enterprise no limits), `tenant_subscriptions`, `subscription_history`; functions `create_hotel`, `subscription_info`, `change_subscription`, `cancel_subscription`, server-only `app.platform_set_subscription`, `app.run_subscription_clock` (pg_cron job `subscription-clock`, daily 00:15 UTC); read-only guard `app.assert_writable` on every write, with a settlement exception so guests in house can still pay and leave; plan limit trigger `app.enforce_plan_limit`. Screen: Create your hotel; trial banner; Admin > subscription. Tests: 54 `[PLT-...]` checks in `15_accounts.sql`, `17_more_features.sql`, `11_isolation.sql`.
- **Works:** one-step hotel creation for a confirmed email (PLT-001, 002); one hotel never sees another (PLT-003, 14 checks; 18 checks in `11_isolation.sql`); the 30-day trial ends by itself and the hotel becomes read-only (PLT-005); a read-only hotel can still settle and check out (PLT-006); plan limits stop new rooms and users without deleting anything (PLT-007 partly; proven again for rooms in `23_room_labels.sql`).
- **Broken or risky:**
  - No second property can be created, so hotel groups cannot use one account and the property limit never applies (PLT-007, failing test).
  - A Ghana (or any non-Nigerian) hotel gets naira and Nigerian taxes (PLT-004, failing test, `app.seed_property_defaults`).
  - Activating a paying hotel or a pilot is only possible by running SQL as the database owner (`app.platform_set_subscription`); there is no platform staff screen (PLT-009, missing). One typing mistake in SQL on live could affect the wrong hotel.
  - No billing: plans have no price and no payment link (PLT-012, missing; decision A16 open).
- **Not built:** platform admin console (tenant list, plan change, suspend, notes); subscription billing through Paystack or Flutterwave; second property and a group view; country templates for Ghana, Kenya and others.
- **Test coverage:** strong for isolation, trial and read-only; none for billing and platform staff (not built).
- **Rating:** AMBER. Safe and correct for a single-property Nigerian hotel; not ready to sell to groups or to bill automatically.
- **Next three actions:** (1) a small platform admin screen with audit for activate, extend and suspend, replacing hand SQL, M; (2) country templates (currency, taxes, payment methods) starting with Ghana, S; (3) create-property function and screen with the plan limit, M.

### Module 2. Sign-up, sign-in, password reset, staff invites, sessions

- **What exists:** screens `auth.tsx` (sign in, create account), `check-email.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `create-hotel.tsx`; server function `src/lib/invite.functions.ts` (permission checked first, service role sends the invite, orphan accounts removed on failure); `register_invited_user`, `update_my_profile`; session handling in `src/routes/__root.tsx` (clears all cached data on sign-out or user switch). Tests: `e2e/sign-in.spec.ts` (3), `e2e/password-reset.spec.ts` (2), `[ADM-...]` 24 checks.
- **Works:** sign-up with email confirmation, sign-in, sign-out, password reset from the email link (browser test), staff invites without temporary passwords, a second person in the same browser never sees the first person's data (`__root.tsx` lines 119 to 135). Proven on live on 5 Oct (sign-in) and on practice on 7 Oct (sign-up, confirmation).
- **Broken or risky:**
  - Sign-up, invite and reset emails go through Supabase's built-in sender, which allows only a few emails per hour (setup checklist D, Resend SMTP not set). With more than a handful of sign-ups or invites in an hour, emails stop and people cannot get in. Evidence: checklist section D 0 of 7 done; deployment plan 4.2.
  - No two-step sign-in for hotel staff, even for administrators who can see guest ID photos and all money. UNVERIFIED whether Supabase multi-factor could be switched on without app changes; the app has no screen for it.
  - Live Site URL and redirect list depend on the vercel.app address; moving to your own domain (checklist E9 to E11) needs the order you agreed.
- **Not built:** two-step sign-in, "sign out everywhere", session time-out for shared front desk computers, staff PIN or quick switch, single sign-on for chains.
- **Test coverage:** strong for the happy paths (browser tests); thin for email failure cases (none simulate Supabase's hourly email limit).
- **Rating:** AMBER. Works today; will fail under real sign-up volume until Resend SMTP is set.
- **Next three actions:** (1) set Resend SMTP on both Supabase projects (your step, checklist D), S; (2) two-step sign-in for administrators and managers, M; (3) automatic sign-out after a chosen idle time on front desk computers, S.

### Module 3. Roles, permissions, custom roles, approvals

- **What exists:** tables `roles` (10 built-in), `permissions` (73), `role_permissions` (304 for built-in roles), `user_property_roles`, `approval_limits`, `approvals`, `notifications`; functions `copy_role`, `rename_role`, `set_role_permissions`, `delete_role`, `assign_role`, `remove_role`, `set_user_status`, `set_approval_limit`, request functions for discount, adjustment, reversal, refund and checkout, `decide_approval`; guards `app.assert_can_grant` (E_ESCALATION), last-administrator guard (E_LAST_ADMIN), segregation of duties (E_SOD and `approvals_sod` check). Screens: Admin (users, roles, limits), Approvals. Tests: `20_builtin_limits.sql` (17), ADM checks (24), approval checks in `12_ledger.sql`.
- **Works:** nobody can hand out a permission or limit they do not hold; the last System Administrator cannot be removed; the requester can never approve their own request; built-in roles carry per-hotel limits (decision 6c); reservation officers see no ID numbers or photos (6b, GST-002).
- **Broken or risky:**
  - A copied role keeps only the permissions it had when copied. When we add a permission (for example the three ID photo permissions on 7 Oct), copied roles do not get it and nobody is told. Live has no copied roles today (checked 7 Oct), so no hotel is affected yet.
  - Approvals arrive as in-app notifications only; with the email sender off (Module 15), a manager away from the screen does not know a discount is waiting.
- **Not built:** approval by phone or email link; delegation while a manager is on leave; a "what can this role do" plain-language summary; role templates by hotel size.
- **Test coverage:** strong.
- **Rating:** GREEN for control and safety; the notification gap belongs to Module 15.
- **Next three actions:** (1) when new permissions ship, list copied roles that lack them on the Admin screen with one "add" button, S; (2) approval alerts by email or WhatsApp once Module 15 sends, S after Module 15; (3) a printable role summary for hotel owners, S.

### Module 4. Setup

- **What exists:** screens Setup > Property details, Room types, Rooms, Rate plans and prices, Tax, charges and payments, Exchange rates; ID photo switches (stage 2); functions `update_property`, `save_tax_rate` and related, `save_charge_code`, `save_payment_method`, exchange rate save, `set_id_photo_settings`, `get_id_photo_settings`; default charge codes (room, restaurant, laundry, minibar, service charge, VAT, cancellation fee, no-show fee), payment methods (cash, POS, bank transfer, card), document numbers and taxes (service charge 10%, VAT 7.5%, levy 0%) seeded for each new property (`app.seed_property_defaults`). Tests: 19 `[SET-...]` checks; `18_server_figures.sql` (tax previews from the server).
- **Works:** property details; tax lines with a rounding remainder rule (`20260930160100_tax_rounding_remainder.sql`); charge codes and payment methods per property; money with 4 decimal places (`20260930110400_money_precision.sql`); ID photo Allow and Require switches with audit (24_id_photos.sql).
- **Broken or risky:**
  - Service charge 10% and VAT 7.5% are placeholders until your accountant confirms (A11, `docs/accountant-brief.md`). If they are wrong, every bill a hotel issues is wrong, and issued invoices cannot be changed (they are insert-only).
  - No switch to turn off inspection for small hotels (SET-008, failing test).
  - The business date and base currency cannot be changed after creation (by design, SET-001), but there is also no guided first-day setup, so a new hotel can start trading before it has set taxes.
- **Not built:** a setup wizard with a "ready to trade" checklist; consumption tax and tourism levy options per state (see Part 4); hotel logo and invoice footer; cancellation policy text for confirmations.
- **Test coverage:** thin for screens, strong for tax maths.
- **Rating:** AMBER. Mechanics are sound; tax content is not signed off.
- **Next three actions:** (1) accountant sign-off of the tax seed and the questions in `accountant-brief.md` (your step), S; (2) inspection on or off per property (SET-008), S; (3) first-day setup checklist screen, M.

### Module 5. Room types, rooms, rates, rate plans, availability, restrictions

- **What exists:** tables `room_types`, `rooms`, `rate_plans`, `rate_plan_prices` (room type, date range, amount, currency), `room_blocks`, `reservation_nights`; functions `save_room_type`, `save_room`, `bulk_add_rooms`, `add_rooms_range`, `add_rooms_named`, `save_rate_plan`, `save_rate_plan_price`, `get_availability`, `request_room_block`, `approve_room_block`; screens Rooms board, Room detail, Setup rooms, Availability. Tests: 58 `[ROOM-...]` checks; 48 in `23_room_labels.sql`; 4 browser tests in `rooms-add.spec.ts`.
- **Works:** free-text room labels (numbers, prefixes, names, accents), natural order, add one or several rooms with a preview, the plan room limit; out-of-order and out-of-service blocks with approval that cannot oversell (ROOM-002, 003); safe last-room booking under a lock (`app.assert_available`).
- **Broken or risky:**
  - Prices are one amount per room type per date range. There is no weekday or weekend price, no minimum stay, no closed-to-arrival or closed-to-departure, no seasons by name and no length-of-stay discount (`rate_plan_prices` columns: `valid_from`, `valid_to`, `amount`, `currency` only). A hotel that charges more on Fridays must create a date range for every Friday.
  - A dirty override needs no reason (ROOM-004, failing test).
  - No overbooking allowance, although requirement SET-002 asks for one: `room_types` has no such column (columns: code, name, max_adults, max_children, description, is_active).
- **Not built:** rate calendar screen, weekday prices, restrictions, packages (room plus breakfast), promotions and codes, derived rates (corporate = BAR minus 10%), channel rate push.
- **Test coverage:** strong for rooms and blocks; thin for rates (prices only).
- **Rating:** AMBER. Rooms GREEN; rates too basic for revenue management.
- **Next three actions:** (1) weekday prices on a rate plan, M; (2) minimum stay and closed-to-arrival per date, M; (3) a rate calendar screen showing prices by day and room type, M.

### Module 6. Reservations

- **What exists:** tables `reservations` (source, guarantee, hold, group, fees, override), `reservation_nights`, `reservation_guests`, `group_bookings`; functions `create_reservation`, `modify_reservation`, `confirm_reservation`, `cancel_reservation`, `mark_no_show`, `reinstate_reservation`, `assign_room`, `unassign_room`, `set_reservation_guests`, `preview_reservation_fee`, `walk_in_check_in`; screens Reservations list, New booking, Booking detail, Availability. Tests: 42 `[RES-...]` checks, `desk-journey.spec.ts` (2).
- **Works:** booking with price taken from the rate plan, tentative holds that expire, deposits by plan policy, cancellation and no-show fees with free-cancellation days, reinstating, walk-ins, same-day stays (DAY-006); a new guest made inside the booking form does not submit the booking (browser test).
- **Broken or risky:**
  - A stay cannot be shortened before check-out (FO-008, 2 failing checks); the room stays unavailable for the nights the guest will not use.
  - No complimentary upgrade that keeps the rate (FO-007).
  - Groups: the `group_bookings` table and `group_id` exist but group booking is untested (RES-012 "built, untested") and there is no group screen for 20 rooms at once.
  - Booking confirmations to guests are queued but not sent (Module 15).
  - No arrival-ready flag (RES-013).
- **Not built:** online booking engine, channel manager (Part 4), group block with rooming list, corporate accounts, booking by WhatsApp, waitlist.
- **Test coverage:** strong for single bookings; none for groups.
- **Rating:** AMBER.
- **Next three actions:** (1) shorten a stay (FO-008), S; (2) complimentary upgrade (FO-007), M; (3) group booking screen with a rooming list, L.

### Module 7. Front desk

- **What exists:** screens Front Desk (Arrivals, In house, Departures today, with a plain Check out button), Check-out page, Walk-in, Move room, Extend stay, Void check-in; views `v_arrivals`, `v_in_house`, `v_checkouts`; functions `check_in`, `walk_in_check_in`, `check_out`, `undo_checkout`, `move_room`, `extend_stay`, `void_check_in`, `post_room_charges`, `post_check_out_charge`, `waive_same_day_charge`, `get_front_desk_rooms`. Tests: 63 `[FO-...]` checks, `19_same_day.sql` (23), `21_same_day_checkout.sql` (28), browser tests `desk-journey.spec.ts`, `front-desk-checkout.spec.ts`, `id-photos.spec.ts` (Require at check-in).
- **Works:** check-in with ID type, number and expiry, room readiness check with a manager override reason, deposit check with waiver, optional ID photo (stage 2); check-out only at zero balance or with an approved unsettled check-out; undo check-out the same day; room moves create a cleaning task; same-day stays and same-day check-outs charge one night (DAY-006, DAY-006b). Hand-tested on live on 5 Oct (Euro Bar Hotel) and on practice on 7 Oct.
- **Broken or risky:**
  - No registration card acceptance step (FO-003).
  - A check-in form open for a long time can lose what was typed if the page reloads (seen on practice, 7 Oct); the form keeps a draft only in the open page.
  - No early check-in or late check-out charge: no charge code or function for it (`grep` for late or early check-out in migrations finds nothing). Hotels charge these by hand with "Post charge".
  - Front Desk lists show "Check out room 101" to screen readers (kept for an existing test).
- **Not built:** registration card print and e-signature, key card encoding (Part 4), express check-out by link, pre-arrival online check-in, a night-by-night room rack.
- **Test coverage:** strong.
- **Rating:** GREEN for the core desk flow; the gaps are conveniences.
- **Next three actions:** (1) registration card step with print and acceptance (FO-003), M; (2) early check-in and late check-out charge with a preset amount, S; (3) keep a draft of the check-in form across reloads, S.

### Module 8. Guests

- **What exists:** tables `guests` (name, phone, email, nationality, address, notes, status, merged, anonymised), `guest_documents`, `guest_document_files`, `guest_feedback`; functions `save_guest`, `get_guest` (masks ID numbers), `search_guests` UNVERIFIED name, `save_guest_document`, `remove_guest_document`, `merge_guests`, `anonymise_guest`, `add_guest_feedback`, ID photo functions; screens Guests list, Guest profile (Details, Documents, Stay history, Feedback), Merge. Tests: 72 `[GST-...]` checks, `24_id_photos.sql` (63), `id-photos.spec.ts` (5).
- **Works:** one profile per person across stays; ID numbers masked for roles without permission; personal data never written into the audit trail (GST-003); merge moves bookings, folios, documents and photos; anonymise removes personal data and photos while keeping the ledger, and is refused while a booking is not over (GST-005); ID photos private, audited and deleted on schedule.
- **Broken or risky:**
  - Feedback is built but untested (GST-006).
  - No duplicate warning when a new guest looks like an existing one; staff must search first.
  - No blacklist or "do not rent" flag: `guests` has no such column. A hotel cannot warn the desk about a guest who left without paying.
- **Not built:** VIP and blacklist flags, preferences (room, pillow, diet), birthdays and anniversaries, loyalty points, marketing consent, guest portal.
- **Test coverage:** strong.
- **Rating:** GREEN for data protection and correctness; AMBER for guest service features.
- **Next three actions:** (1) VIP and "do not rent" flags with a reason, visible at booking and check-in, S; (2) duplicate warning on new guest (same phone or email), S; (3) preferences and marketing consent fields, S.

### Module 9. Folios, charges, payments, refunds, adjustments, reversals, invoices, tax, the ledger

- **What exists:** tables `folios`, `folio_transactions` (insert-only), `folio_tax_lines` (insert-only), `invoices` (insert-only snapshots), `document_sequences`, `charge_codes`, `payment_methods`, `tax_rates`, `exchange_rates`; views `v_folio_balances`, `v_folio_transactions`; functions `post_charge`, `post_payment`, `apply_discount`, request functions for adjustment, reversal, refund, `transfer_transaction`, split folio, `close_folio`, `issue_invoice`, `calculate_tax`, `preview_charge`, `checkout_outstanding`; screens Folios list, Folio detail (Post charge, Record payment, Discount, Adjustment, Refund, Split folio, Transfer, Close, Interim invoice), Invoice page. Tests: 67 `[FIN-...]` checks, `12_ledger.sql` (82 checks), `18_server_figures.sql` (33), `22_accountant_brief.sql` (10).
- **Works:**
  - The ledger cannot be edited or deleted, even by the database owner (E_IMMUTABLE triggers, tested on live on 1 Oct and in `12_ledger.sql`).
  - Entries must carry the open business date (E_DATE).
  - Every posting has a unique retry key at database level (Part 1, rule 7).
  - Discounts, adjustments, reversals and refunds above a limit wait for a second person; nobody approves their own.
  - A refund cannot exceed the credit on the folio (FIN-007).
  - All totals, taxes and balances come from the database; the browser does no money sums (`check:money`).
  - Invoices are numbered in sequence and never change after issue.
- **Broken or risky:**
  - Tax rates are placeholders (Module 4, A11).
  - Payments are recorded, not taken: no card or transfer gateway, no matching of bank transfers (Part 4).
  - A payment entered twice after a dropped connection is recorded twice. The retry key lives only while the payment form is open (`src/lib/folios.tsx` line 116: "stable idempotency key per open dialog"). Staff would see two lines and need a reversal with approval.
  - `issue_invoice` gets a fresh key on every click (`src/lib/checkout.tsx` line 101); a double click while the first request is slow could issue two interim invoices. UNVERIFIED whether the button is disabled while waiting.
  - No cashier shift close or cash-up report (FIN-016, missing).
- **Not built:** cashier shifts and cash drawer, city ledger and accounts receivable for companies, credit limits, deposits ledger report, FIRS e-invoice submission (Part 4), PDF invoice by email.
- **Test coverage:** strong (the best-tested module).
- **Rating:** GREEN for integrity. The money cannot be quietly changed or double-posted by retries. AMBER for features a finance team expects (shifts, city ledger).
- **Next three actions:** (1) warn before recording a payment that matches one made in the last few minutes on the same folio, S; (2) cashier shift open and close with a cash count (FIN-016), M; (3) city ledger for company accounts with statements, L.

### Module 10. Business date and night audit

- **What exists:** `app.roll_property` (one property, one sub-transaction: room charges, expire holds, no-shows, date plus one, stayovers, daily statistics; any error undoes all steps and notifies `fin.nightaudit.run` users once), `app.run_due_rollovers` (all hotels, up to 7 catch-up days per run, at each property's own time zone and roll time: `app.rollover_due`), pg_cron job `business-date-rollover` every 5 minutes, `business_date_log`, Admin > Business date ("Run due rolls now"), `post_room_charges`. Tests: 70 `[DAY-...]` checks, upgrade test runs a 3-day catch-up under the ledger lock.
- **Works:** automatic roll at the hotel's local roll time; catch-up after missed days; guests still in house past departure are extended and charged one night, up to the maximum stay (DAY-003, works though the old table says "Missing"); a failed roll changes nothing and alerts the managers.
- **Broken or risky:**
  - There is no night audit gate (DAY-005, missing): the date rolls even if the day has unposted problems; nobody signs off the day.
  - If the Supabase project is paused (free plan after a quiet week) or pg_cron stops, no hotel's date moves and no room charges post. UNVERIFIED which Supabase plan live is on; if it is Free, this is real.
  - Roll alerts are in-app notifications only (Module 15).
- **Not built:** a night audit checklist screen (unposted charges, unbalanced folios, no-shows to review), an end-of-day report sent to the owner.
- **Test coverage:** strong.
- **Rating:** AMBER. Correct and robust; missing the audit sign-off hotels expect and dependent on the database plan staying awake.
- **Next three actions:** (1) confirm live is on Supabase Pro, which does not pause (your step, checklist C), S; (2) night audit checklist screen before the roll, M; (3) daily end-of-day summary email or WhatsApp to the owner (needs Module 15), S after Module 15.

### Module 11. Housekeeping

- **What exists:** table `hk_tasks` (old `housekeeping_tasks` kept, unused), view `v_hk_board`; functions `create_hk_task`, `assign_hk_task`, `start_hk_task`, `complete_hk_task`, `inspect_hk_task`, `cancel_hk_task`, `set_room_condition`, `hk_staff`; automatic turnover task at check-out and room move; screens Housekeeping board, My tasks, Inspections, Lost and found. Tests: 19 `[HK-...]` checks.
- **Works:** turnover tasks appear by themselves; the inspector cannot be the cleaner (E_SOD and `hk_tasks_sod` check); a failed inspection reopens the task with the defects.
- **Broken or risky:** five known failures here: a task with nobody assigned can be started (HK-002); attendants see every task, not only their own (HK-002); the attendant is not told about a failed inspection (HK-003); no inspection on or off switch (SET-008); a dirty override needs no reason (ROOM-004). A small hotel without a supervisor will see rooms stuck in "waiting inspection".
- **Not built:** daily room assignment by floor or section, linen and amenity counts, minibar posting by the attendant, a phone-friendly attendant screen with large buttons. UNVERIFIED how My tasks looks on a phone; I checked tablet width only.
- **Test coverage:** thin (19 checks, 5 failing).
- **Rating:** AMBER.
- **Next three actions:** (1) fix the four housekeeping rules (HK-002 twice, HK-003, ROOM-004) in one migration, S; (2) inspection switch per property (SET-008), S; (3) daily assignment screen by section with a print-out, M.

### Module 12. Maintenance and service requests

- **What exists:** tables `maintenance_tickets`, `service_requests`; views `v_maintenance_tickets`, `v_service_requests`; functions `create_ticket`, `assign_ticket`, start, wait, resolve, `close_ticket`, `reopen_ticket`, `cancel_ticket`, `block_room_for_ticket`, `mnt_staff`, `create_service_request`, `assign_service_request`, `complete_service_request` (posts a charge once with key `svc:<id>`), `cancel_service_request`; screens Maintenance list, Ticket detail, Service requests. Tests: 10 `[MNT-...]` and 6 `[SVC-...]` checks.
- **Works:** ticket lifecycle with closer not equal to resolver (E_SOD); blocking a room from a ticket goes through the normal approval; closing a ticket releases its blocks; chargeable service requests post once.
- **Broken or risky:** thin tests for a module with a money path (service request charges). No photo on a ticket. No due time or priority alert.
- **Not built:** preventive maintenance schedule (generator, AC, pool), spare parts, contractor tracking, repeat-fault view per room.
- **Test coverage:** thin.
- **Rating:** AMBER.
- **Next three actions:** (1) more tests for service request charges and ticket reopen, S; (2) preventive maintenance schedule with reminders, M; (3) repeat-fault view per room, S.
