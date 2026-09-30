# Status report: Hotel Desk (Lovable build)

Date: 30 Sep 2026. Code audited: `main` at commit `ef56121`. Written by Claude Code for Peter.

This report covers the app Lovable built (`hotel-management-system-29015d49`). It measures that app against the 107 R1 requirements in the reference repo (`hms-reference-backend`, `docs/HMS_R1_Requirements.xlsx`). The "Built" marks in that workbook describe the older reference backend, not this app. Every status below comes from this audit.

## The short version

- Lovable built far more than a skeleton: 17 database migrations, 123 business functions, 44 tables and about 45 screens. The code compiles and builds.
- The core money and booking engine works in the scenarios I ran. That covers booking, sold-out protection (including four clerks racing for the last room), check-in, tax, charges, discounts with approval, the nightly roll, payment, check-out and invoice.
- It is **not ready for a real hotel**. I found 8 problems that must be fixed first. The worst: a staff member with admin rights can make themselves System Administrator and give themselves refund approval, by writing straight to the database. Also, a hotel whose subscription lapses traps guests at the desk, because it can no longer take payment.
- Almost nothing has been tested. The app has 1 automated test. The reference backend had 353. No one has clicked through the screens with real data.
- Lovable can be removed. It is tied into the build tool, error reporting, a duplicate migration folder and the hosting target, and each tie is known and listed.

| | Count |
|---|---|
| Built and works (I ran it and it passed) | 25 |
| Built, untested (code exists, not run) | 52 |
| Partly built (a piece is missing or broken) | 17 |
| Missing (3 of these are R1b or R2, not due yet) | 13 |
| **Total** | **107** |

Of the 76 "Must" requirements: 24 work, 33 are untested, 14 are partly built, 5 are missing.

## How I tested

Everything was read only. I changed nothing in the app.

1. Rebuilt the whole database from the migrations on a plain Postgres, then on a full local copy of Supabase in Docker (Postgres 17.6 with pg_cron). All 17 migrations apply cleanly on both. The existing tenant isolation test passes on both.
2. Listed what the browser is allowed to do to every table and function, on the real Supabase setup.
3. Ran attack tests: a user with limited admin rights tried to give themselves more power, the proper way and by writing to tables directly.
4. Ran a guest journey test with 20 steps: setup, booking, sold out, check-in, charges, tax, duplicate protection, approvals, discount limits, nightly roll, check-out, invoice, ledger lock, read-only mode.
5. Ran a race test: four bookings at the same instant for one room.
6. Ran a code checker over all 123 database functions to find hidden crashes.
7. Read the front-end code for secrets, money maths and duplicate protection. Ran the type check, linter and a production build.

All test data was rolled back or wiped. The test scripts live outside the repo. I will turn them into permanent tests in step 3 of the plan.

What I did not do: click through the screens in a browser, test email sending, or check every one of the 353 reference scenarios. Statuses marked "untested" may hide bugs.

## 1. What exists, requirement by requirement

### Totals per module

| Module | Built and works | Built, untested | Partly built | Missing | Total |
|---|---|---|---|---|---|
| Platform & Tenancy | 3 | 2 | 1 | 6 | 12 |
| Administration | 1 | 4 | 4 | 0 | 9 |
| Setup | 3 | 2 | 2 | 1 | 8 |
| Reservations | 3 | 7 | 3 | 0 | 13 |
| Front Office | 2 | 9 | 2 | 0 | 13 |
| Guests | 0 | 4 | 1 | 1 | 6 |
| Rooms | 1 | 3 | 0 | 0 | 4 |
| Housekeeping | 2 | 4 | 0 | 0 | 6 |
| Maintenance | 0 | 3 | 0 | 0 | 3 |
| Guest Service | 0 | 2 | 0 | 0 | 2 |
| Finance | 8 | 6 | 0 | 2 | 16 |
| Business Date | 2 | 1 | 0 | 3 | 6 |
| Reporting | 0 | 4 | 0 | 0 | 4 |
| Non-functional | 0 | 1 | 4 | 0 | 5 |
| **All** | **25** | **52** | **17** | **13** | **107** |

### Every requirement

