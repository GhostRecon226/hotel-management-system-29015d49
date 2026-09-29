# Database functions

Generated from the migrations in `supabase/migrations` (replayed on an empty database).

- **Schema `public`**: the API the app calls with `supabase.rpc(...)`. Client access is controlled by `GRANT EXECUTE`; a function marked *internal* is revoked from signed-in users.
- **Schema `app`**: helpers and triggers. Not exposed to the API.
- **Permission**: permission keys the function checks through `app.require*` / `app.can`. Many functions derive the property from the row they touch. `—` means no key check (e.g. only a tenant check, or a trigger/helper).
- **Errors**: codes in the function body. Every write also can raise `E_READ_ONLY` via `app.assert_writable()` (listed when called directly). Errors come back as `[E_CODE] message`; see `src/lib/errors.ts`.

## Schema `public`

### `public.add_guest_feedback`
- Args: `p_guest_id uuid, p_category text, p_text text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `guest.edit`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.admin_roles`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_FORBIDDEN`

### `public.admin_users`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_FORBIDDEN`

### `public.anonymise_guest`
- Args: `p_guest uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `guest.anonymise`
- Errors: `E_REQUIRED`

### `public.apply_discount`
- Args: `p_transaction_id uuid, p_amount numeric, p_reason text, p_idempotency_key text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.approve_room_block`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `room.block.approve`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.assign_hk_task`
- Args: `p_id uuid, p_assignee_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `hk.task.assign`
- Errors: `E_INVALID`

### `public.assign_role`
- Args: `p_user_id uuid, p_property_id uuid, p_role_id uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_NOT_FOUND`, `E_READ_ONLY`

### `public.assign_room`
- Args: `p_id uuid, p_room_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_ROOM_TAKEN`

### `public.assign_service_request`
- Args: `p_id uuid, p_assignee_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `svc.order.create`
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.assign_ticket`
- Args: `p_id uuid, p_assignee_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.ticket.assign`
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.audit_filters`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `adm.audit.view`
- Errors: `E_FORBIDDEN`

### `public.audit_log`
- Args: `p_actor uuid DEFAULT NULL::uuid, p_table text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 200`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `adm.audit.view`
- Errors: `E_FORBIDDEN`

### `public.block_room_for_ticket`
- Args: `p_id uuid, p_type text, p_from date, p_to date, p_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`

### `public.bulk_add_rooms`
- Args: `p_property_id uuid, p_from integer, p_to integer, p_room_type_id uuid, p_floor text DEFAULT NULL::text`
- Returns: `integer`
- Callable by signed-in users: yes · security definer
- Permission: `setup.room.manage`
- Errors: `E_INVALID`

### `public.calculate_tax`
- Args: `p_property_id uuid, p_amount numeric, p_tax_inclusive boolean DEFAULT false`
- Returns: `TABLE(line_no integer, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.cancel_hk_task`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `hk.task.assign`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.cancel_reservation`
- Args: `p_id uuid, p_reason text, p_waive_fee boolean DEFAULT false, p_waive_reason text DEFAULT NULL::text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.cancel_service_request`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `svc.order.cancel`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.cancel_ticket`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.ticket.assign`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.check_in`
- Args: `p_id uuid, p_registration jsonb, p_room_id uuid DEFAULT NULL::uuid, p_room_override_reason text DEFAULT NULL::text, p_deposit_waive_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.check_out`
- Args: `p_id uuid, p_approval_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fo.checkout.unsettled`
- Errors: `E_BALANCE_DUE`, `E_INVALID`, `E_NOT_APPROVED`, `E_READ_ONLY`, `E_REQUIRED`

### `public.close_folio`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_BALANCE_DUE`, `E_READ_ONLY`

### `public.close_ticket`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.ticket.close`
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_SOD`

### `public.complete_hk_task`
- Args: `p_id uuid, p_checklist jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `hk.task.assign`, `hk.task.complete`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.complete_service_request`
- Args: `p_id uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `svc.order.complete`
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.confirm_reservation`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`

