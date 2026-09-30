-- Money figures the screens show come from the database, not from sums in the browser
-- (status report S9, Peter's adjustment 4). Each figure must equal what the database itself does.
begin;

-- Tax preview on the Post charge form = what post_charge posts.
do $$
declare j jsonb; v_res uuid; v_f uuid; v_tx uuid; v_posted numeric;
begin
  perform t.login('fdo');
  j := public.preview_charge(t.id('propA'), 10000, false);
  perform t.eq((j->>'net')::numeric, 10000.00, '[S9] charge preview: net of an exclusive 10,000');
  perform t.eq((j->>'tax')::numeric, 1825.00, '[S9] charge preview: tax');
  perform t.eq((j->>'total')::numeric, 11825.00, '[S9] charge preview: total');
  perform t.eq(jsonb_array_length(j->'lines'), 3, '[S9] charge preview: one line per tax');
  j := public.preview_charge(t.id('propA'), 11825, true);
  perform t.eq((j->>'net')::numeric, 10000.00, '[S9] charge preview: inclusive 11,825 solves back to 10,000 net');
  perform t.eq((j->>'total')::numeric, 11825.00, '[S9] charge preview: inclusive total stays 11,825');
  v_res := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('101'), null, null);
  v_f := t.main_folio(v_res);
  v_tx := public.post_charge(v_f, t.cc('REST'), 7777.77, false, 'Odd amount', null, 'sf-1');
  select total into v_posted from public.v_folio_transactions where id = v_tx;
  perform t.eq((public.preview_charge(t.id('propA'), 7777.77, false)->>'total')::numeric, v_posted, '[S9] charge preview total equals the posted row for an odd amount');
  perform t.login('hks');
  perform t.raises(format('select public.preview_charge(%L, 100, false)', t.id('propB')), 'E_FORBIDDEN', '[S9] charge preview only for your own properties');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('charge preview', sqlerrm);
end $$;

-- Fee preview on Cancel / No-show = what the action charges.
do $$
declare v_far uuid; v_near uuid; v_due uuid; j jsonb; c jsonb;
begin
  perform t.login('fom');
  v_far := t.book(t.id('g2'), t.bdate() + 14, t.bdate() + 16, t.id('std'), t.id('bar'));
  j := public.preview_reservation_fee(v_far, 'cancel');
  perform t.eq((j->>'fee')::numeric, 0::numeric, '[S9][6d] cancel preview is free inside the free-cancellation window');
  perform t.ok((j->>'free')::boolean, '[S9] and says it is free');
  c := public.cancel_reservation(v_far, 'Plans changed', false, null);
  perform t.eq((c->>'charged')::numeric, (j->>'fee')::numeric, '[S9] cancel charges exactly the previewed fee (free)');
  v_near := t.book(t.id('g2'), t.bdate() + 1, t.bdate() + 3, t.id('std'), t.id('bar'));
  j := public.preview_reservation_fee(v_near, 'cancel');
  perform t.eq((j->>'fee')::numeric, 50000::numeric, '[S9] cancel preview is one night close to arrival');
  c := public.cancel_reservation(v_near, 'Late change', false, null);
  perform t.eq((c->>'charged')::numeric, (j->>'fee')::numeric, '[S9] cancel charges exactly the previewed fee (one night)');
  v_due := t.book(t.id('g3'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  j := public.preview_reservation_fee(v_due, 'no_show');
  c := public.mark_no_show(v_due, 'Did not arrive', false, null);
  perform t.eq((c->>'charged')::numeric, (j->>'fee')::numeric, '[S9] no-show charges exactly the previewed fee');
  perform t.login('hks');
  perform t.raises(format('select public.preview_reservation_fee(%L, %L)', v_due, 'cancel'), 'E_FORBIDDEN|E_NOT_FOUND', '[S9] fee preview needs access to bookings');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('fee preview', sqlerrm);
end $$;

-- Check-out outstanding, deposit due, amount due and credit.
do $$
declare v_res uuid; v_f1 uuid; v_f2 uuid; v_dep uuid; v_tx uuid;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('102'), null, null);
  v_f1 := t.main_folio(v_res);
  perform public.post_charge(v_f1, t.cc('REST'), 10000, false, 'Dinner', null, 'sf-2');
  v_f2 := public.split_folio(v_f1, 'Extras', null, null, 'sf-split');
  perform public.post_payment(v_f2, t.pm('CASH'), 3000, 'NGN', false, null, null, 'sf-3');
  perform t.eq(public.checkout_outstanding(v_res), 11825 + 3000::numeric, '[S9] check-out outstanding = what is owed plus what is owed back, across folios');
  perform t.eq((select amount_due from public.v_folio_balances where folio_id = v_f1), 11825.0000, '[S9] amount due on a folio that owes');
  perform t.eq((select credit from public.v_folio_balances where folio_id = v_f1), 0.0000, '[S9] no credit on it');
  perform t.eq((select amount_due from public.v_folio_balances where folio_id = v_f2), 0.0000, '[S9] no amount due on a folio in credit');
  perform t.eq((select credit from public.v_folio_balances where folio_id = v_f2), 3000.0000, '[S9] credit on a folio the hotel owes');
  v_dep := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('prepaid'), null, 'confirmed', 1, 'deposit');
  perform t.eq((select deposit_due from public.v_arrivals where id = v_dep), 50000.0000, '[S9] deposit due before any deposit');
  perform public.post_payment(public.open_main_folio(v_dep), t.pm('CASH'), 20000, 'NGN', true, 'Deposit', null, 'sf-dep');
  perform t.eq((select deposit_due from public.v_arrivals where id = v_dep), 30000.0000, '[S9] deposit due after a part deposit');
  perform t.login('hks');
  perform t.raises(format('select public.checkout_outstanding(%L)', v_res), 'E_FORBIDDEN|E_NOT_FOUND', '[S9] check-out outstanding needs folio access');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('balances', sqlerrm);
