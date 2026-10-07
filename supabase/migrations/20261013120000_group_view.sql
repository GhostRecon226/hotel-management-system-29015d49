-- Hotel group view (GRP-001 to GRP-004).
-- 1. New permission rpt.group.view and a built-in Group Manager role (view only).
-- 2. public.group_overview(): one call that returns every branch the caller may see, with totals.
-- 3. public.copy_property_setup(): copy room types, rate plans and prices from one branch to a new, empty one.
-- New permissions reach built-in roles only. Custom roles copied earlier do not get rpt.group.view.

insert into public.permissions(key, description, module)
values ('rpt.group.view', 'View the all-branches summary', 'reports')
on conflict (key) do nothing;

insert into public.roles(tenant_id, code, name, is_system)
select null, 'GROUPMGR', 'Group Manager', true
where not exists (select 1 from public.roles where tenant_id is null and code = 'GROUPMGR');

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, 'rpt.group.view', 'Y' from public.roles r
where r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'GROUPMGR')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, k.key, 'Y'
from public.roles r
cross join (values ('setup.property.view'), ('res.view'), ('fo.view'), ('room.view'), ('guest.view'),
  ('fin.folio.view'), ('rpt.operations.view'), ('rpt.finance.view'), ('adm.audit.view')) as k(key)
where r.tenant_id is null and r.code = 'GROUPMGR'
on conflict do nothing;

-- All branches the caller may see, with figures from the database. Totals never mix currencies.
create or replace function public.group_overview()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_props jsonb; v_totals jsonb;
begin
  if app.my_tenant() is null or not app.can('rpt.group.view') then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to view the group summary.');
  end if;

  with g as (
    select p.id as property_id, p.name, p.code, p.city, p.base_currency, p.business_date,
      (select count(*) from public.rooms r where r.property_id = p.id and r.is_active)::int as rooms_total,
      (select count(*) from public.rooms r where r.property_id = p.id and r.is_active and r.is_occupied)::int as rooms_occupied,
      (select count(*) from public.stays s where s.property_id = p.id and s.status = 'in_house')::int as in_house,
      (select count(*) from public.reservations r where r.property_id = p.id and r.arrival_date = p.business_date
         and r.status in ('tentative', 'confirmed'))::int as arrivals_pending,
      (select count(*) from public.reservations r where r.property_id = p.id and r.departure_date = p.business_date
         and r.status = 'checked_in')::int as departures_pending,
      (select count(*) from public.approvals a where a.property_id = p.id and a.status = 'pending')::int as pending_approvals,
      (select count(*) from public.maintenance_tickets t where t.property_id = p.id
         and t.status in ('open', 'assigned', 'in_progress', 'waiting'))::int as open_tickets,
      (select count(*) from public.maintenance_tickets t where t.property_id = p.id
         and t.status in ('open', 'assigned', 'in_progress', 'waiting') and t.priority = 'urgent')::int as urgent_tickets,
      d.business_date as last_night_date, d.rooms_sold as ln_sold, d.rooms_available as ln_avail,
      coalesce(d.total_revenue, 0) as last_night_revenue
    from public.properties p
    left join lateral (select * from public.daily_stats ds where ds.property_id = p.id and ds.business_date < p.business_date
      order by ds.business_date desc limit 1) d on true
    where p.tenant_id = app.my_tenant() and app.can('rpt.group.view', p.id)
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
      'property_id', property_id, 'name', name, 'code', code, 'city', city, 'base_currency', base_currency,
      'business_date', business_date, 'rooms_total', rooms_total, 'rooms_occupied', rooms_occupied,
      'occupancy', round(rooms_occupied::numeric / nullif(rooms_total, 0), 4),
      'in_house', in_house, 'arrivals_pending', arrivals_pending, 'departures_pending', departures_pending,
      'pending_approvals', pending_approvals, 'open_tickets', open_tickets, 'urgent_tickets', urgent_tickets,
      'last_night_date', last_night_date, 'last_night_revenue', last_night_revenue,
      'last_night_occupancy', round(ln_sold::numeric / nullif(ln_avail, 0), 4)) order by name) from g), '[]'::jsonb),
    (select jsonb_build_object(
      'properties', count(*)::int,
      'rooms_total', coalesce(sum(rooms_total), 0)::int,
      'rooms_occupied', coalesce(sum(rooms_occupied), 0)::int,
      'occupancy', round(coalesce(sum(rooms_occupied), 0)::numeric / nullif(sum(rooms_total), 0), 4),
      'in_house', coalesce(sum(in_house), 0)::int,
      'arrivals_pending', coalesce(sum(arrivals_pending), 0)::int,
      'departures_pending', coalesce(sum(departures_pending), 0)::int,
      'pending_approvals', coalesce(sum(pending_approvals), 0)::int,
      'open_tickets', coalesce(sum(open_tickets), 0)::int,
      'urgent_tickets', coalesce(sum(urgent_tickets), 0)::int,
      'revenue_by_currency', coalesce((select jsonb_object_agg(c.base_currency, c.rev)
         from (select base_currency, sum(last_night_revenue) as rev from g group by base_currency) c), '{}'::jsonb)) from g)
  into v_props, v_totals;

  return jsonb_build_object('properties', v_props, 'totals', v_totals);
