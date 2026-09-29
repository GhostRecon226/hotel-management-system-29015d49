create table public.hk_tasks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  room_id       uuid not null references public.rooms(id),
  stay_id       uuid references public.stays(id),
  type          text not null check (type in ('turnover', 'stayover', 'deep_clean', 'inspection')),
  status        text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'done', 'inspected', 'failed', 'cancelled')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id   uuid references public.profiles(id),
  checklist     jsonb not null default '[]'::jsonb,
  defects       jsonb not null default '[]'::jsonb,
  notes         text,
  business_date date not null,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  assigned_at   timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  completed_by  uuid,
  inspected_at  timestamptz,
  inspected_by  uuid,
  inspection_result text check (inspection_result in ('clean', 'inspected', 'failed')),
  fail_count    integer not null default 0,
  cancelled_at  timestamptz,
  cancel_reason text,
  constraint hk_tasks_sod check (inspected_by is null or completed_by is null or inspected_by <> completed_by)
);
create index hk_tasks_board_idx on public.hk_tasks(property_id, status, business_date);
create index hk_tasks_room_idx on public.hk_tasks(room_id, status);
create index hk_tasks_assignee_idx on public.hk_tasks(assignee_id, status);
grant select on public.hk_tasks to authenticated;
grant all on public.hk_tasks to service_role;
alter table public.hk_tasks enable row level security;
create policy "Housekeeping and front desk read tasks" on public.hk_tasks for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('hk.view', property_id) or app.can('fo.view', property_id)));
create trigger hk_tasks_enforce_writable before insert or update or delete on public.hk_tasks
  for each row execute function app.enforce_writable();

create table public.lost_found_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  room_id       uuid references public.rooms(id),
  description   text not null,
  found_at      timestamptz not null default now(),
  location      text not null,
  status        text not null default 'stored' check (status in ('stored', 'claimed', 'returned', 'disposed')),
  found_by      uuid default auth.uid(),
  claimed_by_name text,
  status_note   text,
  status_changed_at timestamptz,
  status_changed_by uuid,
  created_at    timestamptz not null default now()
);
create index lost_found_property_idx on public.lost_found_items(property_id, status, found_at desc);
grant select on public.lost_found_items to authenticated;
grant all on public.lost_found_items to service_role;
alter table public.lost_found_items enable row level security;
create policy "Housekeeping and front desk read lost and found" on public.lost_found_items for select to authenticated
  using (tenant_id = app.my_tenant() and (app.can('hk.view', property_id) or app.can('fo.view', property_id)));
create trigger lost_found_enforce_writable before insert or update or delete on public.lost_found_items
  for each row execute function app.enforce_writable();

insert into public.hk_tasks(id, tenant_id, property_id, room_id, stay_id, type, status, business_date, notes, created_by, created_at, completed_at)
select id, tenant_id, property_id, room_id, stay_id,
  case kind when 'other' then 'deep_clean' else kind end,
  status, business_date, notes, created_by, created_at, completed_at
from public.housekeeping_tasks;
comment on table public.housekeeping_tasks is 'DEPRECATED: replaced by public.hk_tasks';

create or replace function app.hk_default_checklist(p_type text)
returns jsonb language sql immutable as $$
  select to_jsonb(array(select jsonb_build_object('label', l, 'done', false) from unnest(case p_type
    when 'turnover' then array['Strip and change bed linen','Replace towels','Clean bathroom','Empty bins','Restock amenities','Dust surfaces','Vacuum or mop floor','Check lights, AC and TV','Check for lost property']
    when 'stayover' then array['Make bed','Replace used towels','Tidy bathroom','Empty bins','Restock amenities']
    when 'deep_clean' then array['Turn mattress','Wash curtains','Clean behind furniture','Descale bathroom','Clean windows','Clean AC filter','Full turnover checklist']
    else array['Bed made','Bathroom clean','Amenities stocked','Floor clean','Everything working'] end) l))
$$;

create or replace function app.hk_task_for_write(p_id uuid)
returns public.hk_tasks language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  select * into t from public.hk_tasks where id = p_id and tenant_id = app.my_tenant() for update;
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Task not found.'); end if;
  return t;
end $$;

