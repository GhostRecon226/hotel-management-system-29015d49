-- Group booking screen (RES-012): list groups, open one with its rooms and totals, cancel or reactivate the group record.
-- Arrival-ready flag on the arrivals list (RES-013).
begin;

do $$
declare v_bd date; v_g uuid; v_g2 uuid; v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_f1 uuid; v_row record; v_o jsonb; v_exp numeric; v_can boolean;
begin
  perform t.login('fom');
  v_bd := t.bdate();
  v_g := public.save_group_booking(t.id('propA'), null, 'Okafor Wedding', 'Ngozi Okafor', '08030000000', 'Reception on Saturday');
  v_g2 := public.save_group_booking(t.id('propA'), null, 'Empty Group', null, null, null);
  v_r1 := public.create_reservation(t.id('propA'), 'grp-1', t.id('g1'), v_bd + 2, v_bd + 4, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, v_g, null, null);
  v_r2 := public.create_reservation(t.id('propA'), 'grp-2', t.id('g2'), v_bd + 2, v_bd + 3, t.id('dlx'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, v_g, null, null);
  v_r3 := public.create_reservation(t.id('propA'), 'grp-3', t.id('g1'), v_bd + 5, v_bd + 6, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, v_g, null, null);
  v_r4 := public.create_reservation(t.id('propA'), 'grp-4', t.id('g2'), v_bd + 2, v_bd + 3, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform public.cancel_reservation(v_r3, 'Guest dropped out');

  -- list
  select * into v_row from public.list_group_bookings(t.id('propA')) where id = v_g;
  perform t.eq(v_row.name, 'Okafor Wedding', '[RES-012] the group is listed');
  perform t.eq(v_row.rooms, 2::bigint, '[RES-012] rooms count live bookings only');
  perform t.eq(v_row.nights, 3::bigint, '[RES-012] nights add up the live bookings');
  perform t.eq(v_row.first_arrival, v_bd + 2, '[RES-012] first arrival');
  perform t.eq(v_row.last_departure, v_bd + 4, '[RES-012] last departure');
  select coalesce(sum(total_amount), 0) into v_exp from public.reservations where group_id = v_g and status not in ('cancelled', 'no_show');
  perform t.eq(v_row.total_amount, v_exp, '[RES-012] the group total is the sum of the live bookings');
  perform t.ok(v_exp > 0, 'set-up: the group has value');
  perform t.eq((select rooms from public.list_group_bookings(t.id('propA')) where id = v_g2), 0::bigint, '[RES-012] a group with no bookings shows zero rooms');
  perform t.eq((select count(*) from public.list_group_bookings(t.id('propA'), 'cancelled')), 0::bigint, '[RES-012] the status filter works');
  perform t.eq((select count(*) from public.list_group_bookings(t.id('propA'), 'active') where id in (v_g, v_g2)), 2::bigint, '[RES-012] both are active');

  -- open one
  perform t.admin(); perform app.ensure_main_folio(v_r1); v_f1 := t.main_folio(v_r1);
  perform t.login('fom');
  perform public.post_charge(v_f1, t.cc('ROOM'), 40000, false, 'Room', null, 'grp-room-1');
  v_o := public.get_group_booking(v_g);
  perform t.eq(v_o->'group'->>'name', 'Okafor Wedding', '[RES-012] the group opens');
  perform t.eq(v_o->'group'->>'contact_name', 'Ngozi Okafor', '[RES-012] with its contact');
  perform t.eq(jsonb_array_length(v_o->'reservations'), 3, '[RES-012] it lists every booking, cancelled ones included');
  perform t.ok(not exists (select 1 from jsonb_array_elements(v_o->'reservations') e where e->>'number' = (select number from public.reservations where id = v_r4)),
    '[RES-012] a booking outside the group is not listed');
  perform t.eq((v_o->'totals'->>'rooms')::int, 2, '[RES-012] totals count live rooms');
  perform t.eq((v_o->'totals'->>'total_amount')::numeric, v_exp, '[RES-012] and the same total as the list');
  perform t.eq((v_o->'totals'->>'balance_due')::numeric, t.balance(v_f1), '[RES-012] the unpaid balance comes from the bills');
  perform t.login('rsv');
  v_can := app.can('fin.folio.view', t.id('propA'));
  v_o := public.get_group_booking(v_g);
  perform t.eq((v_o->'totals'->'balance_due') = 'null'::jsonb, not v_can, '[RES-012] the balance shows only to people who can see bills');
  perform t.login('adminB');
  perform t.raises(format('select public.get_group_booking(%L)', v_g), 'E_NOT_FOUND', '[RES-012] another hotel cannot open the group');
  perform t.raises(format('select * from public.list_group_bookings(%L)', t.id('propA')), 'E_FORBIDDEN', '[RES-012] nor list the groups');
  perform t.login('hks');
  perform t.raises(format('select * from public.list_group_bookings(%L)', t.id('propA')), 'E_FORBIDDEN', '[RES-012] housekeeping cannot list groups');

  -- status
  perform t.login('fom');
  perform t.raises(format('select public.set_group_booking_status(%L, %L)', v_g, 'cancelled'), 'E_GROUP_HAS_BOOKINGS',
    '[RES-012] a group with live bookings cannot be cancelled');
  perform t.raises(format('select public.set_group_booking_status(%L, %L)', v_g, 'paused'), 'E_INVALID', '[RES-012] an unknown status is refused');
  perform public.set_group_booking_status(v_g2, 'cancelled');
  perform t.eq((select status from public.group_bookings where id = v_g2), 'cancelled', '[RES-012] an empty group can be cancelled');
  perform t.eq((select count(*) from public.list_group_bookings(t.id('propA'), 'cancelled')), 1::bigint, '[RES-012] and shows under cancelled');
  perform public.set_group_booking_status(v_g2, 'active');
  perform t.eq((select status from public.group_bookings where id = v_g2), 'active', '[RES-012] and can be reactivated');
  perform t.login('att');
  perform t.raises(format('select public.set_group_booking_status(%L, %L)', v_g2, 'cancelled'), 'E_FORBIDDEN', '[RES-012] a room attendant cannot change a group');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where action = 'set_group_booking_status' and record_id = v_g2::text), '[RES-012] the change is audited');
end $$;

-- RES-013: the flag on the arrivals list
do $$
declare v_bd date; v_r uuid;
begin
  perform t.login('fom');
  v_bd := t.bdate();
  v_r := public.create_reservation(t.id('propA'), 'arr-flag-1', t.id('g1'), v_bd, v_bd + 1, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform t.eq((select arrival_ready from public.v_arrivals where id = v_r), false, '[RES-013] the arrivals list shows a new booking as not ready');
  perform public.set_arrival_ready(v_r, true);
  perform t.eq((select arrival_ready from public.v_arrivals where id = v_r), true, '[RES-013] and as ready once front desk marks it');
  perform t.eq((select status from public.reservations where id = v_r), 'confirmed', '[RES-013] ready is a flag, the status stays confirmed');
  perform t.admin();
end $$;

select t.admin();
rollback;
