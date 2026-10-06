-- Retire-room guard (SET-003, decision of 6 Oct 2026): a room with a guest in it right now cannot be retired.
-- The hotel checks the guest out first. Vacant rooms, and rooms already retired, behave as before.
begin;

do $$
declare v_room uuid; v_spare uuid; v_r uuid; v_msg text;
begin
  perform t.login('adminA');
  v_room := public.save_room(t.id('propA'), null, '401', t.id('std'), '4', true);
  v_spare := public.save_room(t.id('propA'), null, '402', t.id('std'), '4', true);

  -- A guest is in room 401.
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), v_room, null, null);
  perform t.login('adminA');
  perform t.raises(format('select public.save_room(%L, %L, %L, %L, %L, false)', t.id('propA'), v_room, '401', t.id('std'), '4'),
    'E_ROOM_OCCUPIED', '[SET-003] a room with a guest in it cannot be retired');
  begin
    perform public.save_room(t.id('propA'), v_room, '401', t.id('std'), '4', false);
  exception when others then v_msg := sqlerrm;
  end;
  perform t.eq(v_msg, '[E_ROOM_OCCUPIED] This room has a guest in it. Retire it after check-out.', '[SET-003] and the message tells the hotel what to do');
  perform t.admin();
  perform t.ok((select is_active from public.rooms where id = v_room), '[SET-003] the room stays in use');
  perform t.login('adminA');
  perform t.lives(format('select public.save_room(%L, %L, %L, %L, %L, true)', t.id('propA'), v_room, '401', t.id('std'), '4 north'),
    '[SET-003] an occupied room can still be renamed or moved to another floor');

  -- After check-out the same room can be retired.
  perform t.login('fdo');
  perform public.post_payment(t.main_folio(v_r), t.pm('CASH'), public.checkout_outstanding(v_r), 'NGN', false, null, null, 'retire-guard-pay');
  perform public.check_out(v_r, null, null);
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), v_room, '401', t.id('std'), '4', false);
  perform t.admin();
  perform t.ok((select not is_active from public.rooms where id = v_room), '[SET-003] after check-out the room can be retired');

  -- Retiring it again is safe to repeat; a vacant room is retired as before.
  perform t.login('adminA');
  perform t.lives(format('select public.save_room(%L, %L, %L, %L, %L, false)', t.id('propA'), v_room, '401', t.id('std'), '4'),
    '[SET-003] retiring a room that is already retired is safe to repeat');
  perform public.save_room(t.id('propA'), v_spare, '402', t.id('std'), '4', false);
  perform t.admin();
  perform t.ok((select not is_active from public.rooms where id = v_spare), '[SET-003] a vacant room is retired as before');
  perform t.eq((select count(*)::int from public.rooms where id in (v_room, v_spare)), 2, '[SET-003] nothing is deleted');
exception when others then perform t.admin(); perform t.crash('retire room guard', sqlerrm);
end $$;

rollback;
