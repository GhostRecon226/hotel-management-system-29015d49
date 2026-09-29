-- Rooms board and room blocks (out of order, out of service, hold).
-- Blocks run from from_date (first blocked night) to to_date (room back in use), like stays.

insert into public.permissions(key, description, module) values
  ('room.block.approve', 'Approve or reject room blocks', 'rooms')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'room.block.approve', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'FOM')
on conflict do nothing;

create table public.room_blocks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  room_id         uuid not null references public.rooms(id),
  block_type      text not null check (block_type in ('out_of_order', 'out_of_service', 'hold')),
  from_date       date not null,
  to_date         date not null,
  reason          text not null,
  ticket_id       uuid,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'released', 'cancelled')),
  requested_by    uuid default auth.uid(),
  approved_by     uuid,
  approved_at     timestamptz,
  decision_reason text,
  released_by     uuid,
  released_at     timestamptz,
  release_reason  text,
  created_at      timestamptz not null default now(),
  check (to_date > from_date)
);
create index room_blocks_room_idx on public.room_blocks(room_id, status);
create index room_blocks_property_idx on public.room_blocks(property_id, status);
alter table public.room_blocks add constraint room_blocks_no_overlap
  exclude using gist (room_id with =, daterange(from_date, to_date, '[)') with &&)
  where (status in ('pending', 'approved'));

grant select on public.room_blocks to authenticated;
grant all on public.room_blocks to service_role;
alter table public.room_blocks enable row level security;
create policy "Room viewers read blocks" on public.room_blocks for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('room.view', property_id));

create trigger room_blocks_enforce_writable before insert or update or delete on public.room_blocks
  for each row execute function app.enforce_writable();
create trigger audit_room_blocks after insert or update or delete on public.room_blocks
  for each row execute function app.audit_row();

create or replace function app.room_blocked(p_room uuid, p_from date, p_to date)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.room_blocks b
    where b.room_id = p_room and b.status = 'approved'
      and daterange(b.from_date, b.to_date, '[)') && daterange(p_from, p_to, '[)'))
$$;

create or replace function app.availability(p_property uuid, p_arrival date, p_departure date, p_exclude uuid default null)
returns table(room_type_id uuid, stay_date date, sellable integer, reserved integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select rt.id, d::date,
    (select count(*)::int from public.rooms rm
      where rm.room_type_id = rt.id and rm.is_active and rm.condition <> 'out_of_order'
        and not exists (select 1 from public.room_blocks b
          where b.room_id = rm.id and b.status = 'approved'
            and d::date >= b.from_date and d::date < b.to_date)),
    (select count(*)::int from public.reservation_nights n
      join public.reservations r on r.id = n.reservation_id
      where n.room_type_id = rt.id and n.stay_date = d::date
        and r.id is distinct from p_exclude
        and (r.status in ('confirmed', 'checked_in')
             or (r.status = 'tentative' and (r.hold_until is null or r.hold_until > now()))))
  from public.room_types rt
  cross join generate_series(p_arrival, p_departure - 1, interval '1 day') d
  where rt.property_id = p_property and rt.is_active
$$;

create or replace function app.check_block(rm public.rooms, p_from date, p_to date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_day date;
begin
  perform pg_advisory_xact_lock(hashtextextended('avail:' || rm.property_id::text || ':' || rm.room_type_id::text, 0));
  if exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, p_to, '[)')) then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' has a guest assigned on these dates. Move them first.');
  end if;
  select a.stay_date into v_day
  from app.availability(rm.property_id, p_from, p_to, null) a
  where a.room_type_id = rm.room_type_id
    and a.sellable
        - (case when rm.is_active and rm.condition <> 'out_of_order'
                 and not app.room_blocked(rm.id, a.stay_date, a.stay_date + 1) then 1 else 0 end)
        - a.reserved < 0
  order by a.stay_date limit 1;
  if v_day is not null then
    perform app.fail('E_OVERSOLD', 'Blocking room ' || rm.room_number || ' would leave the hotel oversold on '
      || to_char(v_day, 'DD Mon YYYY') || '.');
  end if;
end $$;

create or replace function app.assignment_not_blocked()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_no text;
begin
  if new.is_active and app.room_blocked(new.room_id, new.from_date, new.to_date) then
    select room_number into v_no from public.rooms where id = new.room_id;
    perform app.fail('E_ROOM_BLOCKED', 'Room ' || coalesce(v_no, '') || ' is blocked on these dates.');
  end if;
  return new;
