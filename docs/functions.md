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
- The snapshot header also holds adults, children, nights, check-in time and a total for each day; each line holds its receipt reference (FIN-019).

### `public.list_minibar_items`
- Args: `p_property_id uuid`
- Returns: `TABLE(id uuid, name text, price numeric, is_active boolean)`
- Callable by signed-in users: yes · security definer
- Permission: `hk.minibar.record, setup.minibar.manage`
- Errors: `E_FORBIDDEN`

### `public.list_minibar_rooms`
- Args: `p_property_id uuid`
- Returns: `TABLE(room_id uuid, room_number text)`
- Callable by signed-in users: yes · security definer
- Permission: `hk.minibar.record`
- Errors: `E_FORBIDDEN`

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
- Args: `p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text DEFAULT NULL::text, p_keep_rate boolean DEFAULT NULL::boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fo.room.move`; keeping the rate on a dearer room type also needs `fo.upgrade.complimentary`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NO_RATE`, `E_READ_ONLY`, `E_REQUIRED`, `E_ROOM_NOT_READY`, `E_ROOM_TAKEN`
- FO-007: p_keep_rate null means "charge" for a dearer type and "keep" otherwise. Charging reprices nights not yet posted.

### `public.preview_move_rate`
- Args: `p_id uuid, p_room_id uuid`
- Returns: `jsonb` (same_type, is_upgrade, current_total, new_total, missing_date, currency, can_keep_rate)
- Callable by signed-in users: yes · security definer
- Permission: `fo.room.move`
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`

### `public.create_property`
- Args: `p_name text, p_city text, p_country text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.property.create` (System Administrator, General Manager)
- Errors: `E_FORBIDDEN`, `E_PLAN_LIMIT`, `E_READ_ONLY`, `E_REQUIRED`
- PLT-007: seeded like the first property; the creator gets System Administrator and General Manager there. Audited.

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
- Args: `p_folio_id uuid, p_payment_method_id uuid, p_amount numeric, p_currency text, p_is_deposit boolean, p_description text, p_reference text, p_idempotency_key text, p_confirm_duplicate_reason text DEFAULT NULL::text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fin.payment.post` (deposits: `fin.deposit.take`)
- Errors: `E_INVALID`, `E_POSSIBLE_DUPLICATE`, `E_READ_ONLY`, `E_REQUIRED`
- FIN-017: a payment matching one on the same folio (amount, currency, method, reference) in the last `duplicate_payment_window_minutes` (10) is refused with `E_POSSIBLE_DUPLICATE`, naming the earlier payment, unless `p_confirm_duplicate_reason` is given. A confirmed repeat writes audit action `payment_duplicate_confirmed`.

### `public.post_room_charges`
- Args: `p_property_id uuid, p_business_date date DEFAULT NULL::date`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `fin.nightaudit.run`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`

### `public.recent_activity`
- Args: `p_property_id uuid, p_limit integer DEFAULT 8`
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `res.view`, `fo.view`, `fin.folio.view`, `hk.view` (each kind of line needs its own right)
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`

### `public.record_minibar_use`
- Args: `p_room_id uuid, p_items jsonb, p_idempotency_key text`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `hk.minibar.record`
- Errors: `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`

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

### `public.save_minibar_item`
- Args: `p_property_id uuid, p_id uuid, p_name text, p_price numeric, p_is_active boolean`
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `setup.minibar.manage`
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

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
- Errors: `E_DUPLICATE`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`, `E_ROOM_BOOKED`, `E_ROOM_OCCUPIED`
- SET-003: retiring an in-use room is refused while a guest is in it (`E_ROOM_OCCUPIED`, "This room has a guest in it. Retire it after check-out.", checked first) or while upcoming bookings are assigned to it (`E_ROOM_BOOKED`, "103 has 2 upcoming bookings (RES-000123, RES-000140). Move them to another room first.", up to 5 numbers then "and N more"). Upcoming: confirmed, or tentative with a hold not yet expired, assigned from the business date forward. Saving an already retired room as retired, renaming and floor changes work as before.

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

### `public.set_arrival_ready`
- Args: `p_reservation_id uuid, p_ready boolean`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `fo.checkin`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`
- RES-013: marks an upcoming arrival ready (a flag on reservations, not a status).

