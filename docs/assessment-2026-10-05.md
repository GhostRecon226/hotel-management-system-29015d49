# Hotel Desk: full assessment, 5 October 2026

Read-only review. No code, migration, data or setting was changed. No command ran against the live database; the repository stayed linked to the practice project (`vxkresricneodgvqphrn`). Written by Claude Code for Peter, in stages, so each part is saved as it is finished.

How to read it:
- Sizes: S = up to 2 days, M = up to 2 weeks, L = more than 2 weeks.
- Ratings: GREEN = a hotel can rely on it; AMBER = works with gaps; RED = not safe or not usable.
- Every claim names its evidence (file, test, table, function or command). UNVERIFIED marks what I could not check.
- "Code at" means branch `main`, commit `f94222b` (stage 1 and 2 merged and live).

Status of each part: Part 1 done. All five parts done.

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

- **What exists:** tables `guests` (name, phone, email, nationality, address, notes, status, merged, anonymised), `guest_documents`, `guest_document_files`, `guest_feedback`; functions `save_guest`, `get_guest` (masks ID numbers), `search_guests`, `save_guest_document`, `remove_guest_document`, `merge_guests`, `anonymise_guest`, `add_guest_feedback`, ID photo functions; screens Guests list, Guest profile (Details, Documents, Stay history, Feedback), Merge. Tests: 72 `[GST-...]` checks, `24_id_photos.sql` (63), `id-photos.spec.ts` (5).
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

- **What exists:** tables `folios`, `folio_transactions` (insert-only), `folio_tax_lines` (insert-only), `invoices` (insert-only snapshots), `document_sequences`, `charge_codes`, `payment_methods`, `tax_rates`, `exchange_rates`; views `v_folio_balances`, `v_folio_transactions`; functions `post_charge`, `post_payment`, `apply_discount`, request functions for adjustment, reversal, refund, `transfer_transaction`, `split_folio`, `close_folio`, `reopen_folio`, `issue_invoice`, `calculate_tax`, `preview_charge`, `checkout_outstanding`; screens Folios list, Folio detail (Post charge, Record payment, Discount, Adjustment, Refund, Split folio, Transfer, Close, Interim invoice), Invoice page. Tests: 67 `[FIN-...]` checks, `12_ledger.sql` (82 checks), `18_server_figures.sql` (33), `22_accountant_brief.sql` (10).
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
  - `issue_invoice` gets a fresh key on every click (`src/lib/checkout.tsx` line 101). The button is disabled while a request is running (`folios/$id.tsx` line 70), so a double click is safe; two separate clicks a few seconds apart issue two interim invoices. Low risk: interim invoices are informational.
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

### Module 13. Lost and found

- **What exists:** table `lost_found_items`; functions `save_lost_found_item`, `set_lost_found_status`; screen Housekeeping > Lost and found (item, location, room, status). Tests: 1 check (`16_structure.sql`, `[HK-006]` "housekeeping logs a lost and found item").
- **Works:** logging an item with where and when it was found, and changing its status.
- **Broken or risky:** almost untested (1 check). No owner contact, no photo, no hand-over record (who collected it, with what ID). A valuable item handed to the wrong person leaves no trail.
- **Not built:** link to the guest who stayed in the room, notify the guest, disposal after a set number of days, hand-over signature.
- **Test coverage:** none to speak of.
- **Rating:** AMBER (usable as a log; weak as a control).
- **Next three actions:** (1) tests for status changes and permissions, S; (2) hand-over record with who collected and a reason, S; (3) suggest the last guest of the room and offer to notify them, S.

### Module 14. Reports and exports

- **What exists:** functions `dashboard_summary`, `kpi_summary`, `report_revenue_by_charge_code`, `report_payments`, `report_outstanding_balances`, `report_balances_by_guest`, `report_cancellation_rate`, `report_length_of_stay`, `audit_log`, `audit_filters`, `export_data` (CSV of reservations, guests or transactions, permission `rpt.export`, each export audited); table `daily_stats` written by the night roll; view `v_kpi_daily`; screens Dashboard, Reports, Admin > Audit log. Tests: `[RPT-001]` 4 checks (`14_lifecycle.sql`: rooms sold, room revenue, occupancy = rooms sold over rooms, ADR = revenue over rooms sold); `18_server_figures.sql` (33 checks on server-side money figures).
- **Works:** occupancy, ADR and RevPAR come from the database, not the browser, and the formulas are tested; outstanding balances; payments by method; revenue by charge code; audited CSV exports.
- **Broken or risky:**
  - "Every figure traces to ledger rows" (RPT-003) and the report screens (RPT-004) are untested.
  - Figures for a day exist only after that day's roll (`daily_stats`), so a missed roll (Module 10) leaves gaps.
  - No aged debt (30, 60, 90 days) because there is no city ledger.
- **Not built:** daily flash report for the owner, manager's report (the standard hotel daily report), forecast of the next 30 days, tax summary for VAT and service charge returns, PDF and scheduled reports, comparison with last year.
- **Test coverage:** thin.
- **Rating:** AMBER.
- **Next three actions:** (1) a "ledger equals report" test for each report (RPT-003), S; (2) manager's daily report with a tax summary, M; (3) a 30-day on-the-books forecast, M.

### Module 15. Email and messages

- **What exists:** table `notification_outbox` (channel, recipient, subject, body, attempts, back-off, dedupe key); triggers `outbox_reservation_confirmed` (email to the guest when a booking is confirmed) and `outbox_approval_alert` (email to staff for new notifications such as approvals); sender `src/lib/outbox.server.ts` through Resend; scheduled route `/api/cron/outbox`; Admin > Messages ("Run now" per hotel); tests `outbox-cron.spec.ts` (2), `outbox-cron-unit.spec.ts` (4).
- **Works:** the queue, retries with back-off, no duplicates, and the secret-protected sender (browser tests against a local stand-in for Resend).
- **Broken or risky:**
  - **Nothing is sent from live today.** The Vercel Production settings have no `RESEND_API_KEY` and no `OUTBOX_FROM_EMAIL` (Vercel variable list, 7 Oct), and the 5-minute schedule is off on Hobby (`vite.config.ts`). Booking confirmations and approval alerts pile up in the queue.
  - Sign-up, invite and password emails use Supabase's rate-limited built-in sender (Module 2).
  - Only two message types exist, both email. No templates per hotel, no hotel logo.
