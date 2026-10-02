-- Pins every worked example in docs/accountant-brief.md. If a tax rule changes, this fails and the brief must change too.
begin;

do $$
declare v_r uuid; v_f uuid; v_tx uuid; v_d uuid; j jsonb; r record; v_lines text;
begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, '198', t.id('std'), '1', true);
  perform t.admin();
  -- Defaults a new Nigerian hotel starts with
  perform t.eq((select string_agg(code || ' ' || percent::text || case when compounds_on_previous then ' on net+previous' else ' on net' end, ', ' order by sort_order)
    from public.tax_rates where property_id = t.id('propA')), 'SVC 10.0000 on net, VAT 7.5000 on net+previous, LEVY 0.0000 on net', '[brief] default rates and how each is applied');
  perform t.ok((select bool_and(description ilike 'UNVERIFIED%') from public.tax_rates where property_id = t.id('propA')), '[brief] every default is marked unverified');
  perform t.eq((select string_agg(code, ',' order by code) from public.charge_codes where property_id = t.id('propA') and not is_taxable and category <> 'tax'), 'CXLFEE,NOSHOW',
    '[brief] cancellation and no-show fees carry no tax; every other charge carries all three');

  -- Example 1: a 10,000 dinner, price entered without tax
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('198'), null, null);
  v_f := t.main_folio(v_r);
  v_tx := public.post_charge(v_f, t.cc('REST'), 10000, false, 'Dinner', null, 'brief-1');
  perform t.admin();
  select string_agg(tax_code || ' ' || amount::text, ', ' order by line_no) into v_lines from public.folio_tax_lines where transaction_id = v_tx;
  perform t.eq(v_lines, 'SVC 1000.0000, VAT 825.0000, LEVY 0.0000', '[brief] example 1: service charge 1,000, VAT 825 (7.5% of 11,000), levy 0');
  perform t.eq(app.tx_total(v_tx), 11825.0000, '[brief] example 1: guest pays 11,825');

  -- Example 2: a 10% discount (1,182.50) takes 10% off the net and off each tax
  perform t.login('fdo');
  j := public.apply_discount(v_tx, 1182.50, 'Brief', 'brief-d1');
  perform t.admin();
  v_d := (j->>'transaction_id')::uuid;
  perform t.eq((select amount from public.folio_transactions where id = v_d), -1000.0000, '[brief] example 2: the discount lowers the net by 1,000');
  select string_agg(tax_code || ' ' || amount::text, ', ' order by line_no) into v_lines from public.folio_tax_lines where transaction_id = v_d;
  perform t.eq(v_lines, 'SVC -100.0000, VAT -82.5000, LEVY 0.0000', '[brief] example 2: and the service charge by 100 and VAT by 82.50');
  perform t.eq(app.folio_balance(v_f), 10642.5000, '[brief] example 2: guest pays 10,642.50');

  -- Example 3: a price that already includes tax
  select string_agg(tax_code || ' ' || amount::text, ', ' order by line_no) into v_lines from public.calculate_tax(t.id('propA'), 11825, true);
  perform t.eq(v_lines, 'SVC 1000.00, VAT 825.00, LEVY 0.00', '[brief] example 3: 11,825 including tax is 10,000 net plus the same taxes');

  -- Example 4: rounding on an odd amount (the 1 kobo goes on the last tax with a rate)
  select string_agg(tax_code || ' ' || amount::text, ', ' order by line_no) into v_lines from public.calculate_tax(t.id('propA'), 7777.77, false);
  perform t.eq(v_lines, 'SVC 777.78, VAT 641.66, LEVY 0.00', '[brief] example 4: 7,777.77 gives service charge 777.78 and VAT 641.66 (641.67 before the rounding remainder)');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('accountant brief', sqlerrm);
end $$;

rollback;