### `public.set_booking_rules`
- Args: `p_property_id uuid, p_max_stay_nights integer, p_tentative_hold_hours integer`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `setup.property.edit`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`
- SET-012: sets the longest stay (1 to 365 nights) and the tentative hold (1 to 720 hours). Applies to new bookings and changes only. Audited with old and new values.

### `public.set_inspection_required`
- Args: `p_property_id uuid, p_required boolean`
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `setup.property.edit`
- Errors: `E_FORBIDDEN`, `E_READ_ONLY`
- SET-008: off means a completed housekeeping task closes as passed and the room is clean. Audited.

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
- Invoice and interim numbers include the year and month of the property's business date and restart at 1 each month (FIN-020).

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

### `app.warn_before_rollover`
- Args: `p_now timestamptz DEFAULT now()`
- Returns: `integer` (notifications written)
- Permission: none; run by the `rollover-warning` cron job every 5 minutes. Not granted to signed-in users.
- Errors: —
- DAY-007: in the last 60 minutes before a property's roll time, if a cashier shift is still open, every active user with `fin.nightaudit.run` gets one `rollover_warning` notification for that business date. The roll itself never waits.

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

### Platform console (wave 2, item 2)

Every function below first calls `app.require_platform()`: the caller must be on `app.platform_operators` (`E_FORBIDDEN` otherwise) and the session must have passed two-step sign-in, JWT `aal = aal2` (`E_MFA_REQUIRED` otherwise).

### `public.platform_whoami`
- Args: none
- Returns: `jsonb` (`operator`, `mfa`), about the caller only
- Callable by signed-in users: yes · security definer
- Permission: none (answers for the caller)

### `public.platform_list_tenants`
- Args: none
- Returns: table of hotel account data: tenant_id, hotel_name, country, access_status, subscription_status, plan_code, plan_name, trial_ends_at, paid_until, created_at, properties, rooms, active_users, last_change_at. No guest, booking, money or contact data (PLT-009).
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_MFA_REQUIRED`

### `public.platform_tenant_history`
- Args: `p_tenant uuid`
- Returns: table: created_at, from_status, to_status, plan_code, period_end, reason, source, operator_email (platform changes only)
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_MFA_REQUIRED`

### `public.platform_change_subscription`
- Args: `p_tenant uuid, p_action text, p_reason text, p_until timestamptz DEFAULT NULL, p_plan text DEFAULT NULL`
- Actions: `extend_trial` (p_until, at most a year ahead), `activate` (p_until in the future, optional p_plan; also reactivates), `suspend`, `change_plan` (p_plan), `cancel`. Each needs a reason, refuses a change that changes nothing, and writes `subscription_history` (source platform, actor the operator). Nothing is deleted.
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_MFA_REQUIRED`, `E_NOT_FOUND`, `E_PLAN_LIMIT`, `E_REQUIRED`

### `public.platform_request_support_access`
- Args: `p_tenant uuid, p_reason text, p_hours integer DEFAULT 24`
- A platform operator asks to look at one hotel. Needs a reason and 1 to 72 hours. One open request per operator and hotel. Writes the hotel's audit log and tells everyone at the hotel who holds `adm.support.manage`.
- Returns: `uuid` (the request)
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_MFA_REQUIRED`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.platform_support_requests`
- Args: `p_tenant uuid`. The operator's own requests for that hotel, with status (requested, granted, denied, revoked, expired).
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_MFA_REQUIRED`

### `public.list_support_access`
- Args: none. The hotel's support requests, newest first. A granted request past its time shows as `expired`.
- Callable by signed-in users: yes · security definer
- Permission: `adm.support.manage` (System Administrator and General Manager only; custom roles copied earlier do not get it)
- Errors: `E_FORBIDDEN`

### `public.decide_support_access`
- Args: `p_id uuid, p_approve boolean, p_hours integer DEFAULT NULL`. Yes grants access for 1 to 72 hours (default: the hours asked for). No refuses. A decision is final. Audited. Allowed on a read-only hotel on purpose: those hotels most need help, so it does not call `app.assert_writable`.
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.support.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`

