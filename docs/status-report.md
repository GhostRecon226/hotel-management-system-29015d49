# Status report: Hotel Desk (first audit)

> History. This report describes the app as it was first built with Lovable, and the work to remove it. Lovable was fully removed from the code on 2 Oct 2026. For the current state see `docs/deployment-plan.md` and `docs/setup-checklist.md`.

First written 30 Sep 2026 after a read-only audit of `main` at commit `ef56121`. Updated after steps 1, 2 and 4 of the plan and again on 1 Oct 2026, on branch `claude/audit-status-report`. Written by Claude Code for Peter.

This report covers the app Lovable built (`hotel-management-system-29015d49`). It measures that app against the 107 R1 requirements in the reference repo (`hms-reference-backend`, `docs/HMS_R1_Requirements.xlsx`). The "Built" marks in that workbook describe the older reference backend, not this app. Every status below comes from this audit and from the tests.

## The short version

- Lovable built far more than a skeleton: 17 database migrations, 123 business functions, 44 tables and about 45 screens.
- **Steps 1, 2 and 4 are done on the local copy.** Lovable is removed, the app runs on your Mac, and every screen has been clicked through with a demo hotel.
- Tests on local Supabase: **448 checks, 427 pass, 21 fail**, plus 17 upgrade checks (all pass) and 4 browser tests (all pass). The 21 failures are listed under "Remaining failures (21)" below.
- Your real project has the first 24 migrations. **12 new migrations wait for your yes.** Nothing from step 4 has touched the real project.
- Screens no longer add up money. Every total, tax preview, fee preview and KPI comes from the database. A check (`npm run check:money`) fails if browser code starts doing money sums again.
- It is still not ready for a real hotel: 21 failures, tax rules wait for the accountant, email is not connected, and 6c and DAY-006 are not built.

## Update: 7 Oct 2026 (stage 2: ID document photos, on branch `claude/id-photos`)

- **A hotel can keep a photo or scan of a guest's ID** (front and back), if a manager switches on "Allow ID photos" in Setup > Property. Off by default. "Require ID photo at check-in" makes check-in and walk-in wait for a photo.
- **Private:** the files sit in private storage. Staff open a photo only through a link that works for 60 seconds, and every upload, view and deletion is recorded. Reservation officers and accountants cannot upload or see them.
- **Smaller and cleaner:** photos are shrunk on the device before upload (longest side 1600 pixels), which also removes hidden data such as the GPS location.
- **Deleted:** when the guest is anonymised, when a manager deletes one (with a reason), and automatically 12 months after the guest's last check-out. The 12 is one setting and can change without a new migration.
- **Needs before going live:** `CRON_SECRET` in Vercel for the daily clean-up (02:00 UTC), the practice project first, then your separate yes for the live database. The privacy notice draft (branch `claude/public-pages`) now describes ID photos.

## Update: 6 Oct 2026 (stage 1: room labels, on branch `claude/room-labels`)

- **Rooms can be added from the Rooms page** ("Add room" and "Add several rooms"), only by roles that may set up rooms (System Administrator and General Manager).
- **Room labels are free text** (ROOM-005): 101, A101, Zurich or a mix, up to 30 characters. Unique per hotel ignoring case and extra spaces. Natural order everywhere (2 before 10, names A to Z).
- **Wording:** screens and messages show the label as typed, without "Room" in front ("Zurich is occupied."). Lists and boards show "Zurich (Deluxe)". New folio lines read "Zurich · 06 Oct 2026". Lines already posted and invoices already issued never change: they are stored as written at the time.
- **Not live yet.** One new migration (`20261006100000_free_text_room_labels.sql`) waits for the practice project first, then your separate yes for the live database.

## Update: 5 Oct 2026 (first live deploy)

- **The app is live on Vercel** at https://hotel-management-system-29015d49.vercel.app, deployed from `main` (the redesign, merged 2 Oct). Every push to GitHub now deploys by itself: `main` goes live, other branches get preview addresses.
- **Hand test passed on the live address on 5 Oct 2026**, in a test hotel (Euro Bar Hotel): sign-in with the Supabase links, set-up, a new guest made inside the booking form, booking RES-000001, check-in, room charge ₦11,825 (₦10,000 + ₦1,000 service + ₦825 VAT, the same as the Euro Hotel test), cash payment, check-out, and the turnover task in housekeeping.
- **Function region: Dublin (dub1)**, next to the database in Ireland. Checked from the live deploy.
- **Vercel Hobby for now, so the 5-minute email sender is off** until we move to Pro (`docs/deployment-plan.md`, step 4.4). Emails wait in the queue.
- **Lovable sweep done on 2 Oct.** No Lovable package, preset, file or setting is left in the code or in Vercel, and Lovable is disconnected from GitHub.
- **Still to do before a real hotel:** the practice Supabase project for previews, your own domain, email through Resend, and the "before the first real hotel" list in `docs/deployment-plan.md`.

## Update: 1 Oct 2026, afternoon (live project complete)

**Live project `urbpxybyrfjczqbrpdsq`: all 43 migrations applied and recorded.** The last 7 went up in one batch after a dry run. Checked on the live project afterwards:
- Both scheduled jobs are active (business date roll every 5 minutes, subscription clock daily at 00:15 UTC).
- Built-in roles: System Administrator, General Manager, Front Office Manager and Accountant can move charges; Reservation Officer has own-records folio access, deposits only, and no ID documents. System Administrator holds every permission.
- As the database owner (`postgres`, not a superuser), every attempt to edit, delete or wipe the ledger, its tax lines or the audit trail was refused (E_IMMUTABLE), and a backdated entry was refused (E_DATE). The test undid itself, so nothing changed.
- RES-000001, its folio, its charge and its tax lines are byte-for-byte the same as before the apply. Test Guest is still in house in room 101 with ₦11,825 due.

**Hand test on the live project: passed** (room type, room, rate plan with the 2-day free-cancellation default, booking, check-in, a ₦10,000 restaurant charge whose tax preview ₦11,825.00 equals the folio balance, dated the open business date). The first attempt found a screen bug: saving a new guest inside the booking form also submitted the booking ("Guest not found"); the walk-in pop-up had the same fault. Fixed test first, with new browser tests that click the real desk journey.

**Tests:** 539 database checks (527 pass, the same 12 fail), 29 upgrade checks pass, 6 browser tests pass. The production build for Vercel works.

**Next stage:** deployment. See `docs/deployment-plan.md`.

## Update: 1 Oct 2026

**Live project:** all 36 migrations applied and recorded on `urbpxybyrfjczqbrpdsq`. Both scheduled jobs are active. The built-in roles hold the new permissions (move charges for System Administrator, General Manager, Front Office Manager and Accountant; own-records folio access, deposits only and no ID documents for Reservation Officer).

**Built today on the local copy (test first, one commit each), waiting for your yes:**

| Item | What it does now | Proof |
|---|---|---|
| FIN-006, FIN-014, ADM-006 | Nobody, not even the database owner, can edit, delete or wipe the ledger or the audit trail. Ledger rows must carry the open business date, and the sign must suit the kind (no negative charges, no positive payments) | `12_ledger.sql`, `16_structure.sql` |
| GST-005 | A guest with a booking that is not over cannot be anonymised | `15_accounts.sql` |
| FO-012 | Voiding a check-in made by mistake leaves the room ready to use again | `17_more_features.sql` |
| FO-006, HK-001 | A room move creates a cleaning task for the old room | `13_reservations.sql` |
| DAY-006 | Same-day stays can be booked, are charged one night at check-in, and a manager can waive it with a reason | `19_same_day.sql` (23 checks), checked on screen |
| 6c | Built-in roles carry approval limits, set per hotel | `20_builtin_limits.sql` (17 checks), checked on screen |
| Flaky test | Sign-in and Create hotel forms are locked until the page is ready (cause found in the trace) | Failed 4 of 4 before, passes 3 of 3 after |