create or replace function app.hk_set_room(p_room uuid, p_condition text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.rooms set condition = p_condition where id = p_room and condition in ('clean', 'dirty', 'inspected') and condition <> p_condition;
$$;

create or replace function app.hk_notify(p_user uuid, t public.hk_tasks, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
  values (t.tenant_id, t.property_id, p_user, 'hk_task', p_title, p_body, '/housekeeping/my-tasks', t.id);
end $$;

create or replace function app.hk_new_turnover(p_room uuid, p_stay uuid, p_notes text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms; v_bdate date; v_id uuid;
begin
  select * into rm from public.rooms where id = p_room;
  select business_date into v_bdate from public.properties where id = rm.property_id;
  update public.hk_tasks set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Replaced by a newer turnover'
   where room_id = p_room and type = 'turnover' and status in ('open', 'assigned', 'failed');
  insert into public.hk_tasks(tenant_id, property_id, room_id, stay_id, type, priority, checklist, business_date, notes)
  values (rm.tenant_id, rm.property_id, rm.id, p_stay, 'turnover', 'high', app.hk_default_checklist('turnover'), v_bdate, p_notes)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.assign_hk_task(p_id uuid, p_assignee_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.assign', t.property_id);
  if t.status not in ('open', 'assigned', 'failed') then perform app.fail('E_INVALID', 'Only tasks that have not started can be assigned.'); end if;
  if p_assignee_id is null then
    update public.hk_tasks set assignee_id = null, assigned_at = null, status = case when status = 'failed' then 'failed' else 'open' end where id = t.id;
    return;
  end if;
  if not exists (select 1 from public.user_property_roles upr join public.role_permissions rp on rp.role_id = upr.role_id
    where upr.user_id = p_assignee_id and upr.property_id = t.property_id and rp.permission_key = 'hk.task.complete') then
    perform app.fail('E_INVALID', 'That person cannot do housekeeping tasks at this property.'); end if;
  update public.hk_tasks set assignee_id = p_assignee_id, assigned_at = now(),
    status = case when status = 'failed' then 'failed' else 'assigned' end where id = t.id returning * into t;
  perform app.hk_notify(p_assignee_id, t, 'New cleaning task',
    'Room ' || (select room_number from public.rooms where id = t.room_id) || ' · ' || replace(t.type, '_', ' '));
end $$;

create or replace function public.create_hk_task(p_room_id uuid, p_type text, p_priority text default 'normal',
  p_assignee_id uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare rm public.rooms; v_id uuid;
begin
  select * into rm from public.rooms where id = p_room_id and tenant_id = app.my_tenant();
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  perform app.require('hk.task.assign', rm.property_id);
  if p_type not in ('turnover', 'stayover', 'deep_clean', 'inspection') then perform app.fail('E_INVALID', 'Unknown task type.'); end if;
  if p_type = 'turnover' then
    v_id := app.hk_new_turnover(rm.id, null, nullif(btrim(p_notes), ''));
    update public.hk_tasks set priority = coalesce(p_priority, 'normal') where id = v_id;
  else
    insert into public.hk_tasks(tenant_id, property_id, room_id, type, priority, checklist, business_date, notes)
    select rm.tenant_id, rm.property_id, rm.id, p_type, coalesce(p_priority, 'normal'), app.hk_default_checklist(p_type),
      p.business_date, nullif(btrim(p_notes), '') from public.properties p where p.id = rm.property_id
    returning id into v_id;
  end if;
  if p_assignee_id is not null then perform public.assign_hk_task(v_id, p_assignee_id); end if;
  return v_id;
end $$;

create or replace function public.start_hk_task(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.complete', t.property_id);
  if t.status = 'in_progress' then return; end if;
  if t.status not in ('open', 'assigned', 'failed') then perform app.fail('E_INVALID', 'This task cannot be started.'); end if;
  if t.assignee_id is not null and t.assignee_id <> auth.uid() and not app.can('hk.task.assign', t.property_id) then
    perform app.fail('E_FORBIDDEN', 'This task is assigned to someone else.'); end if;
  update public.hk_tasks set status = 'in_progress', started_at = now(),
    assignee_id = coalesce(assignee_id, auth.uid()), assigned_at = coalesce(assigned_at, now()) where id = t.id;
end $$;

create or replace function public.complete_hk_task(p_id uuid, p_checklist jsonb default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.complete', t.property_id);
  if t.status = 'done' then return; end if;
  if t.status <> 'in_progress' then perform app.fail('E_INVALID', 'Start the task before completing it.'); end if;
  if t.assignee_id <> auth.uid() and not app.can('hk.task.assign', t.property_id) then
    perform app.fail('E_FORBIDDEN', 'This task is assigned to someone else.'); end if;
  if p_checklist is not null and jsonb_typeof(p_checklist) <> 'array' then perform app.fail('E_INVALID', 'Checklist must be a list.'); end if;
  update public.hk_tasks set status = 'done', completed_at = now(), completed_by = auth.uid(),
    checklist = coalesce(p_checklist, checklist),
    notes = coalesce(nullif(btrim(p_notes), ''), notes)
  where id = t.id;
  perform app.hk_set_room(t.room_id, 'dirty');
end $$;

create or replace function public.inspect_hk_task(p_id uuid, p_pass boolean, p_result text default 'inspected', p_defects jsonb default '[]'::jsonb, p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks; v_defects jsonb;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.inspect', t.property_id);
  if t.status <> 'done' then perform app.fail('E_INVALID', 'Only completed tasks waiting for inspection can be inspected.'); end if;
  if t.completed_by = auth.uid() then perform app.fail('E_SOD', 'You cleaned this room, so someone else must inspect it.'); end if;
  if p_pass then
    if p_result not in ('clean', 'inspected') then perform app.fail('E_INVALID', 'A pass marks the room clean or inspected.'); end if;
    update public.hk_tasks set status = 'inspected', inspected_at = now(), inspected_by = auth.uid(), inspection_result = p_result,
      notes = coalesce(nullif(btrim(p_notes), ''), notes) where id = t.id;
    perform app.hk_set_room(t.room_id, p_result);
  else
    select coalesce(jsonb_agg(to_jsonb(btrim(d))), '[]'::jsonb) into v_defects
      from jsonb_array_elements_text(coalesce(p_defects, '[]'::jsonb)) d where btrim(d) <> '';
    if jsonb_array_length(v_defects) = 0 then perform app.fail('E_REQUIRED', 'List at least one defect.'); end if;
    update public.hk_tasks set status = 'failed', inspected_at = now(), inspected_by = null, inspection_result = 'failed',
      defects = v_defects, fail_count = fail_count + 1, completed_at = null, completed_by = null, started_at = null,
      checklist = (select coalesce(jsonb_agg(c || jsonb_build_object('done', false)), '[]'::jsonb) from jsonb_array_elements(checklist) c),
      notes = coalesce(nullif(btrim(p_notes), ''), notes)
    where id = t.id returning * into t;
    perform app.hk_set_room(t.room_id, 'dirty');
    perform app.hk_notify(t.assignee_id, t, 'Inspection failed',
      'Room ' || (select room_number from public.rooms where id = t.room_id) || ': ' || (select string_agg(x, ', ') from jsonb_array_elements_text(v_defects) x));
  end if;
end $$;

create or replace function public.cancel_hk_task(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.assign', t.property_id);
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if t.status in ('inspected', 'cancelled') then perform app.fail('E_INVALID', 'This task is already finished.'); end if;
  update public.hk_tasks set status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason) where id = t.id;
end $$;

create or replace function public.hk_staff(p_property_id uuid)
returns table(id uuid, full_name text) language sql stable security definer set search_path = public, pg_temp as $$
  select distinct p.id, p.full_name from public.user_property_roles upr
  join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'hk.task.complete'
  join public.profiles p on p.id = upr.user_id and p.status = 'active'
  where upr.property_id = p_property_id and upr.tenant_id = app.my_tenant() and app.can('hk.view', p_property_id)
  order by p.full_name
$$;

create or replace function public.save_lost_found_item(p_property_id uuid, p_description text, p_location text,
  p_found_at timestamptz default null, p_room_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not (app.can('hk.view', p_property_id) or app.can('fo.view', p_property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  perform app.assert_writable();
  if coalesce(btrim(p_description), '') = '' or coalesce(btrim(p_location), '') = '' then
    perform app.fail('E_REQUIRED', 'Description and where it was found are required.'); end if;
  insert into public.lost_found_items(tenant_id, property_id, room_id, description, location, found_at)
  values (app.my_tenant(), p_property_id, p_room_id, btrim(p_description), btrim(p_location), coalesce(p_found_at, now()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_lost_found_status(p_id uuid, p_status text, p_note text default null, p_claimed_by text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare i public.lost_found_items;
begin
  select * into i from public.lost_found_items where id = p_id and tenant_id = app.my_tenant() for update;
  if i.id is null then perform app.fail('E_NOT_FOUND', 'Item not found.'); end if;
  if not (app.can('hk.task.assign', i.property_id) or app.can('fo.view', i.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  perform app.assert_writable();
  if p_status not in ('stored', 'claimed', 'returned', 'disposed') then perform app.fail('E_INVALID', 'Unknown status.'); end if;
  if p_status in ('claimed', 'returned') and coalesce(btrim(p_claimed_by), '') = '' then
    perform app.fail('E_REQUIRED', 'Enter who claimed the item.'); end if;
  if p_status = 'disposed' and coalesce(btrim(p_note), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  update public.lost_found_items set status = p_status, status_note = nullif(btrim(p_note), ''),
    claimed_by_name = coalesce(nullif(btrim(p_claimed_by), ''), claimed_by_name),
    status_changed_at = now(), status_changed_by = auth.uid() where id = i.id;
end $$;

create or replace view public.v_hk_board with (security_invoker = true) as
select t.*, r.room_number, r.floor, r.condition as room_condition, r.is_occupied, rt.name as room_type_name,
  pa.full_name as assignee_name, pc.full_name as completed_by_name, pi.full_name as inspected_by_name,
  case when t.status in ('open', 'failed') and t.assignee_id is null then 'open'
       when t.status in ('assigned', 'failed') then 'assigned'
       when t.status = 'in_progress' then 'in_progress'
       when t.status = 'done' then 'waiting_inspection'
       when t.status = 'inspected' then 'done'
       else t.status end as board_column
from public.hk_tasks t
join public.rooms r on r.id = t.room_id
join public.room_types rt on rt.id = r.room_type_id
left join public.profiles pa on pa.id = t.assignee_id
left join public.profiles pc on pc.id = t.completed_by
left join public.profiles pi on pi.id = t.inspected_by;
grant select on public.v_hk_board to authenticated;

revoke all on function app.hk_new_turnover(uuid, uuid, text), app.hk_task_for_write(uuid), app.hk_set_room(uuid, text),
  app.hk_notify(uuid, public.hk_tasks, text, text) from public;
revoke all on function public.create_hk_task(uuid, text, text, uuid, text), public.assign_hk_task(uuid, uuid),
  public.start_hk_task(uuid), public.complete_hk_task(uuid, jsonb, text), public.inspect_hk_task(uuid, boolean, text, jsonb, text),
  public.cancel_hk_task(uuid, text), public.hk_staff(uuid), public.save_lost_found_item(uuid, text, text, timestamptz, uuid),
  public.set_lost_found_status(uuid, text, text, text) from public, anon;
grant execute on function public.create_hk_task(uuid, text, text, uuid, text), public.assign_hk_task(uuid, uuid),
  public.start_hk_task(uuid), public.complete_hk_task(uuid, jsonb, text), public.inspect_hk_task(uuid, boolean, text, jsonb, text),
  public.cancel_hk_task(uuid, text), public.hk_staff(uuid), public.save_lost_found_item(uuid, text, text, timestamptz, uuid),
  public.set_lost_found_status(uuid, text, text, text) to authenticated;

create or replace function public.check_out(p_id uuid, p_approval_id uuid default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date; v_out numeric; a public.approvals;
  v_closed uuid[] := '{}'; v_nights jsonb; v_old_dep date; fo record; v_task uuid; v_sid uuid;
begin
  perform app.assert_writable(true);
  r := app.reservation_for_write(p_id, 'fo.checkout');
  perform set_config('app.settlement', 'on', true);
  if r.status = 'checked_out' then
    select id into v_sid from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1;
    return v_sid;
  end if;
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be checked out.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'in_house' for update;
  select business_date into v_bdate from public.properties where id = r.property_id;

  v_out := app.reservation_outstanding(r.id);
  if v_out <> 0 then
    if p_approval_id is not null then
      select * into a from public.approvals where id = p_approval_id and tenant_id = r.tenant_id for update;
      if a.id is null or a.kind <> 'checkout' or a.reservation_id <> r.id then
        perform app.fail('E_INVALID', 'That approval is not for this booking.'); end if;
      if a.status <> 'approved' then perform app.fail('E_NOT_APPROVED', 'The check-out approval has not been approved yet.'); end if;
      if exists (select 1 from public.stays where checkout_approval_id = a.id) then
        perform app.fail('E_INVALID', 'That approval has already been used.'); end if;
      if v_out > a.amount then
        perform app.fail('E_BALANCE_DUE', 'The balance has grown since approval (' || to_char(v_out, 'FM999,999,999,990.00') || '). Ask again.'); end if;
    elsif app.can('fo.checkout.unsettled', r.property_id) then
      if coalesce(btrim(p_reason), '') = '' then
        perform app.fail('E_REQUIRED', 'A reason is required to check out with a balance.'); end if;
    else
      perform app.fail('E_BALANCE_DUE', 'Every folio must be at zero. Outstanding: ' || to_char(v_out, 'FM999,999,999,990.00') || '. Settle it or ask for approval.');
    end if;
  end if;

  for fo in select id from public.folios where reservation_id = r.id and status = 'open' for update loop
    if app.folio_balance(fo.id) = 0 then
      update public.folios set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = fo.id;
      v_closed := v_closed || fo.id;
    end if;
  end loop;

  v_old_dep := r.departure_date;
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_nights
    from public.reservation_nights n where n.reservation_id = r.id and n.stay_date >= v_bdate;
  delete from public.reservation_nights where reservation_id = r.id and stay_date >= v_bdate;
  update public.reservations set status = 'checked_out', updated_at = now(),
    departure_date = case when v_bdate > arrival_date and v_bdate < departure_date then v_bdate else departure_date end
  where id = r.id;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = r.id and is_active;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;

  v_task := app.hk_new_turnover(s.room_id, s.id, 'Check-out ' || r.number);

  update public.stays set status = 'checked_out', checked_out_at = now(), checked_out_by = auth.uid(),
    checkout_business_date = v_bdate, checkout_approval_id = a.id, checkout_reason = nullif(btrim(p_reason), ''),
    checkout_snapshot = jsonb_build_object('closed_folios', to_jsonb(v_closed), 'nights', v_nights,
      'departure_date', v_old_dep, 'task_id', v_task, 'outstanding', v_out)
  where id = s.id;

  perform app.log_res(r, 'check_out', p_reason, jsonb_strip_nulls(jsonb_build_object(
    'outstanding', nullif(v_out, 0), 'approval_id', a.id, 'closed_folios', cardinality(v_closed))));
  return s.id;
end $$;

create or replace function public.undo_checkout(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; s public.stays; v_bdate date; rm public.rooms; v_dep date; n jsonb; v_f text;
begin
  perform app.assert_writable();
  r := app.reservation_for_write(p_id, 'fo.checkout.undo');
  if r.status <> 'checked_out' then perform app.fail('E_INVALID', 'This booking is not checked out.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = r.id and status = 'checked_out' order by checked_out_at desc limit 1 for update;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if s.checkout_business_date is distinct from v_bdate then
    perform app.fail('E_INVALID', 'A check-out can only be undone on the same business day.'); end if;
  select * into rm from public.rooms where id = s.room_id for update;
  if rm.is_occupied then perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' is occupied again. Undo is not possible.'); end if;

  v_dep := coalesce((s.checkout_snapshot->>'departure_date')::date, r.departure_date);
  if v_dep > v_bdate then
    perform app.assert_available(r.property_id, r.room_type_id, v_bdate, v_dep, r.id);
  end if;

  update public.reservations set status = 'checked_in', departure_date = v_dep, updated_at = now() where id = r.id;
  for n in select * from jsonb_array_elements(coalesce(s.checkout_snapshot->'nights', '[]'::jsonb)) loop
    insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
    values (r.tenant_id, r.property_id, r.id, (n->>'room_type_id')::uuid, (n->>'stay_date')::date, (n->>'rate_amount')::numeric, s.room_id)
    on conflict do nothing;
  end loop;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, r.id, s.room_id, least(v_bdate, v_dep - 1), greatest(v_dep, v_bdate + 1));
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', 'Room ' || rm.room_number || ' has been assigned to another booking.');
  end;

  update public.rooms set is_occupied = true where id = s.room_id;
  update public.hk_tasks set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Check-out undone'
   where id = (s.checkout_snapshot->>'task_id')::uuid and status in ('open', 'assigned', 'in_progress', 'failed');
  perform set_config('app.audit_reason', 'Undo check-out: ' || btrim(p_reason), true);
  for v_f in select jsonb_array_elements_text(coalesce(s.checkout_snapshot->'closed_folios', '[]'::jsonb)) loop
    update public.folios set status = 'open', closed_at = null, closed_by = null where id = v_f::uuid and status = 'closed';
  end loop;
  perform set_config('app.audit_reason', '', true);
  update public.stays set status = 'in_house', checked_out_at = null, checked_out_by = null, checkout_business_date = null,
    checkout_approval_id = null, checkout_reason = null, checkout_snapshot = null where id = s.id;
  perform app.log_res(r, 'undo_check_out', p_reason, null);
end $$;