### `public.revoke_support_access`
- Args: `p_id uuid`. Closes open access at once. Audited. Also allowed on a read-only hotel.
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `adm.support.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`

### `public.platform_support_snapshot`
- Args: `p_tenant uuid`. The read-only support view: hotel account data, properties (name, time zone, business date, room and staff counts), the last 10 business date runs, and message counts (pending, failed, sent in 24 hours). No guests, bookings, money, contact details or ID photos. Needs an open grant for this operator and this hotel. Each view is counted and written to the hotel's audit log.
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in and an open grant
- Errors: `E_FORBIDDEN`, `E_MFA_REQUIRED`, `E_NO_CONSENT`

### `app.add_platform_operator`
- Args: `p_email text`. Database owner only (Supabase SQL editor); no grant to any app role.
- Adds an existing sign-in account that belongs to no hotel. Errors: `E_INVALID` (account belongs to a hotel), `E_NOT_FOUND` (no such account).


### `public.setup_progress`
- Args: `p_property_id uuid`. Needs any setup permission at the property. Read-only, so it works while a hotel is read-only.
- Returns `{property_id, total, done, complete, steps[]}`. Each step has `key`, `label`, `detail`, `href` and `done`. Steps: property, room_types, rooms, rates, taxes, payments, staff.
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`.

### `public.list_group_bookings`
- Args: `p_property_id uuid`, `p_status text default null`. Needs `res.view`.
- Lists groups with live room count, nights, first arrival, last departure and total. Cancelled and no-show bookings are not counted.

### `public.get_group_booking`
- Args: `p_id uuid`. Needs `res.view`.
- Returns the group, its bookings and totals. `balance_due` is null without `fin.folio.view`. Errors: `E_NOT_FOUND`.

### `public.set_group_booking_status`
- Args: `p_id uuid`, `p_status text` ('active' or 'cancelled'). Needs `res.group.manage`. Audited.
- Errors: `E_GROUP_HAS_BOOKINGS` (cancel while live bookings exist), `E_NOT_FOUND`, `E_INVALID`.

### AI helpers: owner's morning brief (AI-001 to AI-005)
AI is off for every hotel until switched on. The provider only ever sees plain fact lines built by the database (counts and money, no guest, ID, room or card data). The server rejects any draft that contains a number not in those lines.

### `public.ai_status`
- Args: none. Returns `jsonb`: `enabled`, `monthly_cap`, `used` (this month, failed calls not counted), `remaining`.
- Permission: `adm.ai.manage` or `rpt.finance.view` · Errors: `E_FORBIDDEN`

### `public.set_ai_settings`
- Args: `p_enabled boolean, p_monthly_cap integer` (0 to 1000). Audited as `set_ai_settings`.
- Permission: `adm.ai.manage` (System Administrator and General Manager only) · Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.ai_morning_brief_start`
- Args: `p_property_id uuid`. Checks permission, the switch and the monthly limit, logs a call in `ai_usage`, returns `{usage_id, facts}`. Facts: property, business date, currency, yesterday, today, attention (approvals, repairs, money unpaid more than 30 days after departure) and `lines`.
- Permission: `rpt.finance.view` and `rpt.operations.view` on the property · Errors: `E_FORBIDDEN`, `E_AI_OFF`, `E_AI_LIMIT`