### Platform & Tenancy

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| PLT-001 | A person with a confirmed email creates a hotel account in one step. | Must | Built and works | Test S01: hotel, trial, property and admin roles created. |
| PLT-002 | Signup is refused for an unconfirmed email and for a user who already belongs to a hotel. | Must | Built, untested | Code refuses unconfirmed email; second hotel refused in isolation test. Unconfirmed path not run. |
| PLT-003 | One hotel can never see or change another hotel's data. | Must | Built and works | Isolation test passes on local Supabase. Cross-hotel writes not tested. |
| PLT-004 | A new property is seeded from its country template (currency, timezone, tax lines, payment methods, charge codes). | Must | Built and works | Nigeria taxes seeded; 10,000 charge gave 11,825 (S07). Other countries not checked. |
| PLT-005 | A trial ends automatically and the hotel becomes read-only. | Must | Missing | No subscription clock. Trials never expire. |
| PLT-006 | A read-only hotel can still settle and check out guests already in house. | Must | Partly built | Broken: in a read-only hotel, payments and unsettled check-out are refused (test R1, R2). |
| PLT-007 | Plan limits on rooms, properties and users stop new creation and never delete anything. | Should | Built, untested | Plan limit triggers exist on rooms, properties, users. |
| PLT-008 | Platform staff activate, suspend, change plan or close a hotel by hand, with a reason, and every change is logged. | Must | Missing | No platform console. Status changes are manual SQL. |
| PLT-009 | Platform staff see tenants and subscriptions but no guest, reservation or financial data. | Must | Missing | No platform staff role at all. |
| PLT-010 | Time-boxed break-glass support access, with reason, tenant notice and audit entry. | Should | Missing | No break-glass access. |
| PLT-011 | A hotel can cancel its own subscription and stays read-only afterwards. | Should | Missing | No cancel subscription function. |
| PLT-012 | Subscription billing through a payment provider (Paystack or Flutterwave). | Should | Missing | R1b. Not due yet. |

### Administration

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| ADM-001 | A hotel administrator adds staff to the hotel. | Must | Partly built | Invite works in code, but it creates the account and sends the email before checking permission. |
| ADM-002 | Only administrators assign roles, per property or hotel-wide; the last administrator cannot be removed. | Must | Partly built | Function blocks escalation (test B) and last admin rule holds. Direct table write lets a user make themselves System Administrator (test D). |
| ADM-003 | A disabled user loses all access immediately. | Must | Built, untested | Status check exists in permission helper. |
| ADM-004 | Custom roles cannot hold more than their creator holds. | Must | Partly built | Function blocks it (test A) but direct write bypasses it (test C). set_role_permissions always crashes. |
| ADM-005 | Limit-based permissions (grant level L) use a per-role amount; no limit means zero. | Must | Built and works | Front desk discount with no limit row waited for approval (S10). |
| ADM-006 | The audit trail cannot be changed or deleted by anyone, and is visible to permitted roles only. | Must | Partly built | Browser cannot change audit rows (test J). No database-level lock, and anonymise rewrites audit rows. |
| ADM-007 | Sensitive actions require a reason and write an audit event with actor, time, before and after. | Must | Built, untested | Reasons required in many functions; audit trigger on 8 tables. Not checked action by action. |
| ADM-008 | Staff get in-app notifications for approvals, tasks and exceptions, and can mark them read. | Should | Built, untested | Notifications table and bell exist. |
| ADM-009 | Authorised users export data. | Should | Built, untested | export_data with permission check and audit row. |

### Setup

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| SET-001 | Property profile can be edited, but the business date and base currency cannot. | Must | Partly built | Business date locked (test G). Base currency can be changed directly (test F). |
| SET-002 | Room types with occupancy limits and an overbooking allowance. | Must | Built and works | Room type created and bookable (S02, S03). |
| SET-003 | Room inventory per property; rooms can be retired but never deleted while in use. | Must | Built and works | Bulk add worked (S02). Condition cannot be written directly (test I). |
| SET-004 | Rate plans with prices by room type, date range and weekday, and policies for cancellation, no-show and deposit. | Must | Partly built | Policies stored and fees calculated, but cancellation and no-show fees are never posted to the folio. |
| SET-005 | Tax lines with rate, base (net or net plus prior taxes), applicable revenue groups and a verified flag. | Must | Built and works | Exclusive and inclusive charge both give 11,825 with net 10,000 (S07, P1). |
| SET-006 | Charge codes and payment methods per property. | Must | Built, untested | Charge codes and payment methods seeded per property. |
| SET-007 | Exchange rates per property per day, entered by hand. | Should | Built, untested | set_exchange_rate exists. |
| SET-008 | Inspection can be switched off per property. | Should | Missing | No inspection on/off setting. |

