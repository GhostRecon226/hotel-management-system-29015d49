-- FIN-021: collections follow-up. A guest who left owing money (an approved unpaid check-out, a cancellation fee or a
-- no-show fee) stays on a work list until the bill is paid. Staff log each chase: called, promised to pay by a date,
-- unreachable, disputed, or a plain note. The balance always comes from the ledger. Notes never move money.

create table public.collection_notes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id),
  property_id    uuid not null references public.properties(id),
  folio_id       uuid not null references public.folios(id),
  reservation_id uuid references public.reservations(id),
  outcome        text not null check (outcome in ('called', 'promised', 'unreachable', 'disputed', 'note')),
  note           text not null check (char_length(note) between 1 and 1000),
  promised_date  date,
  business_date  date not null,
  created_by     uuid not null default auth.uid(),
  created_at     timestamptz not null default clock_timestamp()
);
create index collection_notes_folio_idx on public.collection_notes(folio_id, created_at desc);
create index collection_notes_property_idx on public.collection_notes(property_id);
alter table public.collection_notes enable row level security;
revoke all on public.collection_notes from public, anon, authenticated;
grant select on public.collection_notes to authenticated;
grant all on public.collection_notes to service_role;
create policy collection_notes_read on public.collection_notes for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('rpt.finance.view', property_id));

-- The work list: departed guests with an unpaid balance, with the latest chase and the next action date.
-- Next action: no note yet = now. A promise that is still ahead = the day after the promised date. Otherwise 7 days
-- after the last note. A note logged after a broken promise starts the 7 days again.
create or replace function public.collections_list(p_property_id uuid)
returns table(folio_id uuid, folio_number text, reservation_id uuid, reservation_number text, guest_id uuid, guest_name text,
  phone text, email text, departure_date date, days_overdue integer, currency char(3), balance numeric,
  notes_count bigint, last_outcome text, last_note text, last_note_date date, promised_date date,
  next_action_date date, follow_up_due boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_today date; v_contact boolean;
begin
  perform app.require_report('rpt.finance.view', p_property_id);
  select p.business_date into v_today from public.properties p where p.id = p_property_id;
  v_contact := app.can('guest.view', p_property_id);
  return query
  with b as (
    select * from public.v_folio_balances x
    where x.property_id = p_property_id and x.balance > 0 and x.reservation_status in ('checked_out', 'no_show', 'cancelled')
  ), n as (
    select c.folio_id as fid, count(*) as cnt,
      (array_agg(c.outcome order by c.created_at desc, c.id desc))[1] as last_outcome,
      (array_agg(c.note order by c.created_at desc, c.id desc))[1] as last_note,
      max(c.business_date) as last_date,
      (array_agg(c.promised_date order by c.created_at desc, c.id desc) filter (where c.promised_date is not null))[1] as promised
    from public.collection_notes c where c.property_id = p_property_id group by c.folio_id
  ), r as (
    select b.folio_id, b.number, b.reservation_id, b.reservation_number, b.guest_id, b.guest_name,
      case when v_contact then g.phone end as phone, case when v_contact then g.email end as email,
      b.departure_date, greatest(v_today - b.departure_date, 0) as days_overdue, b.currency, b.balance::numeric as balance,
      coalesce(n.cnt, 0) as cnt, n.last_outcome, n.last_note, n.last_date, n.promised,
      case when n.cnt is null then v_today
           when n.promised is not null and n.last_date <= n.promised then n.promised + 1
           else n.last_date + 7 end as next_action
    from b left join n on n.fid = b.folio_id left join public.guests g on g.id = b.guest_id
  )
  select r.folio_id, r.number, r.reservation_id, r.reservation_number, r.guest_id, r.guest_name, r.phone, r.email,
    r.departure_date, r.days_overdue::integer, r.currency, r.balance, r.cnt, r.last_outcome, r.last_note, r.last_date,
    r.promised, r.next_action, r.next_action <= v_today
  from r order by (r.next_action <= v_today) desc, r.balance desc, r.departure_date;
end $$;

-- Log one chase. Needs the right to take payments at the property. The bill must be unpaid and the guest must have left.
create or replace function public.add_collection_note(p_folio_id uuid, p_outcome text, p_note text, p_promised_date date default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.folios; r public.reservations; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_today date; v_id uuid;
begin
  perform app.assert_writable();
  select * into f from public.folios where id = p_folio_id and tenant_id = app.my_tenant();
  if f.id is null or not app.can('fin.folio.view', f.property_id) then perform app.fail('E_NOT_FOUND', 'Folio not found.'); end if;
  perform app.require('fin.payment.post', f.property_id);
  if v_note is null then perform app.fail('E_REQUIRED', 'Write what happened.'); end if;
  if p_outcome is null or p_outcome not in ('called', 'promised', 'unreachable', 'disputed', 'note') then
    perform app.fail('E_INVALID', 'Choose called, promised, unreachable, disputed or note.'); end if;
  select business_date into v_today from public.properties where id = f.property_id;
  if p_outcome = 'promised' then
    if p_promised_date is null then perform app.fail('E_REQUIRED', 'Choose the date the guest promised to pay.'); end if;
    if p_promised_date < v_today then perform app.fail('E_INVALID', 'The promised date cannot be in the past.'); end if;
  end if;
  select * into r from public.reservations where id = f.reservation_id;
  if r.status not in ('checked_out', 'no_show', 'cancelled') then perform app.fail('E_INVALID', 'This guest has not left yet.'); end if;
  if app.folio_balance(f.id) <= 0 then perform app.fail('E_INVALID', 'This bill has nothing left to collect.'); end if;
  insert into public.collection_notes(tenant_id, property_id, folio_id, reservation_id, outcome, note, promised_date, business_date)
  values (f.tenant_id, f.property_id, f.id, f.reservation_id, p_outcome, v_note,
    case when p_outcome = 'promised' then p_promised_date end, v_today)
  returning id into v_id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (f.tenant_id, auth.uid(), 'collection_note', 'collection_notes', v_id::text, jsonb_build_object('folio_id', f.id, 'outcome', p_outcome));
  return v_id;
end $$;

revoke all on function public.collections_list(uuid), public.add_collection_note(uuid, text, text, date) from public, anon;
grant execute on function public.collections_list(uuid), public.add_collection_note(uuid, text, text, date) to authenticated;