### `public.copy_role`
- Args: `p_source_role_id uuid, p_code text, p_name text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `adm.role.manage`
- Errors: `E_DUPLICATE`, `E_FORBIDDEN`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.create_hk_task`
- Args: `p_room_id uuid, p_type text, p_priority text DEFAULT 'normal'::text, p_assignee_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `hk.task.assign`
- Errors: `E_INVALID`, `E_NOT_FOUND`

### `public.create_hotel`
- Args: `p_business_name text, p_country text, p_property_name text, p_full_name text, p_city text`
- Returns: `TABLE(tenant_id uuid, property_id uuid)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_ALREADY_HAS_HOTEL`, `E_EMAIL_NOT_CONFIRMED`, `E_NOT_SIGNED_IN`, `E_REQUIRED`

### `public.create_reservation`
- Args: `p_property_id uuid, p_idempotency_key text, p_guest_id uuid, p_arrival date, p_departure date, p_room_type_id uuid, p_rate_plan_id uuid, p_adults integer, p_children integer, p_status text DEFAULT 'confirmed'::text, p_source text DEFAULT 'direct'::text, p_company_name text DEFAULT NULL::text, p_special_requests text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_guarantee text DEFAULT 'none'::text, p_hold_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_id uuid DEFAULT NULL::uuid, p_rate_override numeric DEFAULT NULL::numeric, p_override_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `res.create`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.create_service_request`
- Args: `p_reservation_id uuid, p_category text, p_description text, p_chargeable boolean DEFAULT false, p_charge_amount numeric DEFAULT NULL::numeric, p_charge_code_id uuid DEFAULT NULL::uuid, p_assignee_id uuid DEFAULT NULL::uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `svc.order.create`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.create_ticket`
- Args: `p_property_id uuid, p_title text, p_description text, p_room_id uuid, p_location text, p_priority text DEFAULT 'normal'::text, p_assignee_id uuid DEFAULT NULL::uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.ticket.assign`, `mnt.ticket.create`
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.dashboard_summary`
- Args: `p_property_id uuid`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_NOT_FOUND`

### `public.decide_approval`
- Args: `p_id uuid, p_approve boolean, p_reason text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_LIMIT`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`, `E_SOD`

### `public.delete_rate_plan_price`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `setup.rate.manage`
- Errors: `E_NOT_FOUND`

### `public.delete_role`
- Args: `p_role_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.role.manage`
- Errors: `E_FORBIDDEN`, `E_IN_USE`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_SYSTEM_ROLE`

### `public.export_data`
- Args: `p_kind text, p_property_id uuid, p_from date, p_to date`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `guest.view`, `rpt.export`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.extend_stay`
- Args: `p_id uuid, p_new_departure date, p_reason text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_NO_RATE`, `E_ROOM_TAKEN`

### `public.get_assignable_rooms`
- Args: `p_id uuid`
- Returns: `TABLE(id uuid, room_number text, floor text, condition text, is_occupied boolean)`
- Callable by signed-in users: yes · security definer
- Permission: `res.view`
- Errors: `E_NOT_FOUND`

### `public.get_availability`
- Args: `p_property_id uuid, p_arrival date, p_departure date`
- Returns: `TABLE(room_type_id uuid, room_type_code text, room_type_name text, stay_date date, sellable integer, reserved integer, available integer)`
- Callable by signed-in users: yes · security definer
- Permission: `res.view`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.get_front_desk_rooms`
- Args: `p_property_id uuid, p_room_type_id uuid, p_from date, p_to date, p_reservation_id uuid DEFAULT NULL::uuid`
- Returns: `TABLE(id uuid, room_number text, floor text, room_type_id uuid, room_type_code text, condition text, is_occupied boolean, is_ready boolean)`
- Callable by signed-in users: yes · security definer
- Permission: `fo.view`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.get_guest`
- Args: `p_id uuid`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `guest.document.view`, `guest.view`, `res.view`
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`

### `public.get_reservation`
- Args: `p_id uuid`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `res.view`
- Errors: `E_NOT_FOUND`

### `public.hk_staff`
- Args: `p_property_id uuid`
- Returns: `TABLE(id uuid, full_name text)`
- Callable by signed-in users: yes · security definer
- Permission: `hk.view`
- Errors: —

### `public.inspect_hk_task`
- Args: `p_id uuid, p_pass boolean, p_result text DEFAULT 'inspected'::text, p_defects jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `hk.inspect`
- Errors: `E_INVALID`, `E_REQUIRED`, `E_SOD`