- **Not built:** WhatsApp and SMS (the main channels in Nigeria), pre-arrival and post-stay messages, payment reminders, the owner's daily summary.
- **Test coverage:** strong for the queue; none against the real Resend service.
- **Rating:** RED. A hotel would expect a guest to get a confirmation; none goes out.
- **Next three actions:** (1) your steps: verify a sending domain in Resend, add `RESEND_API_KEY` and `OUTBOX_FROM_EMAIL` to Vercel, set Resend SMTP in Supabase (checklist D), S; (2) on Hobby, run the sender once a day or move to Vercel Pro for every 5 minutes, S; (3) WhatsApp channel through a provider such as Twilio or Meta's Cloud API, M.

### Module 16. Audit trail and data protection

- **What exists:** `audit_events` (insert-only, blocked against update, delete and truncate, `20261001100000_lock_ledger_and_audit.sql`); guest audit stores only the names of changed fields (`20260930110200_guest_audit_privacy.sql`, GST-003); ID photo audit with ids only; Admin > Audit log with filters; `anonymise_guest`; ID photo keep period in `app.settings`; draft privacy notice (branch `claude/public-pages`). Tests: `[NFR-...]` 9 checks, GST-003 and GST-008 checks.
- **Works:** who did what and when, for bookings, money, roles, rooms and photos; the trail cannot be edited; guest personal data stays out of it; anonymise on request; ID photos private and deleted after 12 months.
- **Broken or risky:**
  - No general retention rule. Guest profiles, bookings and audit rows are kept forever; only ID photos have a keep period. The privacy notice says retention is "[TO CONFIRM]".
  - The NDPA 2023 items are open: legal basis for ID photos, the transfer safeguard for data in Ireland, a named data protection contact, a data processing clause with each hotel (privacy blanks, decision A14). UNVERIFIED whether a hotel of this size must register with the Nigeria Data Protection Commission; the lawyer should answer.
  - No subject access export for one guest (a hotel can export all guests as CSV, not "everything about Mrs X").
  - The audit log has no export and no "who viewed this guest" for ordinary profile views (only ID photo views are logged).
- **Not built:** retention schedule with automatic anonymisation of old guests, subject access report, consent records, data processing agreement acceptance at sign-up, breach log.
- **Test coverage:** strong for immutability and privacy of the trail; none for retention (not built).
- **Rating:** AMBER. Technically careful; the legal and policy half is not done.
- **Next three actions:** (1) lawyer's advice under the NDPA 2023 (your step, A14), S for us, unknown for the lawyer; (2) one-guest subject access report (PDF or CSV), S; (3) retention rule: anonymise guests with no stay for N years, M.

### Module 17. Public pages

- **What exists:** on branch `claude/public-pages`, not merged: home, pricing, FAQ, about, contact, privacy (draft), terms (draft), with a build check that refuses to build while blanks remain. On live, `/` only sends people to the sign-in page or the dashboard (`src/routes/index.tsx`).
- **Works:** 5 browser tests on that branch; legal pages marked as drafts; the build check works (21 blanks found today).
- **Broken or risky:** live has no public website, so a hotel that hears of Hotel Desk finds only a sign-in page. 21 blanks: company name, contact details, about text, payment terms, liability, the dates, and the privacy items above.
- **Not built:** sign-up from the pricing page with a chosen plan, demo request form, blog or case studies.
- **Test coverage:** thin but adequate for static pages.
- **Rating:** AMBER (ready except for your answers and legal text).
- **Next three actions:** (1) your answers for the 13 non-legal blanks, S; (2) lawyer's text for the 8 legal blanks, S for us; (3) merge and publish, S.

### Module 18. Design system and screens

- **What exists:** one theme file `src/theme.css`; shared components (`PageHeader`, `StatTile`, `RoomName`, `EmptyState`, `LoadingState`, `TableStateRow`, `FormDialog`); bundled font (no Google Fonts); contrast check (25 pairs, all pass AA); screenshots at 1366, 1440 and 1024 pixels (stage 1 and 2 reports).
- **Works:** consistent look across 30 screens; loading, empty and error states exist on lists; status colours always come with a text label; keyboard order checked on Front Desk (browser test); dialogs return focus.
- **Broken or risky:**
  - Phone use is UNVERIFIED for most screens. I saw the app at 560 pixels wide on practice (menu button, stacked cards) and at 1024; tables crowd at 1024 (dates wrap onto two lines). Housekeeping staff will use phones.
  - Wide tables do not switch to cards on small screens.
  - No offline mode: a lost connection stops every action (Part 3).
  - Bundle: charts library `recharts` is large (561 KB on the server side); UNVERIFIED first-load time on a slow Nigerian mobile connection.
- **Not built:** phone layout for housekeeping and maintenance, dark mode switch (tokens exist), print layouts for registration card and invoice, language other than English.
- **Test coverage:** none for layout; contrast only.
- **Rating:** AMBER.
- **Next three actions:** (1) phone layouts for My tasks, Maintenance and Front Desk lists, M; (2) measure load time on a throttled 3G connection and trim the charts library, S; (3) print layouts for invoice and registration card, S.

### Module 19. Deployment and operations

