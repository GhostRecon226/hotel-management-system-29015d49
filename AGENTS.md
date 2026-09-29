<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Canonical schema lives in supabase/migrations (YYYYMMDDHHMMSS_topic.sql); copy any tool-generated migration there. Why: files, not the Cloud DB, are the source of truth.
- Permission/tenant helpers live in schema `app` (my_tenant, can, has_property_access, approval_limit, fail); RLS policies call them. Why: keeps helpers off the public API and avoids RLS recursion.
- Every data-changing DB function calls app.assert_writable() first (pass true only for settlement/check-out); enforce_writable triggers also block direct writes. Why: expired/suspended hotels are read-only.
- App shell loads everything via one rpc public.my_context() into AccessProvider (src/lib/access.tsx); hide UI with useAccess().can / <Can>. Why: one call, permissions as data.
- Setup tables are read via RLS SELECT only; every write goes through a public.save_* / set_* function that calls app.require(perm, property). Why: rule 2/5, business rules in Postgres.
- Property defaults (charge codes, payment methods, doc sequences, Nigerian taxes) are seeded by an AFTER INSERT trigger on properties via app.seed_property_defaults. Why: every new property is usable at once.
- Guests are tenant-scoped (shared across properties); guest RPCs check permissions with app.require_any / app.can(key, null). Why: one guest profile per hotel group.
- guest_documents has no client read policy; numbers come only via get_guest(), masked without guest.document.view. Why: ID numbers are sensitive.
- merge_guests must move every table that references guests; add new referencing tables (reservations, folios) to it. Why: merges must leave no orphan references.
- Every screen uses the shared design system only: tokens in src/styles.css, shadcn ui components, Badge status variants (success=clean/ready/paid, warning=pending/dirty, danger=out of order/overdue/error, info=in house/info), Money for amounts (right-aligned, ₦), PageHeader/FilterBar, EmptyState/LoadingState/TableStateRow. No raw colour classes. Reference: /design. Why: consistent, fast-to-scan front desk UI.
- Availability comes from reservation_nights joined to live reservations (confirmed, checked_in, tentative with unexpired hold); bookings lock per property+room type via app.assert_available. Why: safe last-room booking.
- Room assignments use an exclusion constraint on active rows; released rows stay (is_active=false). Why: no double-assigned rooms, keep history.
- Front desk state lives in stays (one in_house row per reservation and per room); check-in/walk-in/move/extend/void are public RPCs, lists read security_invoker views v_arrivals/v_in_house. app.deposit_paid() sums is_deposit payment rows across the booking's folios. Why: occupancy history per room, rules in Postgres.
- Room blocks (room_blocks) remove a room from app.availability only when approved; request/approve re-check oversell via app.check_block ([E_OVERSOLD]) and a trigger stops new room_assignments on blocked rooms. Out of order is set by blocks, set_room_condition only allows clean/dirty/inspected. Why: blocks can never oversell or double-book.
- Ledger: folio_transactions and folio_tax_lines are insert-only (E_IMMUTABLE trigger); amounts signed (charges +, payments -); balances only from v_folio_balances. Reversals/transfers are mirror rows via app.post_mirror; one partial unique index on original_id (reversal, transfer) means a row is reversed or moved once. Transfer = out row on source (links original) + in row on target (links out row). All posting RPCs require an idempotency key. Why: auditable, retry-safe money.
- Approvals: discounts/adjustments/reversals/refunds go through public request RPCs; decide_approval posts via app.post_* with key 'approval:<id>'. E_SOD in code plus CHECK approvals_sod. reverse_transaction is revoked from clients. Notifications are rows in public.notifications written only by DB functions. Why: segregation of duties, nothing posts without approval.
- Check-out: check_out needs all folios at zero, else fo.checkout.unsettled (with reason) or an approved, unused 'checkout' approval (stays.checkout_approval_id unique). It closes zero-balance folios, drops unused nights (same-day keeps dates), frees the room as dirty and opens a turnover hk_tasks row; stays.checkout_snapshot lets undo_checkout restore it on the same business date. Settlement functions set app.settlement=on so enforce_writable lets them run while read-only. Why: rules in Postgres, reversible same day.
- Invoices are insert-only snapshots (lines, header, tax_split grouped by tax code) numbered by app.next_document_number('invoice'); nightly room charge post_room_charges uses key room:<reservation>:<date>. Why: invoices never change; room charges never double-post.
- Housekeeping: hk_tasks (housekeeping_tasks deprecated) changes only via create/assign/start/complete/inspect/cancel_hk_task; app.hk_new_turnover cancels stale unstarted turnovers. Complete sets room dirty, pass sets clean/inspected, fail reopens as status failed with defects. Inspector≠completer via E_SOD plus CHECK hk_tasks_sod. Board reads v_hk_board.board_column. Why: rules in Postgres, segregation of duties.
- Maintenance tickets and service requests change only via their public RPCs (create/assign/start/wait/resolve/close/reopen/cancel_ticket, *_service_request). Closer≠resolver via E_SOD plus CHECK maintenance_tickets_sod; block_room_for_ticket wraps request_room_block with ticket_id. Chargeable service requests post once on completion with key svc:<id>. Why: rules in Postgres, retry-safe charges.