### `public.issue_invoice`
- Args: `p_folio_id uuid, p_kind text, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fin.folio.view`, `fin.invoice.issue`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.mark_all_notifications_read`
- Args: `—`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.mark_no_show`
- Args: `p_id uuid, p_reason text, p_waive_fee boolean DEFAULT false, p_waive_reason text DEFAULT NULL::text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.mark_notification_read`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.merge_guests`
- Args: `p_keep uuid, p_remove uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `guest.merge`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.mnt_staff`
- Args: `p_property_id uuid`
- Returns: `TABLE(id uuid, full_name text)`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.view`
- Errors: —

### `public.modify_reservation`
- Args: `p_id uuid, p_arrival date, p_departure date, p_room_type_id uuid, p_rate_plan_id uuid, p_adults integer, p_children integer, p_source text, p_company_name text, p_special_requests text, p_notes text, p_guarantee text, p_hold_until timestamp with time zone, p_group_id uuid, p_rate_override numeric, p_override_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`

### `public.move_room`
- Args: `p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`, `E_ROOM_TAKEN`

### `public.my_context`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_NOT_SIGNED_IN`

### `public.open_main_folio`
- Args: `p_reservation_id uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fin.charge.post`, `fin.folio.view`, `fin.payment.post`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.outbox_claim`
- Args: `p_limit integer, p_channels text[], p_tenant uuid DEFAULT NULL::uuid`
- Returns: `SETOF notification_outbox`
- Callable by signed-in users: no (internal / service role) · security definer
- Permission: —
- Errors: —

### `public.outbox_mark`
- Args: `p_id uuid, p_ok boolean, p_error text DEFAULT NULL::text, p_final boolean DEFAULT false`
- Returns: `void`
- Callable by signed-in users: no (internal / service role) · security definer
- Permission: —
- Errors: —

### `public.outbox_status`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_FORBIDDEN`

### `public.post_charge`
- Args: `p_folio_id uuid, p_charge_code_id uuid, p_amount numeric, p_tax_inclusive boolean, p_description text, p_reference text, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.post_payment`
- Args: `p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text, p_is_deposit boolean, p_description text, p_reference text, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.post_room_charges`
- Args: `p_property_id uuid, p_business_date date DEFAULT NULL::date`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `fin.nightaudit.run`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.register_invited_user`
- Args: `p_user_id uuid, p_full_name text, p_phone text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_ALREADY_HAS_HOTEL`, `E_FORBIDDEN`, `E_READ_ONLY`, `E_REQUIRED`

### `public.reinstate_reservation`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.reject_room_block`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `room.block.approve`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.release_room_block`
- Args: `p_id uuid, p_reason text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `room.block.approve`, `room.ooo.set`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.remove_guest_document`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `guest.document.view`, `guest.edit`
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`

### `public.remove_role`
- Args: `p_user_id uuid, p_property_id uuid, p_role_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_LAST_ADMIN`, `E_READ_ONLY`

