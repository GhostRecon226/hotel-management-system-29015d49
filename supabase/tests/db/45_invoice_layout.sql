-- [FIN-019] An invoice carries check-in time, guests, nights, a total for each day and the receipt reference of each charge.
begin;

do $$
declare v_r uuid; v_f uuid; v_inv uuid; v_h jsonb; v_in timestamptz;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '196', t.id('std'), '1', true);
  perform t.admin();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('196'), null, null);
  v_f := t.main_folio(v_r);
  perform public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', 'BILL-1042', 'lay-1');
  perform public.post_charge(v_f, t.cc('REST'), 2000, false, 'Drinks', null, 'lay-2');
  perform t.admin();
  select checked_in_at into v_in from public.stays where reservation_id = v_r and status = 'in_house';
  perform t.login('acc');
  v_inv := public.issue_invoice(v_f, 'interim', 'lay-inv');
  perform t.admin();
  select header into v_h from public.invoices where id = v_inv;
  perform t.eq((v_h->>'nights')::int, 2, '[FIN-019] the invoice shows the number of nights');
  perform t.eq((v_h->>'adults')::int + (v_h->>'children')::int, (select adults + children from public.reservations where id = v_r), '[FIN-019] the invoice shows the number of guests');
  perform t.ok((v_h->>'checked_in_at')::timestamptz = v_in, '[FIN-019] the invoice shows the check-in time');
  perform t.eq((select l->>'reference' from public.invoices i, jsonb_array_elements(i.lines) l where i.id = v_inv and l->>'description' = 'Dinner'), 'BILL-1042', '[FIN-019] a charge shows its receipt reference');
  perform t.eq(jsonb_array_length(v_h->'day_totals'), 1, '[FIN-019] one day of charges gives one day total');
  perform t.eq(((v_h->'day_totals'->0)->>'total')::numeric, 14190.0000, '[FIN-019] the day total adds the net and the tax of every charge that day (11,825 + 2,365)');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('invoice layout', sqlerrm);
end $$;

rollback;
