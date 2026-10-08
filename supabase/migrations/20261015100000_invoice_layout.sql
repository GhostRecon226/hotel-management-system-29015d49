-- FIN-019: the invoice snapshot also carries check-in time, guests, nights, a total for each day and the receipt reference of each charge.
-- Older invoices stay as they were issued; the page shows the new parts only when they exist.
-- Function body: the latest issue_invoice (20260930120300) plus these additions only.

CREATE OR REPLACE FUNCTION public.issue_invoice(p_folio_id uuid, p_kind text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios; r public.reservations; p public.properties; v_id uuid; v_bdate date;
  v_net numeric; v_tax numeric; v_pay numeric; v_split jsonb; v_lines jsonb; v_header jsonb; v_days jsonb; v_stay public.stays;
begin
  perform app.assert_writable(true);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select id into v_id from public.invoices where tenant_id = app.my_tenant() and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  select * into f from public.folios where id = p_folio_id and tenant_id = app.my_tenant();
  if f.id is null or not app.folio_scope_ok(f.property_id, f.reservation_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require('fin.invoice.issue', f.property_id);
  if p_kind not in ('interim', 'final') then perform app.fail('E_INVALID', 'Choose interim or final.'); end if;
  if p_kind = 'final' and f.status <> 'closed' then
    perform app.fail('E_INVALID', 'A final invoice needs a closed folio. Issue an interim invoice instead.'); end if;
  select * into r from public.reservations where id = f.reservation_id;
  select * into p from public.properties where id = f.property_id;
  v_bdate := p.business_date;

  select coalesce(sum(t.base_amount) filter (where t.kind not in ('payment', 'refund')
           and not (t.kind in ('reversal', 'transfer') and t.payment_method_id is not null)), 0),
         coalesce(sum(t.base_amount) filter (where t.kind in ('payment', 'refund')
           or (t.kind in ('reversal', 'transfer') and t.payment_method_id is not null)), 0)
    into v_net, v_pay
  from public.folio_transactions t where t.folio_id = f.id;

  select coalesce(sum(x.amount), 0), coalesce(jsonb_agg(to_jsonb(x) order by x.line_no), '[]'::jsonb)
    into v_tax, v_split
  from (select min(l2.line_no) as line_no, l2.tax_code, max(l2.tax_name) as tax_name, l2.percent,
          sum(l2.taxable_base) as taxable_base, sum(l2.base_amount) as amount
        from public.folio_tax_lines l2 join public.folio_transactions t2 on t2.id = l2.transaction_id
        where t2.folio_id = f.id group by l2.tax_code, l2.percent) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'date', v.business_date, 'kind', v.kind,
      'description', coalesce(v.description, v.charge_code_name, v.payment_method_name, v.kind),
      'net', v.base_amount, 'tax', v.tax_amount, 'total', v.total, 'tax_lines', coalesce(v.tax_lines, '[]'::jsonb),
      'reference', v.reference, 'is_reversed', v.is_reversed, 'is_transferred', v.is_transferred) order by v.posted_at), '[]'::jsonb)
    into v_lines
  from public.v_folio_transactions v where v.folio_id = f.id;

  select coalesce(jsonb_agg(jsonb_build_object('date', d.business_date, 'net', d.net, 'tax', d.tax, 'total', d.total) order by d.business_date), '[]'::jsonb)
    into v_days
  from (select v.business_date, sum(v.base_amount) as net, sum(v.tax_amount) as tax, sum(v.total) as total
        from public.v_folio_transactions v
        where v.folio_id = f.id and v.kind not in ('payment', 'refund')
          and not (v.kind in ('reversal', 'transfer') and v.payment_method_id is not null)
        group by v.business_date) d;
  select * into v_stay from public.stays s where s.reservation_id = r.id and s.status in ('in_house', 'checked_out') order by s.checked_in_at desc limit 1;

  select jsonb_build_object(
    'hotel', (select name from public.tenants where id = f.tenant_id), 'property', p.name, 'address', p.address, 'city', p.city,
    'country', p.country, 'folio_number', f.number, 'folio_label', f.label, 'reservation_number', r.number,
    'guest_name', (select nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') from public.guests g where g.id = f.guest_id),
    'company_name', r.company_name, 'adults', r.adults, 'children', r.children, 'nights', r.departure_date - r.arrival_date,
    'checked_in_at', v_stay.checked_in_at, 'day_totals', v_days, 'arrival_date', r.arrival_date, 'departure_date', r.departure_date,
    'room_number', (select rm.room_number from public.stays s join public.rooms rm on rm.id = s.room_id
                    where s.reservation_id = r.id and s.status in ('in_house', 'checked_out') order by s.checked_in_at desc limit 1))
    into v_header;

  begin
    insert into public.invoices(tenant_id, property_id, folio_id, number, kind, currency, business_date, net_total, tax_total,
      gross_total, payments_total, balance, tax_split, lines, header, idempotency_key)
    values (f.tenant_id, f.property_id, f.id, app.next_document_number(f.property_id, case when p_kind = 'interim' then 'interim' else 'invoice' end), p_kind, f.currency, v_bdate,
      v_net, v_tax, v_net + v_tax, -v_pay, v_net + v_tax + v_pay, v_split, v_lines, v_header, p_idempotency_key)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.invoices where tenant_id = f.tenant_id and idempotency_key = p_idempotency_key;
  end;
  return v_id;
end $function$;

revoke all on function public.issue_invoice(uuid, text, text) from public, anon;
grant execute on function public.issue_invoice(uuid, text, text) to authenticated;