### Reservations

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| RES-001 | Availability is calculated per room type and night from sellable rooms less held bookings. | Must | Built and works | Availability 2 for 2 rooms (S03). |
| RES-002 | Create a reservation for one room type and rate plan, priced night by night. | Must | Built and works | Booking created; same key returned same booking (S04). |
| RES-003 | A sold-out room type cannot be booked, and occupancy and stay-length limits are enforced. | Must | Built and works | Third booking for 2 rooms refused (S05). 4 clerks racing for 1 room: 1 booking. |
| RES-004 | Modify dates, room type, rate plan or guest count before check-in; the stay is repriced and inventory follows. | Must | Built, untested | modify_reservation exists. |
| RES-005 | A tentative booking holds inventory until its hold expires, then is released at the next roll; confirming ends the hold. | Must | Built, untested | Roll expires holds. |
| RES-006 | Cancel with a reason; the fee follows the rate plan; only a permitted user can waive it. | Must | Partly built | Cancel works in code; fee calculated but not posted. |
| RES-007 | No-show can be marked by hand or by the automatic roll, with the fee from the rate plan. | Must | Partly built | Roll marked no-show (S12). Fee of 50,000 calculated but not posted (S19). |
| RES-008 | Reinstate a cancelled or no-show booking when inventory allows. | Should | Built, untested | reinstate_reservation exists. |
| RES-009 | Rate override needs its own permission and a reason, and is audited. | Must | Built, untested | Override needs permission and reason in code. |
| RES-010 | A deposit rule on the rate plan sets the deposit required. | Must | Built, untested | Deposit rule and deposit_paid exist. |
| RES-011 | Corporate business is a booking source plus a free-text company name plus a corporate rate plan; no company entity in R1. | Must | Built, untested | Company name and source on booking. |
| RES-012 | A group booking is several one-room reservations sharing a group record. | Should | Built, untested | Group bookings table and form. |
| RES-013 | Additional guests and an arrival-ready flag on a booking. | Should | Partly built | Additional guests yes. No arrival-ready flag. |

### Front Office

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| FO-001 | Arrivals due today or overdue, with guest, room type, guarantee and assigned room. | Must | Built, untested | v_arrivals view and screen. |
| FO-002 | In-house guests with room, departure and balance; overdue departures flagged. | Must | Built, untested | v_in_house view and screen. |
| FO-003 | Check-in guards: confirmed booking, arrival date reached, ID recorded, registration accepted, room ready and free, deposit paid. | Must | Built and works | Check-in with ID succeeded, room occupied (S06). Refusal guards not all run. |
| FO-004 | Walk-in check-in creates the booking and checks in in one step. | Must | Built, untested | walk_in_check_in exists. |
| FO-005 | Assign a room before arrival; two overlapping stays can never hold the same room. | Must | Built, untested | Exclusion constraint on room assignments. |
| FO-006 | Move a guest to another room; the old room turns dirty with a turnover task; the stay and folio carry over. | Must | Built, untested | move_room exists. |
| FO-007 | A move to a different room type reprices from tonight; a complimentary upgrade keeps the rate and needs its own permission. | Should | Partly built | Move reprices by type. No complimentary upgrade permission. |
| FO-008 | Extend or shorten a stay in house; extension checks inventory, the room and blocks. | Must | Built, untested | extend_stay exists. |
| FO-009 | Check-out needs a zero balance and no credit, or an approved exception; open folios stay open for collection. | Must | Partly built | Refused while owing (S14), but one person with the permission can check out a debtor by typing a reason. No second person. |
| FO-010 | Check-out sets the room Dirty and Vacant and creates a turnover task; leaving early releases the unused nights. | Must | Built and works | Room dirty, turnover task, folio closed (S15). Room also kept its stayover task: 2 open tasks. |
| FO-011 | Undo a check-out on the same business date. | Should | Built, untested | undo_checkout exists. |
| FO-012 | Void a check-in on the same business date when no charges are posted. | Should | Built, untested | void_check_in exists. |
| FO-013 | Room board shows each room as occupied, vacant by condition, out of order or out of service. | Must | Built, untested | v_room_board and screen. |

### Guests

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| GST-001 | One guest profile per person across stays; search by name, phone, email or ID number. | Must | Built, untested | search_guests exists. |
| GST-002 | ID documents are stored apart and shown only to roles that may see them. | Must | Partly built | Numbers masked on guest screen, but full ID numbers are copied into the audit log. |
| GST-003 | Personal data never appears in audit records; only the names of changed fields do. | Must | Missing | Audit log stores full personal data (phone, email, ID numbers). |
| GST-004 | Merge duplicate guest profiles; history moves to the kept profile. | Should | Built, untested | merge_guests exists. |
| GST-005 | Anonymise a guest on request; the ledger and stay history stay intact. | Should | Built, untested | anonymise_guest exists. |
| GST-006 | Feedback and complaints logged against a guest. | Should | Built, untested | add_guest_feedback exists. |