### `public.rename_role`
- Args: `p_role_id uuid, p_name text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.role.manage`
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`, `E_SYSTEM_ROLE`

### `public.reopen_folio`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `fin.folio.reopen`, `fin.folio.view`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.reopen_ticket`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `mnt.ticket.close`
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.report_balances_by_guest`
- Args: `p_property_id uuid`
- Returns: `TABLE(guest_id uuid, guest_name text, folios bigint, currency character, balance numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.report_cancellation_rate`
- Args: `p_property_id uuid, p_from date, p_to date`
- Returns: `TABLE(bookings bigint, cancelled bigint, no_shows bigint, cancellation_rate numeric, no_show_rate numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.report_length_of_stay`
- Args: `p_property_id uuid, p_from date, p_to date`
- Returns: `TABLE(stays bigint, total_nights bigint, average_nights numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.report_outstanding_balances`
- Args: `p_property_id uuid`
- Returns: `TABLE(folio_id uuid, folio_number text, label text, reservation_id uuid, reservation_number text, guest_name text, room_number text, reservation_status text, folio_status text, departure_date date, currency character, balance numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.report_payments`
- Args: `p_property_id uuid, p_from date, p_to date`
- Returns: `TABLE(business_date date, method text, kind text, payments numeric, refunds numeric, net numeric, count bigint)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.report_revenue_by_charge_code`
- Args: `p_property_id uuid, p_from date, p_to date`
- Returns: `TABLE(charge_code text, name text, category text, net numeric, tax numeric, gross numeric)`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.request_adjustment`
- Args: `p_folio_id uuid, p_charge_code_id uuid, p_amount numeric, p_reason text, p_idempotency_key text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.request_refund`
- Args: `p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text, p_reference text, p_reason text, p_idempotency_key text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.request_reversal`
- Args: `p_transaction_id uuid, p_reason text, p_idempotency_key text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.request_room_block`
- Args: `p_room_id uuid, p_type text, p_from date, p_to date, p_reason text, p_ticket_id uuid DEFAULT NULL::uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `room.block.approve`, `room.ooo.set`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.request_unsettled_checkout`
- Args: `p_id uuid, p_reason text, p_idempotency_key text`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.resolve_ticket`
- Args: `p_id uuid, p_resolution text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.reverse_transaction`
- Args: `p_id uuid, p_reason text, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: no (internal / service role) · security definer
- Permission: —
- Errors: `E_ALREADY_REVERSED`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.rollover_status`
- Args: `p_property_id uuid`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.run_due_rollovers_now`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `fin.nightaudit.run`
- Errors: `E_FORBIDDEN`

### `public.save_charge_code`
- Args: `p_property_id uuid, p_id uuid, p_code text, p_name text, p_category text, p_is_taxable boolean, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.tax.manage`
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_group_booking`
- Args: `p_property_id uuid, p_id uuid, p_name text, p_contact_name text, p_contact_phone text, p_notes text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `res.group.manage`
- Errors: `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_guest`
- Args: `p_id uuid, p_first_name text, p_last_name text, p_phone text, p_email text, p_nationality text, p_address text, p_notes text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `guest.create`, `guest.edit`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.save_guest_document`
- Args: `p_id uuid, p_guest_id uuid, p_doc_type text, p_doc_number text, p_expiry date`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `guest.document.view`, `guest.edit`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_lost_found_item`
- Args: `p_property_id uuid, p_description text, p_location text, p_found_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_room_id uuid DEFAULT NULL::uuid`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fo.view`, `hk.view`
- Errors: `E_FORBIDDEN`, `E_READ_ONLY`, `E_REQUIRED`

### `public.save_payment_method`
- Args: `p_property_id uuid, p_id uuid, p_code text, p_name text, p_kind text, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.tax.manage`
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_rate_plan`
- Args: `p_property_id uuid, p_id uuid, p_code text, p_name text, p_is_corporate boolean, p_cancellation_type text, p_cancellation_value numeric, p_no_show_type text, p_no_show_value numeric, p_deposit_type text, p_deposit_value numeric, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.rate.manage`
- Errors: `E_DUPLICATE`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_rate_plan_price`
- Args: `p_id uuid, p_rate_plan_id uuid, p_room_type_id uuid, p_valid_from date, p_valid_to date, p_amount numeric, p_currency text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.rate.manage`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_OVERLAP`

### `public.save_room`
- Args: `p_property_id uuid, p_id uuid, p_room_number text, p_room_type_id uuid, p_floor text, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.room.manage`
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_room_type`
- Args: `p_property_id uuid, p_id uuid, p_code text, p_name text, p_max_adults integer, p_max_children integer, p_description text, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.room.manage`
- Errors: `E_DUPLICATE`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.save_tax_rate`
- Args: `p_property_id uuid, p_id uuid, p_code text, p_name text, p_percent numeric, p_sort_order integer, p_compounds_on_previous boolean, p_description text, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.tax.manage`
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.search_guests`
- Args: `p_query text, p_limit integer DEFAULT 50`
- Returns: `TABLE(id uuid, first_name text, last_name text, phone text, email text, nationality text, anonymised_at timestamp with time zone, created_at timestamp with time zone)`
- Callable by signed-in users: yes · security definer
- Permission: `guest.view`
- Errors: `E_FORBIDDEN`

### `public.search_reservations`
- Args: `p_property_id uuid, p_query text DEFAULT ''::text, p_status text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 100`
- Returns: `TABLE(id uuid, number text, guest_id uuid, guest_name text, arrival_date date, departure_date date, room_type_code text, room_number text, status text, source text, company_name text, hold_until timestamp with time zone, total_amount numeric, currency text, adults integer, children integer)`
- Callable by signed-in users: yes · security definer
- Permission: `res.view`
- Errors: `E_FORBIDDEN`

### `public.set_approval_limit`
- Args: `p_role_id uuid, p_permission_key text, p_max_amount numeric`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.role.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_SYSTEM_ROLE`

### `public.set_exchange_rate`
- Args: `p_property_id uuid, p_currency text, p_rate_date date, p_rate numeric`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.rate.manage`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.set_guest_feedback_status`
- Args: `p_id uuid, p_status text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `guest.edit`
- Errors: `E_INVALID`, `E_NOT_FOUND`

### `public.set_lost_found_status`
- Args: `p_id uuid, p_status text, p_note text DEFAULT NULL::text, p_claimed_by text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `fo.view`, `hk.task.assign`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.set_reservation_guests`
- Args: `p_id uuid, p_primary_guest_id uuid, p_guest_ids uuid[]`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.set_role_permissions`
- Args: `p_role_id uuid, p_permissions jsonb`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.role.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_SYSTEM_ROLE`

### `public.set_rollover_time`
- Args: `p_property_id uuid, p_time time without time zone`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `fin.nightaudit.run`
- Errors: `E_REQUIRED`

### `public.set_room_condition`
- Args: `p_room_id uuid, p_condition text, p_reason text DEFAULT NULL::text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `room.status.set`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

### `public.set_user_status`
- Args: `p_user_id uuid, p_status text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.user.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_LAST_ADMIN`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.split_folio`
- Args: `p_folio_id uuid, p_label text, p_guest_id uuid, p_transaction_ids uuid[], p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.start_hk_task`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `hk.task.assign`, `hk.task.complete`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.start_service_request`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `svc.order.complete`
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.start_ticket`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`

### `public.subscription_info`
- Args: `—`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_FORBIDDEN`

### `public.svc_staff`
- Args: `p_property_id uuid`
- Returns: `TABLE(id uuid, full_name text)`
- Callable by signed-in users: yes · security definer
- Permission: `svc.view`
- Errors: —

### `public.tenant_is_writable`
- Args: `—`
- Returns: `boolean`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: —

### `public.transfer_transaction`
- Args: `p_id uuid, p_to_folio_id uuid, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_READ_ONLY`, `E_REQUIRED`

### `public.unassign_room`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`

### `public.undo_checkout`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`, `E_ROOM_TAKEN`

### `public.update_property`
- Args: `p_property_id uuid, p_name text, p_address text, p_city text, p_country text, p_timezone text, p_check_in_time time without time zone, p_check_out_time time without time zone`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `setup.property.edit`
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.void_check_in`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.wait_ticket`
- Args: `p_id uuid, p_reason text`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`

### `public.walk_in_check_in`
- Args: `p_property_id uuid, p_idempotency_key text, p_guest_id uuid, p_departure date, p_room_type_id uuid, p_rate_plan_id uuid, p_adults integer, p_children integer, p_room_id uuid, p_registration jsonb, p_company_name text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_rate_override numeric DEFAULT NULL::numeric, p_override_reason text DEFAULT NULL::text, p_room_override_reason text DEFAULT NULL::text, p_deposit_waive_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fo.checkin`, `fo.walkin`
- Errors: `E_NO_ROOM`

### `public.withdraw_approval`
- Args: `p_id uuid`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: —
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`

## Schema `app`

### `app.approval_limit`
- Args: `p_permission_key text, p_property_id uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.approve_perm`
- Args: `p_kind text`
- Returns: `text`
- Permission: —
- Errors: —

### `app.assert_available`
- Args: `p_property uuid, p_room_type uuid, p_arrival date, p_departure date, p_exclude uuid`
- Returns: `void`
- Permission: —
- Errors: `E_NO_AVAILABILITY`

### `app.assert_can_grant`
- Args: `p_key text, p_level character, p_limit numeric, p_property uuid`
- Returns: `void`
- Permission: —
- Errors: `E_ESCALATION`

### `app.assert_reversible`
- Args: `t folio_transactions`
- Returns: `void`
- Permission: —
- Errors: `E_ALREADY_REVERSED`, `E_INVALID`

### `app.assert_role_grantable`
- Args: `p_role uuid, p_property uuid`
- Returns: `void`
- Permission: —
- Errors: —

### `app.assert_staff`
- Args: `p_user uuid, p_perm text, p_property uuid`
- Returns: `void`
- Permission: —
- Errors: `E_INVALID`

### `app.assert_writable`
- Args: `p_allow_when_read_only boolean DEFAULT false`
- Returns: `void`
- Permission: —
- Errors: `E_READ_ONLY`

### `app.assignment_not_blocked`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_ROOM_BLOCKED`

### `app.audit_guest_row`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.audit_row`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.availability`
- Args: `p_property uuid, p_arrival date, p_departure date, p_exclude uuid DEFAULT NULL::uuid`
- Returns: `TABLE(room_type_id uuid, stay_date date, sellable integer, reserved integer)`
- Permission: —
- Errors: —

### `app.block_ledger_change`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_IMMUTABLE`

### `app.can`
- Args: `p_permission_key text, p_property_id uuid DEFAULT NULL::uuid`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.canany_admin`
- Args: `—`
- Returns: `boolean`
- Permission: `adm.role.manage`, `adm.user.manage`
- Errors: —

### `app.check_arrival_room`
- Args: `p_property uuid, p_room uuid, p_override_reason text`
- Returns: `rooms`
- Permission: `fo.room.override`
- Errors: `E_NOT_FOUND`, `E_REQUIRED`, `E_ROOM_NOT_READY`

### `app.check_block`
- Args: `rm rooms, p_from date, p_to date`
- Returns: `void`
- Permission: —
- Errors: `E_OVERSOLD`, `E_ROOM_TAKEN`

### `app.check_override`
- Args: `p_property uuid, p_override numeric, p_reason text`
- Returns: `void`
- Permission: `res.rate.override`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_REQUIRED`

### `app.check_policy`
- Args: `p_label text, p_type text, p_value numeric`
- Returns: `void`
- Permission: —
- Errors: `E_INVALID`

### `app.check_user_property_role`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_NOT_FOUND`, `E_TENANT_MISMATCH`

### `app.compute_daily_stats`
- Args: `p_property uuid, p_date date`
- Returns: `void`
- Permission: —
- Errors: —

### `app.copy_tax_lines`
- Args: `p_from uuid, p_to uuid, p_sign integer`
- Returns: `void`
- Permission: —
- Errors: —

### `app.deposit_paid`
- Args: `p_res uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.discount_room`
- Args: `p_charge uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.do_check_in`
- Args: `p_id uuid, p_room_id uuid, p_registration jsonb, p_room_override_reason text, p_deposit_waive_reason text`
- Returns: `uuid`
- Permission: `fo.deposit.waive`
- Errors: `E_DEPOSIT_REQUIRED`, `E_FORBIDDEN`, `E_INVALID`, `E_NO_ROOM`

### `app.do_transfer`
- Args: `p_id uuid, p_to uuid, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_ALREADY_REVERSED`, `E_INVALID`, `E_NOT_FOUND`

### `app.enforce_plan_limit`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_PLAN_LIMIT`

### `app.enforce_writable`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_READ_ONLY`

### `app.enqueue_message`
- Args: `p_tenant uuid, p_property uuid, p_channel text, p_recipient text, p_subject text, p_body text, p_dedupe text`
- Returns: `void`
- Permission: —
- Errors: —

### `app.ensure_main_folio`
- Args: `p_res uuid`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.existing_tx`
- Args: `p_key text`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.fail`
- Args: `p_code text, p_message text`
- Returns: `void`
- Permission: —
- Errors: —

### `app.folio_balance`
- Args: `p_folio uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.folio_for_write`
- Args: `p_folio uuid, p_perm text`
- Returns: `folios`
- Permission: `fin.folio.view`
- Errors: `E_FOLIO_CLOSED`, `E_NOT_FOUND`

### `app.fx_rate`
- Args: `p_property uuid, p_currency text, p_date date`
- Returns: `numeric`
- Permission: —
- Errors: `E_NO_RATE`

### `app.guard_last_sysadmin`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_LAST_SYSADMIN`

### `app.guard_last_sysadmin_profile`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_LAST_SYSADMIN`

### `app.guest_for_write`
- Args: `p_id uuid`
- Returns: `guests`
- Permission: —
- Errors: `E_INVALID`, `E_NOT_FOUND`

### `app.has_property_access`
- Args: `p_property_id uuid`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.hk_default_checklist`
- Args: `p_type text`
- Returns: `jsonb`
- Permission: —
- Errors: —

### `app.hk_new_turnover`
- Args: `p_room uuid, p_stay uuid, p_notes text`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.hk_notify`
- Args: `p_user uuid, t hk_tasks, p_title text, p_body text`
- Returns: `void`
- Permission: —
- Errors: —

### `app.hk_set_room`
- Args: `p_room uuid, p_condition text`
- Returns: `void`
- Permission: —
- Errors: —

### `app.hk_task_for_write`
- Args: `p_id uuid`
- Returns: `hk_tasks`
- Permission: —
- Errors: `E_NOT_FOUND`

### `app.level_rank`
- Args: `p_level character`
- Returns: `integer`
- Permission: —
- Errors: —

### `app.log_res`
- Args: `r reservations, p_action text, p_reason text, p_after jsonb DEFAULT NULL::jsonb`
- Returns: `void`
- Permission: —
- Errors: —

### `app.mnt_require_worker`
- Args: `t maintenance_tickets`
- Returns: `void`
- Permission: `mnt.ticket.assign`, `mnt.ticket.work`
- Errors: `E_FORBIDDEN`

### `app.mnt_ticket_for_write`
- Args: `p_id uuid`
- Returns: `maintenance_tickets`
- Permission: —
- Errors: `E_NOT_FOUND`

### `app.my_level`
- Args: `p_key text, p_property uuid`
- Returns: `character`
- Permission: —
- Errors: —

### `app.my_limit`
- Args: `p_key text, p_property uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.my_tenant`
- Args: `—`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.new_approval`
- Args: `f folios, p_kind text, p_tx uuid, p_payload jsonb, p_amount numeric, p_currency text, p_reason text, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.next_document_number`
- Args: `p_property_id uuid, p_doc_type text`
- Returns: `text`
- Permission: —
- Errors: `E_NOT_FOUND`

### `app.notify_approvers`
- Args: `a approvals`
- Returns: `void`
- Permission: —
- Errors: —

### `app.notify_user`
- Args: `p_user uuid, p_tenant uuid, p_property uuid, p_kind text, p_title text, p_body text, p_link text, p_entity uuid`
- Returns: `void`
- Permission: —
- Errors: —

### `app.outbox_approval_alert`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.outbox_reservation_confirmed`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.policy_amount`
- Args: `p_type text, p_value numeric, p_res uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.post_adjustment`
- Args: `a approvals, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_FOLIO_CLOSED`

### `app.post_discount`
- Args: `c folio_transactions, p_amount numeric, p_reason text, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_FOLIO_CLOSED`, `E_INVALID`

### `app.post_mirror`
- Args: `src folio_transactions, p_kind text, p_folio uuid, p_sign integer, p_original uuid, p_key text, p_description text`
- Returns: `uuid`
- Permission: —
- Errors: —

### `app.post_refund`
- Args: `a approvals, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_FOLIO_CLOSED`, `E_INVALID`

### `app.post_reversal`
- Args: `t folio_transactions, p_reason text, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_ALREADY_REVERSED`, `E_FOLIO_CLOSED`

### `app.profiles_lock_tenant`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_FORBIDDEN`

### `app.properties_after_insert`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.protect_business_date`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: `E_INVALID`

### `app.rebuild_nights`
- Args: `p_res uuid`
- Returns: `void`
- Permission: —
- Errors: `E_NO_RATE`

### `app.release_rooms`
- Args: `p_res uuid`
- Returns: `void`
- Permission: —
- Errors: —

### `app.request_prelude`
- Args: `p_reason text, p_key text`
- Returns: `uuid`
- Permission: —
- Errors: `E_REQUIRED`

### `app.require`
- Args: `p_permission_key text, p_property_id uuid`
- Returns: `void`
- Permission: —
- Errors: `E_FORBIDDEN`, `E_READ_ONLY`

### `app.require_any`
- Args: `p_permission_key text`
- Returns: `void`
- Permission: —
- Errors: `E_FORBIDDEN`, `E_READ_ONLY`

### `app.require_report`
- Args: `p_perm text, p_property uuid`
- Returns: `void`
- Permission: —
- Errors: `E_FORBIDDEN`

### `app.reservation_for_write`
- Args: `p_id uuid, p_perm text`
- Returns: `reservations`
- Permission: —
- Errors: `E_NOT_FOUND`

### `app.reservation_outstanding`
- Args: `p_res uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.roll_expire_holds`
- Args: `p properties`
- Returns: `integer`
- Permission: —
- Errors: —

### `app.roll_no_shows`
- Args: `p properties, p_date date`
- Returns: `integer`
- Permission: —
- Errors: —

### `app.roll_property`
- Args: `p_property uuid, p_trigger text, p_actor uuid DEFAULT NULL::uuid`
- Returns: `jsonb`
- Permission: —
- Errors: —

### `app.roll_room_charges`
- Args: `p properties, p_date date`
- Returns: `integer`
- Permission: —
- Errors: `E_INVALID`

### `app.roll_stayovers`
- Args: `p properties, p_new_date date`
- Returns: `integer`
- Permission: —
- Errors: —

### `app.rollover_due`
- Args: `p properties`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.room_blocked`
- Args: `p_room uuid, p_from date, p_to date`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.room_blocked_today`
- Args: `p_room uuid, p_date date`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.room_ready`
- Args: `rm rooms`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.run_due_rollovers`
- Args: `p_tenant uuid DEFAULT NULL::uuid, p_trigger text DEFAULT 'schedule'::text, p_actor uuid DEFAULT NULL::uuid`
- Returns: `jsonb`
- Permission: —
- Errors: —

### `app.save_registration`
- Args: `p_guest uuid, p_reg jsonb`
- Returns: `jsonb`
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `app.scrub_stay_registration`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.seed_property_defaults`
- Args: `p_property_id uuid`
- Returns: `void`
- Permission: —
- Errors: —

### `app.set_arrival_room`
- Args: `r reservations, p_room uuid`
- Returns: `void`
- Permission: —
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_ROOM_TAKEN`

### `app.set_tenant_from_role`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.stays_main_folio`
- Args: `—`
- Returns: `trigger`
- Permission: —
- Errors: —

### `app.svc_for_write`
- Args: `p_id uuid`
- Returns: `service_requests`
- Permission: —
- Errors: `E_NOT_FOUND`

### `app.tenant_writable`
- Args: `p_tenant uuid`
- Returns: `boolean`
- Permission: —
- Errors: —

### `app.tx_total`
- Args: `p_id uuid`
- Returns: `numeric`
- Permission: —
- Errors: —

### `app.validate_stay`
- Args: `p_property uuid, p_arrival date, p_departure date, p_room_type uuid, p_rate_plan uuid, p_adults integer, p_children integer`
- Returns: `void`
- Permission: —
- Errors: `E_INVALID`, `E_REQUIRED`

### `app.would_drop_last_admin`
- Args: `p_tenant uuid, p_user uuid`
- Returns: `boolean`
- Permission: —
- Errors: —