end $$;

-- Period KPIs on the dashboard use the same definitions as the daily figures.
do $$
declare j jsonb;
begin
  perform t.admin();
  insert into public.daily_stats(tenant_id, property_id, business_date, rooms_available, rooms_sold, room_revenue, total_revenue, arrivals, departures, no_shows, cancellations)
  values (t.id('tenantA'), t.id('propA'), t.bdate() - 2, 4, 3, 150000, 170000, 1, 1, 0, 0),
         (t.id('tenantA'), t.id('propA'), t.bdate() - 1, 4, 1, 50000, 60000, 0, 2, 0, 0);
  perform t.login('fom');
  j := public.kpi_summary(t.id('propA'), t.bdate() - 2, t.bdate() - 1);
  perform t.eq((j->>'rooms_sold')::int, 4, '[S9] period rooms sold');
  perform t.eq((j->>'rooms_available')::int, 8, '[S9] period rooms available');
  perform t.eq((j->>'occupancy')::numeric, 0.5000, '[S9] period occupancy = sold / available');
  perform t.eq((j->>'adr')::numeric, 50000.00, '[S9] period ADR = room revenue / rooms sold');
  perform t.eq((j->>'revpar')::numeric, 25000.00, '[S9] period RevPAR = room revenue / rooms available');
  perform t.login('att');
  perform t.raises(format('select public.kpi_summary(%L, %L, %L)', t.id('propA'), t.bdate() - 2, t.bdate()), 'E_FORBIDDEN', '[S9] period KPIs need a report permission');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('kpi summary', sqlerrm);
end $$;

-- Maintenance: a pending block is "requested", only an approved one means "room blocked".
do $$
declare v_tk uuid; v_blk uuid;
begin
  perform t.login('hks');
  v_tk := public.create_ticket(t.id('propA'), 'Leak', null, t.room('201'), null, 'normal', t.id('mnt'));
  perform t.login('mnt');
  perform public.start_ticket(v_tk);
  v_blk := public.block_room_for_ticket(v_tk, 'out_of_order', t.bdate() + 30, t.bdate() + 31, 'Pipe');
  perform t.ok((select has_active_block and not has_approved_block from public.v_maintenance_tickets where id = v_tk), '[S9] a pending block shows as requested, not blocked');
  perform t.login('fom');
  perform public.approve_room_block(v_blk);
  perform t.ok((select has_approved_block from public.v_maintenance_tickets where id = v_tk), '[S9] an approved block shows as room blocked');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('block label', sqlerrm);
end $$;

rollback;
