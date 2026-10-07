-- Revenue by booking source (RPT-005) and ageing of unpaid balances by source (RPT-006).
begin;

do $$
declare v_bd date; v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_f1 uuid; v_f2 uuid; v_f4 uuid; v_row record; v_tot numeric; v_c int;
begin
  perform t.login('fdo');
  v_bd := t.bdate();
  v_r1 := public.create_reservation(t.id('propA'), 'src-1', t.id('g1'), v_bd + 2, v_bd + 4, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  v_r2 := public.create_reservation(t.id('propA'), 'src-2', t.id('g2'), v_bd + 2, v_bd + 3, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'corporate', 'Acme Ltd', null, null, 'none', null, null, null, null);
  v_r3 := public.create_reservation(t.id('propA'), 'src-3', t.id('g1'), v_bd + 6, v_bd + 7, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'phone', null, null, null, 'none', null, null, null, null);
  v_r4 := public.create_reservation(t.id('propA'), 'src-4', t.id('g2'), v_bd + 8, v_bd + 9, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform t.login('fom');
  perform public.cancel_reservation(v_r3, 'Changed plans');
  perform t.admin();
  perform app.ensure_main_folio(v_r1); perform app.ensure_main_folio(v_r2); perform app.ensure_main_folio(v_r4);
  v_f1 := t.main_folio(v_r1); v_f2 := t.main_folio(v_r2); v_f4 := t.main_folio(v_r4);
  perform t.ok(v_f1 is not null and v_f2 is not null and v_f4 is not null, 'set-up: bookings have a main bill');
  perform t.login('fom');
  perform public.post_charge(v_f1, t.cc('ROOM'), 40000, false, 'Room', null, 'src-room-1');
  perform public.post_charge(v_f1, t.cc('LAUNDRY'), 5000, false, 'Laundry', null, 'src-laundry-1');
  perform public.post_charge(v_f2, t.cc('ROOM'), 25000, false, 'Room', null, 'src-room-2');
  perform public.post_charge(v_f4, t.cc('ROOM'), 15000, false, 'Room', null, 'src-room-4');
  perform t.admin();

  -- RPT-005: revenue by booking source
  perform t.login('acc');
  select * into v_row from public.report_revenue_by_source(t.id('propA'), v_bd, v_bd + 10) where source = 'direct';
  perform t.eq(v_row.bookings, 2::bigint, '[RPT-005] direct bookings are counted');
  perform t.eq(v_row.room_nights, 3::bigint, '[RPT-005] room nights are counted from the booked nights');
  perform t.eq(v_row.room_revenue, 55000::numeric, '[RPT-005] room revenue is room charges only, laundry left out');
  perform t.eq(v_row.adr, round(55000::numeric / 3, 2), '[RPT-005] average rate is room revenue divided by room nights');
  select * into v_row from public.report_revenue_by_source(t.id('propA'), v_bd, v_bd + 10) where source = 'corporate';
  perform t.eq(v_row.room_revenue, 25000::numeric, '[RPT-005] corporate revenue is kept apart');
  select * into v_row from public.report_revenue_by_source(t.id('propA'), v_bd, v_bd + 10) where source = 'phone';
  perform t.eq(v_row.cancelled, 1::bigint, '[RPT-005] a cancelled booking is shown as cancelled');
  perform t.eq(v_row.bookings, 0::bigint, '[RPT-005] and not as a booking');
  perform t.eq(v_row.room_nights, 0::bigint, '[RPT-005] a cancelled booking has no room nights');
  perform t.ok(not exists (select 1 from public.report_revenue_by_source(t.id('propA'), v_bd, v_bd + 10) where source = 'walk_in'),
    '[RPT-005] a source with no activity is not listed');
  perform t.eq((select count(*) from public.report_revenue_by_source(t.id('propA'), v_bd + 20, v_bd + 30)), 0::bigint,
    '[RPT-005] a quiet period lists nothing');
  perform t.raises(format('select * from public.report_revenue_by_source(%L, %L, %L)', t.id('propA'), v_bd + 5, v_bd), 'E_INVALID',
    '[RPT-005] the end date cannot be before the start date');
  perform t.login('fdo');
  perform t.raises(format('select * from public.report_revenue_by_source(%L, %L, %L)', t.id('propA'), v_bd, v_bd + 10), 'E_FORBIDDEN',
    '[RPT-005] front desk cannot open finance reports');
  perform t.login('adminB');
  perform t.raises(format('select * from public.report_revenue_by_source(%L, %L, %L)', t.id('propA'), v_bd, v_bd + 10), 'E_FORBIDDEN',
    '[RPT-005] another hotel cannot open it');
  perform t.admin();

  -- RPT-006: ageing. Move the business date so the stays are in the past.
  -- r1 leaves at bd+4 (direct), r2 at bd+3 (corporate), r4 at bd+9 (direct)
  perform t.set_bdate(t.id('propA'), v_bd + 40);
  perform t.login('acc');
  select * into v_row from public.report_balance_ageing(t.id('propA')) where source = 'corporate';
  perform t.eq(v_row.total, t.balance(v_f2), '[RPT-006] a corporate balance appears under corporate');
  perform t.eq(v_row.days_31_60, t.balance(v_f2), '[RPT-006] 37 days after leaving falls in 31 to 60 days');
  perform t.eq(v_row.current_amount + v_row.days_1_7 + v_row.days_8_30 + v_row.days_61_plus, 0::numeric, '[RPT-006] nothing in the other columns');
  select * into v_row from public.report_balance_ageing(t.id('propA')) where source = 'direct';
  perform t.eq(v_row.days_31_60, t.balance(v_f1) + t.balance(v_f4), '[RPT-006] two direct bills in the same column are added');
  perform t.eq(v_row.folios, 2::bigint, '[RPT-006] the number of bills is shown');
  perform t.eq(v_row.total, t.balance(v_f1) + t.balance(v_f4), '[RPT-006] total is the sum of the columns');
  perform t.eq((select sum(total) from public.report_balance_ageing(t.id('propA')) where currency = 'NGN'),
    (select sum(balance) from public.report_outstanding_balances(t.id('propA')) where balance > 0 and currency = 'NGN'),
    '[RPT-006] ageing adds up to the outstanding balances report');

  -- pay one bill in full: it leaves the ageing, and a credit shows separately
  perform t.admin();
  perform t.set_bdate(t.id('propA'), v_bd);
  perform t.login('fom');
  perform public.post_payment(v_f2, t.pm('CASH'), t.balance(v_f2) + 1000, 'NGN', false, null, null, 'src-pay-2');
  perform t.admin();
  perform t.set_bdate(t.id('propA'), v_bd + 40);
  perform t.login('acc');
  perform t.ok(not exists (select 1 from public.report_balance_ageing(t.id('propA')) where source = 'corporate' and total > 0),
    '[RPT-006] a paid bill leaves the ageing');
  perform t.eq((select credit_held from public.report_balance_ageing(t.id('propA')) where source = 'corporate'), 1000::numeric,
    '[RPT-006] an overpayment shows as a credit held, not a negative debt');
  perform t.login('fdo');
  perform t.raises(format('select * from public.report_balance_ageing(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-006] front desk cannot open it');
  perform t.login('adminB');
  perform t.raises(format('select * from public.report_balance_ageing(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-006] another hotel cannot open it');
  perform t.admin();
end $$;

select t.admin();
rollback;
