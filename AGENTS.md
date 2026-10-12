# Zikora: rules

The single rules file for this repository. Claude Code reads it through `CLAUDE.md`, which only imports this file.
Merged on 6 Oct 2026 from the reference repository's `CLAUDE.md` (rules 1 to 10, adapted) and this file's architecture notes.

## Product and people

Multi-tenant hotel management system for Nigeria, then Africa. Peter owns the product. Peter is a project manager, not a database engineer: explain choices in business terms.

## Stack

- Supabase Postgres owns all data and rules. Every rule a hotel depends on lives in a migration and is proved by a test.
- The app is TanStack Start (React, Vite) on Vercel. Work Postgres cannot do (staff invites, ID photo links, email sending, CSV exports, cron) runs in server functions under `src/lib/*.functions.ts` and `src/routes/api`. No Edge Functions, no Lovable.
- Hosting: Vercel Hobby, so the 5-minute email cron is off until Pro; the daily ID photo clean-up runs at 02:00 UTC. Supabase in West EU (Ireland).

## Commands

- `scripts/test-db.sh` rebuilds a local Supabase database from the migrations, runs the upgrade test and every database test, and checks the requirement register. It must end with `ALL OK`. `SKIP_UPGRADE=1` skips the upgrade test for quick runs.
- `npx playwright test` runs the browser tests against local Supabase.
- `npm run typecheck`, `npm run check:money`, `npm run check:contrast`, `npm run check:requirements`, `npm run build`.
- Run all of them before you finish any change.

## Rules

1. Never edit a migration that has been applied to the practice or live database. Add a new one. Name it `YYYYMMDDHHMMSS_topic.sql`. Before writing a new version of a function, find its latest definition: later migrations often use upper-case `CREATE OR REPLACE FUNCTION`, so search without regard to case.
2. Every table has `tenant_id` and row-level security and, where it applies, `property_id`. The only tables without `tenant_id` are the shared lists `tenants`, `plans` and `permissions`.
3. Helpers live in schema `app`. Callable functions live in `public`. Only `public` functions are granted to signed-in users (`authenticated`); never to `anon`.
4. Every function is `security definer` with `set search_path = public, pg_temp`. Every public function checks a permission first, with `app.require` or `app.can`, or through a helper that does (`app.reservation_for_write`, `app.folio_for_write`, `app.hk_task_for_write`).
5. Errors use `app.fail('E_CODE', 'plain message')`. It raises `[E_CODE] message`; the app shows the message only (`src/lib/errors.ts`). List every code a function raises in its entry in `docs/functions.md`.
6. The ledger is immutable. Never update or delete `folio_transactions`, `folio_tax_lines`, `invoices` or `audit_events`. Correct with a linked reversal, adjustment or refund.
7. Money and room inventory writes must be safe to repeat.
   - Every write that moves money takes an idempotency key, unique per hotel. A retry returns the first result and never posts twice.
   - Every write that changes room inventory must be safe to repeat: a key, or a state check that refuses the repeat.
   - Known cases that use the state check: Change departure (`extend_stay`: the same departure again is refused, "Choose a departure date other than ...") and room moves (`move_room`: moving to the room the guest is already in is refused, "The guest is already in this room.").
8. New tables get default-deny grants: no insert, update or delete for the browser, reads only through row-level security. New public functions need `revoke ... from public, anon` and an explicit grant to `authenticated`.
9. Every new function needs a test, tagged with its requirement id, for example `[FIN-017]`. Every id a test uses needs a row in `docs/requirements.csv`, the single requirement register; `npm run check:requirements` (also run by `scripts/test-db.sh`) fails otherwise. Refresh the workbook with `python3 scripts/requirements-workbook.py` (needs `openpyxl`).
10. Reference data (permissions, built-in roles and their grants, plans, settings) is seeded inside migrations. Change it with a new migration, never by hand on a database. New permissions go to built-in roles only; custom roles copied earlier do not get them, so say so in the report.
11. Tests first. Write the failing test, then the change. Do not change an existing test without Peter's yes; show the before and after.
12. Money arithmetic happens in Postgres only. The browser shows the figures the database returns (`npm run check:money`).

## Releases

