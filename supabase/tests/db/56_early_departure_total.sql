-- QA-12 / RES-014: leaving early brings the booking total down to the nights kept; undo check-out puts it back.
begin;

do $$
declare v_r uuid; v_total numeric; v_night numeric; v_out numeric;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform t.admin();
  select total_amount into v_total from public.reservations where id = v_r;
  perform t.ok(v_total > 0, '[RES-014] a three night booking has a total');
  v_night := v_total / 3;

  perform t.login('fdo');
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  perform t.admin();
  perform t.set_bdate(t.id('propA'), t.bdate() + 1);

  perform t.login('fdo');
  v_out := public.checkout_outstanding(v_r);
  if v_out > 0 then
    perform public.post_payment(t.main_folio(v_r), t.pm('CASH'), v_out, 'NGN', false, null, null, 'early-pay');
  end if;
  perform public.check_out(v_r, null, null);
  perform t.admin();
  perform t.eq((select total_amount from public.reservations where id = v_r), v_night,
    '[RES-014] after leaving a night early the total is one night, not three');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_r), 1,
    '[RES-014] one night is kept');

  perform t.login('fom');
  perform public.undo_checkout(v_r, 'Guest came back');
  perform t.admin();
  perform t.eq((select total_amount from public.reservations where id = v_r), v_total,
    '[RES-014] undo check-out restores the original total');
exception when others then perform t.admin(); perform t.crash('early departure total', sqlerrm);
end $$;

rollback;