### Rooms

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| ROOM-001 | Room condition and occupancy are separate, are set only by the system or a controlled action, and cannot be written by hand. | Must | Built and works | Direct update of condition changed 0 rows (test I). |
| ROOM-002 | Out-of-order and out-of-service blocks; a request from maintenance needs approval, an approver's own request does not. | Must | Built, untested | Block request and approval functions. |
| ROOM-003 | A block cannot cover a night a guest is assigned, and cannot oversell the room type. | Must | Built, untested | check_block raises E_OVERSOLD. |
| ROOM-004 | A supervisor can override a room's condition with a reason; it is audited. | Should | Built, untested | set_room_condition with reason. |

### Housekeeping

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| HK-001 | Check-out and room moves create a turnover task; the board lists open tasks. | Must | Built and works | Turnover task created at check-out (S15). |
| HK-002 | Assign, start and complete cleaning tasks; an attendant sees only their own tasks. | Must | Built, untested | Task functions exist. |
| HK-003 | Inspection passes to Ready or fails with a reason and goes to rework. | Must | Built, untested | inspect_hk_task exists. |
| HK-004 | Nobody inspects their own cleaning. | Must | Built, untested | Database rule inspector differs from cleaner. |
| HK-005 | Stayover cleaning tasks are planned at the roll for guests staying on. | Should | Built and works | Roll created a stayover task (S15 detail). |
| HK-006 | Lost and found items are logged and tracked to return or disposal. | Should | Built, untested | Lost and found functions exist. |

### Maintenance

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| MNT-001 | Tickets move from open to assigned, in progress, waiting, resolved and closed; waiting needs a reason. | Must | Built, untested | Ticket functions exist. |
| MNT-002 | The person who resolved a ticket cannot close it; closing releases its room block. | Must | Built, untested | Database rule closer differs from resolver. |
| MNT-003 | Tickets can be reopened or cancelled, each with a reason. | Should | Built, untested | reopen and cancel exist. |

### Guest Service

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| SVC-001 | Guest requests are captured, assigned, progressed and completed. | Should | Built, untested | Service request functions exist. |
| SVC-002 | A chargeable request posts its charge, with tax, to the folio when completed. | Should | Built, untested | Charge posts once with key svc:<id> in code. |

### Finance

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| FIN-001 | Charges post with their tax lines; prices can include or exclude tax; the remainder of a rounding goes on the last tax line. | Must | Built and works | Tax lines correct both ways (S07, P1). |
| FIN-002 | Payments and deposits are recorded against a folio with a method; payments are taken outside the system in R1. | Must | Built and works | Cash payment cleared the balance (S15). |
| FIN-003 | Foreign-currency postings store the amount, currency, exchange rate and base amount. | Should | Built, untested | FX columns and rate lookup exist. |
| FIN-004 | A discount within the user's limit posts at once; above the limit it waits for an approver who is not the requester. | Must | Built and works | Pending discount did not change balance; manager approval posted it (S10, S11). |
| FIN-005 | Adjustments, reversals and refunds always need a second person and stay within the approver's limit. | Must | Built and works | Requester could not approve own adjustment (S08). Approver limit not tested. |
| FIN-006 | A posted transaction is never edited or deleted; corrections are linked reversal, adjustment or refund rows. | Must | Built and works | Ledger edit refused even for the database owner (S17). |
| FIN-007 | A refund cannot exceed the credit on the folio. | Must | Built, untested | Refund capped at credit in code. |
| FIN-008 | Repeating the same request cannot double post (idempotency keys). | Must | Built and works | Repeat charge key did not double post (S07). |
| FIN-009 | Move a posted charge, with its tax, to another folio of the same booking; revenue does not change. | Should | Built, untested | transfer_transaction exists. |
| FIN-010 | Split folios per reservation. | Should | Built, untested | split_folio exists. |
| FIN-011 | A folio closes only at a zero balance and reopens only for the accountant with a reason; a closed folio takes no postings. | Must | Built, untested | close_folio and reopen_folio exist. |
| FIN-012 | Invoices and receipts are numbered documents built from posted rows; they cannot be changed once issued. | Must | Built and works | Invoice INV-000001 issued (S16). |
| FIN-013 | Balances are calculated from posted rows and never stored; pending approvals do not change them. | Must | Built and works | Balance unchanged while discount pending (S10). |
| FIN-014 | Every posting takes the open business date, and a past date is refused. | Must | Built, untested | Postings take the business date in code. |
| FIN-015 | Folio visibility follows the role: managers see all folios, a reservation officer sees only those of their own bookings. | Must | Missing | Folio access is all or nothing. No own-bookings-only level. |
| FIN-016 | Cashier shifts and reconciliation by cashier, shift and method. | Should | Missing | R2. Not due yet. |

