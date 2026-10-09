-- Group booking screen (RES-012) and the arrival-ready flag on the arrivals list (RES-013).
-- 1. v_arrivals gains arrival_ready (added at the end, nothing else changes).
-- 2. list_group_bookings and get_group_booking: groups with their rooms, nights and totals, figures from the database.
-- 3. set_group_booking_status: cancel or reactivate the group record. A group with live bookings cannot be cancelled,
--    so cancelling a group never cancels guests' bookings behind anyone's back.

create or replace view public.v_arrivals with (security_invoker = true) as
SELECT r.id,
    r.property_id,
    r.number,
    r.guest_id,
    NULLIF(btrim(((COALESCE(g.first_name, ''::text) || ' '::text) || COALESCE(g.last_name, ''::text))), ''::text) AS guest_name,
    g.phone AS guest_phone,
    r.arrival_date,
    r.departure_date,
    (r.departure_date - r.arrival_date) AS nights,
    r.adults,
    r.children,
    r.room_type_id,
    rt.code AS room_type_code,
    rt.name AS room_type_name,
    r.rate_plan_id,
    r.status,
    r.hold_until,
    r.company_name,
    r.special_requests,
    r.total_amount,
    r.currency,
    r.deposit_required,
    app.deposit_paid(r.id) AS deposit_paid,
    a.room_id,
    rm.room_number,
    rm.condition AS room_condition,
    rm.is_occupied AS room_is_occupied,
    ((rm.id IS NOT NULL) AND rm.is_active AND (rm.condition = ANY (ARRAY['clean'::text, 'inspected'::text])) AND (NOT rm.is_occupied)) AS room_is_ready,
    (r.arrival_date < p.business_date) AS is_late,
    GREATEST((r.deposit_required - app.deposit_paid(r.id)), (0)::numeric) AS deposit_due,
    r.arrival_ready
   FROM (((((reservations r
     JOIN properties p ON ((p.id = r.property_id)))
     JOIN room_types rt ON ((rt.id = r.room_type_id)))
     LEFT JOIN guests g ON ((g.id = r.guest_id)))
     LEFT JOIN LATERAL ( SELECT x.room_id
           FROM room_assignments x
          WHERE ((x.reservation_id = r.id) AND x.is_active)
         LIMIT 1) a ON (true))
     LEFT JOIN rooms rm ON ((rm.id = a.room_id)))
  WHERE ((r.status = ANY (ARRAY['tentative'::text, 'confirmed'::text])) AND (r.arrival_date <= p.business_date) AND ((r.departure_date > p.business_date) OR ((r.departure_date = p.business_date) AND (r.arrival_date = p.business_date))));

grant select on public.v_arrivals to authenticated, service_role;

create or replace function public.list_group_bookings(p_property_id uuid, p_status text default null)
returns table(id uuid, name text, contact_name text, contact_phone text, status text, rooms bigint, nights bigint,
  first_arrival date, last_departure date, total_amount numeric, currency char(3))
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_cur char(3);
begin
  if not app.can('res.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view reservations.'); end if;
  select pr.base_currency into v_cur from public.properties pr where pr.id = p_property_id and pr.tenant_id = app.my_tenant();
  return query
  select g.id, g.name, g.contact_name, g.contact_phone, g.status,
    count(r.id) filter (where r.status not in ('cancelled', 'no_show')),
    coalesce(sum(r.departure_date - r.arrival_date) filter (where r.status not in ('cancelled', 'no_show')), 0)::bigint,
    min(r.arrival_date) filter (where r.status not in ('cancelled', 'no_show')),
    max(r.departure_date) filter (where r.status not in ('cancelled', 'no_show')),
    coalesce(sum(r.total_amount) filter (where r.status not in ('cancelled', 'no_show') and r.currency = v_cur), 0)::numeric,
    v_cur
  from public.group_bookings g
  left join public.reservations r on r.group_id = g.id
  where g.property_id = p_property_id and g.tenant_id = app.my_tenant() and (p_status is null or g.status = p_status)
  group by g.id
  order by g.status, g.name;
end $$;