### `public.ai_call_finish`
- Args: `p_usage_id uuid, p_ok boolean`. Marks the call done or failed. Only the person who started it, once.
- Errors: `E_NOT_FOUND`

### Setup import assistant (SET-010, AI-006, AI-007)
A hotel pastes its room list. The server screens it (no email, phone or card number), asks the AI for a draft list, drops anything not in the pasted text, and shows a preview from the database. Nothing is added until the person confirms; `apply_setup_import` then checks the whole list again.

### `public.ai_import_start`
- Args: `p_property_id uuid`. Logs a call in `ai_usage` and returns `{usage_id, context}`; the context is only the existing room type codes and a room count.
- Permission: `setup.room.manage` on the property · Errors: `E_FORBIDDEN`, `E_AI_OFF`, `E_AI_LIMIT`

### `public.apply_setup_import`
- Args: `p_property_id uuid, p_payload jsonb, p_preview boolean DEFAULT true`. Payload: `{room_types:[{code,name,max_adults?,max_children?}], rooms:[{number,type_code,floor?}]}`, at most 50 types and 500 rooms.
- Preview writes nothing and returns what would be created, skipped and refused. Apply adds room types, then rooms, all or nothing. Existing type codes and room names are skipped, so repeating the same import adds nothing. Audited as `apply_setup_import`.
- Returns `jsonb`: `would_create_types, skipped_types, would_create_rooms, skipped_rooms, invalid, created_types, created_rooms, room_limit, rooms_now`
- Permission: `setup.room.manage` on the property
- Errors: `E_FORBIDDEN`, `E_INVALID` (bad shape, bad room name, unknown type, too many), `E_PLAN_LIMIT`

### Source and ageing reports (RPT-005, RPT-006)

### `public.report_revenue_by_source`
- Args: `p_property_id uuid, p_from date, p_to date`
- Returns one row per booking source with any activity: `source, bookings, cancelled, no_shows, room_nights, room_revenue, adr`. Bookings, cancellations and no-shows count by arrival date. Room nights count booked nights in the range for live bookings. Room revenue is room-category charges (reversals and adjustments included, payments and refunds left out) posted in the range, before tax. `adr` is room revenue divided by room nights.
- Callable by signed-in users: yes · security definer, stable
- Permission: `rpt.finance.view`
- Errors: `E_FORBIDDEN`, `E_INVALID` (end before start)

### `public.report_balance_ageing`
- Args: `p_property_id uuid`
- Returns one row per source and currency: `source, currency, folios, current_amount, days_1_7, days_8_30, days_31_60, days_61_plus, total, credit_held`. Age is the property's business date minus the booking's departure date; guests still staying or due to arrive are current. Only positive balances are aged; overpayments add up in `credit_held`.
- Callable by signed-in users: yes · security definer, stable
- Permission: `rpt.finance.view`

### Hotel group view (GRP-001 to GRP-004)