Tests: **488 database checks, 476 pass, 12 fail**; 6 upgrade checks pass; 4 browser tests pass. The upgrade test now starts from what the live project has (20260930160100).

Remaining failures (12): FO-003 (registration card step), FO-007 (complimentary upgrade), FO-008 x2 (shorten a stay), HK-002 x2 (task with no assignee, attendants see every task), HK-003 (failed-inspection notice), ROOM-004 (reason for dirty override), PLT-007 (second property), PLT-004 (Ghana currency), RES-013 (arrival-ready flag), SET-008 (inspection on/off).

Migrations waiting for your yes (7, in order): `20261001100000_lock_ledger_and_audit`, `20261001100100_anonymise_upcoming_guard`, `20261001100200_void_check_in_keeps_room_ready`, `20261001100300_room_move_cleaning_task`, `20261001100400_same_day_stays`, `20261001100500_builtin_role_limits`, `20261001100600_same_day_check_out_charge`.

Later on 1 Oct: a guest booked overnight who leaves on the arrival day is charged one night (`21_same_day_checkout.sql`, 28 checks). The upgrade test now proves refunds, adjustments, discounts, reversals and a three-day catch-up roll (with an overstay) under the ledger lock: 29 of 29 checks pass. Tests: 539 database checks, 527 pass, the same 12 fail.

## Update: step 4 (30 Sep 2026)

### What changed

| Item | What was wrong | What it does now | Proof |
|---|---|---|---|
| FIN-012 | Interim invoices shared the invoice number series | Interim invoices get their own INT- series | `12_ledger.sql`, upgrade test |
| MNT-002 | Closing a ticket left the room out of sale | Closing releases the block, or cancels it if it was never approved | `14_lifecycle.sql` |
| FIN-009 | Front desk could move charges between folios | Needs the new permission `fin.folio.transfer` (System Administrator, General Manager, Front Office Manager, Accountant) | `12_ledger.sql`, upgrade test |
| FIN-015 | Reservation officers saw every guest's bill | They see only folios of bookings they made | `12_ledger.sql`, upgrade test |
| DAY-003, DAY-001 | Guests still in house after departure were not charged, and the catch-up roll stopped short | The roll extends the stay one night, charges it and flags it, up to the maximum stay | `17_more_features.sql` |
| 6a | Reservation officers could take any payment | Deposits only | `12_ledger.sql`, upgrade test |
| 6b | Reservation officers saw ID documents | They do not | `10_security.sql`, upgrade test |
| 6d | Rate plans had no free-cancellation default, and 0 days made every cancellation free | Default 2 days, changeable on the rate plan screen. 0 days means the fee always applies | `18_server_figures.sql`, upgrade test |
| API bug | Posting charges through the app failed with "DELETE requires a WHERE clause" (only on the API path) | Fixed in four functions. A code scan and a browser test guard it | `10_security.sql`, `e2e/api-path.spec.ts` |
| S9 | Screens added up money in the browser | Fee preview, tax preview, check-out outstanding, amount due, credit, deposit due and dashboard KPIs come from the database | `18_server_figures.sql`, `npm run check:money` |
| Rounding | A tax remainder of −0.01 could land on the 0% levy line | The remainder goes on the last tax that has a rate | `12_ledger.sql` |
| Top bar | After "Run due rolls now" the date only changed after a refresh | The whole app refreshes its data after a roll | Checked in the browser |

The earlier finding "a discount does not reduce tax" (old failure 1) was wrong. Discounts reduce tax in proportion. The test was corrected.

### Lovable removal

Removed the Lovable build preset, preview auth, error reporting, the cron secret, `drizzle/`, `.lovable/` and bun. The build now targets Vercel (Nitro `vercel` preset). `.env` is no longer tracked. The app runs with `npm run dev`.

### Nightly roll, run on the local copy

Demo hotel started one day behind (29 Sept), rolled by hand from Admin, Business date:
- 2 room charges posted (Room 201 ₦100,512.50 and Room 101 ₦65,037.50, tax included), 1 no-show fee (₦55,000) with the booking marked no-show, 1 stayover task.
- Dashboard "Last 30 days" and Reports daily KPIs both show 16 available, 2 sold, occupancy 12.5%, ADR ₦70,000, RevPAR ₦8,750.
- Check-out for Room 101 shows ₦69,132.50 outstanding, the same as the database.

### Remaining failures (21)

Numbers refer to the table under steps 1 and 2. Fixed since then: 1 (test was wrong), 2, 3, 4, 5, 20, 21, 22, 27. Wave 1 (6 Oct 2026) fixed FO-008, RES-013, HK-002, HK-003 (the test read the notification as the supervisor; corrected to read it as the attendant), ROOM-004, PLT-004 and SET-008.

| Requirement | What is still wrong |
|---|---|
| FIN-006, FIN-014 (3) | The database owner can wipe the ledger, or insert a backdated or negative row directly |
| ADM-006 (3) | The database owner can change, delete or wipe audit rows |
| FO-006, HK-001 | A room move creates no cleaning task for the old room |
| FO-012 | After a voided check-in the room is dirty, so the guest cannot be checked in again at once |
| GST-005 | A guest with an upcoming booking can be anonymised |

Also not done: 6c (approval limits on built-in roles), DAY-006 (same-day stays), tax on the `tax_rates` table is not audited, invoice net and taxable figures can differ by 1 kobo from the folio on odd amounts, and one browser test failed once and then passed (not explained).

### Migrations waiting for your yes (12, in order)

1. `20260930120000_interim_invoice_numbers.sql`
2. `20260930120100_ticket_close_releases_blocks.sql`
3. `20260930120200_folio_transfer_permission.sql`
4. `20260930120300_own_bookings_folio_access.sql`
5. `20260930120400_roll_overstays.sql`
6. `20260930130000_overstay_max_stay.sql`
7. `20260930130100_deposits_only_reservations.sql`
8. `20260930140000_api_safe_temp_table_deletes.sql`
9. `20260930150000_reservations_no_id_documents.sql`
10. `20260930150100_free_cancellation_default.sql`
11. `20260930160000_server_money_figures.sql`
12. `20260930160100_tax_rounding_remainder.sql`

The upgrade test applies all 12 on top of a hotel made with the first 24, which is what your real project has. All 17 checks pass.

## Update: steps 1 and 2

### What changed