end $$;
create trigger room_assignments_not_blocked before insert or update of room_id, from_date, to_date, is_active
  on public.room_assignments for each row execute function app.assignment_not_blocked();

create or replace function public.request_room_block(p_room_id uuid, p_type text, p_from date, p_to date,
  p_reason text, p_ticket_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms; v_id uuid; v_approver boolean;
begin
  perform app.assert_writable();
  select * into rm from public.rooms where id = p_room_id and tenant_id = app.my_tenant() for update;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  perform app.require('room.ooo.set', rm.property_id);
  if p_type not in ('out_of_order', 'out_of_service', 'hold') then perform app.fail('E_INVALID', 'Choose a block type.'); end if;
  if p_from is null or p_to is null or p_to <= p_from then perform app.fail('E_INVALID', 'The end date must be after the start date.'); end if;
  if p_from < (select business_date from public.properties where id = rm.property_id) then
    perform app.fail('E_INVALID', 'A block cannot start before the business date.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  perform app.check_block(rm, p_from, p_to);
  v_approver := app.can('room.block.approve', rm.property_id);
  begin
    insert into public.room_blocks(tenant_id, property_id, room_id, block_type, from_date, to_date, reason, ticket_id,
      status, approved_by, approved_at)
    values (rm.tenant_id, rm.property_id, rm.id, p_type, p_from, p_to, btrim(p_reason), p_ticket_id,
      case when v_approver then 'approved' else 'pending' end,
      case when v_approver then auth.uid() end, case when v_approver then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    perform app.fail('E_INVALID', 'Room ' || rm.room_number || ' already has a block on these dates.');
  end;
  return v_id;
end $$;

create or replace function public.approve_room_block(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.room_blocks; rm public.rooms;
begin
  perform app.assert_writable();
  select * into b from public.room_blocks where id = p_id and tenant_id = app.my_tenant() for update;
  if b.id is null then perform app.fail('E_NOT_FOUND', 'Block not found.'); end if;
  perform app.require('room.block.approve', b.property_id);
  if b.status <> 'pending' then perform app.fail('E_INVALID', 'Only pending blocks can be approved.'); end if;
  select * into rm from public.rooms where id = b.room_id for update;
  perform app.check_block(rm, b.from_date, b.to_date);
  update public.room_blocks set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
end $$;

create or replace function public.reject_room_block(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.room_blocks;
begin
  perform app.assert_writable();
  select * into b from public.room_blocks where id = p_id and tenant_id = app.my_tenant() for update;
  if b.id is null then perform app.fail('E_NOT_FOUND', 'Block not found.'); end if;
  perform app.require('room.block.approve', b.property_id);
  if b.status <> 'pending' then perform app.fail('E_INVALID', 'Only pending blocks can be rejected.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  update public.room_blocks set status = 'rejected', approved_by = auth.uid(), approved_at = now(),
    decision_reason = btrim(p_reason) where id = p_id;
end $$;

create or replace function public.release_room_block(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.room_blocks;
begin
  perform app.assert_writable();
  select * into b from public.room_blocks where id = p_id and tenant_id = app.my_tenant() for update;
  if b.id is null then perform app.fail('E_NOT_FOUND', 'Block not found.'); end if;
  if not (app.can('room.ooo.set', b.property_id) or app.can('room.block.approve', b.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to release room blocks.'); end if;
  if b.status not in ('pending', 'approved') then perform app.fail('E_INVALID', 'This block is already closed.'); end if;
  update public.room_blocks set status = case when b.status = 'approved' then 'released' else 'cancelled' end,
    released_by = auth.uid(), released_at = now(), release_reason = nullif(btrim(p_reason), '') where id = p_id;
end $$;

create or replace function public.set_room_condition(p_room_id uuid, p_condition text, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms;
begin
  perform app.assert_writable();
  select * into rm from public.rooms where id = p_room_id and tenant_id = app.my_tenant() for update;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  perform app.require('room.status.set', rm.property_id);
  if p_condition not in ('clean', 'dirty', 'inspected') then
    perform app.fail('E_INVALID', 'Choose clean, dirty or inspected. Use a block for out of order.'); end if;
  if p_condition = rm.condition then return; end if;
  if rm.condition = 'out_of_order' and coalesce(btrim(p_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'A reason is required to bring a room back from out of order.'); end if;
  update public.rooms set condition = p_condition where id = rm.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values (rm.tenant_id, auth.uid(), 'set_room_condition', 'rooms', rm.id::text,
    jsonb_build_object('condition', rm.condition), jsonb_build_object('condition', p_condition), nullif(btrim(p_reason), ''));
end $$;

create or replace function public.get_front_desk_rooms(p_property_id uuid, p_room_type_id uuid, p_from date, p_to date,
  p_reservation_id uuid default null)
returns table(id uuid, room_number text, floor text, room_type_id uuid, room_type_code text,
              condition text, is_occupied boolean, is_ready boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.can('fo.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view the front desk.'); end if;
  if p_from is null or p_to is null or p_to <= p_from then perform app.fail('E_INVALID', 'Departure must be after arrival.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.room_type_id, rt.code, rm.condition, rm.is_occupied, app.room_ready(rm)
  from public.rooms rm join public.room_types rt on rt.id = rm.room_type_id
  where rm.property_id = p_property_id and rm.is_active and rm.condition <> 'out_of_order'
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and not app.room_blocked(rm.id, p_from, p_to)
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id is distinct from p_reservation_id
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, p_to, '[)'))
  order by rt.code, length(rm.room_number), rm.room_number;
end $$;

create or replace function public.get_assignable_rooms(p_id uuid)
returns table(id uuid, room_number text, floor text, condition text, is_occupied boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  select * into r from public.reservations x where x.id = p_id and x.tenant_id = app.my_tenant();
  if r.id is null or not app.can('res.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.condition, rm.is_occupied
  from public.rooms rm
  where rm.room_type_id = r.room_type_id and rm.is_active and rm.condition <> 'out_of_order'
    and not app.room_blocked(rm.id, r.arrival_date, r.departure_date)
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id <> r.id
        and daterange(a.from_date, a.to_date, '[)') && daterange(r.arrival_date, r.departure_date, '[)'))
  order by length(rm.room_number), rm.room_number;
end $$;

create view public.v_room_board with (security_invoker = true) as
select rm.id, rm.property_id, rm.room_number, rm.floor, rm.room_type_id, rt.code as room_type_code, rt.name as room_type_name,
  rm.condition, rm.is_occupied, rm.is_active,
  cb.id as block_id, cb.block_type, cb.to_date as block_to_date,
  (rm.is_active and rm.condition <> 'out_of_order' and cb.id is null) as is_sellable,
  st.reservation_id as current_reservation_id, st.number as current_number, st.guest_name as current_guest_name,
  st.departure_date as current_departure_date,
  na.id as next_reservation_id, na.number as next_number, na.guest_name as next_guest_name,
  na.arrival_date as next_arrival_date,
  (select count(*)::int from public.room_blocks pb where pb.room_id = rm.id and pb.status = 'pending') as pending_blocks
from public.rooms rm
join public.room_types rt on rt.id = rm.room_type_id
join public.properties p on p.id = rm.property_id
left join lateral (select b.id, b.block_type, b.to_date from public.room_blocks b
  where b.room_id = rm.id and b.status = 'approved' and p.business_date >= b.from_date and p.business_date < b.to_date
  limit 1) cb on true
left join lateral (select r.id as reservation_id, r.number, r.departure_date,
    nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name
  from public.stays s join public.reservations r on r.id = s.reservation_id
  left join public.guests g on g.id = r.guest_id
  where s.room_id = rm.id and s.status = 'in_house' limit 1) st on true
left join lateral (select r.id, r.number, r.arrival_date,
    nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name
  from public.room_assignments a join public.reservations r on r.id = a.reservation_id
  left join public.guests g on g.id = r.guest_id
  where a.room_id = rm.id and a.is_active and r.status in ('tentative', 'confirmed') and r.departure_date > p.business_date
  order by r.arrival_date limit 1) na on true;

grant select on public.v_room_board to authenticated, service_role;

revoke all on function app.room_blocked(uuid, date, date), app.check_block(public.rooms, date, date) from public;
grant execute on function app.room_blocked(uuid, date, date) to authenticated, service_role;