- One branch per change. Never merge: Peter merges.
- Practice database (`vxkresricneodgvqphrn`) first: dry run, then apply, then report. Keep the folder linked to practice.
- Live database (`urbpxybyrfjczqbrpdsq`) only after Peter's separate yes for that release: back up first into `~/hotel-desk-backups`, dry run and apply only if it lists exactly the agreed migrations, confirm the count matches the code, check the new objects exist, then link back to practice.
- Apply the database before the app is merged: the app calls the new functions. A report for a change with a migration says when Peter can merge: after the live release, not before.
- After every merge to main, and before saying the live site works, compare main's migration files with live's applied list. Read live with `supabase migration list` (read only: the one touch of live allowed outside a release), then link back to practice at once. If main has a migration live does not, say that first, name the screens that call it, and ask for "yes, live". Never apply it without that yes. Why: on 12 Oct 2026 list paging and top bar search were merged before their database part, and the Guests list, Reservations list, audit log and top bar search failed on live until they were released.
- Every report to Peter starts with one line, "Project: practice" or "Project: live", and says which project the next step needs.
- Claude does all Supabase CLI linking and relinking. Never ask Peter to switch, link or check which project is active.
- When any task finishes, the CLI is linked back to practice; the report's last line says so.
- Live is touched only in a release, after Peter says "yes, live", and always in this order: backup, dry run, apply, confirm the count, relink to practice.
- Live Supabase "Deploy to production" (Settings, Integrations, GitHub) stays off, so a merge to main never changes live. Live database changes happen only in these release steps, after Peter says yes. Never switch it back on.
- Never put keys, passwords, database addresses or service keys in chat or in git. The app uses only the public (anon) key; the service role key stays in server code and Vercel settings.
- Keep "Allow ID photos" off on every live hotel. Do not change the three privacy `[TO CONFIRM]` markers.

## Architecture notes

One line per rule. Why: the reason.

