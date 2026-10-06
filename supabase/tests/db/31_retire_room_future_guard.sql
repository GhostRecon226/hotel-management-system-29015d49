-- Retire-room guard, future bookings (SET-003, decision of 6 Oct 2026): a room cannot be retired while upcoming
-- bookings are assigned to it. Upcoming = confirmed, or tentative with a hold not yet expired, assigned to the room from
-- the business date forward. The refusal names the room and up to 5 booking numbers. The in-house check comes first.
begin;

create function t.res_number(p uuid) returns text language sql stable security definer as $$ select number from public.reservations where id = p $$;
grant execute on function t.res_number(uuid) to authenticated;

do $$
declare v_room uuid; v_spare uuid; v_a uuid; v_b uuid; v_msg text; v_i int; v_many uuid[] := '{}'; v_x uuid;
begin
  perform t.login('adminA');
  v_room := public.save_room(t.id('propA'), null, '501', t.id('std'), '5', true);
  v_spare := public.save_room(t.id('propA'), null, '502', t.id('std'), '5', true);

  -- Two upcoming bookings on room 501: one confirmed, one tentative with a hold that has not expired.
  perform t.login('fdo');
  v_a := t.book(t.id('g1'), t.bdate() + 5, t.bdate() + 7, t.id('std'), t.id('bar'));
  v_b := public.create_reservation(t.id('propA'), 'future-guard-b', t.id('g2'), t.bdate() + 9, t.bdate() + 10, t.id('std'), t.id('bar'), 1, 0,
    'tentative', 'direct', null, null, null, 'none', now() + interval '2 days', null, null, null);
  perform public.assign_room(v_a, v_room);
  perform public.assign_room(v_b, v_room);
  perform t.login('adminA');
  perform t.raises(format('select public.save_room(%L, %L, %L, %L, %L, false)', t.id('propA'), v_room, '501', t.id('std'), '5'),
    'E_ROOM_BOOKED', '[SET-003] a room with upcoming bookings cannot be retired');
  begin
    perform public.save_room(t.id('propA'), v_room, '501', t.id('std'), '5', false);
  exception when others then v_msg := sqlerrm;
  end;
  perform t.eq(v_msg, format('[E_ROOM_BOOKED] 501 has 2 upcoming bookings (%s, %s). Move them to another room first.', t.res_number(v_a), t.res_number(v_b)),
    '[SET-003] the refusal names the room and the bookings, in arrival order');
  perform t.lives(format('select public.save_room(%L, %L, %L, %L, %L, true)', t.id('propA'), v_room, '501', t.id('std'), '5 east'),
    '[SET-003] a room with bookings can still be renamed or moved to another floor');

  -- Move one booking, cancel the other: now the room can be retired.
  perform t.login('fdo');
  perform public.unassign_room(v_a);
  perform public.assign_room(v_a, v_spare);
  perform t.login('adminA');
  begin
    perform public.save_room(t.id('propA'), v_room, '501', t.id('std'), '5', false);
  exception when others then v_msg := sqlerrm;
  end;
  perform t.eq(v_msg, format('[E_ROOM_BOOKED] 501 has 1 upcoming booking (%s). Move it to another room first.', t.res_number(v_b)),
    '[SET-003] after moving one booking, the message names only the one left');
  perform t.login('fom');
  perform public.cancel_reservation(v_b, 'Group did not confirm');
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), v_room, '501', t.id('std'), '5', false);
  perform t.admin();
  perform t.ok((select not is_active from public.rooms where id = v_room), '[SET-003] once the bookings are moved or cancelled, the room can be retired');
  perform t.login('adminA');
  perform t.lives(format('select public.save_room(%L, %L, %L, %L, %L, false)', t.id('propA'), v_room, '501', t.id('std'), '5'),
    '[SET-003] retiring it again is safe to repeat');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('future bookings guard', sqlerrm);
end $$;

-- Cancelled and expired tentative bookings do not block.
do $$
declare v_room uuid; v_c uuid; v_t uuid;
begin
  perform t.login('adminA');
  v_room := public.save_room(t.id('propA'), null, '503', t.id('std'), '5', true);
  perform t.login('fdo');
  v_c := t.book(t.id('g3'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar'));
  v_t := public.create_reservation(t.id('propA'), 'future-guard-t', t.id('g1'), t.bdate() + 6, t.bdate() + 7, t.id('std'), t.id('bar'), 1, 0,
    'tentative', 'direct', null, null, null, 'none', now() + interval '1 day', null, null, null);
  perform public.assign_room(v_c, v_room);
  perform public.assign_room(v_t, v_room);
  perform t.login('fom');
  perform public.cancel_reservation(v_c, 'Guest cancelled');
  perform t.admin();
  update public.reservations set hold_until = now() - interval '1 hour' where id = v_t;
  perform t.login('adminA');
  perform t.lives(format('select public.save_room(%L, %L, %L, %L, %L, false)', t.id('propA'), v_room, '503', t.id('std'), '5'),
    '[SET-003] a cancelled booking and a tentative booking whose hold expired do not block retiring');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('cancelled and expired', sqlerrm);
end $$;

-- In-house first: with a guest in the room and a later booking, the in-house message is given.
do $$
declare v_room uuid; v_in uuid; v_later uuid; v_msg text;
begin
  perform t.login('adminA');
  v_room := public.save_room(t.id('propA'), null, '504', t.id('std'), '5', true);
  perform t.login('fdo');
  v_in := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_in, t.reg(), v_room, null, null);
  v_later := t.book(t.id('g3'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar'));
  perform public.assign_room(v_later, v_room);
  perform t.login('adminA');
  begin
    perform public.save_room(t.id('propA'), v_room, '504', t.id('std'), '5', false);
  exception when others then v_msg := sqlerrm;
  end;
  perform t.eq(v_msg, '[E_ROOM_OCCUPIED] This room has a guest in it. Retire it after check-out.',
    '[SET-003] the in-house guard still works and comes first when both apply');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('in-house first', sqlerrm);
end $$;

-- More than 5 bookings: five are named, the rest counted.
do $$
declare v_room uuid; v_ids uuid[] := '{}'; v_x uuid; v_msg text; i int;
begin
  perform t.login('adminA');
  v_room := public.save_room(t.id('propA'), null, '505', t.id('std'), '5', true);
  perform t.login('fdo');
  for i in 1..7 loop
    v_x := t.book(t.id('g1'), t.bdate() + 10 + i * 2, t.bdate() + 11 + i * 2, t.id('std'), t.id('bar'));
    perform public.assign_room(v_x, v_room);
    v_ids := v_ids || v_x;
  end loop;
  perform t.login('adminA');
  begin
    perform public.save_room(t.id('propA'), v_room, '505', t.id('std'), '5', false);
  exception when others then v_msg := sqlerrm;
  end;
  perform t.eq(v_msg, format('[E_ROOM_BOOKED] 505 has 7 upcoming bookings (%s, %s, %s, %s, %s and 2 more). Move them to another room first.',
    t.res_number(v_ids[1]), t.res_number(v_ids[2]), t.res_number(v_ids[3]), t.res_number(v_ids[4]), t.res_number(v_ids[5])),
    '[SET-003] with more than 5 bookings, five are named and the rest counted');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('more than five', sqlerrm);
end $$;

rollback;