### Business Date

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| DAY-001 | The business date rolls automatically at each property's cut-off time. | Must | Built and works | Roll advanced the date (S12); a hotel 3 days behind caught up in one run (P4). |
| DAY-002 | At the roll, each guest in house is charged the night's room rate and tax exactly once. | Must | Built and works | One room charge per night; second run added none (S12, S13). |
| DAY-003 | A guest still in house past departure is charged and extended a night if the room allows; otherwise managers are told. | Should | Missing | Guests past departure are not extended or flagged. |
| DAY-004 | A failed roll changes nothing and notifies managers; other properties are not blocked. | Must | Built, untested | Sub-transaction and failure notice in code. |
| DAY-005 | Night audit gates the roll from R2. | Should | Missing | R2. Not due yet. |
| DAY-006 | A same-day arrival and departure: decide whether a night or day-use charge applies. | Should | Missing | Decision open. Today a same-day booking cannot be made at all. |

### Reporting

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| RPT-001 | Occupancy, ADR and RevPAR use one definition: rooms sold over rooms available (out-of-order rooms excluded), revenue net of tax. | Must | Built, untested | v_kpi_daily exists. |
| RPT-002 | Live operations views: arrivals, in-house, room board, housekeeping board. | Must | Built, untested | Operations views exist. |
| RPT-003 | Every reported figure traces to ledger rows or operational records. | Must | Built, untested | Not checked. |
| RPT-004 | Report screens (occupancy trend, revenue by group, outstanding balances, cancellation and no-show rates). | Must | Built, untested | Report functions exist for each report. |

### Non-functional

| Ref | Requirement | Priority | Status | Evidence |
|---|---|---|---|---|
| NFR-001 | Every table has row-level security and tenant_id; security definer functions pin their search path. | Must | Partly built | All 44 tables have RLS and tenant id (checked). No automated test guards this. |
| NFR-002 | The browser can write directly only to plain configuration tables; ledger, reservations, stays, tasks and blocks change only through functions. | Must | Partly built | Ledger and state tables are protected by RLS only. Role and limit tables are writable. No test. |
| NFR-003 | Create actions accept client-generated ids and idempotency keys so an offline queue can be added later. | Should | Partly built | Idempotency keys yes. Client-generated ids no. |
| NFR-004 | Money uses fixed decimals per currency (naira 2, CFA franc 0), never floating point. | Must | Partly built | Money is numeric, but an amount with 3 decimals was accepted (P2). |
| NFR-005 | Business date and cut-off follow the property's timezone. | Must | Built, untested | Business date uses property timezone in code. |

## 2. Audit findings

Ranked by how much harm they could do. "Where" gives the file or database object. Test names (S07, C and so on) refer to the checks in "How I tested".

### Must fix before any real hotel

**M1. Staff can give themselves more power by writing straight to the role tables.**
- Where: row-level security policies `roles_write`, `role_permissions_write`, `upr_write`, `approval_limits_write` in `supabase/migrations/20260929090000_multi_tenant_foundation.sql` (lines 386 to 407).
- Proof: a user whose role only allowed "manage staff and roles" was blocked by the proper functions (tests A, B). The same user then wrote to the tables directly and succeeded. They gave their own role refund approval (C), made themselves System Administrator (D) and set their own approval limit (E).
- Business risk: a manager could approve their own refunds and remove any trace of limits, which defeats separation of duties.
- Fix: remove the four write policies, so the only way in is the functions that already check for escalation. Add a test that proves the attack fails.

**M2. The "change role permissions" function always crashes.**
- Where: `public.set_role_permissions` (both insert lines leave out the role id).
- Proof: calling it gives "INSERT has more target columns than expressions". The code checker found no other function with this kind of fault.
- Business risk: nobody can edit a custom role's permissions or limits from the Roles screen. Once M1 is fixed, this becomes the only way to do it.
- Fix: two-line correction, plus a test.

