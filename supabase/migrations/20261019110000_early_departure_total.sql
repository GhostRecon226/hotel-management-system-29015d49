-- QA-12 / RES-014: check-out sets the booking total to the nights kept; undo check-out restores it.
CREATE OR REPLACE FUNCTION public.check_out(p_id uuid, p_approval_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; s public.stays; v_bdate date; v_out numeric; a public.approvals;
  v_closed uuid[] := '{}'; v_nights jsonb; v_old_dep date; fo record; v_task uuid; v_sid uuid; v_same numeric; v_old_total numeric; v_new_total numeric;
begin
  perform app.assert_writable(true);
  r := app.reservation_for_write(p_id, 'fo.checkout');
  perform set_config('app.settlement', 'on', true);
  if r.status = 'checked_out' then
    select id into v_sid from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1;
    return v_sid;
  end if;
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be checked out.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;

  -- Leaving on the business day of check-in: one night is charged unless a manager waived it.
  v_same := app.check_out_night(r.id);
  if v_same > 0 then
    perform app.insert_same_day_charge(r.id, v_same);
  end if;
  v_out := app.reservation_outstanding(r.id);
  if v_out <> 0 then
    if p_approval_id is not null then
      select * into a from public.approvals where id = p_approval_id and tenant_id = r.tenant_id for update;
      if a.id is null or a.kind <> 'checkout' or a.reservation_id <> r.id then
        perform app.fail('E_INVALID', 'That approval is not for this booking.'); end if;
      if a.status <> 'approved' then perform app.fail('E_NOT_APPROVED', 'The check-out approval has not been approved yet.'); end if;
      if exists (select 1 from public.stays where checkout_approval_id = a.id) then
        perform app.fail('E_INVALID', 'That approval has already been used.'); end if;
      if v_out > a.amount then
        perform app.fail('E_BALANCE_DUE', 'The balance has grown since approval (' || to_char(v_out, 'FM999,999,999,990.00') || '). Ask again.'); end if;
    elsif app.can('fo.checkout.unsettled', r.property_id) then
      if coalesce(btrim(p_reason), '') = '' then
        perform app.fail('E_REQUIRED', 'A reason is required to check out with a balance.'); end if;
    else
      perform app.fail('E_BALANCE_DUE', 'Every folio must be at zero. Outstanding: ' || to_char(v_out, 'FM999,999,999,990.00') || '. Settle it or ask for approval.');
    end if;
  end if;

  for fo in select id from public.folios where reservation_id = r.id and status = 'open' for update loop
    if app.folio_balance(fo.id) = 0 then
      update public.folios set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = fo.id;
      v_closed := v_closed || fo.id;
    end if;
  end loop;

  v_old_dep := r.departure_date;
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_nights
    from public.reservation_nights n where n.reservation_id = r.id and n.stay_date >= v_bdate;
  delete from public.reservation_nights where reservation_id = r.id and stay_date >= v_bdate;
  v_old_total := r.total_amount;
  select coalesce(sum(rate_amount), 0) + coalesce(v_same, 0) into v_new_total from public.reservation_nights where reservation_id = r.id;
  update public.reservations set status = 'checked_out', updated_at = now(), total_amount = v_new_total,
    departure_date = case when v_bdate >= arrival_date and v_bdate < departure_date then v_bdate else departure_date end
  where id = r.id;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = r.id and is_active;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;

  v_task := app.hk_new_turnover(s.room_id, s.id, 'Check-out ' || r.number);

  update public.stays set status = 'checked_out', checked_out_at = now(), checked_out_by = auth.uid(),
    checkout_business_date = v_bdate, checkout_approval_id = a.id, checkout_reason = nullif(btrim(p_reason), ''),
    checkout_snapshot = jsonb_build_object('closed_folios', to_jsonb(v_closed), 'nights', v_nights,
      'departure_date', v_old_dep, 'total_amount', v_old_total, 'task_id', v_task, 'outstanding', v_out)
  where id = s.id;

  perform app.log_res(r, 'check_out', p_reason, jsonb_strip_nulls(jsonb_build_object(
    'outstanding', nullif(v_out, 0), 'approval_id', a.id, 'closed_folios', cardinality(v_closed))));
  return s.id;
end $function$;

CREATE OR REPLACE FUNCTION public.undo_checkout(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; s public.stays; v_bdate date; rm public.rooms; v_dep date; n jsonb; v_f text;
begin
  perform app.assert_writable();
  r := app.reservation_for_write(p_id, 'fo.checkout.undo');
  if r.status <> 'checked_out' then perform app.fail('E_INVALID', 'This booking is not checked out.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1 for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.checkout_business_date is distinct from v_bdate then
    perform app.fail('E_INVALID', 'A check-out can only be undone on the same business day.'); end if;
  select * into rm from public.rooms where id = s.room_id for update;
  if rm.is_occupied then perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is occupied again. Undo is not possible.'); end if;

  v_dep := coalesce((s.checkout_snapshot->>'departure_date')::date, r.departure_date);
  if v_dep > v_bdate then
    perform app.assert_available(r.property_id, r.room_type_id, v_bdate, v_dep, r.id);
  end if;

  update public.reservations set status = 'checked_in', departure_date = v_dep, updated_at = now(),
    total_amount = coalesce((s.checkout_snapshot->>'total_amount')::numeric, total_amount) where id = r.id;
  for n in select * from jsonb_array_elements(coalesce(s.checkout_snapshot->'nights', '[]'::jsonb)) loop
    insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
    values (r.tenant_id, r.property_id, r.id, (n->>'room_type_id')::uuid, (n->>'stay_date')::date, (n->>'rate_amount')::numeric, s.room_id)
    on conflict do nothing;
  end loop;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, r.id, s.room_id, least(v_bdate, v_dep - 1), greatest(v_dep, v_bdate + 1));
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' has been assigned to another booking.');
  end;

  update public.rooms set is_occupied = true where id = s.room_id;
  update public.hk_tasks set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Check-out undone'
   where id = (s.checkout_snapshot->>'task_id')::uuid and status in ('open', 'assigned', 'in_progress', 'failed');
  perform set_config('app.audit_reason', 'Undo check-out: ' || btrim(p_reason), true);
  for v_f in select jsonb_array_elements_text(coalesce(s.checkout_snapshot->'closed_folios', '[]'::jsonb)) loop
    update public.folios set status = 'open', closed_at = null, closed_by = null where id = v_f::uuid and status = 'closed';
  end loop;
  perform set_config('app.audit_reason', '', true);
  update public.stays set status = 'in_house', checked_out_at = null, checked_out_by = null, checkout_business_date = null,
    checkout_approval_id = null, checkout_reason = null, checkout_snapshot = null where id = s.id;
  perform app.log_res(r, 'undo_check_out', p_reason, null);
end $function$;
