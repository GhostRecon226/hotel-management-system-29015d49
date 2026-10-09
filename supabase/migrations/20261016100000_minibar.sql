-- [HK-007] Minibar. A manager keeps a price list. A room attendant logs what a guest used. Front desk confirms, and only then does the charge post.

insert into public.permissions(key, description, module) values
  ('hk.minibar.record', 'Log minibar use from a room', 'housekeeping'),
  ('setup.minibar.manage', 'Manage the minibar price list', 'setup')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, m.key, 'Y' from (values
  ('SYSADMIN','hk.minibar.record'),('GM','hk.minibar.record'),('FOM','hk.minibar.record'),('FDO','hk.minibar.record'),
  ('HKS','hk.minibar.record'),('RA','hk.minibar.record'),
  ('SYSADMIN','setup.minibar.manage'),('GM','setup.minibar.manage'),('FOM','setup.minibar.manage')
) as m(code, key)
join public.roles r on r.code = m.code and r.tenant_id is null
on conflict do nothing;

create table public.minibar_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name        text not null,
  price       numeric(20,4) not null check (price > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index minibar_items_name_uq on public.minibar_items(property_id, lower(name));
grant select on public.minibar_items to authenticated;
grant all on public.minibar_items to service_role;
alter table public.minibar_items enable row level security;
create policy "Staff read minibar items" on public.minibar_items for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('hk.minibar.record', property_id) or app.can('setup.minibar.manage', property_id)));
create trigger minibar_items_enforce_writable before insert or update or delete on public.minibar_items
  for each row execute function app.enforce_writable();

-- A retry from a weak phone signal must not create a second request.
alter table public.service_requests add column idempotency_key text;
create unique index service_requests_key_uq on public.service_requests(tenant_id, idempotency_key) where idempotency_key is not null;

create or replace function public.save_minibar_item(p_property_id uuid, p_id uuid, p_name text, p_price numeric, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.properties; v_id uuid;
begin
  perform app.require('setup.minibar.manage', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if p.id is null then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  if coalesce(btrim(p_name), '') = '' then perform app.fail('E_REQUIRED', 'Enter the item name.'); end if;
  if p_price is null or p_price <= 0 then perform app.fail('E_INVALID', 'Enter a price above zero.'); end if;
  perform app.assert_money(p_price, p.base_currency);
  begin
    if p_id is null then
      insert into public.minibar_items(tenant_id, property_id, name, price, is_active)
      values (p.tenant_id, p.id, btrim(p_name), round(p_price, 2), coalesce(p_is_active, true)) returning id into v_id;
    else
      update public.minibar_items set name = btrim(p_name), price = round(p_price, 2), is_active = coalesce(p_is_active, true)
       where id = p_id and property_id = p.id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Item not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'That item is already on the list.');
  end;
  return v_id;
end $$;

create or replace function public.record_minibar_use(p_room_id uuid, p_items jsonb, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms; p public.properties; st public.stays; cc public.charge_codes; v_id uuid;
        v_total numeric := 0; v_desc text; l record;
begin
  perform app.assert_writable();
  select * into rm from public.rooms where id = p_room_id and tenant_id = app.my_tenant();
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  perform app.require('hk.minibar.record', rm.property_id);
  if coalesce(btrim(p_idempotency_key), '') = '' then perform app.fail('E_REQUIRED', 'An idempotency key is required.'); end if;
  select id into v_id from public.service_requests where tenant_id = rm.tenant_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  select * into p from public.properties where id = rm.property_id;
  select * into st from public.stays where room_id = rm.id and status = 'in_house';
  if st.id is null then perform app.fail('E_INVALID', 'No guest is in this room.'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform app.fail('E_INVALID', 'Add at least one item.'); end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where jsonb_typeof(e) <> 'object' or (e->>'item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (e->>'qty') !~ '^[0-9]{1,3}$' or (e->>'qty')::int < 1 or (e->>'item_id') is null) then
    perform app.fail('E_INVALID', 'Each item needs a quantity of at least one.'); end if;
  for l in
    select i.name, i.price, sum((e->>'qty')::int) as qty
      from jsonb_array_elements(p_items) e
      join public.minibar_items i on i.id = (e->>'item_id')::uuid and i.property_id = p.id and i.is_active
     group by i.id, i.name, i.price order by i.name
  loop
    v_total := v_total + l.price * l.qty;
    v_desc := coalesce(v_desc || ', ', 'Minibar: ') || l.qty || ' x ' || l.name;
  end loop;
  if v_desc is null or (select count(distinct e->>'item_id') from jsonb_array_elements(p_items) e) <>
     (select count(*) from public.minibar_items i where i.property_id = p.id and i.is_active and i.id::text in (select e->>'item_id' from jsonb_array_elements(p_items) e)) then
    perform app.fail('E_INVALID', 'One of the items is not on the minibar list.'); end if;
  perform app.assert_money(v_total, p.base_currency);
  select * into cc from public.charge_codes where property_id = p.id and code = 'MINIBAR' and is_active;
  if cc.id is null then perform app.fail('E_INVALID', 'The Minibar charge code is missing or switched off.'); end if;
  insert into public.service_requests(tenant_id, property_id, reservation_id, category, description, chargeable, charge_amount,
    currency, charge_code_id, status, business_date, idempotency_key)
  values (p.tenant_id, p.id, st.reservation_id, 'amenities', v_desc || ' (room ' || rm.room_number || ')', true, round(v_total, 2),
    p.base_currency, cc.id, 'open', p.business_date, p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_minibar_items(p_property_id uuid)
returns table (id uuid, name text, price numeric, is_active boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (app.can('hk.minibar.record', p_property_id) or app.can('setup.minibar.manage', p_property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  return query select i.id, i.name, i.price, i.is_active from public.minibar_items i
   where i.property_id = p_property_id and i.tenant_id = app.my_tenant() order by i.name;
end $$;

create or replace function public.list_minibar_rooms(p_property_id uuid)
returns table (room_id uuid, room_number text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.can('hk.minibar.record', p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  -- Room numbers only. Attendants do not see guest names here.
  return query select r.id, r.room_number from public.stays s join public.rooms r on r.id = s.room_id
   where s.property_id = p_property_id and s.tenant_id = app.my_tenant() and s.status = 'in_house'
   order by r.room_number collate app.natural;
end $$;

revoke all on function public.save_minibar_item(uuid, uuid, text, numeric, boolean),
  public.record_minibar_use(uuid, jsonb, text), public.list_minibar_items(uuid), public.list_minibar_rooms(uuid) from public, anon;
grant execute on function public.save_minibar_item(uuid, uuid, text, numeric, boolean),
  public.record_minibar_use(uuid, jsonb, text), public.list_minibar_items(uuid), public.list_minibar_rooms(uuid) to authenticated;