**M3. A read-only hotel cannot take payment or check out a guest who owes money.**
- Where: `public.post_payment`, `public.request_refund`, `public.check_out`. They allow settlement, but only `check_out` switches on the flag the table guard (`app.enforce_writable`) looks for. Payment inserts are then blocked.
- Proof: in a read-only hotel, a 1,000 payment on an open bill was refused with E_READ_ONLY (test R1). Checking out a guest who owes was also refused (R2).
- Business risk: when a subscription lapses, guests are stuck at the desk and staff cannot record money already received. Decision D6 exists to prevent exactly this.
- Fix: set the settlement flag in every settlement function. Test in a read-only hotel.

**M4. Trials never end and past-due hotels are never suspended.**
- Where: nothing exists. There is no subscription clock job. Read-only mode is only switched on by hand in SQL.
- Business risk: every hotel keeps full access forever for free, and D7 (suspend after 14 days past due) never happens.
- Fix: a daily job that expires trials, marks past due and suspends, with a history row for each change. Also align the two status fields (`tenants.status` controls access, `tenant_subscriptions.status` feeds the banner).

**M5. The audit log keeps guests' personal data, including ID numbers.**
- Where: `app.audit_guest_row` in `20260929100000_guests.sql`. It copies the whole row, before and after, for `guests` and `guest_documents`.
- Business risk: anyone allowed to read the audit log sees phone numbers, emails and passport numbers that the guest screen deliberately hides. That is a data protection problem (GST-003).
- Fix: record only the names of the changed fields for guest tables. Clean the rows already written.

**M6. The staff invite sends an email before checking permission.**
- Where: `src/lib/invite.functions.ts`. It creates the login and sends the invite using the powerful service key. Only after that does it ask the database whether the caller may add staff.
- Business risk: any signed-in user, even one with no hotel, can make the system send invite emails to any address. That can be used for spam or phishing in your name. The failed account is deleted, but the email has already gone.
- Fix: check `adm.user.manage` first. Also look up existing users properly (it only checks the first 200). Drop or restrict the "temporary password shown on screen" fallback.

**M7. Cancellation and no-show fees are worked out but never charged.**
- Where: `cancel_reservation`, `mark_no_show` and the nightly roll store the fee on the reservation (`cancellation_fee`, `no_show_fee`) but never post it to a folio.
- Proof: the nightly roll marked a booking as a no-show and worked out a fee of 50,000. No folio rows were posted (S19).
- Business risk: lost revenue on every late cancellation and no-show.
- Fix: post the fee to the booking's folio with an idempotency key, and allow a waiver only with permission.

**M8. The browser can write to every table, and only row-level security stops it.**
- Where: on real Supabase, the browser roles (`anon`, `authenticated`) get insert, update and delete on every table by default. No migration takes this away. Today the ledger, reservations and stays are safe only because they have no write policy (test H). The "column grants" the design relies on do nothing, because the whole table is granted.
- Business risk: one careless policy in a future migration would open the ledger or bookings to direct edits. There is also no test that would catch it (NFR-001, NFR-002).
- Fix: revoke table writes from `anon` and `authenticated`, grant back only the few that are needed, change the default privileges, and add a test that lists exactly which tables the browser can write.

### Should fix

| # | What | Where | Business risk | Fix |
|---|---|---|---|---|
| S1 | Admin can change a property's base currency directly | `properties_update` policy | Past bills and reports would show the wrong currency | Remove the policy. `update_property` already exists and leaves currency out |
| S2 | Admin can edit other staff profiles directly, including status | `profiles_update_admin` policy | Disabling staff skips the audited `set_user_status` path | Route through the functions only |
| S3 | One person can check out a guest who owes money, just by typing a reason | `check_out` with `fo.checkout.unsettled` | Unpaid bills leave with no second check (FO-009 says a different person must approve) | Require an approved exception from someone else, or confirm the one-person rule is acceptable |
| S4 | 11 functions can be called by someone who is not signed in | `check_in`, `move_room`, `extend_stay`, `void_check_in`, `walk_in_check_in`, room block functions, `set_room_condition`, `get_front_desk_rooms` | Low today, since they refuse without a hotel, but it breaks the default-deny rule | Revoke from `anon` |
| S5 | Audit rows can be changed at database level, and anonymise rewrites them | `audit_events`, `anonymise_guest` | The audit trail is only as safe as the browser rules (ADM-006) | Add a lock trigger. Handle anonymise by storing no personal data in the first place (see M5) |
| S6 | Amounts with too many decimals are accepted (₦100.123) | posting functions | Rounding differences between folio, invoice and accounts (NFR-004) | Check decimals per currency |
| S7 | Guests past departure are not extended or flagged | nightly roll | A guest who stays on is not charged, and nobody is told (DAY-003) | Extend and charge if the room is free, otherwise notify managers |
| S8 | Folio access is all or nothing | `folios` read policy | A reservation officer sees every guest's bill, not only their own bookings (FIN-015) | Support grant level O (own records) |
| S9 | Several screens add up money in the browser | `checkout.$id.tsx` (outstanding), `reservations/$id.tsx` (fee preview), `dashboard.tsx` (revenue), `folios.tsx` (tax preview) | Small rounding errors on screen that do not match the invoice | Take totals from the database |
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

