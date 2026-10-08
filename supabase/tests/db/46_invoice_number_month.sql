-- [FIN-020] Invoice numbers carry the year and month of the hotel's business date, then a count that restarts each month.
begin;

do $$
declare v_a text; v_b text; v_c text; v_d text; v_m text; v_next date;
begin
  perform t.admin();
  v_m := to_char(t.bdate(), 'YYYYMM');
  v_a := app.next_document_number(t.id('propA'), 'interim');
  v_b := app.next_document_number(t.id('propA'), 'interim');
  perform t.eq(left(v_a, 11), 'INT-' || v_m || '-', '[FIN-020] an interim number starts with INT, the year and month of the business date');
  perform t.ok(v_a ~ '^INT-[0-9]{6}-[0-9]{6}$', '[FIN-020] the shape is INT-YYYYMM-000001');
  perform t.eq(substr(v_a, 12)::int + 1, substr(v_b, 12)::int, '[FIN-020] the count runs on by one with no gap inside the month');
  v_c := app.next_document_number(t.id('propA'), 'invoice');
  perform t.ok(v_c ~ ('^INV-' || v_m || '-[0-9]{6}$'), '[FIN-020] a final invoice number has the same shape with INV');
  -- A new month restarts the count at 1
  v_next := (date_trunc('month', t.bdate()) + interval '1 month')::date;
  perform t.set_bdate(t.id('propA'), v_next);
  v_d := app.next_document_number(t.id('propA'), 'interim');
  perform t.eq(v_d, 'INT-' || to_char(v_next, 'YYYYMM') || '-000001', '[FIN-020] the count restarts at 1 in a new month');
  perform t.eq(app.next_document_number(t.id('propA'), 'interim'), 'INT-' || to_char(v_next, 'YYYYMM') || '-000002', '[FIN-020] and runs on from there');
  -- Reservation and folio numbers are not touched
  perform t.ok(app.next_document_number(t.id('propA'), 'reservation') !~ ('-' || to_char(v_next, 'YYYYMM') || '-'), '[FIN-020] reservation numbers carry no month');
  perform t.ok(app.next_document_number(t.id('propA'), 'folio') !~ ('-' || to_char(v_next, 'YYYYMM') || '-'), '[FIN-020] folio numbers carry no month');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('invoice number month', sqlerrm);
end $$;

rollback;