create or replace function public.get_group_booking(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare g public.group_bookings; v_cur char(3); v_fin boolean; v_bal numeric;
begin
  select * into g from public.group_bookings where id = p_id and tenant_id = app.my_tenant();
  if g.id is null or not app.can('res.view', g.property_id) then perform app.fail('E_NOT_FOUND', 'Group not found.'); end if;
  select base_currency into v_cur from public.properties where id = g.property_id;
  v_fin := app.can('fin.folio.view', g.property_id);
  if v_fin then
    select coalesce(sum(b.balance), 0)::numeric into v_bal from public.v_folio_balances b
    join public.reservations r on r.id = b.reservation_id
    where r.group_id = g.id and r.status not in ('cancelled', 'no_show') and b.currency = v_cur and b.balance > 0;
  end if;
  return jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'property_id', g.property_id, 'name', g.name, 'contact_name', g.contact_name,
      'contact_phone', g.contact_phone, 'notes', g.notes, 'status', g.status, 'created_at', g.created_at),
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'number', r.number,
        'guest_name', nullif(btrim(coalesce(gu.first_name, '') || ' ' || coalesce(gu.last_name, '')), ''),
        'arrival_date', r.arrival_date, 'departure_date', r.departure_date, 'status', r.status, 'room_type_code', rt.code,
        'room_number', (select rm.room_number from public.room_assignments a join public.rooms rm on rm.id = a.room_id
                        where a.reservation_id = r.id and a.is_active limit 1),
        'total_amount', r.total_amount, 'currency', r.currency, 'arrival_ready', r.arrival_ready)
        order by r.arrival_date, r.number)
      from public.reservations r join public.room_types rt on rt.id = r.room_type_id left join public.guests gu on gu.id = r.guest_id
      where r.group_id = g.id), '[]'::jsonb),
    'totals', jsonb_build_object(
      'currency', v_cur,
      'rooms', (select count(*) from public.reservations r where r.group_id = g.id and r.status not in ('cancelled', 'no_show')),
      'nights', (select coalesce(sum(r.departure_date - r.arrival_date), 0) from public.reservations r where r.group_id = g.id and r.status not in ('cancelled', 'no_show')),
      'total_amount', (select coalesce(sum(r.total_amount), 0) from public.reservations r where r.group_id = g.id and r.status not in ('cancelled', 'no_show') and r.currency = v_cur),
      'deposit_required', (select coalesce(sum(r.deposit_required), 0) from public.reservations r where r.group_id = g.id and r.status not in ('cancelled', 'no_show') and r.currency = v_cur),
      'balance_due', case when v_fin then to_jsonb(v_bal) else 'null'::jsonb end));
end $$;

create or replace function public.set_group_booking_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.group_bookings; v_live int;
begin
  select * into g from public.group_bookings where id = p_id and tenant_id = app.my_tenant();
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Group not found.'); end if;
  perform app.require('res.group.manage', g.property_id);
  if p_status is null or p_status not in ('active', 'cancelled') then perform app.fail('E_INVALID', 'Choose active or cancelled.'); end if;
  if p_status = 'cancelled' then
    select count(*) into v_live from public.reservations r where r.group_id = g.id and r.status in ('tentative', 'confirmed', 'checked_in');
    if v_live > 0 then
      perform app.fail('E_GROUP_HAS_BOOKINGS', format('This group still has %s live booking%s. Cancel or move them first.', v_live, case when v_live = 1 then '' else 's' end));
    end if;
  end if;
  if g.status <> p_status then
    update public.group_bookings set status = p_status where id = g.id;
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after)
    values (g.tenant_id, auth.uid(), 'set_group_booking_status', 'group_bookings', g.id::text,
      jsonb_build_object('status', g.status), jsonb_build_object('status', p_status));
  end if;
end $$;

revoke all on function public.list_group_bookings(uuid, text), public.get_group_booking(uuid), public.set_group_booking_status(uuid, text) from public, anon;
grant execute on function public.list_group_bookings(uuid, text), public.get_group_booking(uuid), public.set_group_booking_status(uuid, text) to authenticated;