end $$;

-- Copy room types, rate plans and their prices from a source branch to an empty target branch.
-- Rooms are not copied: every hotel names and numbers its own rooms. Taxes, charge codes and payment methods
-- already arrive with every new branch.
create or replace function public.copy_property_setup(p_source_property_id uuid, p_target_property_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant(); v_types int; v_plans int; v_prices int;
begin
  perform app.require('setup.room.manage', p_target_property_id);
  perform app.require('setup.rate.manage', p_target_property_id);
  if p_source_property_id = p_target_property_id then
    perform app.fail('E_INVALID', 'Choose a different branch to copy from.');
  end if;
  if not exists (select 1 from public.properties where id = p_source_property_id and tenant_id = v_tenant)
     or not exists (select 1 from public.properties where id = p_target_property_id and tenant_id = v_tenant)
     or not app.can('setup.property.view', p_source_property_id) then
    perform app.fail('E_NOT_FOUND', 'Branch not found.');
  end if;
  if exists (select 1 from public.room_types where property_id = p_target_property_id)
     or exists (select 1 from public.rate_plans where property_id = p_target_property_id) then
    perform app.fail('E_NOT_EMPTY', 'The new branch already has room types or rates. Copy only into an empty branch.');
  end if;

  create temp table _rt_map(old_id uuid, new_id uuid) on commit drop;
  create temp table _rp_map(old_id uuid, new_id uuid) on commit drop;

  with src as (select * from public.room_types where property_id = p_source_property_id),
  ins as (
    insert into public.room_types(tenant_id, property_id, code, name, max_adults, max_children, description, is_active)
    select v_tenant, p_target_property_id, s.code, s.name, s.max_adults, s.max_children, s.description, s.is_active from src s
    returning id, code)
  insert into _rt_map select s.id, i.id from src s join ins i on i.code = s.code;
  get diagnostics v_types = row_count;

  with src as (select * from public.rate_plans where property_id = p_source_property_id),
  ins as (
    insert into public.rate_plans(tenant_id, property_id, code, name, is_corporate,
      cancellation_policy_type, cancellation_policy_value, no_show_policy_type, no_show_policy_value,
      deposit_policy_type, deposit_policy_value, is_active)
    select v_tenant, p_target_property_id, s.code, s.name, s.is_corporate,
      s.cancellation_policy_type, s.cancellation_policy_value, s.no_show_policy_type, s.no_show_policy_value,
      s.deposit_policy_type, s.deposit_policy_value, s.is_active from src s
    returning id, code)
  insert into _rp_map select s.id, i.id from src s join ins i on i.code = s.code;
  get diagnostics v_plans = row_count;

  insert into public.rate_plan_prices(tenant_id, property_id, rate_plan_id, room_type_id, valid_from, valid_to, amount, currency)
  select v_tenant, p_target_property_id, rp.new_id, rt.new_id, x.valid_from, x.valid_to, x.amount, x.currency
  from public.rate_plan_prices x
  join _rp_map rp on rp.old_id = x.rate_plan_id
  join _rt_map rt on rt.old_id = x.room_type_id
  where x.property_id = p_source_property_id;
  get diagnostics v_prices = row_count;

  drop table _rt_map; drop table _rp_map;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'copy_property_setup', 'properties', p_target_property_id::text,
    jsonb_build_object('source', p_source_property_id, 'room_types', v_types, 'rate_plans', v_plans, 'rate_prices', v_prices));
  return jsonb_build_object('room_types', v_types, 'rate_plans', v_plans, 'rate_prices', v_prices);
end $$;

revoke all on function public.group_overview() from public, anon;
revoke all on function public.copy_property_setup(uuid, uuid) from public, anon;
grant execute on function public.group_overview() to authenticated;
grant execute on function public.copy_property_setup(uuid, uuid) to authenticated;
