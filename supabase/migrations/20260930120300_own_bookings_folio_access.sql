-- Folio access "own bookings only" (requirement FIN-015, remaining failure 3).
--
-- Before: anyone with fin.folio.view saw every guest's bill, so a reservation officer could read the
-- folios, payments and invoices of bookings made by colleagues.
-- After: grant level O (own records) on fin.folio.view means "folios of bookings I created". Level Y
-- still means every folio. The rule applies to every read (folios, rows, tax lines, invoices, approvals,
-- and the views built on them) and to every folio write. The Reservation Officer role moves to level O,
-- so reservation officers see and take deposits on their own bookings only.

-- Who may see a folio: full folio access, or own-records access to a booking they created.
create or replace function app.folio_scope_ok(p_property uuid, p_reservation uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app.can('fin.folio.view', p_property)
     and (coalesce(app.my_level('fin.folio.view', p_property), '') <> 'O'
          or exists (select 1 from public.reservations r where r.id = p_reservation and r.created_by = auth.uid()))
$$;

create or replace function app.folio_visible(p_folio uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select app.folio_scope_ok(f.property_id, f.reservation_id) from public.folios f where f.id = p_folio), false)
$$;

revoke all on function app.folio_scope_ok(uuid, uuid), app.folio_visible(uuid) from public, anon;
grant execute on function app.folio_scope_ok(uuid, uuid), app.folio_visible(uuid) to authenticated, service_role;

-- Read rules.
drop policy "Folio viewers read folios" on public.folios;
create policy "Folio viewers read folios" on public.folios for select to authenticated
  using (tenant_id = app.my_tenant() and app.folio_scope_ok(property_id, reservation_id));

drop policy "Folio viewers read transactions" on public.folio_transactions;
create policy "Folio viewers read transactions" on public.folio_transactions for select to authenticated
  using (tenant_id = app.my_tenant() and app.folio_visible(folio_id));

drop policy "Folio viewers read tax lines" on public.folio_tax_lines;
create policy "Folio viewers read tax lines" on public.folio_tax_lines for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('fin.folio.view', property_id)
         and exists (select 1 from public.folio_transactions t where t.id = transaction_id));

drop policy "Folio viewers read invoices" on public.invoices;
create policy "Folio viewers read invoices" on public.invoices for select to authenticated
  using (tenant_id = app.my_tenant() and app.folio_visible(folio_id));

drop policy "Folio viewers and requesters read approvals" on public.approvals;
create policy "Folio viewers and requesters read approvals" on public.approvals for select to authenticated
  using (tenant_id = app.my_tenant() and (requested_by = auth.uid() or app.folio_visible(folio_id)));

-- Reservation officers: own bookings only.
update public.role_permissions set grant_level = 'O'
where permission_key = 'fin.folio.view'
  and role_id = (select id from public.roles where tenant_id is null and code = 'RES');

-- Writes and documents follow the same rule.

CREATE OR REPLACE FUNCTION app.folio_for_write(p_folio uuid, p_perm text)
 RETURNS folios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios;
begin
  select * into f from public.folios where id = p_folio and tenant_id = app.my_tenant() for update;
  if f.id is null or not app.folio_scope_ok(f.property_id, f.reservation_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require(p_perm, f.property_id);
  if f.status <> 'open' then perform app.fail('E_FOLIO_CLOSED', 'Folio ' || f.number || ' is closed. Reopen it first.'); end if;
  return f;
end $function$;

CREATE OR REPLACE FUNCTION public.issue_invoice(p_folio_id uuid, p_kind text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios; r public.reservations; p public.properties; v_id uuid; v_bdate date;
  v_net numeric; v_tax numeric; v_pay numeric; v_split jsonb; v_lines jsonb; v_header jsonb;
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
      'is_reversed', v.is_reversed, 'is_transferred', v.is_transferred) order by v.posted_at), '[]'::jsonb)
    into v_lines
  from public.v_folio_transactions v where v.folio_id = f.id;

  select jsonb_build_object(
    'hotel', (select name from public.tenants where id = f.tenant_id), 'property', p.name, 'address', p.address, 'city', p.city,
    'country', p.country, 'folio_number', f.number, 'folio_label', f.label, 'reservation_number', r.number,
    'guest_name', (select nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') from public.guests g where g.id = f.guest_id),
    'company_name', r.company_name, 'arrival_date', r.arrival_date, 'departure_date', r.departure_date,
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

CREATE OR REPLACE FUNCTION public.open_main_folio(p_reservation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_id uuid;
begin
  select * into r from public.reservations where id = p_reservation_id and tenant_id = app.my_tenant();
  if r.id is null or not app.folio_scope_ok(r.property_id, r.id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  select id into v_id from public.folios where reservation_id = r.id and is_main;
  if v_id is not null then return v_id; end if;
  perform app.assert_writable(true);
  if not (app.can('fin.charge.post', r.property_id) or app.can('fin.payment.post', r.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to open folios.'); end if;
  if r.status in ('cancelled', 'no_show') then perform app.fail('E_INVALID', 'This booking is not active.'); end if;
  return app.ensure_main_folio(r.id);
end $function$;

CREATE OR REPLACE FUNCTION public.reopen_folio(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.folios;
begin
  perform app.assert_writable();
  select * into f from public.folios where id = p_id and tenant_id = app.my_tenant() for update;
  if f.id is null or not app.folio_scope_ok(f.property_id, f.reservation_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require('fin.folio.reopen', f.property_id);
  if f.status <> 'closed' then perform app.fail('E_INVALID', 'The folio is already open.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required to reopen a folio.'); end if;
  perform set_config('app.audit_reason', btrim(p_reason), true);
  update public.folios set status = 'open', closed_at = null, closed_by = null where id = f.id;
  perform set_config('app.audit_reason', '', true);
end $function$;