| Finding | What was wrong | What it does now | Proof |
|---|---|---|---|
| M1, M8 | The browser could write to every table. Staff with "manage roles" could make themselves System Administrator or approve their own refunds by writing to role tables directly | Default-deny. The browser can only read (filtered by hotel and permission) and call functions. Every change goes through a function that checks permission and escalation | 49 security checks. One of them fails if any table becomes writable again. Checked on real local Supabase |
| M2 | Changing a custom role's permissions always crashed | Works | Tests in `10_security.sql` |
| M3 | A read-only hotel could not take payment or check out a guest who owed money | Payments, refunds, check-out and unsettled check-out work in a read-only hotel. New bookings and charges stay blocked | `15_accounts.sql`, read-only settlement |
| M4 | Trials never ended. Past-due hotels were never suspended | A daily clock (00:15 UTC) expires trials, marks unpaid hotels past due, suspends them after 14 days, and ends cancelled subscriptions at the end of the paid period. Every change is in a new subscription history. Activation is manual for pilots (decision 5e), and a hotel can cancel its own subscription | `15_accounts.sql`, subscription clock |
| M5 | The audit log kept guests' phone numbers, emails and passport numbers | The audit log records which fields changed, never their values. Old rows were cleaned | `15_accounts.sql`, guest privacy |
| M6 | The staff invite sent an email before checking permission, and fell back to a temporary password | Permission is checked first. Accounts are looked up by email properly. No temporary passwords: if the email fails, nothing is created. Unaccepted invites have a "Resend invite" button (decision 5b) | Database check tested. Server code type-checks. Browser test in step 4 |
| M7 | Cancellation and no-show fees were worked out but never charged. Every cancellation was charged, however early. Anyone who could cancel could waive the fee | Rate plans can set free-cancellation days. Fees post to the booking's folio once, whether the desk, a manager or the nightly roll sets the status. Waiving needs the rate override permission and a reason. Fees use their own charge codes and are not taxed until the accountant confirms | `13_reservations.sql`, fees |
| S1, S2 | Base currency and staff status could be changed directly | Only through the functions. Staff edit their own name through `update_my_profile` | `10_security.sql` |
| S3 | One person could check out a guest who owes | Kept, as you decided (5a): allowed only for holders of the approval permission, with a reason, and it is audited. Everyone else needs a second person to approve | `13_reservations.sql`, unsettled check-out |
| S4 | 11 functions could be called by someone not signed in | None can | `10_security.sql` |
| S6 | Amounts with too many decimals were silently rounded | Refused with E_PRECISION (naira 2 decimals, CFA franc 0) | `12_ledger.sql` |
| ADM-003 | A disabled user was told the subscription had expired | They are told they have no access | `15_accounts.sql` |

New migrations, in order:
- `20260930100000_default_deny_grants.sql`
- `20260930100100_admin_invite_fixes.sql`
- `20260930110000_read_only_settlement.sql`
- `20260930110100_subscription_clock.sql`
- `20260930110200_guest_audit_privacy.sql`
- `20260930110300_reservation_fees.sql`
- `20260930110400_money_precision.sql`

No existing migration was edited. All 24 migrations rebuild cleanly on local Supabase and on plain Postgres. A code checker finds no hidden faults in any function.

### How the tests work

- Run `scripts/test-db.sh`. It rebuilds the local Supabase database in Docker from the migrations, loads test users and a sample hotel, and runs every file in `supabase/tests/db/`. It refuses to run against anything but a local database.
- Every check prints "ok" or "not ok" and the run carries on, so one run shows every failure. Each check is tagged with its requirement or finding, for example `[FIN-004]` or `[M7]`.
- Order of work: the tests were written and committed first (commit `e578c1f`, 267 ok and 83 not ok), then the fixes (340 ok and 30 not ok).
- Files: `10_security`, `11_isolation`, `12_ledger`, `13_reservations`, `14_lifecycle`, `15_accounts`, `16_structure`, `17_more_features`. Files 11 to 17 port the reference repo's tests to this app's functions.

### Remaining failures (30)

These are real gaps found by the ported tests. None was in scope for steps 1 and 2. Several are new. The audit did not see them.

| # | Requirement | What the test found | Business risk | Size |
|---|---|---|---|---|
| 1 | FIN-004 | A discount lowers the bill by the discount only. Service charge and VAT stay the same | The hotel may over-collect tax. **Accountant to decide** | Small once decided |
| 2 | FIN-009 | Front desk can move charges between folios | Charges can be shifted to a company folio without a manager | Small |
| 3 | FIN-015 | Anyone who can see folios sees all of them | A reservation officer sees every guest's bill | Medium |
| 4 | FIN-002 | Reservation officers can take any payment, not only deposits | Role differs from your design. **Your call** | Small |
| 5 | FIN-012 | Interim invoices and receipts share the invoice number series | Gaps and mixed numbering in the invoice series | Small |
| 6 to 8 | FIN-006, FIN-014 | The database owner can wipe the ledger in one command, and a direct insert by the owner can be backdated or negative. The app's own functions cannot do any of this | Low: needs database owner access. Worth closing | Small |
| 9 | FO-006, HK-001 | A room move marks the old room dirty but creates no cleaning task | Housekeeping never learns that the old room needs cleaning | Small |
| 10 | FO-003 | No "registration card accepted" step at check-in | Missing check from the requirement | Small |
| 11 | FO-007 | No complimentary upgrade that keeps the booked rate | Staff must override the rate by hand | Small |
| 12, 13 | FO-008 | An in-house stay can be extended but not shortened. Only an early check-out removes nights | Staff cannot record "leaving a day early" in advance | Small |
| 14 | FO-012 | After voiding a check-in, the room is marked dirty, so the guest cannot be checked in again until it is cleaned | Delay at the desk after a mistake | Small |
| 15 | RES-013 | No arrival-ready flag | Missing feature | Small |
| 16 | HK-002 | A supervisor can start a task nobody is assigned to | Weakens the housekeeping flow | Small |
| 17 | HK-002 | A room attendant sees every task, not only their own | Attendants see the whole board | Small |
| 18 | HK-003 | The attendant is not notified when their room fails inspection | Rework waits until someone tells them | Small |
| 19 | ROOM-004 | Marking a room dirty by override needs no reason | Weaker audit trail | Small |
| 20 | MNT-002 | Closing a ticket does not release its room block | The room stays out of sale after the repair | Small |
| 21 | DAY-003 | A guest still in house after their departure date is not extended or flagged at the roll | The night is not charged and nobody is told | Medium |
| 22 | DAY-001 | Catching up several days stopped one day short when an overstaying guest was in house | Probably the same cause as 21. Needs a closer look | Small to medium |
| 23 | PLT-007 | There is no way to add a second property | Multi-property plans cannot be used | Medium |
| 24 | PLT-004 | A Ghana hotel gets naira as its currency | Wrong currency outside Nigeria | Small |
| 25 | SET-008 | Inspection cannot be switched off per property | Small hotels without inspectors are stuck | Small |
| 26 | GST-005 | A guest with an upcoming booking can be anonymised | The upcoming booking loses its guest details | Small |
| 27 | GST-002 | Reservation officers can see ID documents | Role differs from your design. **Your call** | Small |
| 28 to 30 | ADM-006 | The database owner can change, delete or wipe audit rows. The browser cannot | Low: needs database owner access. Worth closing | Small |

Other things the tests showed:
- **Built-in roles cannot carry approval limits.** A hotel must copy a role before it can set a limit. Until then, a built-in "limited" permission means zero, so every front desk discount waits for approval. That is safe, but it will surprise hotels. It belongs in the onboarding guide, or the design should change.
- **Folios are opened when first needed** (at check-in, or when a deposit is taken), not at booking. RES-002 says "a folio is opened". It works either way.
- **Checking in or out twice returns the same stay.** That is deliberate retry protection, and good.
- **Error message wording.** "This booking is for 1 people" needs a small copy fix.

## 1. What exists, requirement by requirement

