-- [FIN-018] A hotel can match the tax method of a real folio using setup only.
-- Method: service charge 10%, VAT 7.5% and state tax 5%, each on the room price alone (none on another tax).
-- Food and drink carry no tax. Invented figures: room 45,000 plus bar 12,001 gives 67,126.
begin;

do $$
declare v_r uuid; v_f uuid; v_room_tx uuid; v_bar_tx uuid; v_lc uuid; v_bc uuid; v_lines text;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '197', t.id('std'), '1', true);
  -- Set the three rates the way the sample hotel uses them: all on the price alone
  perform public.save_tax_rate(t.id('propA'), (select id from public.tax_rates where property_id = t.id('propA') and code = 'SVC'), 'SVC', 'Service charge', 10, 1, false, 'Sample method', true);
  perform public.save_tax_rate(t.id('propA'), (select id from public.tax_rates where property_id = t.id('propA') and code = 'VAT'), 'VAT', 'VAT', 7.5, 2, false, 'Sample method', true);
  perform public.save_tax_rate(t.id('propA'), (select id from public.tax_rates where property_id = t.id('propA') and code = 'LEVY'), 'LEVY', 'State tax', 5, 3, false, 'Sample method', true);
  v_lc := public.save_charge_code(t.id('propA'), null, 'SAMPLEROOM', 'Room (sample)', 'room', true, true);
  v_bc := public.save_charge_code(t.id('propA'), null, 'SAMPLEBAR', 'Bar (sample)', 'food', false, true);
  perform t.admin();

  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('197'), null, null);
  v_f := t.main_folio(v_r);
  v_room_tx := public.post_charge(v_f, v_lc, 45000, false, 'Room', null, 'sample-room');
  v_bar_tx := public.post_charge(v_f, v_bc, 12001, false, 'Bar', null, 'sample-bar');
  perform t.admin();

  select string_agg(tax_code || ' ' || amount::text, ', ' order by line_no) into v_lines from public.folio_tax_lines where transaction_id = v_room_tx;
  perform t.eq(v_lines, 'SVC 4500.0000, VAT 3375.0000, LEVY 2250.0000', '[FIN-018] each tax is worked on the room price alone: 4,500 / 3,375 / 2,250');
  perform t.eq(app.tx_total(v_room_tx), 55125.0000, '[FIN-018] the room charge comes to 55,125');
  perform t.eq((select count(*) from public.folio_tax_lines where transaction_id = v_bar_tx)::int, 0, '[FIN-018] bar carries no tax lines');
  perform t.eq(app.tx_total(v_bar_tx), 12001.0000, '[FIN-018] bar stays 12,001');
  perform t.eq(app.folio_balance(v_f), 67126.0000, '[FIN-018] the bill totals 67,126');
exception when others then perform t.admin(); perform t.crash('folio sample method', sqlerrm);
end $$;

rollback;