- Canonical schema lives in supabase/migrations (YYYYMMDDHHMMSS_topic.sql). Never edit an applied migration; add a new one. Why: files, not the live database, are the source of truth.
- Permission/tenant helpers live in schema `app` (my_tenant, can, has_property_access, approval_limit, fail); RLS policies call them. Why: keeps helpers off the public API and avoids RLS recursion.
- Every data-changing DB function calls app.assert_writable() first (pass true only for settlement/check-out); enforce_writable triggers also block direct writes. Why: expired/suspended hotels are read-only.
- App shell loads everything via one rpc public.my_context() into AccessProvider (src/lib/access.tsx); hide UI with useAccess().can / <Can>. Why: one call, permissions as data.
- Setup tables are read via RLS SELECT only; every write goes through a public.save_* / set_* function that calls app.require(perm, property). Why: rule 2/5, business rules in Postgres.
- Property defaults (charge codes, payment methods, doc sequences, Nigerian taxes) are seeded by an AFTER INSERT trigger on properties via app.seed_property_defaults. Why: every new property is usable at once.
- Guests are tenant-scoped (shared across properties); guest RPCs check permissions with app.require_any / app.can(key, null). Why: one guest profile per hotel group.
- guest_documents has no client read policy; numbers come only via get_guest(), masked without guest.document.view. Why: ID numbers are sensitive.
- merge_guests must move every table that references guests; add new referencing tables (reservations, folios) to it. Why: merges must leave no orphan references.
- Every screen uses the shared design system only: tokens in src/theme.css, shadcn ui components, Badge status variants (success=clean/ready/paid, warning=pending/dirty, danger=out of order/overdue/error, info=in house/info), Money for amounts (right-aligned, ₦), PageHeader/FilterBar, EmptyState/LoadingState/TableStateRow. No raw colour classes. Why: consistent, fast-to-scan front desk UI.
- Availability comes from reservation_nights joined to live reservations (confirmed, checked_in, tentative with unexpired hold); bookings lock per property+room type via app.assert_available. Why: safe last-room booking.
- Room assignments use an exclusion constraint on active rows; released rows stay (is_active=false). Why: no double-assigned rooms, keep history.
- Front desk state lives in stays (one in_house row per reservation and per room); check-in/walk-in/move/extend/void are public RPCs, lists read security_invoker views v_arrivals/v_in_house. app.deposit_paid() sums is_deposit payment rows across the booking's folios. Check-in refuses a registration with registration_accepted sent and not true (FO-003; omitting it is not refused). move_room p_keep_rate: a dearer room type (app.move_rate_quote, unposted nights only) charges the new rate unless fo.upgrade.complimentary, audited complimentary_upgrade (FO-007). create_property needs setup.property.create (System Administrator and General Manager, PLT-007). Why: occupancy history per room, rules in Postgres.
- Room labels (rooms.room_number) are free text, tidied and checked by app.room_label on every insert and rename (trigger), unique per property on lower(room_number), sorted with collation app.natural (JS: compareRoomLabels in src/lib/room-label.ts). Show the label as typed, never "Room " + label; lists and boards use <RoomName> ("Zurich (Deluxe)"). Add several rooms only via add_rooms_range / add_rooms_named. Why: hotels name rooms their own way (ROOM-005).
- Room blocks (room_blocks) remove a room from app.availability only when approved; request/approve re-check oversell via app.check_block ([E_OVERSOLD]) and a trigger stops new room_assignments on blocked rooms. Out of order is set by blocks, set_room_condition only allows clean/dirty/inspected. Why: blocks can never oversell or double-book.
- Ledger: folio_transactions and folio_tax_lines are insert-only (E_IMMUTABLE trigger); amounts signed (charges +, payments -); balances only from v_folio_balances. Reversals/transfers are mirror rows via app.post_mirror; one partial unique index on original_id (reversal, transfer) means a row is reversed or moved once. Transfer = out row on source (links original) + in row on target (links out row). All posting RPCs require an idempotency key. post_payment also refuses a likely repeat (same folio, amount, currency, method, reference within app.settings duplicate_payment_window_minutes) with [E_POSSIBLE_DUPLICATE] unless p_confirm_duplicate_reason is given, audited as payment_duplicate_confirmed (FIN-017). Why: auditable, retry-safe money.
- Approvals: discounts/adjustments/reversals/refunds go through public request RPCs; decide_approval posts via app.post_* with key 'approval:<id>'. E_SOD in code plus CHECK approvals_sod. reverse_transaction is revoked from clients. Notifications are rows in public.notifications written only by DB functions. Why: segregation of duties, nothing posts without approval.
- Check-out: check_out needs all folios at zero, else fo.checkout.unsettled (with reason) or an approved, unused 'checkout' approval (stays.checkout_approval_id unique). It closes zero-balance folios, drops unused nights (same-day keeps dates), frees the room as dirty and opens a turnover hk_tasks row; stays.checkout_snapshot lets undo_checkout restore it on the same business date. Settlement functions set app.settlement=on so enforce_writable lets them run while read-only. Why: rules in Postgres, reversible same day.
- Invoices are insert-only snapshots (lines, header, tax_split grouped by tax code) numbered by app.next_document_number('invoice'); nightly room charge post_room_charges uses key room:<reservation>:<date>. Why: invoices never change; room charges never double-post.
- Housekeeping: hk_tasks (housekeeping_tasks deprecated) changes only via create/assign/start/complete/inspect/cancel_hk_task; app.hk_new_turnover cancels stale unstarted turnovers. Complete sets room dirty, pass sets clean/inspected, fail reopens as status failed with defects. Inspector≠completer via E_SOD plus CHECK hk_tasks_sod. A task must be assigned before it is started; hk.view at level O (room attendants) reads only tasks assigned to them. properties.inspection_required off makes complete_hk_task close the task as passed and the room clean (SET-008). Board reads v_hk_board.board_column. Why: rules in Postgres, segregation of duties.
- Maintenance tickets and service requests change only via their public RPCs (create/assign/start/wait/resolve/close/reopen/cancel_ticket, *_service_request). Closer≠resolver via E_SOD plus CHECK maintenance_tickets_sod; block_room_for_ticket wraps request_room_block with ticket_id. Chargeable service requests post once on completion with key svc:<id>. Why: rules in Postgres, retry-safe charges.
- Business date rolls only via app.roll_property (sub-transaction: room charges, expire holds, no-shows, date+1, stayovers, daily_stats; logs business_date_log; failure notifies fin.nightaudit.run users once). pg_cron job 'business-date-rollover' runs app.run_due_rollovers() every 5 min; a trigger blocks other business_date edits. Dashboard/reports read dashboard_summary, v_kpi_daily and report_* functions only. Why: figures and rules in Postgres.
- Admin: staff/roles/limits change only via register_invited_user, assign_role, remove_role, set_user_status, copy_role, rename_role, set_role_permissions, delete_role, set_approval_limit; app.assert_can_grant/app.assert_role_grantable raise [E_ESCALATION] so nobody hands out a permission or limit they do not hold, and [E_LAST_ADMIN] keeps one active SYSADMIN per tenant. System roles are read-only ([E_SYSTEM_ROLE]); copy to customise. Staff invites go through the createServerFn src/lib/invite.functions.ts (permission checked first via require_permission, service role sends the invite, hotel rules run as the inviter, orphan accounts are deleted on failure, no temporary passwords) (a server function, not an Edge Function). Why: rules in Postgres, no privilege escalation.
- ID photos: files in the private bucket guest-id-documents (no storage policies), one row each in guest_document_files (no client grants). Every step goes through begin/finish_id_photo_upload, open_id_photo, list_id_photos, delete_id_photo; the server (src/lib/id-photos.functions.ts) signs links only after those pass, views for 60 seconds. Per-property switches allow_id_photos / require_id_photo; keep period in app.settings (id_photo_keep_months). Files are marked 'deleting' by the database and removed by the server (id_photo_cleanup_due, daily cron). Audit with ids only. Why: ID images are the most sensitive data we hold (GST-007 to GST-010).
- Outbound messages are rows in public.notification_outbox, added only by app.enqueue_message (dedupe key per tenant); src/lib/outbox.server.ts claims batches via outbox_claim/outbox_mark (service role) with exponential back-off. CSV exports go through public.export_data (rpt.export, audit row) via src/lib/exports.functions.ts. Why: queue and permissions in Postgres, no Edge Functions on this stack.
- AI helpers: off per hotel until `set_ai_settings` (adm.ai.manage); monthly limit in `ai_usage`; the provider sees only the plain fact lines built by the database (no guest, ID, room or card data); drafts only, and the server (`src/lib/ai-brief.ts`) refuses a draft with any number not in the facts. The key (`ANTHROPIC_API_KEY`) stays in server code and Vercel settings. Why: AI never invents figures and never sees personal data (AI-001 to AI-005).
- Migrations must replay from empty. Run scripts/test-db.sh (local Supabase in Docker) after every change; it must not add any "not ok". Why: supabase/migrations is the only source of truth, and the tests are the proof.
- The browser has no table write rights (default-deny, 20260930100000). New tables need RLS and tenant_id; new public functions need an explicit grant to authenticated. Why: every change goes through a permission-checked function.
- Keep the existing permission names (decision 5f). Why: the code and database already use them.
- Errors go to Sentry only through src/lib/error-report.ts (no Sentry package): never add user identity, IP, request bodies, form values or session replay, and keep expected [E_CODE] refusals out. GitHub checks (.github/workflows/ci.yml) always report "Checks and database tests" and "Browser tests"; docs-only changes pass early (scripts/ci-changes.sh). None of this is in the Vercel build. See docs/safety-net.md. Why: we hear about failures without sending personal data, and an urgent fix can always ship.

