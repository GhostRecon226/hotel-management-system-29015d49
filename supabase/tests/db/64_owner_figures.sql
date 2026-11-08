-- [RPT-010] Owner figures: yesterday's money and rooms, the week-on-week change, and what guests owe.
-- All arithmetic happens in the database. Finance report rights only.
begin;

do $$
declare v_r uuid; v_f uuid; j jsonb; v_owed numeric; v_n bigint; v_day date; v_prev date;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '196', t.id('std'), '1', true);
  perform t.admin();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('196'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_payment(v_f, t.pm('CASH'), 5000, 'NGN', false, null, null, 'ofg-pay-1');
  perform public.post_payment(v_f, t.pm('CASH'), 2500, 'NGN', false, null, 'second', 'ofg-pay-2');
  perform t.raises(format('select public.owner_figures(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-010] front desk without finance reports cannot read the owner figures');
  perform t.admin();
  perform t.login('adminA');
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'ofg-chg-1');
  perform t.admin();

  -- Move the date on one day so today's postings fall in "yesterday", and save two days of figures.
  perform t.set_bdate(t.id('propA'), t.bdate() + 1);
  v_day := t.bdate() - 1; v_prev := v_day - 7;
  insert into public.daily_stats (tenant_id, property_id, business_date, rooms_available, rooms_sold, room_revenue, total_revenue)
  values (t.id('tenantA'), t.id('propA'), v_day, 10, 8, 400000, 450000),
         (t.id('tenantA'), t.id('propA'), v_prev, 10, 5, 200000, 300000);

  perform t.login('acc');
  j := public.owner_figures(t.id('propA'));
  perform t.admin();
  perform t.eq((j->>'date')::date, v_day, '[RPT-010] the figures are for the last closed day');
  perform t.eq((j->>'compare_date')::date, v_day - 7, '[RPT-010] the comparison is the same weekday a week earlier');
  perform t.eq((j->>'revenue')::numeric, 450000.00, '[RPT-010] revenue is the day''s total revenue');
  perform t.eq((j->>'occupancy')::numeric, 0.8, '[RPT-010] occupancy is rooms sold over rooms available');
  perform t.eq((j->>'adr')::numeric, 50000.00, '[RPT-010] ADR is room revenue over rooms sold');
  perform t.eq((j->>'revpar')::numeric, 40000.00, '[RPT-010] RevPAR is room revenue over rooms available');
  perform t.eq((j->>'collected')::numeric, 7500.00, '[RPT-010] collected counts the day''s payments');
  perform t.eq((j->'change'->>'revenue_pct')::numeric, 50.0, '[RPT-010] revenue change is a percentage of the week before');
  perform t.eq((j->'change'->>'occupancy_points')::numeric, 30.0, '[RPT-010] occupancy change is in points');
  perform t.eq((j->'change'->>'adr')::numeric, 10000.00, '[RPT-010] ADR change is an amount');
  perform t.eq((j->'change'->>'revpar')::numeric, 20000.00, '[RPT-010] RevPAR change is an amount');
  perform t.ok(j->'change'->'collected_pct' = 'null'::jsonb, '[RPT-010] no change is shown when the week before collected nothing');
  select coalesce(sum(b.balance), 0), count(*) into v_owed, v_n
  from public.v_folio_balances b join public.properties p on p.id = b.property_id
  where b.property_id = t.id('propA') and b.balance > 0 and b.currency::text = p.base_currency::text;
  perform t.eq((j->>'owed')::numeric, v_owed, '[RPT-010] owed is the sum of folios with a balance, from the ledger');
  perform t.eq((j->>'owed_folios')::bigint, v_n, '[RPT-010] owed folios counts the folios that owe');
  perform t.ok(v_owed >= 10000, '[RPT-010] the dinner charge is owed');
  perform t.admin();

  -- A day with no saved figures shows nothing instead of zero.
  delete from public.daily_stats where property_id = t.id('propA') and business_date = v_prev;
  perform t.login('acc');
  j := public.owner_figures(t.id('propA'));
  perform t.admin();
  perform t.ok(j->'change'->'revenue_pct' = 'null'::jsonb, '[RPT-010] no week-before figures means no change is shown');
  perform t.eq((j->>'revenue')::numeric, 450000.00, '[RPT-010] yesterday''s figures still show');
  delete from public.daily_stats where property_id = t.id('propA') and business_date = v_day;
  perform t.login('acc');
  j := public.owner_figures(t.id('propA'));
  perform t.admin();
  perform t.ok((j->>'has_figures')::boolean = false and j->'revenue' = 'null'::jsonb, '[RPT-010] a day not yet closed has no figures, not zeros');

  -- Another hotel's manager cannot read this hotel's figures.
  perform t.login('adminB');
  perform t.raises(format('select public.owner_figures(%L)', t.id('propA')), 'E_FORBIDDEN', '[RPT-010] another hotel is refused');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('owner figures', sqlerrm);
end $$;

rollback;
