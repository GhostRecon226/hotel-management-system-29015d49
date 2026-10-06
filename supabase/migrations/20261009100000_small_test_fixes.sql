-- Wave 1, item 2 (6 Oct 2026): the small fixes behind known test failures.
--
-- FO-008   Before: extend_stay only moved the departure later. After: it also shortens an in-house stay to any
--          date after the business date, removing the unused nights, releasing the room from the new
--          departure and repricing the stay.
-- HK-002   Before: anyone could start a task nobody was assigned to (it assigned itself). After: a task must be
--          assigned first. Before: room attendants (hk.view at level O) saw every task. After: level O on
--          hk.view means "tasks assigned to me", like fin.folio.view level O for reservation officers.
-- ROOM-004 Before: a manual condition change needed a reason only when leaving out of order. After: every manual
--          change needs a reason (it is an override of housekeeping's own flow).
-- PLT-004  Before: every new property got naira and the Lagos time zone. After: the country picks them
--          (Ghana GHS Africa/Accra, Kenya KES Africa/Nairobi, South Africa ZAR Africa/Johannesburg; Nigeria and
--          anything else keep NGN Africa/Lagos). Tax lines are still seeded for Nigeria only.
-- RES-013  New flag reservations.arrival_ready (not a status), set by front desk with set_arrival_ready.
-- SET-008  New switch properties.inspection_required (on by default), set with set_inspection_required. Off: a
--          completed task closes as passed and the room is clean, with no inspection step.

-- FO-008 ---------------------------------------------------------------------------------------------------------
create or replace function public.extend_stay(p_id uuid, p_new_departure date, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations; v_max int; d date; v_amt numeric; v_room uuid; v_rn text; v_bdate date;
begin
  r := app.reservation_for_write(p_id, 'fo.stay.extend');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house stays can be extended or shortened.'); end if;
  if p_new_departure is null or p_new_departure = r.departure_date then
    perform app.fail('E_INVALID', 'Choose a departure date other than ' || to_char(r.departure_date, 'DD Mon YYYY') || '.'); end if;

  if p_new_departure < r.departure_date then
    -- Shorten: nights from the new departure on have not been charged yet (they are after the business date).
    select business_date into v_bdate from public.properties where id = r.property_id;
    if p_new_departure <= v_bdate then
      perform app.fail('E_INVALID', 'The new departure must be after ' || to_char(v_bdate, 'DD Mon YYYY') || '. To leave today, check the guest out.'); end if;
    delete from public.reservation_nights where reservation_id = p_id and stay_date >= p_new_departure;
    update public.room_assignments set to_date = p_new_departure
    where reservation_id = p_id and is_active and to_date > p_new_departure and from_date < p_new_departure;
  else
    select max_stay_nights into v_max from public.properties where id = r.property_id;
    if p_new_departure - r.arrival_date > v_max then
      perform app.fail('E_INVALID', 'Stays can be at most ' || v_max || ' nights at this property.'); end if;
    perform app.assert_available(r.property_id, r.room_type_id, r.departure_date, p_new_departure, p_id);

    select a.room_id, rm.room_number into v_room, v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
    where a.reservation_id = p_id and a.is_active order by a.to_date desc limit 1;
    begin
      update public.room_assignments set to_date = p_new_departure
      where reservation_id = p_id and is_active and room_id = v_room;
    exception when exclusion_violation then
      perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
    end;

    for d in select g::date from generate_series(r.departure_date, p_new_departure - 1, interval '1 day') g loop
      select p.amount into v_amt from public.rate_plan_prices p
      where p.rate_plan_id = r.rate_plan_id and p.room_type_id = r.room_type_id and d between p.valid_from and p.valid_to limit 1;
      if r.rate_override is not null then v_amt := r.rate_override; end if;
      if v_amt is null then
        perform app.fail('E_NO_RATE', 'No price is set for this rate plan and room type on ' || to_char(d, 'DD Mon YYYY') || '.'); end if;
      begin
        insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
        values (r.tenant_id, r.property_id, p_id, r.room_type_id, d, v_amt, v_room);
      exception when unique_violation then
        perform app.fail('E_ROOM_TAKEN', 'Room ' || v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
      end;
    end loop;
  end if;

  perform set_config('app.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.reservations set departure_date = p_new_departure,
    total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = p_id),
    updated_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
end $$;

-- HK-002 ---------------------------------------------------------------------------------------------------------
create or replace function public.start_hk_task(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.complete', t.property_id);
  if t.status = 'in_progress' then return; end if;
  if t.status not in ('open', 'assigned', 'failed') then perform app.fail('E_INVALID', 'This task cannot be started.'); end if;
  if t.assignee_id is null then perform app.fail('E_INVALID', 'Assign this task to someone before it is started.'); end if;
  if t.assignee_id <> auth.uid() and not app.can('hk.task.assign', t.property_id) then
    perform app.fail('E_FORBIDDEN', 'This task is assigned to someone else.'); end if;
  update public.hk_tasks set status = 'in_progress', started_at = now() where id = t.id;
end $$;

drop policy "Housekeeping and front desk read tasks" on public.hk_tasks;
create policy "Housekeeping and front desk read tasks" on public.hk_tasks for select to authenticated
  using (tenant_id = app.my_tenant() and (
    app.can('fo.view', property_id)
    or (app.can('hk.view', property_id)
        and (coalesce(app.my_level('hk.view', property_id), '') <> 'O' or assignee_id = auth.uid()))));

-- ROOM-004 -------------------------------------------------------------------------------------------------------
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
  if coalesce(btrim(p_reason), '') = '' then
    perform app.fail('E_REQUIRED', 'Give a reason for changing the room condition by hand.'); end if;
  if p_condition = rm.condition then return; end if;
  update public.rooms set condition = p_condition where id = rm.id;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values (rm.tenant_id, auth.uid(), 'set_room_condition', 'rooms', rm.id::text,
    jsonb_build_object('condition', rm.condition), jsonb_build_object('condition', p_condition), btrim(p_reason));
end $$;

-- PLT-004 --------------------------------------------------------------------------------------------------------
create or replace function app.property_country_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Only replaces the column defaults, never a currency or time zone given on purpose.
  if new.base_currency = 'NGN' and new.timezone = 'Africa/Lagos' then
    case lower(btrim(coalesce(new.country, '')))
      when 'ghana', 'gh' then new.base_currency := 'GHS'; new.timezone := 'Africa/Accra';
      when 'kenya', 'ke' then new.base_currency := 'KES'; new.timezone := 'Africa/Nairobi';
      when 'south africa', 'za' then new.base_currency := 'ZAR'; new.timezone := 'Africa/Johannesburg';
      else null;
    end case;
  end if;
  return new;
end $$;
create trigger properties_country_defaults before insert on public.properties
  for each row execute function app.property_country_defaults();

-- RES-013 --------------------------------------------------------------------------------------------------------
alter table public.reservations add column arrival_ready boolean not null default false;
comment on column public.reservations.arrival_ready is 'RES-013: front desk has everything ready for this arrival. A flag, not a status.';

create or replace function public.set_arrival_ready(p_reservation_id uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservations;
begin
  r := app.reservation_for_write(p_reservation_id, 'fo.checkin');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only upcoming arrivals can be marked ready.'); end if;
  update public.reservations set arrival_ready = coalesce(p_ready, false), updated_at = now() where id = r.id;
end $$;
revoke all on function public.set_arrival_ready(uuid, boolean) from public, anon;
grant execute on function public.set_arrival_ready(uuid, boolean) to authenticated;

-- SET-008 --------------------------------------------------------------------------------------------------------
alter table public.properties add column inspection_required boolean not null default true;
comment on column public.properties.inspection_required is 'SET-008: off means a completed housekeeping task closes as passed, with no inspection.';

create or replace function public.set_inspection_required(p_property_id uuid, p_required boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.assert_writable();
  perform app.require('setup.property.edit', p_property_id);
  update public.properties set inspection_required = coalesce(p_required, true)
  where id = p_property_id and tenant_id = app.my_tenant();
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (app.my_tenant(), auth.uid(), 'set_inspection_required', 'properties', p_property_id::text,
    jsonb_build_object('inspection_required', coalesce(p_required, true)));
end $$;
revoke all on function public.set_inspection_required(uuid, boolean) from public, anon;
grant execute on function public.set_inspection_required(uuid, boolean) to authenticated;

create or replace function public.complete_hk_task(p_id uuid, p_checklist jsonb default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.hk_tasks; v_inspect boolean;
begin
  t := app.hk_task_for_write(p_id);
  perform app.require('hk.task.complete', t.property_id);
  if t.status in ('done', 'inspected') then return; end if;
  if t.status <> 'in_progress' then perform app.fail('E_INVALID', 'Start the task before completing it.'); end if;
  if t.assignee_id <> auth.uid() and not app.can('hk.task.assign', t.property_id) then
    perform app.fail('E_FORBIDDEN', 'This task is assigned to someone else.'); end if;
  if p_checklist is not null and jsonb_typeof(p_checklist) <> 'array' then perform app.fail('E_INVALID', 'Checklist must be a list.'); end if;
  select inspection_required into v_inspect from public.properties where id = t.property_id;
  if coalesce(v_inspect, true) then
    update public.hk_tasks set status = 'done', completed_at = now(), completed_by = auth.uid(),
      checklist = coalesce(p_checklist, checklist), notes = coalesce(nullif(btrim(p_notes), ''), notes)
    where id = t.id;
    perform app.hk_set_room(t.room_id, 'dirty');
  else
    update public.hk_tasks set status = 'inspected', completed_at = now(), completed_by = auth.uid(),
      inspected_at = now(), inspection_result = 'clean',
      checklist = coalesce(p_checklist, checklist), notes = coalesce(nullif(btrim(p_notes), ''), notes)
    where id = t.id;
    perform app.hk_set_room(t.room_id, 'clean');
  end if;
end $$;