### `public.group_overview`
- Args: none
- Returns `jsonb`: `properties` (one object per branch the caller holds `rpt.group.view` on: name, code, city, base currency, business date, rooms total and occupied, occupancy, in house, arrivals and departures still to come, pending approvals, open and urgent repairs, last night's revenue and occupancy) and `totals` (the same counts added up, plus `revenue_by_currency`, never mixed).
- Callable by signed-in users: yes · security definer, stable
- Permission: `rpt.group.view`, checked per branch; other hotel groups are never listed
- Errors: `E_FORBIDDEN`

### `public.copy_property_setup`
- Args: `p_source_property_id uuid, p_target_property_id uuid`
- Copies room types, rate plans and rate prices from the source into an empty target branch. Prices point at the target's own room types. Rooms are not copied. Writes an audit row `copy_property_setup`.
- Returns `jsonb`: `room_types`, `rate_plans`, `rate_prices` (counts)
- Callable by signed-in users: yes · security definer
- Permission: `setup.room.manage` and `setup.rate.manage` on the target, `setup.property.view` on the source
- Errors: `E_FORBIDDEN`, `E_INVALID` (same branch), `E_NOT_FOUND`, `E_NOT_EMPTY` (target already has room types or rates)

### Cashier shifts and night audit flags (FIN-016, DAY-005)
Tables: `cashier_shifts`, `cashier_shift_lines` (read through row-level security: a cashier sees their own shifts, a user with `fin.shift.reconcile` sees the hotel's). `folio_transactions.cashier_shift_id` is set by a trigger when a payment, refund or reversal is posted by someone with an open shift. `properties.require_cashier_shift` (off by default) makes `post_payment` refuse a payment from a cashier with no open shift (`E_NO_SHIFT`). New permission `fin.shift.reconcile` goes to the built-in System Administrator, General Manager, Front Office Manager and Accountant roles only. Custom roles copied earlier do not get it. Amounts are whole currency in the hotel's base currency.

### `public.open_cashier_shift`
- Args: `p_property_id uuid, p_opening_float numeric, p_idempotency_key text`
- Opens the caller's shift. A retry with the same key returns the same shift. One open shift per cashier and hotel.
- Returns: `uuid`
- Callable by signed-in users: yes · security definer
- Permission: `fin.shift.close`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_READ_ONLY`, `E_REQUIRED`, `E_SHIFT_OPEN`

### `public.cashier_shift_summary`
- Args: `p_shift uuid`
- One shift with, per payment method, what it should hold (`expected`), what was counted and the difference. An open shift shows live expected figures. Cash expected includes the float.
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: the cashier who opened it, or `fin.shift.reconcile`
- Errors: `E_FORBIDDEN`, `E_NOT_FOUND`

### `public.close_cashier_shift`
- Args: `p_shift uuid, p_counts jsonb ([{payment_method_id, counted}]), p_note text`
- Every method that took money must be counted. The database works out the difference (counted minus expected). A difference needs a note. A manager can close someone else's shift, with a note. Works while the hotel is read-only.
- Returns: `jsonb` (the shift summary)
- Callable by signed-in users: yes · security definer
- Permission: `fin.shift.close` for your own shift; `fin.shift.reconcile` for another's
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_REQUIRED`

### `public.reconcile_cashier_shift`
- Args: `p_shift uuid, p_note text`
- A manager checks a closed shift. Not the person who closed it (`E_SOD`, and CHECK `cashier_shifts_sod`). A shift with a difference needs a note. Audited.
- Returns: `jsonb` (the shift summary)
- Callable by signed-in users: yes · security definer
- Permission: `fin.shift.reconcile`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NOT_FOUND`, `E_READ_ONLY`, `E_REQUIRED`, `E_SOD`

### `public.list_cashier_shifts`
- Args: `p_property_id uuid, p_from date, p_to date, p_status text (open, closed, unreconciled or null)`
- Up to 200 shifts, newest first: the caller's own, or all when the caller can reconcile.
- Returns: `jsonb` (list)
- Callable by signed-in users: yes · security definer
- Permission: `fin.shift.close` or `fin.shift.reconcile`
- Errors: `E_FORBIDDEN`, `E_INVALID`

### `public.set_cashier_shift_required`
- Args: `p_property_id uuid, p_required boolean`
- Turns the "open a shift before taking payments" rule on or off for a hotel. Audited.
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: `setup.property.edit`
- Errors: `E_FORBIDDEN`, `E_READ_ONLY`

### `public.night_audit_flags`
- Args: `p_property_id uuid`
- What is still open before the day closes. `blocking`: cashier shifts still open. `warnings`: closed shifts with an unreconciled difference, guests in house on or past departure, bookings due that have not checked in. It does not stop the date rolling.
- Returns: `jsonb` (`business_date`, `blocking`, `warnings`; each item has `code`, `title`, `count`, `detail`)
- Callable by signed-in users: yes · security definer
- Permission: `fin.nightaudit.run`
- Errors: `E_FORBIDDEN`

### `app.stamp_cashier_shift`
- Trigger on `folio_transactions` (before insert). Ties a payment, refund or reversal to the poster's open shift. Raises `E_NO_SHIFT` for a payment when the hotel requires a shift and the poster has none.

### Subscription billing (PLT-012)
Prices: column `plans.prices` (for example `{"NGN": {"month": 6000000, "year": 60000000}}`; hotels read it, only `platform_set_plan_price` writes it). Tables: `subscription_payments` (a hotel reads its own with `adm.subscription.manage`), `billing_events` (no client access). Amounts are in the smallest unit (kobo). Nothing here is settled in a browser: the price always comes from `plans.prices`.

### `public.platform_set_plan_price`
- Args: `p_plan text, p_currency text, p_interval text, p_amount_minor bigint`
- Sets or replaces one price. `p_interval` is `month` or `year`.
- Returns: `void`
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_MFA_REQUIRED`, `E_NOT_FOUND`

### `public.start_subscription_payment`
- Args: `p_plan text, p_interval text, p_idempotency_key text`
- Makes a pending payment for the hotel's own currency (its first property). A retry with the same key returns the first payment. Refuses a plan the hotel has outgrown.
- Returns: `jsonb` (`payment_id`, `reference`, `amount_minor`, `currency`, `plan_code`, `interval`, `status`)
- Callable by signed-in users: yes · security definer
- Permission: `adm.subscription.manage`
- Errors: `E_FORBIDDEN`, `E_INVALID`, `E_NO_PRICE`, `E_NOT_FOUND`, `E_PLAN_LIMIT`, `E_REQUIRED`

### `public.billing_apply_event`
- Args: `p_provider text, p_event_id text, p_reference text, p_outcome text ('success' or 'failed'), p_amount_minor bigint, p_currency text`
- Called only by the server after it verifies the provider's signature. Stores the event once, then: `applied` (plan activated, or failure recorded), `duplicate` (event seen before), `ignored` (payment already paid), `mismatch` (amount or currency differ; payment marked failed, nothing activated), `unknown_reference`.
- Success adds one month or one year to the end of the current paid period, or from today when the hotel is not active. Writes `subscription_history` with source `billing`.
- Returns: `text`
- Callable by signed-in users: no (service role only) · security definer
- Errors: `E_INVALID`, `E_REQUIRED`

### `public.platform_failed_payments`
- Args: none
- Failed payments from the last 60 days and payments still pending after a day.
- Returns: table (`payment_id`, `created_at`, `tenant_id`, `tenant_name`, `plan_code`, `period`, `amount` (whole currency, worked out by the database), `currency`, `status`, `reference`, `failure_reason`)
- Callable by signed-in users: yes · security definer
- Permission: platform operator with two-step sign-in
- Errors: `E_FORBIDDEN`, `E_MFA_REQUIRED`

### `app.assert_plan_fits`
- Args: `p_tenant uuid, p_plan text`. Helper. Errors: `E_NOT_FOUND`, `E_PLAN_LIMIT`.

### `public.billing_options`
- Args: none
- For the Subscription screen: the hotel's currency, every plan with its monthly and yearly price in whole currency (the database divides, the browser does not), `fits` (the hotel is within the plan's limits) and `can_buy` (fits and has a price), and the hotel's last 20 payments.
- Returns: `jsonb`
- Callable by signed-in users: yes · security definer
- Permission: `adm.subscription.manage`
- Errors: `E_FORBIDDEN`

### `public.owner_summary`
- Args: `p_property_id uuid`
- Returns: `jsonb` (facts, collected money for the last closed day, `lines` and `text`)
- Callable by signed-in users: yes · security definer
- Permission: `rpt.finance.view` and `rpt.operations.view`
- Errors: `E_FORBIDDEN`
