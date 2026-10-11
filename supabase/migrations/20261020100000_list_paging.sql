-- PAG-001: long lists load a page at a time.
-- Guest search, booking search and the audit log each gain p_offset (default 0), so the app can ask for the next
-- page. The old signatures are dropped first so a call that leaves p_offset out still finds one function.
-- Guest and booking order now ends on the id, so two rows that tie on date or name never swap between pages.

drop function if exists public.search_guests(text, integer);
create function public.search_guests(p_query text, p_limit integer default 50, p_offset integer default 0)
returns table(id uuid, first_name text, last_name text, phone text, email text, nationality text,
              anonymised_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := lower(btrim(coalesce(p_query, ''))); v_digits text; v_lim int;
begin
  if not app.can('guest.view', null) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view guests.'); end if;
  v_lim := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_digits := regexp_replace(v_q, '\D', '', 'g');
  return query
  select g.id, g.first_name, g.last_name, g.phone, g.email, g.nationality, g.anonymised_at, g.created_at
  from public.guests g
  where g.tenant_id = app.my_tenant() and g.status = 'active'
    and (v_q = ''
      or lower(g.first_name || ' ' || g.last_name) like '%' || v_q || '%'
      or lower(g.last_name || ' ' || g.first_name) like '%' || v_q || '%'
      or lower(coalesce(g.email, '')) like '%' || v_q || '%'
      or (length(v_digits) >= 3 and regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'))
  order by case when v_q = '' then null else lower(g.last_name) end, g.created_at desc, g.id
  limit v_lim offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.search_guests(text, integer, integer) from public, anon;
grant execute on function public.search_guests(text, integer, integer) to authenticated;

drop function if exists public.search_reservations(uuid, text, text, date, date, integer);
create function public.search_reservations(p_property_id uuid, p_query text default '', p_status text default null,
  p_from date default null, p_to date default null, p_limit integer default 100, p_offset integer default 0)
returns table(id uuid, number text, guest_id uuid, guest_name text, arrival_date date, departure_date date,
  room_type_code text, room_number text, status text, source text, company_name text, hold_until timestamptz,
  total_amount numeric, currency text, adults integer, children integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := lower(btrim(coalesce(p_query, '')));
begin
  if not app.can('res.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view reservations.'); end if;
  return query
  select r.id, r.number, r.guest_id, btrim(g.first_name || ' ' || g.last_name), r.arrival_date, r.departure_date,
    rt.code, (select rm.room_number from public.room_assignments a join public.rooms rm on rm.id = a.room_id
              where a.reservation_id = r.id and a.is_active limit 1),
    r.status, r.source, r.company_name, r.hold_until, r.total_amount::numeric, r.currency::text, r.adults, r.children
  from public.reservations r
  join public.guests g on g.id = r.guest_id
  join public.room_types rt on rt.id = r.room_type_id
  where r.property_id = p_property_id and r.tenant_id = app.my_tenant()
    and (p_status is null or r.status = p_status)
    and (p_from is null or r.departure_date > p_from)
    and (p_to is null or r.arrival_date <= p_to)
    and (v_q = '' or lower(r.number) like '%' || v_q || '%'
      or lower(g.first_name || ' ' || g.last_name) like '%' || v_q || '%'
      or lower(coalesce(r.company_name, '')) like '%' || v_q || '%'
      or lower(coalesce(g.phone, '')) like '%' || v_q || '%')
  order by r.arrival_date, r.number, r.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.search_reservations(uuid, text, text, date, date, integer, integer) from public, anon;
grant execute on function public.search_reservations(uuid, text, text, date, date, integer, integer) to authenticated;

drop function if exists public.audit_log(uuid, text, text, date, date, integer);
create function public.audit_log(
  p_actor uuid default null,
  p_table text default null,
  p_action text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 200,
  p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  v_tenant := app.my_tenant();
  if v_tenant is null or not app.can('adm.audit.view', null) then
    perform app.fail('E_FORBIDDEN', 'You cannot view the audit log.');
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc, t.id)
    from (
      select a.id, a.action, a.table_name, a.record_id, a.before, a.after, a.reason, a.created_at,
             a.actor_id, coalesce(p.full_name, 'System') as actor_name
      from public.audit_events a
      left join public.profiles p on p.id = a.actor_id
      where a.tenant_id = v_tenant
        and (p_actor is null or a.actor_id = p_actor)
        and (p_table is null or a.table_name = p_table)
        and (p_action is null or a.action = p_action)
        and (p_from is null or a.created_at >= p_from::timestamptz)
        and (p_to is null or a.created_at < (p_to + 1)::timestamptz)
      order by a.created_at desc, a.id
      limit greatest(1, least(coalesce(p_limit, 200), 500)) offset greatest(coalesce(p_offset, 0), 0)
    ) t), '[]'::jsonb);
end $$;
revoke all on function public.audit_log(uuid, text, text, date, date, integer, integer) from public, anon;
grant execute on function public.audit_log(uuid, text, text, date, date, integer, integer) to authenticated;