- **What exists:** Vercel project `hotel-management-system-29015d49` on the **Hobby** plan, functions in Dublin (dub1), every push deploys (main to Production, branches to previews); Supabase live `urbpxybyrfjczqbrpdsq` and practice `vxkresricneodgvqphrn`, both West EU (Ireland); daily ID photo clean-up (Vercel Cron 02:00 UTC); a manual backup of live taken 7 Oct (`~/hotel-desk-backups/live-2026-10-07-before-stage1-2`); release practice: practice first, dry run, live with a separate yes, fingerprint comparison.
- **Works:** fast, repeatable deploys; instant rollback of the app in Vercel (Deployments > Promote an older deploy); a tested release routine for database changes.
- **Broken or risky:**
  - **Vercel Hobby does not allow commercial use** (Vercel terms; third-party summaries, sources below). Charging hotels while on Hobby breaks the terms. Pro is about $20 per seat per month.
  - Live Supabase plan is UNVERIFIED. If it is Free: the project pauses after a week without traffic (no date roll, no access), and there are no restorable daily backups. Pro is $25 per month.
  - No error tracking or alerts: a failing page or a failed roll reaches you only if a hotel calls (deployment plan section 7; Lovable's error reporting was removed).
  - No automatic tests on GitHub before deploy (deployment plan 5.1 not built) and `main` is not protected (5.2): any push to main goes live untested.
  - Database rollback is forward-only: a bad migration is undone by a new migration or a restore from backup. No restore has been rehearsed.
- **Not built:** monitoring (uptime check on the sign-in page and the cron routes), error tracking (for example Sentry), database alerts, status page, staged rollout, runbook for "the database is down".
- **Test coverage:** none for operations.
- **Rating:** RED for paid production use (plan terms, no monitoring, no automatic checks); fine for a free pilot.
- **Cost at scale (rough, monthly, before AI; check the official price pages):**

| Hotels | Vercel | Supabase | Email (Resend) | Total about |
|---|---|---|---|---|
| 10 | Pro, 1 to 2 seats: $20 to $40 | Pro $25 plus Micro compute (covered by the $10 credit) | Free tier or Pro $20 | $45 to $85 |
| 100 | Pro $40 plus usage, about $60 to $100 | Pro $25 plus Small or Medium compute $15 to $60, storage for ID photos | Pro $20 to $35 | $120 to $220 |
| 1000 | Pro plus usage, about $200 to $500 | Pro or Team plus Large compute or more ($110 and up), read replica, point-in-time recovery add-on | $90 and up | $500 to $1,500 |

  Assumptions: one property per hotel, about 30 rooms, light usage; ID photos at about 250 KB each. At 1000 hotels a single database is still possible but needs load testing first (Part 3).
- **Rating:** RED (see above).
- **Next three actions:** (1) move Vercel to Pro and confirm Supabase Pro with daily backups before the first paying hotel (your steps), S; (2) automatic test run on GitHub and protection on `main` (deployment plan 5.1, 5.2), M; (3) error tracking and an uptime check with alerts to your phone, S.

Price sources: [Supabase pricing summary (MakerKit)](https://makerkit.dev/blog/saas/supabase-pricing), [Vercel cost summary (MakerKit)](https://makerkit.dev/blog/saas/vercel-cost), [Resend pricing](https://www.resend.com/pricing.md).

---

## Part 3. Cross-cutting questions

### Is it safe for two hotels to share the system?

Yes, as far as I could test. I found no way for one hotel to see or change another's data.

- **Every table has row-level security** (46 of 46) and no write right for the browser (Part 1.5). Reads go through rules that call `app.my_tenant()` or property access checks.
- **Every one of our 139 browser-callable functions checks the hotel or a permission** before acting. A pattern search of all their bodies for a tenant or permission check found none without one (practice, today). Example: `calculate_tax` refuses a property of another hotel (`if ... not app.has_property_access(p_property_id) then ... E_FORBIDDEN`).
- **Tests:** 18 checks in `11_isolation.sql`, 14 for PLT-003, cross-hotel checks in `23_room_labels.sql` ("another hotel cannot add rooms here") and `24_id_photos.sql` ("another hotel cannot open the photo ... nor upload to this hotel's guest").
- **Storage:** the ID photo bucket is private with no storage rules; files open only through 60-second links signed after the database check.
- **Server functions** (invites, exports, photos) run the permission check as the signed-in user before using the service key (`src/lib/invite.functions.ts`, `src/lib/id-photos.functions.ts`).
- **Residual risks:** (1) the `btree_gist` helper functions in `public` (harmless, Part 1.5); (2) the service role key is in Vercel and on your Mac; anyone holding it can read everything, so it must stay Sensitive and be rotated if exposed; (3) one person can belong to only one hotel (`profiles.tenant_id`), so a management company running two hotels needs two logins. UNVERIFIED: no outside penetration test has been done.

### Power cut, slow connection, or closed browser mid-way

- **Check-in:** one database transaction; it either happens completely or not at all. Repeating it is safe: if the booking is already checked in, `check_in` returns the existing stay (`20260929102000_front_desk.sql` line 185). The ID photo is uploaded first; if the browser closes after the upload, the photo stays on the guest; an unfinished upload is cleaned up after a day (`id_photo_cleanup_due`). What is lost: the typed form (no draft).
- **Payment:** one transaction. A retry in the same open form cannot post twice (retry key per form). If the connection drops after the server saved it and the cashier opens a new form and enters it again, the payment is recorded twice (Module 9). Staff see it on the folio and reverse it with approval.
- **Night audit:** runs in the database on a schedule, not in anyone's browser, so a closed browser or a power cut at the hotel does not matter. Each property rolls in its own sub-transaction; a failure undoes that property's roll and alerts managers; the next run (5 minutes later) tries again and catches up to 7 days (`app.run_due_rollovers`).
- **Slow connection:** buttons are disabled while a request runs; money is never computed in the browser. There is no offline mode: with no internet, the desk cannot check anyone in or take a payment. This is the biggest practical risk for Nigerian hotels with unstable internet.

### Can money ever be wrong?

- **Rounding:** amounts are stored with 4 decimals (`20260930110400_money_precision.sql`); tax lines use a remainder rule so lines add up to the total (`20260930160100_tax_rounding_remainder.sql`); tested in `18_server_figures.sql` and `22_accountant_brief.sql`.
- **Double posting:** prevented at database level by unique retry keys on `folio_transactions`, `invoices`, `reservations`, `approvals` (Part 1.5); nightly room charges use `room:<booking>:<date>` so a night is never charged twice, even when the roll catches up. The one gap is the human retry after a dropped connection (above).
- **Currency mix:** each folio line stores the amount, currency, exchange rate and the amount in the hotel's base currency (`FIN-003` test: "USD 10 at 1,500 is 15,000 in naira"). Balances use the base amount. Risk: if no exchange rate is entered for the day, UNVERIFIED which rate a foreign-currency payment uses; I found no test for a missing rate.
- **Tax:** correct maths, unconfirmed rates (A11). If service charge should not be taxed by VAT, or the levy applies, every invoice is wrong until fixed, and issued invoices cannot be edited.
- **Refunds:** need approval above the limit and cannot exceed the folio credit (`FIN-007`).
- **Ledger tampering:** impossible through the app and blocked for the database owner too (triggers); only a superuser with direct database access could drop the triggers, and that would show in the migration history.

### What breaks first at 50 rooms, 200 rooms, 1000 bookings a day?

Nothing has been load tested. All of this is UNVERIFIED and based on reading the code.

- **50 rooms:** fine. Plan limits: Starter allows 20 rooms, Standard 60, so a 50-room hotel needs Standard.
- **200 rooms:** needs the Enterprise plan (Pro allows 150). Screens that list all rooms (Rooms board, Setup rooms) load everything at once with no paging; the guests list and folios list are capped (for example 200 folios, `docs/known-issues.md`), so older records are hidden rather than paged.
- **1000 bookings a day (across all hotels):** the database work per booking is small. The likely first limits are (1) the Supabase Micro compute (1 GB memory, 60 connections) included in Pro, (2) row-level security rules that call functions for every row on large lists, and (3) the availability check, which locks per room type and walks each night. Upgrade compute and add paging before this level.
- **Night roll:** one property at a time, every 5 minutes, up to 7 catch-up days per property per run; with hundreds of hotels rolling at midnight Lagos time, the run takes longer but stays correct.

### What is the recovery plan if the live database is damaged?

- **Today:** one manual dump of live (7 Oct) on your Mac. If live is on Supabase Pro, Supabase also keeps 7 daily backups (UNVERIFIED which plan live is on). No point-in-time recovery add-on. No restore has been practised.
- **Gaps:** no written runbook, no restore drill, no off-site copy of backups, no alert when the database is down.
- **Recommended:** confirm Pro and its daily backups; add point-in-time recovery once there are paying hotels (lose minutes, not a day); practise a restore into the practice project once per quarter; keep the app's Vercel rollback as the first step for app bugs.

### What does support need that we do not have?

- A platform admin console: find a hotel by name or email, see its plan, trial, users and last roll, activate or extend with a reason (PLT-008 is SQL-only today, PLT-009 missing).
- Time-boxed, audited support access to a hotel with the hotel's consent (PLT-010, missing).
- Usage dashboard: active hotels, bookings per day, failed rolls, queued emails, errors.
- Error tracking with the hotel and user attached (none today).
- A way to resend a stuck email or rerun a roll for one hotel from a screen (partly: Admin > Messages "Run now" and Admin > Business date are per hotel, used by the hotel itself).

---

## Part 4. What hotels expect that we lack

**Compared with:** Cloudbeds, Mews, Oracle OPERA Cloud (global); eZee Absolute and Hotelogix (strong in Africa and India); DJUBO (West Africa, Paystack); StayNaija and MyHotelLine (Nigerian). Feature claims come from vendor pages and review sites listed under Sources; I did not use the products themselves, so details are UNVERIFIED beyond what those pages say.

Importance: must, should, nice, for an independent Nigerian hotel of 20 to 150 rooms.

| Capability | We have it | How competitors handle it | Importance | Size |
|---|---|---|---|---|
| Online booking engine and website widget | No | Cloudbeds: branded, mobile-first booking engine with promo codes; eZee, Hotelogix, DJUBO include one | Must | L |
| Channel manager and OTA links (Booking.com, Expedia, Airbnb) | No | Cloudbeds connects to many OTAs and updates rates in real time; eZee, Hotelogix include it; usually through a certified connectivity partner | Must | L (or M using a partner such as SiteMinder or Rategain) |
| Nigerian payment gateways (Paystack, Flutterwave), transfer matching, POS terminals | No (payments are recorded by hand) | DJUBO takes card, mobile money and transfer through Paystack inside the PMS; SabeeApp has a Paystack app; Cloudbeds and Mews have their own payment platforms | Must | M (Paystack links and webhooks), L (POS terminals and transfer matching) |
| Other African payments (M-Pesa, MTN MoMo, Ghana) | No | Paystack covers Ghana, Kenya, South Africa; DJUBO cites mobile money | Should | M |
| Restaurant and bar POS posting to the room folio | Partly (charge codes Restaurant, Minibar, Laundry; staff post by hand) | eZee and Hotelogix include their own POS that posts to the room | Must | L (own POS) or M (simple outlet screen posting to folios) |
| Stores, stock and purchasing | No | eZee lists inventory management | Should | L |
| Laundry, spa, events and banqueting, conference rooms | Partly (laundry charge code; service requests) | eZee and Hotelogix cover POS outlets; events usually a separate module | Should (events: nice) | M to L |
| Group blocks, corporate accounts, city ledger, credit control | Partly (group table, no screen; no city ledger) | OPERA has accounts receivable and back office interfaces; Hotelogix handles group bookings | Must (city ledger for corporate clients) | L |
| Rate management, packages, seasons, promotions | Partly (date-range prices only) | Cloudbeds promo codes and rate plans; Hotelogix "smart pricing across booking sites" | Must | M |
| Guest messaging: WhatsApp, SMS, email, pre-arrival, post-stay | Partly (email queue, not sending) | Cloudbeds automated guest emails; Mews guest journey and online check-in | Must (WhatsApp first) | M |
| Guest register and statutory returns | Partly (ID type, number, expiry, photo; nationality) | Not advertised by the global players | Must: Regulation 29 of the Nigeria Immigration Regulations 2017 requires hotels to record each foreign guest's full name, last address, occupation, nationality, passport number, arrival and departure dates, destination and signature; some states (Rivers, Sokoto) ask for ID capture at every check-in | S (add the missing fields and a printable register) |
| Taxes: VAT, service charge, state consumption tax, tourism levy | Partly (VAT 7.5%, service charge 10%, levy 0%, unconfirmed) | Configurable tax tables in all products | Must: VAT stays 7.5% under the Nigeria Tax Act 2025 from 1 Jan 2026; Lagos charges a 5% hotel occupancy and restaurant consumption tax collected by LIRS; states levy a tourism development levy (reported as 5% of income in some states); one hotel may face several state levies | S (rules exist), plus your accountant (A11) |
| Nigerian e-invoicing (FIRS MBS) | No | Hotelogix supports fiscal e-invoicing in Tanzania; no Nigerian connector found | Must for large and medium taxpayers: FIRS e-invoicing through the Merchant Buyer Solution became mandatory for large taxpayers (turnover N5 billion or more) from 1 Nov 2025; medium taxpayers (N1 to N5 billion) from 1 July 2026; smaller businesses from 2027, enforced by 2028. Most of our target hotels are below N1 billion today, so this is "should" now and "must" before 2027 | L |
| Door locks and key cards, phone and TV systems | No | OPERA and Mews integrate with lock vendors through partners | Should (larger hotels) | M per vendor |
| Accounting links (QuickBooks, Xero, Sage) and exports | Partly (CSV of reservations, guests, transactions) | OPERA night audit summaries feed accounting tools (AccountsIQ example) | Should | M |
| Multi-property and chain view, franchise, management companies | No (one property per account in practice) | Hotelogix manages single or multiple properties from anywhere | Should | L |
| Multi-currency and multi-language | Partly (foreign-currency payments at a daily rate; English only) | Mews payments in 40+ countries; OPERA multilingual | Should (currency), nice (language for now; French for West Africa later) | M |
| Staff rota, attendance, payroll hand-off | No | eZee lists employee management | Nice | M |
| Guest feedback, reviews, loyalty, repeat-guest tools | Partly (feedback log, untested) | eZee lists CRM and marketing automation | Should | M |
| QR self check-in, mobile staff app, offline mode | No | Mews kiosk and online check-in; most are online only | Should (online check-in), must (some offline tolerance, given power and network cuts) | M (online check-in), L (offline) |
| Owner dashboards and daily flash report on WhatsApp or email | Partly (dashboard on screen) | OPERA daily departmental summaries | Must (owners are often not on site) | S once messaging works |
| API and webhooks for partners | No (internal API only) | Mews open API with 1,000+ marketplace apps | Should | M |

### Do not build yet

| Item | Why wait |
|---|---|
| Own door lock integration | Each lock brand needs its own work and hardware testing; few target hotels have electronic locks. |
| Own restaurant POS with kitchen screens | A folio-posting outlet screen covers most needs; a full POS is a product of its own. |
| Events and banqueting module | Valuable for large hotels only; our first customers are 20 to 60 rooms. |
| Staff rota and payroll | Hotels already use other tools; low link to bookings and money. |
| Loyalty points | Needs a guest base and messaging first. |
| Multi-language interface | English covers Nigeria and Ghana; add French when we enter francophone markets. |
| Our own channel manager connections to each OTA | Certification takes months; use a connectivity partner first. |
| Full offline mode | Very hard to do safely with an immutable ledger; start with a "read-only when offline" view and a printed arrivals list. |

### Sources for Part 4

- Cloudbeds: [Cloudbeds platform](https://www.cloudbeds.com/hospitality-platform/), [Zeevou summary of Cloudbeds](https://zeevou.com/pms/cloudbeds/)
- eZee Absolute: [GetApp](https://www.getapp.com/all-software/a/ezee-absolute/), [Krowdbase](https://www.krowdbase.com/software/ezee-absolute)
- Hotelogix: [Hotelogix Africa](https://www.hotelogix.com/af), [Hotelogix blog on Africa](https://www.hotelogix.com/blog/hotel-management-software-africa)
- Mews: [Mews kiosk](https://www.mews.com/en/blog/the-new-mews-operator-your-reception-kiosk-on-steroids-2), [Contrary research on Mews](https://research.contrary.com/report/mews)
- OPERA Cloud: [Oracle OPERA Cloud](https://www.oracle.com/hospitality/hotel-property-management/hotel-pms-software/), [AccountsIQ OPERA integration](https://www.accountsiq.com/integrations/opera)
- Nigerian and African options and Paystack: [DJUBO Ghana](https://djubo.com/ghana), [SabeeApp Paystack](https://www.sabeeapp.com/marketplace/paystack), [StayNaija on VC4A](https://vc4a.com/ventures/staynaija/), [MyHotelLine Lagos](https://www.myhotelline.com/hotel-management-software-in-lagos-cloud-pms-channel-manager-myhotelline)
- Guest register: [The Nigeria Lawyer on Regulation 29](https://thenigerialawyer.com/what-hotel-owners-must-do-before-accommodating-immigrants/), [TheCable on Sokoto](https://thecable.ng/tambuwal-tasks-sokoto-hoteliers-security)
- Taxes: [Forvis Mazars on VAT under the Nigeria Tax Act 2025](https://www.forvismazars.com/ng/en/services/tax/nigeria-s-tax-reform-in-focus/2025-nta-vat-key-business-changes), [Lagos consumption tax (Legalnaija)](https://legalnaija.com/compliance-challenges-of-lagos-state/), [ICIR on hotel taxes in Cross River](https://www.icirnigeria.org/how-21-taxes-are-stifling-hotel-business-in-cross-river-state/)
- E-invoicing: [VATupdate, large taxpayers](https://www.vatupdate.com/2025/09/09/firs-extends-e-invoicing-compliance-deadline-for-large-nigerian-taxpayers-to-november-2025/), [vatcalc on the 2026 wave](https://www.vatcalc.com/nigeria/nigeria-automated-tax-administration-system-april-2021/), [Global VAT Compliance 2026 update](https://www.globalvatcompliance.com/globalvatnews/nigeria-e-invoicing-rollout-key-updates-2026/)

---

## Part 5. AI as our competitive edge

Prices used (Anthropic API, per million tokens, input / output): Claude Haiku 4.5 $1 / $5; Claude Sonnet 5.5 $2 / $10; Claude Opus 5.5 $4 / $20. Batch jobs cost half. Cached prompt text costs about a tenth on re-use. Source: Anthropic model table (cached 25 Sep 2026, in the Claude API reference used for this report); check the live price page before budgeting. One Naira figure: N1,450 to the dollar is assumed only where noted; UNVERIFIED rate.

Where it runs: this app has no Supabase Edge Functions by design (`AGENTS.md`: "no Edge Functions on this stack"). AI calls would run in Vercel server functions, like invites and ID photo links, never in the browser, so the AI key stays server-side.

### 5.1 AI features

"Cost per use" assumes typical sizes stated in the row; all UNVERIFIED until measured.

| # | Feature | What the hotel user sees | Tables and screens used | Model or service | Runs | Cost per use | Accuracy risk | Human approval step |
|---|---|---|---|---|---|---|---|---|
| 1 | ID document reading | At check-in, staff photograph the ID; type, number, name, expiry and nationality fill in | `guest_documents`, `guest_document_files`, check-in and walk-in forms (stage 2 photo step) | Sonnet 5.5 vision | Vercel server function, after the photo is stored | About $0.006 (1 image plus short prompt, 200-token answer) | Medium: misread digits, worn cards | Staff confirm each field before Save; nothing saves without the click |
| 2 | WhatsApp concierge and booking assistant | Guests ask about rooms, prices, directions on WhatsApp; the bot answers and can hold a room | `rate_plan_prices`, `get_availability`, `create_reservation` (tentative only), `guests` | Haiku 4.5 for chat, Sonnet 5.5 for hard turns; WhatsApp Business API | Server function plus WhatsApp webhook | About $0.01 to $0.03 per conversation in model cost, plus Meta's fee (utility message about $0.01 in Nigeria) | Medium: wrong price or promise | Bot creates tentative holds only; staff confirm; prices come from the database, never from the model |
| 3 | Occupancy and demand forecast | "Next 30 days: 72% expected; Friday 3 Oct may sell out" | `reservation_nights`, `daily_stats`, `v_kpi_daily` | Statistics in the database (no language model) | Database job after the night roll | Near zero | Low to medium; needs 3 to 6 months of history | Information only |
| 4 | Price suggestions | "Raise Deluxe on Friday from N45,000 to N50,000 (forecast 90%)" | forecast, `rate_plan_prices`, Setup > Rates | Rules on the forecast; Haiku 4.5 writes the one-line reason | Database plus server function | Under $0.001 | Medium: wrong demand signal | Manager clicks Apply; the change goes through `save_rate_plan_price` and is audited |
| 5 | No-show and cancellation risk | A risk badge on arrivals ("high risk: no deposit, booked 2 hours ago, past no-show") | `reservations`, `guests`, past no-shows, deposits | A simple scoring model in SQL | Database | Near zero | Medium | Staff decide to call or ask for a deposit |
| 6 | Night audit anomaly and fraud flags | "3 things to check before the roll: a 100% discount, a refund after check-out, a room charged twice by hand" | `folio_transactions`, `approvals`, `audit_events`, `stays` | Rules in SQL first; Sonnet 5.5 to explain a flagged pattern | Database plus server function | Rules: zero; explanation about $0.01 | Low for rules; medium for explanations | The auditor marks each flag reviewed; nothing posts or reverses automatically |
| 7 | Plain-language reports | "How did we do last week?" gets a short answer with numbers and a chart link | `kpi_summary`, `report_*` functions, `daily_stats` | Sonnet 5.5 with tools that call our report functions (it never writes SQL) | Server function | About $0.01 to $0.03 per question | Medium: wrong reading of numbers | Answers cite the report rows; numbers come from the database, the model only words them |
| 8 | Housekeeping and room assignment planning | "Suggested assignment: Ada floors 1 and 2 (9 rooms), Musa floor 3 (8 rooms)"; room picks for arrivals | `hk_tasks`, `rooms`, `room_assignments`, `v_arrivals` | Rules and a simple optimiser; no language model needed | Database or server | Near zero | Low | Supervisor accepts or drags tasks |
| 9 | Maintenance triage and repeat faults | New ticket "AC leaking room 204" gets a category, priority, and "third AC ticket in 30 days" | `maintenance_tickets`, `rooms` | Haiku 4.5 for category; SQL for repeat counts | Server function | About $0.001 | Low | Maintenance lead confirms priority |
| 10 | Guest message drafting | Staff click "Draft reply" on a guest email or WhatsApp; a polite reply appears | outbox, guest profile, booking | Haiku 4.5 or Sonnet 5.5 | Server function | About $0.002 to $0.01 | Low | Staff edit and send |
| 11 | Review reply drafting and sentiment | Reviews from Google or Booking.com are summarised; draft replies ready | `guest_feedback` (and imported reviews, not built) | Haiku 4.5 | Batch job | About $0.002 per review (half in batch) | Low | Manager edits and posts |
| 12 | Upsell offers at check-in | "Offer late check-out N10,000 or upgrade to Deluxe N15,000; guest is a repeat corporate guest" | `guests`, `stays`, `rate_plan_prices`, room availability | Rules plus Haiku 4.5 for wording | Server function | Under $0.001 | Low | Staff choose; posting a charge goes through `post_charge` with its retry key |
| 13 | Invoice and receipt capture | Photograph a supplier receipt; amount, date, vendor fill in (for a future expenses or purchases module) | not built yet | Sonnet 5.5 vision | Server function | About $0.006 | Medium | Staff confirm; never touches the guest ledger |
| 14 | Staff question answering from hotel procedures | "How do we handle a guest who wants to pay in dollars?" answered from the hotel's own manual | a new procedures table or uploaded document | Sonnet 5.5 with the hotel's documents cached | Server function | About $0.005 per question with caching | Medium: outdated procedure | Answer shows its source paragraph |
| 15 | Daily owner summary | 7 am WhatsApp or email: occupancy, revenue, cash, balances, 3 things to watch | `dashboard_summary`, `kpi_summary`, `report_outstanding_balances`, night audit flags | Sonnet 5.5 for wording; numbers from the database | Scheduled server job | About $0.01 per day | Low | Information only |
| 16 | Guest register and immigration return helper | Fills the Regulation 29 register for foreign guests from booking and ID data; flags missing fields | `guests`, `guest_documents`, `stays` | Rules; Haiku 4.5 only to flag odd entries | Database | Near zero | Low | Front office manager reviews before printing |
| 17 | Tax return pack | Monthly VAT, service charge and state consumption tax totals with a plain explanation for the accountant | `folio_tax_lines`, `invoices` | SQL totals; Sonnet 5.5 for the cover note | Server function | About $0.02 per month | Low for totals | Accountant files it |
| 18 | Duplicate guest finder | "These two profiles look like the same person" | `guests`, `guest_documents` | SQL similarity; Haiku 4.5 to judge close cases | Batch job | Under $0.001 per pair | Medium | Staff use the existing Merge screen, which asks for a reason |

### 5.2 Ranking and three quick wins

| Feature | Value to hotel | Effort for us | Risk | Rank |
|---|---|---|---|---|
| 15 Daily owner summary | High (owners are often away) | S, once a message channel works | Low | 1 |
| 1 ID document reading | High (saves typing at every check-in; feeds the statutory register) | S to M (photo step exists since stage 2) | Medium, controlled by confirmation | 2 |
| 6 Night audit anomaly flags | High (fraud and error control) | M (rules first) | Low | 3 |
| 7 Plain-language reports | Medium to high | M | Medium | 4 |
| 2 WhatsApp concierge | High, but needs WhatsApp first | L | Medium | 5 |
| 3 and 4 Forecast and price suggestions | High after 3 to 6 months of data | M | Medium | 6 |
| 10 Message drafting | Medium | S | Low | 7 |
| 9 Maintenance triage | Medium | S | Low | 8 |
| 5 No-show risk | Medium | S | Medium | 9 |
| 8, 11 to 14, 16 to 18 | Medium to low today | S to M | Low to medium | later |

**Quick wins for the next month:**
1. **Daily owner summary** (15): the numbers already exist (`dashboard_summary`, `kpi_summary`, balances); the model only writes them up; cost about $0.30 per hotel per month. Depends on email being switched on (Module 15).
2. **ID document reading** (1): the stage 2 photo step already captures the image privately; reading it fills fields that staff type today; every field is confirmed by a person. Must wait for the lawyer's view on ID photos (A14) and stays off unless the hotel has "Allow ID photos" on.
3. **Night audit anomaly flags, rules only** (6): no model at all for the first version (SQL rules over `folio_transactions` and `approvals`); a model explains a flag later. Directly protects hotel revenue.

### 5.3 Rule: AI never changes money or the ledger without a person approving each action

How the database enforces it:
- **No new power for AI.** AI runs in a server function that calls the same `public` functions a person would, signed in as that person (the auth middleware passes the user's token). It gets no service key for writes to hotel data.
- **AI only proposes.** Every AI suggestion is stored as a row in a new `ai_suggestions` table (hotel, user, feature, proposal as data, model and prompt version, status). Turning a suggestion into money (a price change, an upsell charge, a discount) needs the person to click Apply, which calls the normal function (`save_rate_plan_price`, `post_charge`, `apply_discount`) with the normal permission, limits, approval rules and retry key.
- **Ledger stays locked.** The insert-only triggers on `folio_transactions`, `folio_tax_lines`, `invoices` and `audit_events` apply to AI exactly as to people; nothing can edit or delete.
- **Audit.** Each Apply writes an `audit_events` row with the suggestion id, so we can always tell "accepted from AI" apart from "typed by staff".
- **Permission.** A new permission `ai.use` per feature (for example `ai.pricing.suggest`), off by default for built-in roles that handle money, so an owner chooses who sees suggestions.

### 5.4 Data protection for AI

- **May go to the AI provider:** aggregated hotel numbers (occupancy, revenue), room and rate data, ticket text, procedures, guest messages the guest sent to the hotel (for drafting), and ID images only for ID reading when the hotel has ID photos switched on.
- **Must stay out:** full card or bank details (we hold none), passwords and keys, the audit trail, other guests' data in the same request, and any guest data for features that do not need it (reports and forecasts use totals, not names).
- **NDPA 2023 and transfer abroad:** sending personal data to a provider outside Nigeria is a cross-border transfer. The NDPA and the GAID 2025 allow it only with adequate protection, an adequacy decision, an approved transfer instrument, or another lawful basis (section 43). Our data already sits in Ireland; adding a US or EU AI provider adds a second transfer. The lawyer should cover both in one opinion (A14). We may also need to register as a data controller or processor of major importance; the lawyer must say.
- **What to tell guests:** in the privacy notice: which features use AI, what data goes, the provider's name and country, that a person checks every result, and how to object (for example, type the ID by hand instead of reading it).
- **Logging without personal data:** an `ai_calls` table with hotel, feature, model, prompt version, tokens in and out, cost, time, outcome (accepted, edited, rejected) and a hash of the input, never the input itself. Same idea as the ID photo audit (ids only).
- **Provider settings:** use the commercial API, not a consumer app. Anthropic's commercial terms state API data is not used for training by default; zero data retention is available by agreement for eligible models (Claude Fable 5.1 is not available under zero data retention). UNVERIFIED for our account: confirm the retention period and sign a data processing addendum before any guest data is sent.

### 5.5 Architecture

- **Provider:** Anthropic Claude as the main provider (Haiku 4.5 for simple, high-volume work; Sonnet 5.5 for vision and reasoning; Opus 5.5 only for rare hard cases). Keep the gateway provider-neutral so a second provider can be added for fallback.
- **One AI gateway:** a single Vercel server function (`src/lib/ai.functions.ts`, not built) that every feature calls. It checks the `ai.*` permission and the hotel's plan through the database first (same pattern as `startIdPhotoUpload`), applies the cost cap, calls the model, logs to `ai_calls`, and returns a proposal.
- **Prompts stored and versioned:** prompts live in the repository as files with a version number, recorded on every call, so a change can be traced and rolled back.
- **Cost caps per hotel:** a monthly budget per hotel in a settings row; the gateway refuses once it is used, and the owner sees "AI paused until 1 Nov" rather than a surprise bill.
- **Rate limits:** per hotel and per user per minute, enforced in the gateway with a counter table.
- **When the provider is down:** every AI feature has a manual path that already works (type the ID, read the report); the gateway times out quickly and shows "suggestion unavailable".
- **Evaluation tests:** a fixed set of examples per feature (for example 50 test ID images with known answers, 30 report questions with known numbers) run before each prompt or model change; quality below the last score blocks release. Track the accept, edit and reject rate in `ai_calls` as the live quality signal.
- **Caching:** the fixed part of each prompt (hotel facts, procedures) is cached so repeat calls cost about a tenth.

### 5.6 Business model (ties to decision A16)

Rough monthly AI cost per hotel in model fees only (assumptions: 60% occupancy, 2-night average stay, so about 180, 540 and 1,350 check-ins a month; one ID read per check-in; daily owner summary; 30 report questions; 20 drafted replies; night audit explanations on 10 flags; WhatsApp concierge on 1 conversation per booking where switched on). WhatsApp's own per-message fees from Meta are extra and pass through.

| Hotel size | Without WhatsApp concierge | With WhatsApp concierge (model cost only) |
|---|---|---|
| 20 rooms | about $2 to $4 | about $4 to $9 |
| 60 rooms | about $5 to $9 | about $12 to $25 |
| 150 rooms | about $11 to $20 | about $30 to $60 |

Suggested packaging (to decide under A16):
- **Starter (20 rooms):** daily owner summary and night audit flags included (cheap, high value, sells the product).
- **Standard (60 rooms):** plus ID reading, plain-language reports, message drafting, maintenance triage.
- **Pro (150 rooms) and Enterprise:** plus WhatsApp concierge, forecast and price suggestions, review replies.
- **Price:** charge an AI add-on of about 3 times the model cost to cover gateway, support and spikes, for example $10, $25 and $60 a month (UNVERIFIED willingness to pay; test with pilots), or fold it into the plan price. WhatsApp fees billed at cost.

### 5.7 Where AI would be a mistake right now

- **Automatic price changes** without a person: a wrong forecast on a holiday weekend costs real money and trust.
- **Anything that posts, reverses or discounts money by itself:** breaks the control model and the audit story.
- **A chatbot that confirms bookings or quotes prices from its own memory:** prices must come from the database.
- **ID reading before the lawyer's NDPA opinion** and before hotels switch ID photos on.
- **Forecasting for a hotel with under 3 months of data:** it would be noise.
- **Building our own AI models:** the provider models are cheaper and better for our volume.
- **AI before the basics:** email sending (Module 15), Vercel Pro and backups (Module 19) and the tax sign-off (A11) matter more to a paying hotel than any AI feature.

Sources for Part 5: [WhatsApp pricing in Nigeria (Yournotify)](https://yournotify.com/blog/whatsapp-pricing-update-2026/), [Meta WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [DLA Piper on the GAID 2025](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/), [Legal500 on cross-border transfers in Nigeria](https://www.legal500.com/developments/thought-leadership/cross-border-data-transfers-an-overview-of-legal-requirements-and-compliance-mechanisms-in-nigeria/).

---

## What I could not verify, and how you can help

| Item | How to verify |
|---|---|
| Dependabot alerts | GitHub > repository > Security > Dependabot alerts; or install the GitHub command-line tool on this Mac and sign in. |
| Live Supabase plan (Free or Pro) and its backups | Supabase > live project > Settings > Billing, and Database > Backups. |
| The workbook matches the status report row for row | Send me the workbook exported as CSV, or allow me to install a spreadsheet reader. |
| Phone layouts and load time on slow mobile data | Open the live site on a phone on mobile data; or let me run a throttled phone test locally. |
| Load at 200 rooms and 1000 bookings a day | A load test on the practice project (needs your yes; costs nothing extra on the current plan but uses practice resources). |
| Foreign-currency payment with no rate for the day | A test on practice (needs your yes). |
| Competitor features in detail | Vendor demos; my table relies on their public pages and review sites. |
| Nigerian legal duties (NDPC registration, ID photo basis, transfer safeguard, state levies) | Your lawyer and accountant (A14, A11). |
| AI provider data retention and terms for our account | Anthropic Console > organisation settings and the commercial terms; ask for a data processing addendum. |
| Exchange rate used for Naira figures | Your preferred rate source. |