- Phones and tablets (NFR-008): the shared `Table` is a stack of cards under 768px (labels come from the column headings; pass `scroll` for a true grid, `wide` for 8 or more columns so it is cards under 1280px); `PageHeader` stacks its buttons under the title on a phone; check boxes, switches, tabs and links are larger for touch (`pointer-coarse`, `pointer-fine`); fields are 16px on touch so an iPhone does not zoom in; dialogs keep a margin and a pinned button bar. `e2e/phone-layout.spec.ts` fails a screen that scrolls sideways, squeezes its title, cuts off a table, has small targets or text under 12px. Why: most hotel staff and owners use a phone.

- Platform console (/platform, src/lib/platform.tsx): operators are separate sign-ins listed in app.platform_operators (no grants; added only by the owner with app.add_platform_operator), never hotel members (trigger on profiles). Every platform_* function calls app.require_platform(): operator list AND JWT aal2, enforced in the database, not only on screen. Operators see hotel account data only. Subscription changes go through platform_change_subscription, which reuses app.platform_set_subscription / app.change_subscription so every change is in subscription_history. Why: no hand SQL on live, no platform access to guest data (PLT-008, PLT-009, PLT-013).

## Test gotchas

- `set role` persists across DO blocks. Call `perform t.admin();` at the end of each block, and before reading tables a signed-in role cannot see.
- Test helpers are in schema `t`: `login`, `admin`, `ok`, `eq`, `raises`, `lives`, `crash`, `bdate`, `set_bdate`, `pm`, `cc`, `room`, `reg`, `id`, `put`, `book`, `main_folio`, `balance`, `set_tenant_status`. A helper created inside a test needs `grant execute ... to authenticated`.
- Fixture users: adminA, adminB, gm, fdo, fom, acc, hks, att, mnt, rsv, csh. fdo and fom hold custom copies of the built-in roles (FDOL, FOML). The test hotel has rooms 101 to 103 and 201; add your own rooms for new tests.
- Staff can read only their own notifications.

## Language

Plain and short. No em dashes. Active voice. Explain choices in business terms.

## Open decisions

Plan tiers and prices (A16; pilots are free; every new hotel gets 60 days free, A13), tax seed sign-off (A11, accountant), fee and discount tax treatment (accountant). See `docs/decisions.md`. Decided: region West EU, Ireland (A14, 30 Sep 2026); same-day stays charged one night, a manager can waive it (DAY-006, 30 Sep and 1 Oct 2026).
