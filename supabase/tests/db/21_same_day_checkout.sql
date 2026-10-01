-- A guest booked overnight who checks in and leaves on the same business day is charged one night
-- (Peter, 1 Oct 2026, extending DAY-006). A manager can waive it with a reason, before or after it posts.
begin;

do $$
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '160', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '161', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '162', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '163', t.id('std'), '1', true);
  perform public.save_room(t.id('propA'), null, '164', t.id('std'), '1', true);
  perform t.admin();
end $$;

-- Check-out on the arrival day: the screen shows the night, the desk posts or the check-out posts it.
do $$
declare v_r uuid; v_f uuid; j jsonb;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('160'), null, null);
  v_f := t.main_folio(v_r);
  j := public.preview_check_out_charge(v_r);
  perform t.ok((j->>'applies')::boolean, '[DAY-006b] leaving on the arrival day: a one-night charge applies');
  perform t.eq((j->>'amount')::numeric, 50000::numeric, '[DAY-006b] the charge is the first night''s rate');
  perform t.eq((j->>'total')::numeric, 59125::numeric, '[DAY-006b] with tax');
  perform t.eq(public.checkout_outstanding(v_r), 59125::numeric, '[DAY-006b] check-out outstanding includes it before it is posted');
  perform t.raises(format('select public.check_out(%L)', v_r), 'E_BALANCE_DUE', '[DAY-006b] check-out is refused until it is paid');
  perform t.eq(t.balance(v_f), 0.0000, '[DAY-006b] and the refused check-out leaves nothing behind');
  perform public.post_check_out_charge(v_r);
  perform t.eq(t.balance(v_f), 59125.0000, '[DAY-006b] the desk can post it before taking payment');
  perform public.post_check_out_charge(v_r);
  perform t.eq(t.balance(v_f), 59125.0000, '[DAY-006b] posting it again does not charge twice');
  perform t.ok((select description ilike '%same-day stay%' from public.folio_transactions where folio_id = v_f and kind = 'charge'), '[DAY-006b] labelled as a same-day stay');
  perform t.eq(public.checkout_outstanding(v_r), 59125::numeric, '[DAY-006b] outstanding does not count it twice once posted');
  perform public.post_payment(v_f, t.pm('CASH'), 59125, 'NGN', false, null, null, 'sdc-p1');
  perform t.lives(format('select public.check_out(%L)', v_r), '[DAY-006b] once paid, the guest checks out');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = v_f and kind = 'charge'), 1, '[DAY-006b] exactly one room charge');
  perform t.eq((select departure_date from public.reservations where id = v_r), t.bdate(), '[DAY-006b] the departure date becomes the arrival day');

  -- Payment first: the desk takes the amount shown, then checks out. Check-out posts the night itself.
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('161'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 59125, 'NGN', false, null, null, 'sdc-p2');
  perform t.eq(public.checkout_outstanding(v_r), 0::numeric, '[DAY-006b] paid up front: the check-out screen shows nothing outstanding');
  perform t.lives(format('select public.check_out(%L)', v_r), '[DAY-006b] paid up front: check-out posts the night and closes at zero');
  perform t.eq(t.balance(v_f), 0.0000, '[DAY-006b] the folio is at zero');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day check-out', sqlerrm);
end $$;

-- Waiving: before it posts, and after.
do $$
declare v_r uuid; v_f uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g3'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('162'), null, null);
  perform t.raises(format('select public.waive_same_day_charge(%L, %L)', v_r, 'Regular'), 'E_FORBIDDEN', '[DAY-006b] front desk cannot waive it');
  perform t.login('fom');
  perform t.raises(format('select public.waive_same_day_charge(%L, %L)', v_r, ''), 'E_REQUIRED', '[DAY-006b] waiving needs a reason');
  perform public.waive_same_day_charge(v_r, 'Family emergency, left after an hour');
  perform t.ok(not (public.preview_check_out_charge(v_r)->>'applies')::boolean, '[DAY-006b] once waived, no charge applies');
  perform t.eq(public.checkout_outstanding(v_r), 0::numeric, '[DAY-006b] and nothing is outstanding');
  perform t.ok(exists (select 1 from public.audit_events where table_name = 'reservations' and record_id = v_r::text
    and action = 'waive_same_day_charge' and reason = 'Family emergency, left after an hour'), '[DAY-006b] the waiver and reason are in the booking history');
  perform t.login('fdo');
  perform t.lives(format('select public.check_out(%L)', v_r), '[DAY-006b] the guest checks out with nothing to pay');
  perform t.eq((select count(*)::int from public.folio_transactions t join public.folios f on f.id = t.folio_id where f.reservation_id = v_r and t.kind = 'charge'), 0,
    '[DAY-006b] no room charge was posted');

  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('163'), null, null);
  perform public.post_check_out_charge(v_r);
  perform t.login('fom');
  perform public.waive_same_day_charge(v_r, 'Complaint');
  perform t.eq(t.balance(t.main_folio(v_r)), 0.0000, '[DAY-006b] waiving after it posted reverses it');
  perform t.ok(not (public.preview_check_out_charge(v_r)->>'applies')::boolean, '[DAY-006b] and it does not apply again');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('same-day check-out waiver', sqlerrm);
end $$;

-- No charge when the guest stayed a night: the roll charged it, and check-out the next day adds nothing.
do $$
declare v_r uuid; v_d date := t.bdate();
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g2'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('164'), null, null);
  perform t.admin();
  perform app.roll_property(t.id('propA'), 'manual', null);
  perform t.login('fdo');
  perform t.ok(not (public.preview_check_out_charge(v_r)->>'applies')::boolean, '[DAY-006b] a guest who stayed the night is not charged a same-day night');
  perform public.post_payment(t.main_folio(v_r), t.pm('CASH'), 59125, 'NGN', false, null, null, 'sdc-p3');
  perform t.lives(format('select public.check_out(%L)', v_r), '[DAY-006b] they check out the next day as usual');
  perform t.eq((select count(*)::int from public.folio_transactions t join public.folios f on f.id = t.folio_id where f.reservation_id = v_r and t.kind = 'charge'), 1,
    '[DAY-006b] with only the one night the roll charged');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('stayed a night', sqlerrm);
end $$;

rollback;