This is the real Supabase setup. "Direct write" means the browser can change rows itself, not through a function.

| Table | Browser can read | Direct write allowed | Note |
|---|---|---|---|
| roles, role_permissions, user_property_roles, approval_limits | Yes | **Yes: insert, update, delete** | Finding M1 |
| properties | Yes | **Yes: update any column** | Business date is locked by a trigger. Base currency is not (S1) |
| profiles | Yes | **Yes: update** (own row, or any row for admins) | Finding S2 |
| guest_documents | **No** | No | Read only through `get_guest`, masked |
| folio_transactions, folio_tax_lines, folios, invoices | Yes, needs `fin.folio.view` | No | Ledger rows also locked by a trigger, even for the database owner |
| approvals | Yes | No | |
| reservations, reservation_nights, reservation_guests, room_assignments, stays, group_bookings | Yes | No | |
| rooms, room_types, rate_plans, rate_plan_prices, tax_rates, charge_codes, payment_methods, exchange_rates, document_sequences | Yes | No | Changed only by `save_*` and `set_*` functions |
| room_blocks, hk_tasks, housekeeping_tasks, maintenance_tickets, service_requests, lost_found_items | Yes | No | |
| guests, guest_feedback | Yes | No | |
| audit_events, business_date_log, daily_stats, notifications, notification_outbox | Yes | No | Notifications: own rows only |
| tenants, tenant_subscriptions, plans, permissions | Yes | No | |

On every table the browser holds full write grants. The only barrier is the row-level security policy (M8).

## 3. What is outstanding

Sizes: small is about a day or less, medium a few days, large a week or more.

| Area | Work | Size |
|---|---|---|
| Security | Close direct role and limit writes and fix `set_role_permissions` (M1, M2) | Small |
| Security | Revoke default table and function grants, and add a test listing what the browser can write (M8, S4) | Small |
| Security | Route property and profile edits through functions (S1, S2) | Small |
| Security | Invite: check permission first, proper user lookup, decide on temporary passwords (M6) | Small |
| Security | Keep personal data out of the audit log, lock audit rows (M5, S5) | Medium |
| Money rules | Settlement in read-only hotels (M3) | Small |
| Money rules | Post cancellation and no-show fees (M7) | Medium |
| Money rules | Second-person approval for unsettled check-out (S3) | Small |
| Money rules | Decimal rules per currency (S6), totals from the database (S9), invoice key (S11) | Small |
| Money rules | Own-bookings folio access (S8) | Medium |
| Money rules | Discount tax treatment, after the accountant decides | Small to medium |
| Booking rules | Overdue departures at the roll (S7) | Medium |
| Booking rules | Same-day stays, after decision DAY-006. Today they cannot be booked at all | Medium |
| Booking rules | Arrival-ready flag, complimentary upgrade, inspection on/off, duplicate task (S10, S13) | Small |
| Jobs and email | Subscription clock: trial expiry, past due, suspension (M4) | Medium |
| Jobs and email | Connect email and schedule the outbox sender (S12) | Small |
| Jobs and email | Platform console for activating, suspending and changing plans (PLT-008, PLT-009) | Medium |
| Jobs and email | Break-glass support access (PLT-010), cancel subscription (PLT-011) | Medium |
| Screens | Click through every screen with real data and fix what breaks | Large |
| Screens | Password reset, list paging, typed database calls | Small to medium |
| Tests | Turn my audit checks into permanent tests, then work through the reference scenarios module by module | Large |
| Lovable removal | Replace the Lovable build preset, delete Lovable preview auth, error reporting and the cron secret, remove the gateway branch from the outbox, delete `drizzle/`, `.lovable/` and the AGENTS block, stop tracking `.env`, replace `supabase/config.toml`, disconnect the GitHub sync | Medium |
| Deployment | Your Supabase project: migrations, auth settings, pg_cron, secrets | Small |
| Deployment | Hosting. The build targets Cloudflare Workers today. Moving to Vercel means changing the build target | Small to medium |
| Deployment | Automatic checks on every change (tests and build before anything reaches main) | Small |

## 4. Decisions you must make

