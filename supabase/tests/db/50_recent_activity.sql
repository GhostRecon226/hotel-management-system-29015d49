-- [RPT-008] Latest activity on the dashboard: the newest things that happened at the hotel, as plain lines,
-- limited to what the signed-in person is allowed to see. Read only.
begin;

do $$
declare v_r uuid; v_task uuid; a jsonb; k text[];
begin
  -- Something happens at the front desk and in housekeeping.
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  perform public.post_payment(t.main_folio(v_r), t.pm('CASH'), 5000, 'NGN', false, null, null, 'act-pay-1');
  perform public.post_payment(t.main_folio(v_r), t.pm('CASH'), public.checkout_outstanding(v_r), 'NGN', true, 'second payment on purpose', null, 'act-pay-2');
  perform public.check_out(v_r, null, null);
  perform t.admin();
  select id into v_task from public.hk_tasks where room_id = t.room('101') and type = 'turnover' and status = 'open';
  perform t.login('hks');
  perform public.assign_hk_task(v_task, t.id('att'));
  perform t.login('att');
  perform public.start_hk_task(v_task);
  perform public.complete_hk_task(v_task, '[]'::jsonb, null);
  perform t.login('hks');
  perform public.inspect_hk_task(v_task, true, 'inspected', null, null);

  -- A manager sees every kind of event.
  perform t.login('adminA');
  a := public.recent_activity(t.id('propA'), 20);
  select array_agg(distinct e->>'kind') into k from jsonb_array_elements(a) e;
  perform t.ok(k @> array['reservation_created', 'checked_in', 'payment', 'checked_out', 'room_clean'], '[RPT-008] a manager sees bookings, check-ins, payments, check-outs and clean rooms');
  perform t.ok(exists (select 1 from jsonb_array_elements(a) e where e->>'kind' = 'checked_in' and e->>'detail' like '%101%'), '[RPT-008] the check-in line names the room');
  perform t.ok(exists (select 1 from jsonb_array_elements(a) e where e->>'kind' = 'payment' and (e->>'amount')::numeric = 5000 and e->>'currency' = 'NGN'), '[RPT-008] a payment line carries the amount as a positive figure from the database');
  perform t.ok(exists (select 1 from jsonb_array_elements(a) e where e->>'kind' = 'reservation_created' and e->>'detail' like '%' || (select number from public.reservations where id = v_r) || '%'), '[RPT-008] the booking line carries the reservation number');
  perform t.ok((select count(*) from jsonb_array_elements(a)) <= 20, '[RPT-008] the list never exceeds the limit asked for');
  perform t.eq(jsonb_array_length(public.recent_activity(t.id('propA'), 2)), 2, '[RPT-008] a small limit returns that many lines');

  -- Newest first.
  perform t.admin();
  update public.reservations set created_at = now() - interval '3 days' where id = v_r;
  update public.stays set checked_in_at = now() - interval '2 days' where reservation_id = v_r;
  perform t.login('adminA');
  a := public.recent_activity(t.id('propA'), 50);
  perform t.ok((a->0->>'kind') not in ('reservation_created', 'checked_in'), '[RPT-008] older events come after newer ones');
  perform t.ok((select e->>'kind' from jsonb_array_elements(a) with ordinality x(e, o) where e->>'kind' in ('reservation_created', 'checked_in') order by o limit 1) = 'checked_in', '[RPT-008] the two-day-old check-in sits above the three-day-old booking');

  -- Each person sees only what their rights allow.
  perform t.login('hks');
  a := public.recent_activity(t.id('propA'), 50);
  perform t.ok(jsonb_array_length(a) > 0 and not exists (select 1 from jsonb_array_elements(a) e where e->>'kind' in ('payment', 'reservation_created')), '[RPT-008] housekeeping sees room events but no payments or bookings');
  perform t.login('fdo');
  a := public.recent_activity(t.id('propA'), 50);
  perform t.ok(exists (select 1 from jsonb_array_elements(a) e where e->>'kind' = 'checked_in'), '[RPT-008] front desk sees check-ins');
  perform t.login('att');
  perform t.raises(format('select public.recent_activity(%L, 8)', t.id('propA')), 'E_FORBIDDEN', '[RPT-008] a room attendant who may only see their own tasks has no activity feed');
  perform t.login('nobody');
  perform t.raises(format('select public.recent_activity(%L, 8)', t.id('propA')), 'E_NOT_FOUND', '[RPT-008] someone with no role at the hotel gets nothing');
  perform t.login('adminB');
  perform t.raises(format('select public.recent_activity(%L, 8)', t.id('propA')), 'E_NOT_FOUND', '[RPT-008] another hotel group cannot read this hotel''s activity');
  perform t.login('adminA');
  perform t.raises(format('select public.recent_activity(%L, 0)', t.id('propA')), 'E_INVALID', '[RPT-008] a limit below one is refused');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('recent_activity', sqlerrm);
end $$;

do $$
declare v_r uuid; n1 int; n2 int; n3 int;
begin
  -- A room move is not a second check-in, and a voided check-in does not show.
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('102'), null, null);
  n1 := (select count(*)::int from jsonb_array_elements(public.recent_activity(t.id('propA'), 50)) e where e->>'kind' = 'checked_in');
  perform public.move_room(v_r, t.room('103'), 'guest asked for a quieter room', null);
  n2 := (select count(*)::int from jsonb_array_elements(public.recent_activity(t.id('propA'), 50)) e where e->>'kind' = 'checked_in');
  perform t.eq(n2, n1, '[RPT-008] moving a guest to another room adds no second check-in line');
  perform t.ok(exists (select 1 from jsonb_array_elements(public.recent_activity(t.id('propA'), 50)) e where e->>'kind' = 'checked_in' and e->>'detail' like '%103%') or exists (select 1 from jsonb_array_elements(public.recent_activity(t.id('propA'), 50)) e where e->>'kind' = 'checked_in' and e->>'detail' like '%102%'), '[RPT-008] the move still leaves a check-in line for the stay');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('recent_activity move', sqlerrm);
end $$;

do $$ begin
  perform t.anon();
  perform t.raises(format('select public.recent_activity(%L, 8)', t.id('propA')), 'permission denied', '[RPT-008] a signed-out visitor cannot call it');
  perform t.admin();
end $$;

rollback;
