-- [HK-007] Minibar: the price list, an attendant logging use from the room, and front desk confirming the charge.
begin;

do $$
declare v_r uuid; v_f uuid; v_water uuid; v_cola uuid; v_req uuid; v_req2 uuid; v_tx uuid;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '196', t.id('std'), '1', true);
  v_water := public.save_minibar_item(t.id('propA'), null, 'Water', 500, true);
  v_cola  := public.save_minibar_item(t.id('propA'), null, 'Cola', 1200.50, true);
  perform t.ok(v_water is not null and v_cola is not null, '[HK-007] a manager saves minibar items with prices');
  perform t.raises(format('select public.save_minibar_item(%L, null, ''water'', 600, true)', t.id('propA')), 'E_DUPLICATE', '[HK-007] two items cannot share a name');
  perform t.raises(format('select public.save_minibar_item(%L, null, ''Free'', 0, true)', t.id('propA')), 'E_INVALID', '[HK-007] a price must be above zero');
  perform t.admin();

  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('196'), null, null);
  perform t.raises(format('select public.save_minibar_item(%L, null, ''Juice'', 700, true)', t.id('propA')), 'E_FORBIDDEN', '[HK-007] front desk cannot change the price list');
  perform t.admin();

  perform t.login('att');
  perform t.ok(exists (select 1 from public.list_minibar_rooms(t.id('propA')) where room_number = '196'), '[HK-007] the attendant sees rooms with a guest in house');
  perform t.ok(not exists (select 1 from public.list_minibar_rooms(t.id('propA')) where room_number = '103'), '[HK-007] empty rooms are not listed');
  v_req := public.record_minibar_use(t.room('196'), jsonb_build_array(
    jsonb_build_object('item_id', v_water, 'qty', 2), jsonb_build_object('item_id', v_cola, 'qty', 1)), 'mb-key-1');
  perform t.admin();
  perform t.eq((select charge_amount from public.service_requests where id = v_req), 2200.50, '[HK-007] the database prices the use (2 x 500 + 1,200.50)');
  perform t.eq((select status from public.service_requests where id = v_req), 'open', '[HK-007] the request waits for front desk, nothing is on the folio yet');
  perform t.ok((select description from public.service_requests where id = v_req) like 'Minibar: 2 x Water, 1 x Cola%', '[HK-007] the request lists what was used');
  perform t.eq((select count(*)::int from public.folio_transactions where folio_id = t.main_folio(v_r) and description like 'Minibar%'), 0, '[HK-007] nothing posts before confirmation');

  perform t.login('att');
  perform t.eq(public.record_minibar_use(t.room('196'), jsonb_build_array(
    jsonb_build_object('item_id', v_water, 'qty', 2), jsonb_build_object('item_id', v_cola, 'qty', 1)), 'mb-key-1'), v_req, '[HK-007] a repeat with the same key returns the first request');
  perform t.raises(format('select public.complete_service_request(%L)', v_req), 'E_FORBIDDEN', '[HK-007] the attendant cannot confirm their own charge');
  perform t.raises(format('select public.record_minibar_use(%L, ''[{"item_id":"%s","qty":0}]''::jsonb, ''mb-key-2'')', t.room('196'), v_water), 'E_INVALID', '[HK-007] quantity must be at least one');
  perform t.raises(format('select public.record_minibar_use(%L, ''[]''::jsonb, ''mb-key-3'')', t.room('101')), 'E_INVALID', '[HK-007] at least one item is needed');
  perform t.admin();
  perform t.eq((select count(*)::int from public.service_requests where reservation_id = v_r), 1, '[HK-007] the repeat did not create a second request');

  perform t.login('fdo');
  v_tx := public.complete_service_request(v_req);
  perform t.admin();
  perform t.ok(v_tx is not null, '[HK-007] front desk confirms and the charge posts to the folio');
  perform t.eq((select amount from public.folio_transactions where id = v_tx), 2200.50, '[HK-007] the folio gets the priced total');

  -- An empty room cannot be charged.
  perform t.login('att');
  perform t.raises(format('select public.record_minibar_use(%L, ''[{"item_id":"%s","qty":1}]''::jsonb, ''mb-key-4'')', t.room('103'), v_water), 'E_INVALID', '[HK-007] a room with no guest in house cannot be charged');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('minibar', sqlerrm);
end $$;

rollback;