| # | Decision | Why it matters now | My suggestion |
|---|---|---|---|
| 1 | Plan tiers and prices (A16) | Plan limits are enforced, so the numbers must be real before signup opens | Confirm starter 20, standard 60, pro 150 rooms, and set prices |
| 2 | Cloud region (A14) | Guest data location. Frankfurt is the nearest Supabase region | Frankfurt for pilots with consent. Get data protection advice before signing a bank or chain |
| 3 | Tax rules (A11), needs your accountant | Service charge 10%, VAT 7.5% on net plus service charge, state levy 0%, rounding to 2 decimals. Also: are cancellation and no-show fees taxable, and does a discount reduce the tax? | Send the accountant the one-page tax example I can produce from the test |
| 4 | Same-day arrival and departure (DAY-006) | Today the system refuses these bookings outright | Choose: charge a night, a day-use rate, or nothing |
| 5 | Unsettled check-out: one person with a reason, or a second approver? | The design says a second person. The build allows one | Second person, as designed |
| 6 | Temporary passwords when the invite email fails | Convenient but weak | Remove them once email is connected |
| 7 | Hosting: Cloudflare Workers (as built) or Vercel | Changes one build setting and where the server functions run | Vercel, since you already use it |
| 8 | Email provider and sending domain | Needed for invites, confirmations and alerts. The code is written for Resend | Resend with your domain |
| 9 | Platform console for R1, or manual activation by me for the first pilots | Affects how soon the first hotel can go live | Manual for the first 1 to 3 pilots, console before open signup |
| 10 | Permission names | Lovable used its own names (for example `fo.room.move`, not `fo.roommove`). Your docs use the old ones | Keep Lovable's names and update the docs |

## 5. Risks and things I am unsure about

- **Untested is not the same as working.** 52 requirements have code I did not run. The one admin function I did run on a whim (M2) turned out broken. Expect more bugs like it until the tests exist.
- **The screens have never been used with real data.** Lovable says so itself. Some will fail on first use.
- **My checks ran on a local rebuild, not on the Lovable Cloud database.** Lovable says the rebuild matches the live database. I cannot confirm that, because Lovable Cloud gives no direct access. We are starting a fresh database anyway.
- **Two-way sync with Lovable is still on.** Any edit made in Lovable lands on `main` and can clash with my work. Please do not edit in Lovable from now on.
- **Tax figures are guesses** until your accountant signs off. They are marked unverified in the data.
- **Data protection.** Guest ID numbers already sit in the audit log (M5), and the region decision is open.
- **I checked about 35 scenarios, not all 353 reference tests.** The requirement statuses are my honest reading, not a full proof.
- **One builder and no automatic checks.** Until tests run on every change, a later fix can quietly break an earlier one.
- **Unsure:** whether discounts should reduce tax, and whether one-person unsettled check-out was a deliberate Lovable choice or an oversight.

## 6. Proposed plan

Each step ends with the tests passing. You approve each step before I start the next.

| Step | Work | What you can see or try afterwards |
|---|---|---|
| 1 | Security fixes: M1, M2, M6, M8, S1, S2, S4 | A test report showing the attack tests from this audit now fail. You can read it in plain words |
| 2 | Money and subscription fixes: M3, M4, M5, M7, S3, S6 | The test report grows: read-only hotels settle, fees post, trials expire |
| 3 | Permanent automated tests from this audit and the reference scenarios, run with one command | One command that ends in "ALL OK", plus a list of which requirements each test proves |
| 4 | Remove Lovable, switch the build to your host, stop tracking `.env` | The app runs on your Mac at `http://localhost:8080` against the local database. You can sign up and click around |
| 5 | Browser walk-through of every screen, fixing what breaks | Screenshots of each main flow: booking, check-in, folio, check-out, invoice, housekeeping, maintenance, reports |
| 6 | Remaining gaps: overdue departures, own-bookings folios, email, smaller features, after your decisions | Updated requirement table with more rows at "Built and works" |
| 7 | Link your Supabase project and apply migrations (only after you confirm it is empty and approve the list), then set auth, pg_cron and secrets | The app on your Mac talking to your real Supabase project |
| 8 | Deploy to your host, add automatic checks, disconnect Lovable | A live URL you control, with no Lovable dependency |

## Supabase status

- **Local Supabase: done.** It runs in Docker on your Mac. All 17 migrations applied, the pg_cron job `business-date-rollover` is scheduled, and the isolation test passes. The local database has been wiped clean after my tests.
- **Your project: waiting for you.** The steps are in the chat summary. No keys go in chat.