> **Superseded on 6 Oct 2026.** The single requirement register is now [`docs/requirements.csv`](requirements.csv) (115 rows, status per row taken from this app's tests), checked by `scripts/check-requirements.mjs` (`npm run check:requirements`, and in every full `scripts/test-db.sh` run). The workbook [`docs/HMS_R1_Requirements.xlsx`](HMS_R1_Requirements.xlsx) is generated from it. The table below is kept as the record of 1 Oct 2026 and is no longer updated.

Statuses after steps 1 and 2. A requirement counts as "Built and works" only when a test proves it. At the audit, the totals were 25 working, 52 untested, 17 partly built and 13 missing.

### Totals per module

| Module | Built and works | Built, untested | Partly built | Missing | Total |
|---|---|---|---|---|---|
| Platform & Tenancy | 7 | 0 | 2 | 3 | 12 |
| Administration | 6 | 2 | 1 | 0 | 9 |
| Setup | 6 | 1 | 0 | 1 | 8 |
| Reservations | 11 | 1 | 1 | 0 | 13 |
| Front Office | 8 | 0 | 5 | 0 | 13 |
| Guests | 3 | 1 | 2 | 0 | 6 |
| Rooms | 3 | 0 | 1 | 0 | 4 |
| Housekeeping | 3 | 0 | 3 | 0 | 6 |
| Maintenance | 2 | 0 | 1 | 0 | 3 |
| Guest Service | 2 | 0 | 0 | 0 | 2 |
| Finance | 8 | 0 | 6 | 2 | 16 |
| Business Date | 2 | 0 | 1 | 3 | 6 |
| Reporting | 1 | 3 | 0 | 0 | 4 |
| Non-functional | 4 | 0 | 1 | 0 | 5 |
| **All** | **66** | **8** | **24** | **9** | **107** |

### Every requirement

### Platform & Tenancy

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| PLT-001 | A person with a confirmed email creates a hotel account in one step. | Must | Built and works | 2 test checks pass. |
| PLT-002 | Signup is refused for an unconfirmed email and for a user who already belongs to a hotel. | Must | Built and works | 2 test checks pass. |
| PLT-003 | One hotel can never see or change another hotel's data. | Must | Built and works | 14 test checks pass. |
| PLT-004 | A new property is seeded from its country template (currency, timezone, tax lines, payment methods, charge codes). | Must | Built and works | 8 test checks pass, plus 2 in `26_small_fixes.sql`. Ghana GHS, Kenya KES, South Africa ZAR, each with its time zone; tax lines for Nigeria only. |
| PLT-005 | A trial ends automatically and the hotel becomes read-only. | Must | Built and works | 8 test checks pass. |
| PLT-006 | A read-only hotel can still settle and check out guests already in house. | Must | Built and works | 3 test checks pass. |
| PLT-007 | Plan limits on rooms, properties and users stop new creation and never delete anything. | Should | Built and works | 4 test checks pass, plus 6 in `27_medium_fixes.sql`. System Administrator or General Manager (ADM-002, decision of 6 Oct 2026) adds a property on Setup, Property; the limit is `plans.max_properties` (Starter and Standard 1, Pro 3). |
| PLT-008 | Platform staff activate, suspend, change plan or close a hotel by hand, with a reason, and every change is logged. | Must | Built and works | Manual activation, suspension and plan change through app.platform_set_subscription (decision 5e). No console screen. Tests pass. |
| PLT-009 | Platform staff see tenants and subscriptions but no guest, reservation or financial data. | Must | Missing | No platform staff role at all. (no automated test yet) |
| PLT-010 | Time-boxed break-glass support access, with reason, tenant notice and audit entry. | Should | Missing | No break-glass access. (no automated test yet) |
| PLT-011 | A hotel can cancel its own subscription and stays read-only afterwards. | Should | Built and works | 5 test checks pass. |
| PLT-012 | Subscription billing through a payment provider (Paystack or Flutterwave). | Should | Missing | R1b. Not due yet. (no automated test yet) |

### Administration

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| ADM-001 | A hotel administrator adds staff to the hotel. | Must | Built, untested | Invite now checks permission first, looks up accounts by email, never uses temporary passwords, and has a resend button (server code, finding M6). Browser test in step 4. |
| ADM-002 | Only administrators assign roles, per property or hotel-wide; the last administrator cannot be removed. | Must | Built and works | 4 test checks pass. |
| ADM-003 | A disabled user loses all access immediately. | Must | Built and works | 2 test checks pass. |
| ADM-004 | Custom roles cannot hold more than their creator holds. | Must | Built and works | 2 test checks pass. |
| ADM-005 | Limit-based permissions (grant level L) use a per-role amount; no limit means zero. | Must | Built and works | 1 test checks pass. |
| ADM-006 | The audit trail cannot be changed or deleted by anyone, and is visible to permitted roles only. | Must | Partly built | 1 pass, 3 fail: the audit trail cannot be changed, even by the owner (expected [E_IMMUTABLE], but it succeeded); the audit trail cannot be deleted (expected [E_IMMUTABLE], but it succeeded); the audit trail cannot be truncated (expected [E_IMMUTABLE], but it succeeded) |
| ADM-007 | Sensitive actions require a reason and write an audit event with actor, time, before and after. | Must | Built and works | 2 test checks pass. |
| ADM-008 | Staff get in-app notifications for approvals, tasks and exceptions, and can mark them read. | Should | Built and works | 4 test checks pass. |
| ADM-009 | Authorised users export data. | Should | Built, untested | export_data with permission check and audit row. (no automated test yet) |

### Setup

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| SET-001 | Property profile can be edited, but the business date and base currency cannot. | Must | Built and works | 4 test checks pass. |
| SET-002 | Room types with occupancy limits and an overbooking allowance. | Must | Built and works | Room type created and bookable (S02, S03). (no automated test yet) |
| SET-003 | Room inventory per property; rooms can be retired but never deleted while in use. | Must | Built and works | Bulk add worked (S02). Condition cannot be written directly (test I). (no automated test yet) |
| SET-004 | Rate plans with prices by room type, date range and weekday, and policies for cancellation, no-show and deposit. | Must | Built and works | 2 test checks pass. |
| SET-005 | Tax lines with rate, base (net or net plus prior taxes), applicable revenue groups and a verified flag. | Must | Built and works | 1 test checks pass. |
| SET-006 | Charge codes and payment methods per property. | Must | Built, untested | Charge codes and payment methods seeded per property. (no automated test yet) |
| SET-007 | Exchange rates per property per day, entered by hand. | Should | Built and works | 1 test checks pass. |
| SET-008 | Inspection can be switched off per property. | Should | Built and works | 1 test check passes, plus 4 in `26_small_fixes.sql`. Switch on Setup, Property. Off: a completed room is clean at once. |
| SET-009 | Per hotel: "Allow ID photos" (off by default) and "Require ID photo at check-in" (applies only when allowed). While Allow is off, uploading and opening ID photos are refused. | Must | Built and works (branch `claude/id-photos`, not yet live) | Database and browser tests pass. |

### Reservations

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| RES-001 | Availability is calculated per room type and night from sellable rooms less held bookings. | Must | Built and works | 2 test checks pass. |
| RES-002 | Create a reservation for one room type and rate plan, priced night by night. | Must | Built and works | 3 test checks pass. |
| RES-003 | A sold-out room type cannot be booked, and occupancy and stay-length limits are enforced. | Must | Built and works | 4 test checks pass. |
| RES-004 | Modify dates, room type, rate plan or guest count before check-in; the stay is repriced and inventory follows. | Must | Built and works | 3 test checks pass. |
| RES-005 | A tentative booking holds inventory until its hold expires, then is released at the next roll; confirming ends the hold. | Must | Built and works | 5 test checks pass. |
| RES-006 | Cancel with a reason; the fee follows the rate plan; only a permitted user can waive it. | Must | Built and works | 8 test checks pass. |
| RES-007 | No-show can be marked by hand or by the automatic roll, with the fee from the rate plan. | Must | Built and works | 6 test checks pass. |
| RES-008 | Reinstate a cancelled or no-show booking when inventory allows. | Should | Built and works | 2 test checks pass. |
| RES-009 | Rate override needs its own permission and a reason, and is audited. | Must | Built and works | 3 test checks pass. |
| RES-010 | A deposit rule on the rate plan sets the deposit required. | Must | Built and works | 2 test checks pass. |
| RES-011 | Corporate business is a booking source plus a free-text company name plus a corporate rate plan; no company entity in R1. | Must | Built and works | 2 test checks pass. |
| RES-012 | A group booking is several one-room reservations sharing a group record. | Should | Built, untested | Group bookings table and form. (no automated test yet) |
| RES-013 | Additional guests and an arrival-ready flag on a booking. | Should | Built and works (database only) | 2 test checks pass, plus 4 in `26_small_fixes.sql`. `set_arrival_ready` exists; no screen shows the flag yet. |

### Front Office

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| FO-001 | Arrivals due today or overdue, with guest, room type, guarantee and assigned room. | Must | Built and works | 2 test checks pass. |
| FO-002 | In-house guests with room, departure and balance; overdue departures flagged. | Must | Built and works | 1 test checks pass. |
| FO-003 | Check-in guards: confirmed booking, arrival date reached, ID recorded, registration accepted, room ready and free, deposit paid. | Must | Built and works, with a known limit | 12 test checks pass, plus 6 in `27_medium_fixes.sql`. The check-in and walk-in screens force the "registration card" tick; a direct database call that omits the tick is not refused (decision of 6 Oct 2026). Drawn signature: later. |
| FO-004 | Walk-in check-in creates the booking and checks in in one step. | Must | Built and works | 2 test checks pass. |
| FO-005 | Assign a room before arrival; two overlapping stays can never hold the same room. | Must | Built and works | 2 test checks pass. |
| FO-006 | Move a guest to another room; the old room turns dirty with a turnover task; the stay and folio carry over. | Must | Partly built | 6 pass, 1 fail: a cleaning task was created for the old room |
| FO-007 | A move to a different room type reprices from tonight; a complimentary upgrade keeps the rate and needs its own permission. | Should | Built and works | 1 test check passes, plus 13 in `27_medium_fixes.sql`. Dearer type: front desk charges the new rate; keeping the rate needs `fo.upgrade.complimentary` (GM, FOM, and System Administrator under ADM-002), the move reason, and is audited. Nights already charged keep their price. |
| FO-008 | Extend or shorten a stay in house; extension checks inventory, the room and blocks. | Must | Built and works | 6 test checks pass, plus 4 in `26_small_fixes.sql` and browser test `e2e/change-departure.spec.ts`. |
| FO-009 | Check-out needs a zero balance and no credit, or an approved exception; open folios stay open for collection. | Must | Built and works | 10 test checks pass. |
| FO-010 | Check-out sets the room Dirty and Vacant and creates a turnover task; leaving early releases the unused nights. | Must | Built and works | 5 test checks pass. |
| FO-011 | Undo a check-out on the same business date. | Should | Built and works | 5 test checks pass. |
| FO-012 | Void a check-in on the same business date when no charges are posted. | Should | Partly built | 5 pass, 1 fail: the guest can be checked in again straight away (failed: [E_ROOM_NOT_READY] Room 103 is not ready. Only clean  |
| FO-013 | Room board shows each room as occupied, vacant by condition, out of order or out of service. | Must | Built and works | 1 test checks pass. |

### Guests

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| GST-001 | One guest profile per person across stays; search by name, phone, email or ID number. | Must | Built and works | 2 test checks pass. |
| GST-002 | ID documents are stored apart and shown only to roles that may see them. ID photos follow the same roles (6 Oct 2026). | Must | Partly built | 3 pass, 1 fail: reservation officers do not see ID documents |
| GST-003 | Personal data never appears in audit records; only the names of changed fields do. | Must | Built and works | 2 test checks pass. |
| GST-004 | Merge duplicate guest profiles; history moves to the kept profile. | Should | Built and works | 3 test checks pass. |
| GST-005 | Anonymise a guest on request; the ledger and stay history stay intact. | Should | Partly built | 4 pass, 1 fail: a guest with upcoming stays cannot be anonymised (expected [E_INVALID/E_IN_USE], but it succeeded) |
| GST-006 | Feedback and complaints logged against a guest. | Should | Built, untested | add_guest_feedback exists. (no automated test yet) |
| GST-007 | A photo or scan of an ID document (front and back; JPEG, PNG, WebP or PDF, 2 MB) is kept in private storage, shrunk in the browser first (longest side 1600 px, hidden photo data such as GPS removed), and opened only through a 60-second link. Upload and view: System Administrator, General Manager, Front Office Manager, Front Desk. Delete by hand with a reason: the first three. | Must | Built and works (branch `claude/id-photos`, not yet live) | Database and browser tests pass. |
| GST-008 | Every upload, view and deletion of an ID photo is audited with ids only, no personal data. | Must | Built and works (branch `claude/id-photos`) | Database tests pass. |
| GST-009 | ID photos are removed from storage when the guest is anonymised or the document is removed, and move with the guest when two profiles are merged. | Must | Built and works (branch `claude/id-photos`) | Database and browser tests pass. |
| GST-010 | ID photos are deleted automatically a set number of months (one setting, now 12) after the guest's last check-out, unless the guest has a booking that is not over. A daily clean-up removes the files. | Must | Built and works (branch `claude/id-photos`) | Database tests pass. |

### Rooms

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| ROOM-001 | Room condition and occupancy are separate, are set only by the system or a controlled action, and cannot be written by hand. | Must | Built and works | 2 test checks pass. |
| ROOM-002 | Out-of-order and out-of-service blocks; a request from maintenance needs approval, an approver's own request does not. | Must | Built and works | 5 test checks pass. |
| ROOM-003 | A block cannot cover a night a guest is assigned, and cannot oversell the room type. | Must | Built and works | 2 test checks pass. |
| ROOM-004 | A supervisor can override a room's condition with a reason; it is audited. | Should | Built and works | 3 test checks pass, plus 1 in `26_small_fixes.sql`. |
| ROOM-005 | Rooms are added from the Rooms page by roles that set up rooms: one at a time, or several by number (optional prefix and range) or by name (one per line), with a preview. Labels are free text up to 30 characters (letters, accented letters, digits, spaces, hyphens, apostrophes), unique per hotel ignoring case and extra spaces, shown as typed and sorted in natural order. | Must | Built and works (branch `claude/room-labels`, not yet live) | 48 database checks and 4 browser tests pass. |

### Housekeeping

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| HK-001 | Check-out and room moves create a turnover task; the board lists open tasks. | Must | Partly built | 2 pass, 1 fail: a cleaning task was created for the old room |
| HK-002 | Assign, start and complete cleaning tasks; an attendant sees only their own tasks. | Must | Built and works | 6 test checks pass, plus 2 in `26_small_fixes.sql`. |
| HK-003 | Inspection passes to Ready or fails with a reason and goes to rework. | Must | Built and works | 5 test checks pass (the notification check now reads as the attendant, 6 Oct 2026). |
| HK-004 | Nobody inspects their own cleaning. | Must | Built and works | 2 test checks pass. |
| HK-005 | Stayover cleaning tasks are planned at the roll for guests staying on. | Should | Built and works | 1 test checks pass. |
| HK-006 | Lost and found items are logged and tracked to return or disposal. | Should | Built and works | 1 test checks pass. |

### Maintenance

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| MNT-001 | Tickets move from open to assigned, in progress, waiting, resolved and closed; waiting needs a reason. | Must | Built and works | 2 test checks pass. |
| MNT-002 | The person who resolved a ticket cannot close it; closing releases its room block. | Must | Partly built | 1 pass, 1 fail: closing the ticket releases the block (got approved, expected released) |
| MNT-003 | Tickets can be reopened or cancelled, each with a reason. | Should | Built and works | 4 test checks pass. |

### Guest Service

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| SVC-001 | Guest requests are captured, assigned, progressed and completed. | Should | Built and works | 3 test checks pass. |
| SVC-002 | A chargeable request posts its charge, with tax, to the folio when completed. | Should | Built and works | 3 test checks pass. |

### Finance

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| FIN-001 | Charges post with their tax lines; prices can include or exclude tax; the remainder of a rounding goes on the last tax line. | Must | Built and works | 4 test checks pass. |
| FIN-002 | Payments and deposits are recorded against a folio with a method; payments are taken outside the system in R1. | Must | Partly built | 1 pass, 1 fail: reservation officer cannot take a normal payment (expected [E_FORBIDDEN/E_NOT_FOUND], but it succeeded) |
| FIN-003 | Foreign-currency postings store the amount, currency, exchange rate and base amount. | Should | Built and works | 2 test checks pass. |
| FIN-004 | A discount within the user's limit posts at once; above the limit it waits for an approver who is not the requester. | Must | Partly built | 4 pass, 1 fail: approved discount also reduces service charge and VAT (accountant to confirm) (got -5231.1600, expected -6326. |
| FIN-005 | Adjustments, reversals and refunds always need a second person and stay within the approver's limit. | Must | Built and works | 2 test checks pass. |
| FIN-006 | A posted transaction is never edited or deleted; corrections are linked reversal, adjustment or refund rows. | Must | Partly built | 9 pass, 2 fail: ledger cannot be truncated (expected [E_IMMUTABLE], but it succeeded); a charge cannot carry a negative sign (expected [check constraint/E_INVALID], but it succeeded) |
| FIN-007 | A refund cannot exceed the credit on the folio. | Must | Built and works | 2 test checks pass. |
| FIN-008 | Repeating the same request cannot double post (idempotency keys). | Must | Built and works | 2 test checks pass. |
| FIN-009 | Move a posted charge, with its tax, to another folio of the same booking; revenue does not change. | Should | Partly built | 4 pass, 1 fail: front desk cannot transfer between folios (expected [E_FORBIDDEN], but it succeeded) |
| FIN-010 | Split folios per reservation. | Should | Built and works | 1 test checks pass. |
| FIN-011 | A folio closes only at a zero balance and reopens only for the accountant with a reason; a closed folio takes no postings. | Must | Built and works | 5 test checks pass. |
| FIN-012 | Invoices and receipts are numbered documents built from posted rows; they cannot be changed once issued. | Must | Partly built | 5 pass, 1 fail: interim documents and receipts have their own number series |
| FIN-013 | Balances are calculated from posted rows and never stored; pending approvals do not change them. | Must | Built and works | 2 test checks pass. |
| FIN-014 | Every posting takes the open business date, and a past date is refused. | Must | Partly built | 1 pass, 1 fail: posting to a past business date is refused (expected [E_DATE/E_INVALID], but it succeeded) |
| FIN-015 | Folio visibility follows the role: managers see all folios, a reservation officer sees only those of their own bookings. | Must | Missing | Test fails: reservation officer sees only folios of own bookings (got 2, expected 1) |
| FIN-016 | Cashier shifts and reconciliation by cashier, shift and method. | Should | Missing | R2. Not due yet. (no automated test yet) |
| FIN-017 | A payment matching one on the same bill (amount, method, reference) within 10 minutes is refused unless the cashier confirms it with a reason; the refusal names the earlier payment and the confirmation is audited. Added 6 Oct 2026 (wave 1). | Must | Built and works | 20 test checks pass (`25_duplicate_payments.sql`), plus browser test `e2e/duplicate-payment.spec.ts`. |

### Business Date

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| DAY-001 | The business date rolls automatically at each property's cut-off time. | Must | Partly built | 3 pass, 1 fail: the scheduler rolled the lagging property forward and stopped at the correct date (got 2026-09-29, expected 20 |
| DAY-002 | At the roll, each guest in house is charged the night's room rate and tax exactly once. | Must | Built and works | 3 test checks pass. |
| DAY-003 | A guest still in house past departure is charged and extended a night if the room allows; otherwise managers are told. | Should | Missing | Test fails: a guest still in house after departure is not extended or flagged at the roll. |
| DAY-004 | A failed roll changes nothing and notifies managers; other properties are not blocked. | Must | Built and works | 2 test checks pass. |
| DAY-005 | Night audit gates the roll from R2. | Should | Missing | R2. Not due yet. (no automated test yet) |
| DAY-006 | A same-day arrival and departure: decide whether a night or day-use charge applies. | Should | Missing | Decision open. Today a same-day booking cannot be made at all. (no automated test yet) |

### Reporting

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| RPT-001 | Occupancy, ADR and RevPAR use one definition: rooms sold over rooms available (out-of-order rooms excluded), revenue net of tax. | Must | Built and works | 4 test checks pass. |
| RPT-002 | Live operations views: arrivals, in-house, room board, housekeeping board. | Must | Built, untested | Operations views exist. (no automated test yet) |
| RPT-003 | Every reported figure traces to ledger rows or operational records. | Must | Built, untested | Not checked. (no automated test yet) |
| RPT-004 | Report screens (occupancy trend, revenue by group, outstanding balances, cancellation and no-show rates). | Must | Built, untested | Report functions exist for each report. (no automated test yet) |

### Non-functional

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| NFR-001 | Every table has row-level security and tenant_id; security definer functions pin their search path. | Must | Built and works | 3 test checks pass. |
| NFR-002 | The browser can write directly only to plain configuration tables; ledger, reservations, stays, tasks and blocks change only through functions. | Must | Built and works | 1 test checks pass. |
| NFR-003 | Create actions accept client-generated ids and idempotency keys so an offline queue can be added later. | Should | Partly built | Idempotency keys proven (RES-002, FIN-008 tests). Client-generated ids are not accepted yet. |
| NFR-004 | Money uses fixed decimals per currency (naira 2, CFA franc 0), never floating point. | Must | Built and works | 2 test checks pass. |
| NFR-005 | Business date and cut-off follow the property's timezone. | Must | Built and works | 1 test checks pass. |


## 2. Audit findings

The findings as the read-only audit found them. Where one is fixed, its heading says so. The Update section above has the proof.

Ranked by how much harm they could do. "Where" gives the file or database object. Test names (S07, C and so on) refer to the checks in "How I tested".

### Must fix before any real hotel

**M1. Staff can give themselves more power by writing straight to the role tables. Fixed in step 1.**
- Where: row-level security policies `roles_write`, `role_permissions_write`, `upr_write`, `approval_limits_write` in `supabase/migrations/20260929090000_multi_tenant_foundation.sql` (lines 386 to 407).
- Proof: a user whose role only allowed "manage staff and roles" was blocked by the proper functions (tests A, B). The same user then wrote to the tables directly and succeeded. They gave their own role refund approval (C), made themselves System Administrator (D) and set their own approval limit (E).
- Business risk: a manager could approve their own refunds and remove any trace of limits, which defeats separation of duties.
- Fix: remove the four write policies, so the only way in is the functions that already check for escalation. Add a test that proves the attack fails.

**M2. The "change role permissions" function always crashes. Fixed in step 1.**
- Where: `public.set_role_permissions` (both insert lines leave out the role id).
- Proof: calling it gives "INSERT has more target columns than expressions". The code checker found no other function with this kind of fault.
- Business risk: nobody can edit a custom role's permissions or limits from the Roles screen. Once M1 is fixed, this becomes the only way to do it.
- Fix: two-line correction, plus a test.

**M3. A read-only hotel cannot take payment or check out a guest who owes money. Fixed in step 2.**
- Where: `public.post_payment`, `public.request_refund`, `public.check_out`. They allow settlement, but only `check_out` switches on the flag the table guard (`app.enforce_writable`) looks for. Payment inserts are then blocked.
- Proof: in a read-only hotel, a 1,000 payment on an open bill was refused with E_READ_ONLY (test R1). Checking out a guest who owes was also refused (R2).
- Business risk: when a subscription lapses, guests are stuck at the desk and staff cannot record money already received. Decision D6 exists to prevent exactly this.
- Fix: set the settlement flag in every settlement function. Test in a read-only hotel.

**M4. Trials never end and past-due hotels are never suspended. Fixed in step 2.**
- Where: nothing exists. There is no subscription clock job. Read-only mode is only switched on by hand in SQL.
- Business risk: every hotel keeps full access forever for free, and D7 (suspend after 14 days past due) never happens.
- Fix: a daily job that expires trials, marks past due and suspends, with a history row for each change. Also align the two status fields (`tenants.status` controls access, `tenant_subscriptions.status` feeds the banner).

**M5. The audit log keeps guests' personal data, including ID numbers. Fixed in step 2.**
- Where: `app.audit_guest_row` in `20260929100000_guests.sql`. It copies the whole row, before and after, for `guests` and `guest_documents`.
- Business risk: anyone allowed to read the audit log sees phone numbers, emails and passport numbers that the guest screen deliberately hides. That is a data protection problem (GST-003).
- Fix: record only the names of the changed fields for guest tables. Clean the rows already written.

**M6. The staff invite sends an email before checking permission. Fixed in step 1.**
- Where: `src/lib/invite.functions.ts`. It creates the login and sends the invite using the powerful service key. Only after that does it ask the database whether the caller may add staff.
- Business risk: any signed-in user, even one with no hotel, can make the system send invite emails to any address. That can be used for spam or phishing in your name. The failed account is deleted, but the email has already gone.
- Fix: check `adm.user.manage` first. Also look up existing users properly (it only checks the first 200). Drop or restrict the "temporary password shown on screen" fallback.

**M7. Cancellation and no-show fees are worked out but never charged. Fixed in step 2.**
- Where: `cancel_reservation`, `mark_no_show` and the nightly roll store the fee on the reservation (`cancellation_fee`, `no_show_fee`) but never post it to a folio.
- Proof: the nightly roll marked a booking as a no-show and worked out a fee of 50,000. No folio rows were posted (S19).
- Business risk: lost revenue on every late cancellation and no-show.
- Fix: post the fee to the booking's folio with an idempotency key, and allow a waiver only with permission.

**M8. The browser can write to every table, and only row-level security stops it. Fixed in step 1.**
- Where: on real Supabase, the browser roles (`anon`, `authenticated`) get insert, update and delete on every table by default. No migration takes this away. Today the ledger, reservations and stays are safe only because they have no write policy (test H). The "column grants" the design relies on do nothing, because the whole table is granted.
- Business risk: one careless policy in a future migration would open the ledger or bookings to direct edits. There is also no test that would catch it (NFR-001, NFR-002).
- Fix: revoke table writes from `anon` and `authenticated`, grant back only the few that are needed, change the default privileges, and add a test that lists exactly which tables the browser can write.

### Should fix

| # | What | Where | Business risk | Fix |
|---|---|---|---|---|
| S1 | **Fixed in step 1.** Admin can change a property's base currency directly | `properties_update` policy | Past bills and reports would show the wrong currency | Remove the policy. `update_property` already exists and leaves currency out |
| S2 | **Fixed in step 1.** Admin can edit other staff profiles directly, including status | `profiles_update_admin` policy | Disabling staff skips the audited `set_user_status` path | Route through the functions only |
| S3 | **Kept by decision 5a**, now tested. One person can check out a guest who owes money, just by typing a reason | `check_out` with `fo.checkout.unsettled` | Unpaid bills leave with no second check (FO-009 says a different person must approve) | Require an approved exception from someone else, or confirm the one-person rule is acceptable |
| S4 | **Fixed in step 1.** 11 functions can be called by someone who is not signed in | `check_in`, `move_room`, `extend_stay`, `void_check_in`, `walk_in_check_in`, room block functions, `set_room_condition`, `get_front_desk_rooms` | Low today, since they refuse without a hotel, but it breaks the default-deny rule | Revoke from `anon` |
| S5 | Audit rows can be changed at database level, and anonymise rewrites them | `audit_events`, `anonymise_guest` | The audit trail is only as safe as the browser rules (ADM-006) | Add a lock trigger. Handle anonymise by storing no personal data in the first place (see M5) |
| S6 | **Fixed in step 2.** Amounts with too many decimals are accepted (₦100.123) | posting functions | Rounding differences between folio, invoice and accounts (NFR-004) | Check decimals per currency |
| S7 | Guests past departure are not extended or flagged | nightly roll | A guest who stays on is not charged, and nobody is told (DAY-003) | Extend and charge if the room is free, otherwise notify managers |
| S8 | Folio access is all or nothing | `folios` read policy | A reservation officer sees every guest's bill, not only their own bookings (FIN-015) | Support grant level O (own records) |
| S9 | **In the plan, step 5.** Several screens add up money in the browser | `checkout.$id.tsx` (outstanding), `reservations/$id.tsx` (fee preview), `dashboard.tsx` (revenue), `folios.tsx` (tax preview) | Small rounding errors on screen that do not match the invoice | Take totals from the database |
| S10 | Check-out leaves two open cleaning tasks on the room | `app.hk_new_turnover` | Housekeeping sees duplicate work | Cancel the stayover task when a turnover is created |
| S11 | A new invoice key is made on every click | `src/lib/checkout.tsx` | A retry after a network drop could issue two invoices | Keep one key per dialog, like the payment forms do |
| S12 | Email is not connected, and nothing sends the outbox on a schedule | `outbox.server.ts`, no job | Booking confirmations and approval alerts never go out, including failed-roll alerts | Add the email key and a scheduled sender |
| S13 | Missing smaller features | see requirement table | Gaps against R1 | Inspection on/off (SET-008), arrival-ready flag (RES-013), complimentary upgrade (FO-007), password reset |

### Nice to have

- Lint: 6,560 formatting issues, fixable automatically. Only 3 real warnings.
- Unused starter packages (embla, cmdk, vaul, input-otp and others) and the deprecated `housekeeping_tasks` table.
- Many database calls in the screens are untyped (`as any`). This hides mistakes that the type checker could catch.
- Lists are capped (for example 200 folios) with no paging.
- A question to check, not a confirmed bug: a 1,000 discount on a taxed 10,000 charge lowered the bill by exactly 1,000, and the tax stayed the same. If the discount should also reduce VAT and service charge, the hotel is over-collecting tax. See decision 3.

### What the browser can do to each table

After step 1, on the real Supabase setup:

| Tables | Browser can read | Direct write |
|---|---|---|
| Every table except guest_documents | Yes, filtered by row-level security to the user's hotel and permissions | **No.** Every change goes through a function |
| guest_documents | No. ID numbers come only through `get_guest`, masked unless the user may see documents | No |
| Any table, for someone not signed in | No | No |

A test (`10_security.sql`) fails if any table, view or policy ever allows a direct write again, if anyone who is not signed in can call an app function, or if a table lacks row-level security or tenant_id.

Before step 1, the browser held full write grants on every table. Direct writes were possible on roles, role_permissions, user_property_roles, approval_limits, properties and profiles.

## 3. What is outstanding

Sizes: small is about a day or less, medium a few days, large a week or more. Fixed items are gone from this list.

| Area | Work | Size |
|---|---|---|
| Security | Lock audit rows and the ledger against the database owner (remaining failures 6 to 8, 28 to 30) | Small |
| Security | Own-bookings folio access (FIN-015). Front desk transfers need a manager (FIN-009) | Medium |
| Money rules | Discount tax treatment, after the accountant decides (FIN-004) | Small to medium |
| Money rules | Separate number series for interim invoices and receipts (FIN-012) | Small |
| Money rules | Approval limits on built-in roles, or clear onboarding to copy a role first | Small |
| Booking rules | Overdue departures at the roll, and the catch-up roll stopping short (DAY-003, DAY-001) | Medium |
| Booking rules | Same-day stays, after decision DAY-006. Today they cannot be booked at all | Medium |
| Booking rules | Shorten an in-house stay, complimentary upgrade, registration card accepted, arrival-ready flag, re-check-in after a void (FO-008, FO-007, FO-003, RES-013, FO-012) | Small each |
| Booking rules | Guest with an upcoming stay cannot be anonymised (GST-005) | Small |
| Housekeeping and maintenance | Cleaning task on room move, attendants see own tasks only, failed-inspection notice, no start without an assignee, reason for dirty override, ticket close releases block, inspection on/off (FO-006, HK-002, HK-003, ROOM-004, MNT-002, SET-008) | Small each, medium together |
| Setup | Add a second property (PLT-007). Currency from the country template (PLT-004) | Medium, small |
| Screens | **Show server-calculated figures wherever a screen adds up money today**: check-out outstanding total, reservation fee preview, dashboard revenue, tax preview on the charge form (S9, your adjustment 4). The database will provide each figure, and the screen shows it as is | Small to medium |
| Screens | Rate plan screen: add the new free-cancellation days field | Small |
| Screens | Click through every screen with real data and fix what breaks | Large |
| Screens | Password reset, list paging, typed database calls (regenerate `types.ts`) | Small to medium |
| Jobs and email | Connect Resend (decision 5d) and schedule the outbox sender | Small |
| Jobs and email | Break-glass support access (PLT-010), platform console (PLT-009). Deferred by decision 5e | Medium |
| Tests | Keep adding tests as each gap is fixed. Add browser tests for the main flows | Medium |
| Lovable removal | Replace the Lovable build preset, delete Lovable preview auth, error reporting and the cron secret, remove the gateway branch from the outbox, delete `drizzle/`, `.lovable/` and the AGENTS block, stop tracking `.env`, disconnect the GitHub sync | Medium |
| Deployment | Your Supabase project: migrations, auth settings, pg_cron, secrets | Small |
| Deployment | Vercel (decision 5c): change the build target from Cloudflare Workers | Small to medium |
| Deployment | Automatic checks on every change (tests and build before anything reaches main) | Small |

## 4. Decisions

### Answered on 30 Sep 2026

| # | Question | Your answer | What it means in the build |
|---|---|---|---|
| 5a | Unsettled check-out | The approval-permission holder may do it alone with a reason, and it is audited. Everyone else needs a second approver | Already how the app works. Now covered by tests |
| 5b | Temporary passwords | None. Use a resend-invite button | Done in step 1 |
| 5c | Hosting | Vercel | Build target changes in step 4 |
| 5d | Email | Resend | Connect in step 6 |
| 5e | Platform console | Manual activation for the first pilots | `app.platform_set_subscription`, run by me or the service role, with a reason and a history row |
| 5f | Permission names | Keep Lovable's names, update the docs | Recorded in `docs/decisions.md`. The design docs will use these names from now on |
| 6a | Reservation officers and payments | Deposits only | Built and tested |
| 6b | Reservation officers and ID documents | They do not see them | Built and tested |
| 6c | Approval limits on built-in roles | Yes, set per hotel | Not built yet |
| 6d | Free-cancellation default | 2 days, changeable | Built and tested |
| DAY-006 | Same-day stays | Charged one night. A manager can waive it with a reason | Not built yet. Today such bookings are refused |

### Still open

| # | Decision | Why it matters now |
|---|---|---|
| A16 | Plan tiers and prices | Limits are enforced, so the numbers must be final before signup opens |
| A14 | Cloud region | Your project is in West EU (Ireland). Get data protection advice before real guest data goes in |
| A11 | Tax rules (accountant) | Rates, whether cancellation and no-show fees are taxed (not taxed for now), and rounding |

## 5. Risks and things I am unsure about

- **The screens have not been used against the fixed database.** Step 1 removed every direct table write. No screen does one, but a screen could still depend on something I cannot see without running it. Step 4 is the check.
- **Untested is still not the same as working.** 8 requirements have no test yet, and some reports are only checked for existence.
- **My checks ran on a local rebuild, not on the Lovable Cloud database.** We start a fresh database anyway.
- **Two-way sync with Lovable is still on.** Nothing has been pushed. When we push this branch, edits made in Lovable in the meantime could clash.
- **Tax figures are guesses** until your accountant signs off.
- **One builder, no automatic checks yet.** The test suite helps, but it only runs when someone runs it.
- **Unsure:** whether Lovable made the generous reservation officer rights on purpose, and whether the catch-up roll failure (22) has the same cause as the overstay failure (21).

## 6. Plan

Steps 1 and 2 are done. You approve each step before I start the next.

| Step | Work | What you can see or try afterwards |
|---|---|---|
| 1 | Done. Security fixes | 49 security checks pass |
| 2 | Done. Money and subscription fixes | Read-only settlement, fees, clock and audit privacy checks pass |
| 3 | Grow the test suite: fix and prove the 30 remaining failures, starting with money and housekeeping (failures 1 to 3, 9, 16 to 21) | Fewer "not ok" lines. A list of which requirements each test proves |
| 4 | Remove Lovable, switch the build to Vercel, stop tracking `.env`, run the app on your Mac against local Supabase | Sign up and click around at `http://localhost:8080` |
| 5 | Browser walk-through of every screen and fix what breaks. **Every screen that adds up money switches to figures from the database** (check-out, reservations, dashboard revenue, tax preview) | Screenshots of each main flow. No money is calculated in the browser |
| 6 | Remaining gaps after your decisions: tax on discounts, same-day stays, roles, email with Resend | Updated requirement table |
| 7 | Link your Supabase project and apply migrations (only after you confirm it is empty and approve the list), then set auth, pg_cron and secrets | The app on your Mac talking to your real Supabase project |
| 8 | Deploy to Vercel, add automatic checks, disconnect Lovable | A live URL you control, with no Lovable dependency |

## Supabase status

- **Local Supabase: running** in Docker, from the app repo (project name `hotel-desk`). All 36 migrations apply. Scheduled jobs: the business date roll every 5 minutes, and the subscription clock daily.
- **Your project** `urbpxybyrfjczqbrpdsq` (West EU, Ireland): linked, pg_cron on, all 43 migrations applied and recorded (1 Oct 2026). Your account and hotel (Euro Hotel) exist, with the hand-test booking RES-000001 in house.
