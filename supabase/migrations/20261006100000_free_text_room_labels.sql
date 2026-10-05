-- Room labels are free text (stage 1, decision of 6 Oct 2026; requirement ROOM-005).
--
-- Before: a room "number" was any text, but Bulk add made plain numbers only, rooms were sorted by length
-- then text (fine for 101, wrong for names), uniqueness was exact (A101 and a101 could both exist), and
-- messages and new folio lines put the word "Room" in front ("Room Zurich is occupied").
-- After:
--   * A label is up to 30 characters: letters (accented too), digits, spaces, hyphens and apostrophes.
--     Spaces are tidied (trimmed, single). Stored as typed otherwise. Checked on every insert and rename.
--   * Unique per hotel ignoring case and extra spaces.
--   * Natural order everywhere the database sorts rooms (2 before 10, names A to Z): collation app.natural.
--   * "Add several rooms": add_rooms_range (optional prefix + range) and add_rooms_named (one per line).
--     Both preview, skip duplicates, cap 500 per batch, and keep the plan room limit. bulk_add_rooms stays.
--   * Messages and new folio lines show the label as typed: "Zurich is occupied.", "Zurich · 06 Oct 2026".
--     Lines already posted and invoices already issued keep their text: both are insert-only snapshots.
-- The 17 rewritten functions below are their current definitions with only those wording and ordering edits.

create collation if not exists app.natural (provider = icu, locale = 'und-u-kn-true');

-- Tidies a label and checks it. Raises E_REQUIRED or E_INVALID. Letters: Latin, Latin-1, Latin Extended A/B
-- and Additional (Yoruba, Igbo, Hausa, French, German...), plus combining accents after a letter or digit.
create or replace function app.room_label(p_label text)
returns text language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare v text;
begin
  v := regexp_replace(btrim(normalize(coalesce(p_label, ''), NFC)), '\s+', ' ', 'g');
  if v = '' then perform app.fail('E_REQUIRED', 'Room name or number is required.'); end if;
  if char_length(v) > 30 then perform app.fail('E_INVALID', 'A room name or number can be at most 30 characters.'); end if;
  if v !~ (E'^[0-9A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF]'
           || E'[0-9A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF\u0300-\u036F ''\u2019-]*$') then
    perform app.fail('E_INVALID', 'A room name or number can use letters, numbers, spaces, hyphens and apostrophes only: ' || v);
  end if;
  return v;
end $$;

create or replace function app.rooms_tidy_label() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.room_number := app.room_label(new.room_number);
  return new;
end $$;
create trigger rooms_tidy_label before insert or update of room_number on public.rooms
  for each row execute function app.rooms_tidy_label();

create unique index rooms_property_label_key on public.rooms (property_id, lower(room_number));

-- Same as before, with the free-text wording.
create or replace function public.save_room(
  p_property_id uuid, p_id uuid, p_room_number text, p_room_type_id uuid, p_floor text, p_is_active boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_tenant uuid;
begin
  perform app.require('setup.room.manage', p_property_id);
  if coalesce(btrim(p_room_number), '') = '' then perform app.fail('E_REQUIRED', 'Room name or number is required.'); end if;
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = p_property_id) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  begin
    if p_id is null then
      insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor, is_active)
      values (v_tenant, p_property_id, p_room_number, p_room_type_id, nullif(btrim(p_floor), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.rooms set room_number = p_room_number, room_type_id = p_room_type_id,
        floor = nullif(btrim(p_floor), ''), is_active = coalesce(p_is_active, true)
      where id = p_id and property_id = p_property_id returning id into v_id;
      if v_id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
    end if;
  exception when unique_violation then
    perform app.fail('E_DUPLICATE', 'A room with that name or number already exists: ' || app.room_label(p_room_number));
  end;
  return v_id;
end $$;

-- Shared by both "Add several rooms" modes. p_labels in the order typed; blanks already removed.
-- Returns would_create, skipped (already there, or repeated in the list), invalid (label and reason),
-- created (0 in a preview), room_limit (null = no limit) and rooms_now.
create or replace function app.add_rooms(p_property_id uuid, p_labels text[], p_room_type_id uuid, p_floor text, p_preview boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_label text; v_raw text; v_seen text[] := '{}'; v_create text[] := '{}'; v_skip text[] := '{}';
  v_invalid jsonb := '[]'; v_limit integer; v_now integer; v_count integer := 0;
begin
  perform app.require('setup.room.manage', p_property_id);
  if coalesce(array_length(p_labels, 1), 0) = 0 then perform app.fail('E_REQUIRED', 'Enter at least one room.'); end if;
  if array_length(p_labels, 1) > 500 then perform app.fail('E_INVALID', 'You can add at most 500 rooms at a time.'); end if;
  if not exists (select 1 from public.room_types where id = p_room_type_id and property_id = p_property_id) then
    perform app.fail('E_INVALID', 'Choose a room type for this property.'); end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;

  foreach v_raw in array p_labels loop
    begin
      v_label := app.room_label(v_raw);
    exception when others then
      v_invalid := v_invalid || jsonb_build_object('label', btrim(v_raw), 'reason', regexp_replace(sqlerrm, '^\[[A-Z_]+\] ', ''));
      continue;
    end;
    if lower(v_label) = any (v_seen)
       or exists (select 1 from public.rooms r where r.property_id = p_property_id and lower(r.room_number) = lower(v_label)) then
      v_skip := v_skip || v_label;
    else
      v_create := v_create || v_label;
    end if;
    v_seen := v_seen || lower(v_label);
  end loop;

  select pl.max_rooms into v_limit
  from public.tenant_subscriptions s join public.plans pl on pl.code = s.plan_code where s.tenant_id = v_tenant;
  select count(*) into v_now from public.rooms where tenant_id = v_tenant and is_active;

  if not p_preview then
    if jsonb_array_length(v_invalid) > 0 then
      perform app.fail('E_INVALID', format('%s room name(s) are not allowed, for example "%s". Nothing was added.',
        jsonb_array_length(v_invalid), v_invalid->0->>'label'));
    end if;
    -- The plan limit trigger refuses the first room over the limit, which undoes the whole batch.
    insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor)
    select v_tenant, p_property_id, x, p_room_type_id, nullif(btrim(p_floor), '') from unnest(v_create) with ordinality u(x, n) order by n;
    get diagnostics v_count = row_count;
  end if;

  return jsonb_build_object('would_create', to_jsonb(v_create), 'skipped', to_jsonb(v_skip), 'invalid', v_invalid,
    'created', v_count, 'room_limit', v_limit, 'rooms_now', v_now);
end $$;

-- Numbers mode: optional prefix (letters and digits, up to 4) + a range, no zero padding. A + 8..10 = A8, A9, A10.
create or replace function public.add_rooms_range(p_property_id uuid, p_prefix text, p_from integer, p_to integer,
  p_room_type_id uuid, p_floor text, p_preview boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prefix text := btrim(normalize(coalesce(p_prefix, ''), NFC));
begin
  perform app.require('setup.room.manage', p_property_id);
  if v_prefix !~ E'^[0-9A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF]{0,4}$' then
    perform app.fail('E_INVALID', 'A prefix is up to 4 letters or digits, for example A or 1F.'); end if;
  if p_from is null or p_to is null or p_from < 0 or p_to < p_from then
    perform app.fail('E_INVALID', 'Enter a valid range, for example 101 to 120.'); end if;
  if p_to - p_from + 1 > 500 then perform app.fail('E_INVALID', 'You can add at most 500 rooms at a time.'); end if;
  return app.add_rooms(p_property_id, array(select v_prefix || g from generate_series(p_from, p_to) g order by g),
    p_room_type_id, p_floor, coalesce(p_preview, true));
end $$;

-- Names mode: one name per line; blank lines are ignored.
create or replace function public.add_rooms_named(p_property_id uuid, p_names text[], p_room_type_id uuid,
  p_floor text, p_preview boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require('setup.room.manage', p_property_id);
  return app.add_rooms(p_property_id, array(select x from unnest(p_names) with ordinality u(x, n) where btrim(coalesce(x, '')) <> '' order by n),
    p_room_type_id, p_floor, coalesce(p_preview, true));
end $$;

revoke all on function app.room_label(text), app.rooms_tidy_label(), app.add_rooms(uuid, text[], uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.add_rooms_range(uuid, text, integer, integer, uuid, text, boolean),
  public.add_rooms_named(uuid, text[], uuid, text, boolean) from public, anon;
grant execute on function public.add_rooms_range(uuid, text, integer, integer, uuid, text, boolean),
  public.add_rooms_named(uuid, text[], uuid, text, boolean) to authenticated;

-- Wording and ordering in the functions that name or sort rooms (current definitions, label as typed).
CREATE OR REPLACE FUNCTION app.assignment_not_blocked()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_no text;
begin
  if new.is_active and app.room_blocked(new.room_id, new.from_date, new.to_date) then
    select room_number into v_no from public.rooms where id = new.room_id;
    perform app.fail('E_ROOM_BLOCKED', coalesce(v_no, '') || ' is blocked on these dates.');
  end if;
  return new;
end $function$

;

CREATE OR REPLACE FUNCTION app.check_arrival_room(p_property uuid, p_room uuid, p_override_reason text)
 RETURNS rooms
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare rm public.rooms;
begin
  select * into rm from public.rooms where id = p_room and property_id = p_property for update;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if not rm.is_active or rm.condition = 'out_of_order' then
    perform app.fail('E_ROOM_NOT_READY', rm.room_number || ' is blocked and cannot be used.'); end if;
  if rm.is_occupied then perform app.fail('E_ROOM_NOT_READY', rm.room_number || ' is occupied.'); end if;
  if not app.room_ready(rm) then
    if not app.can('fo.room.override', p_property) then
      perform app.fail('E_ROOM_NOT_READY', rm.room_number || ' is not ready. Only clean or inspected rooms can be used.'); end if;
    if coalesce(btrim(p_override_reason), '') = '' then
      perform app.fail('E_REQUIRED', 'A reason is required to use a room that is not ready.'); end if;
  end if;
  return rm;
end $function$

;

CREATE OR REPLACE FUNCTION app.check_block(rm rooms, p_from date, p_to date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_day date;
begin
  perform pg_advisory_xact_lock(hashtextextended('avail:' || rm.property_id::text || ':' || rm.room_type_id::text, 0));
  if exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, p_to, '[)')) then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' has a guest assigned on these dates. Move them first.');
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
    perform app.fail('E_OVERSOLD', 'Blocking ' || rm.room_number || ' would leave the hotel oversold on '
      || to_char(v_day, 'DD Mon YYYY') || '.');
  end if;
end $function$

;

CREATE OR REPLACE FUNCTION app.insert_same_day_charge(p_res uuid, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; p public.properties; cc public.charge_codes; v_folio uuid; v_key text; v_id uuid;
  v_amt numeric; v_rn text; l record;
begin
  select * into r from public.reservations where id = p_res;
  select * into p from public.properties where id = r.property_id;
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'No active room charge code. Add one in Setup.'); end if;
  v_amt := round(coalesce(p_amount, 0), 2);
  if v_amt <= 0 then return null; end if;
  select rm.room_number into v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
  where a.reservation_id = r.id and a.is_active limit 1;
  -- Same key as the nightly room charge for this date, so the roll never charges the night again.
  v_key := 'room:' || r.id || ':' || p.business_date;
  if exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key) then
    v_key := v_key || ':' || gen_random_uuid();
  end if;
  v_folio := app.ensure_main_folio(r.id);
  insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
    base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
  values (p.tenant_id, p.id, v_folio, 'charge', cc.id, v_amt, p.base_currency, 1, v_amt, false,
    coalesce(v_rn, '') || ' · same-day stay · ' || to_char(p.business_date, 'DD Mon YYYY'), r.number, v_key, p.business_date)
  returning id into v_id;
  if cc.is_taxable then
    for l in select * from public.calculate_tax(p.id, v_amt, false) order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
  end if;
  return v_id;
end $function$

;

CREATE OR REPLACE FUNCTION app.roll_overstays(p properties, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s record; r public.reservations; d date; v_amt numeric; v_room uuid; v_rn text; v_max int;
  v_extended int := 0; v_flagged int := 0; v_err text;
begin
  for s in
    select st.reservation_id, st.room_id from public.stays st
    join public.reservations x on x.id = st.reservation_id
    where st.property_id = p.id and st.status = 'in_house' and x.status = 'checked_in' and x.departure_date <= p_date
  loop
    select * into r from public.reservations where id = s.reservation_id for update;
    select a.room_id, rm.room_number into v_room, v_rn from public.room_assignments a join public.rooms rm on rm.id = a.room_id
    where a.reservation_id = r.id and a.is_active order by a.to_date desc limit 1;
    begin
      -- Same limit as the Extend button: never extend past the property's maximum stay.
      select max_stay_nights into v_max from public.properties where id = r.property_id;
      if v_max is not null and (p_date + 1) - r.arrival_date > v_max then
        perform app.fail('E_INVALID', 'The stay has reached the maximum of ' || v_max || ' nights at this property.');
      end if;
      perform app.assert_available(r.property_id, r.room_type_id, r.departure_date, p_date + 1, r.id);
      begin
        update public.room_assignments set to_date = p_date + 1 where reservation_id = r.id and is_active and room_id = v_room;
      exception when exclusion_violation then
        perform app.fail('E_ROOM_TAKEN', v_rn || ' is booked for another guest tonight.');
      end;
      for d in select g::date from generate_series(r.departure_date, p_date, interval '1 day') g loop
        v_amt := r.rate_override;
        if v_amt is null then
          select pr.amount into v_amt from public.rate_plan_prices pr
          where pr.rate_plan_id = r.rate_plan_id and pr.room_type_id = r.room_type_id and d between pr.valid_from and pr.valid_to limit 1;
        end if;
        if v_amt is null then perform app.fail('E_NO_RATE', 'No price is set for ' || to_char(d, 'DD Mon YYYY') || '.'); end if;
        begin
          insert into public.reservation_nights(tenant_id, property_id, reservation_id, room_type_id, stay_date, rate_amount, room_id)
          values (r.tenant_id, r.property_id, r.id, r.room_type_id, d, v_amt, v_room);
        exception when unique_violation then
          perform app.fail('E_ROOM_TAKEN', v_rn || ' is booked for another guest tonight.');
        end;
      end loop;
      update public.reservations set departure_date = p_date + 1,
        total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = r.id),
        updated_at = now()
      where id = r.id;
      perform app.log_res(r, 'auto_extend_overstay', 'Still in house after departure (business date roll)',
        jsonb_build_object('from', r.departure_date, 'to', p_date + 1, 'room', v_rn));
      v_extended := v_extended + 1;
    exception when others then
      v_err := regexp_replace(sqlerrm, '^\[[A-Z0-9_]+\]\s*', '');
      perform app.log_res(r, 'overstay_not_extended', v_err, jsonb_build_object('departure', r.departure_date, 'room', v_rn));
      insert into public.notifications(tenant_id, property_id, user_id, kind, title, body, link, entity_id)
      select distinct p.tenant_id, p.id, upr.user_id, 'overstay', 'Guest still in house after departure',
        coalesce(v_rn, '?') || ', booking ' || r.number || ': due out ' || to_char(r.departure_date, 'DD Mon YYYY')
          || ' and still in house. The stay was not extended: ' || v_err || ' Check the guest out or move them.',
        '/reservations/' || r.id, r.id
      from public.user_property_roles upr
      join public.role_permissions rp on rp.role_id = upr.role_id and rp.permission_key = 'fin.nightaudit.run'
      join public.profiles pr on pr.id = upr.user_id and pr.status = 'active'
      where upr.property_id = p.id
        and not exists (select 1 from public.notifications n where n.user_id = upr.user_id and n.kind = 'overstay'
                        and n.entity_id = r.id and n.created_at::date = current_date);
      v_flagged := v_flagged + 1;
    end;
  end loop;
  return jsonb_build_object('extended', v_extended, 'flagged', v_flagged);
end $function$

;

CREATE OR REPLACE FUNCTION app.roll_room_charges(p properties, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cc public.charge_codes; s record; v_key text; v_id uuid; v_folio uuid; v_posted int := 0; l record;
begin
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'No active room charge code. Add one in Setup.'); end if;
  create temp table if not exists _roll_tax (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;
  for s in
    select st.reservation_id, n.rate_amount, rm.room_number, r.number
    from public.stays st
    join public.reservations r on r.id = st.reservation_id
    join public.reservation_nights n on n.reservation_id = r.id and n.stay_date = p_date
    join public.rooms rm on rm.id = st.room_id
    where st.property_id = p.id and st.status = 'in_house'
  loop
    v_key := 'room:' || s.reservation_id || ':' || p_date;
    continue when exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key);
    v_folio := app.ensure_main_folio(s.reservation_id);
    continue when (select status from public.folios where id = v_folio) <> 'open' or round(s.rate_amount, 2) <= 0;
    delete from _roll_tax where true;
    if cc.is_taxable then insert into _roll_tax select * from public.calculate_tax(p.id, round(s.rate_amount, 2), false); end if;
    insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
      base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
    values (p.tenant_id, p.id, v_folio, 'charge', cc.id, round(s.rate_amount, 2), p.base_currency, 1, round(s.rate_amount, 2), false,
      s.room_number || ' · ' || to_char(p_date, 'DD Mon YYYY'), s.number, v_key, p_date)
    returning id into v_id;
    for l in select * from _roll_tax order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
    v_posted := v_posted + 1;
  end loop;
  return v_posted;
end $function$

;

CREATE OR REPLACE FUNCTION app.set_arrival_room(r reservations, p_room uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare rm public.rooms;
begin
  select * into rm from public.rooms where id = p_room and property_id = r.property_id;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if rm.room_type_id <> r.room_type_id then perform app.fail('E_INVALID', 'The room must be of the booked room type.'); end if;
  if exists (select 1 from public.room_assignments where reservation_id = r.id and is_active and room_id = p_room) then return; end if;
  perform app.release_rooms(r.id);
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, r.id, p_room, r.arrival_date, r.departure_date);
    update public.reservation_nights set room_id = p_room where reservation_id = r.id;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is already assigned to another stay on these dates.');
  end;
  perform app.log_res(r, 'assign_room', null, jsonb_build_object('room_id', p_room, 'room_number', rm.room_number));
end $function$

;

CREATE OR REPLACE FUNCTION public.assign_hk_task(p_id uuid, p_assignee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    (select room_number from public.rooms where id = t.room_id) || ' · ' || replace(t.type, '_', ' '));
end $function$

;

CREATE OR REPLACE FUNCTION public.assign_room(p_id uuid, p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; rm public.rooms;
begin
  r := app.reservation_for_write(p_id, 'res.edit');
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Rooms can be assigned only to tentative or confirmed bookings.'); end if;
  select * into rm from public.rooms where id = p_room_id and property_id = r.property_id;
  if rm.id is null then perform app.fail('E_NOT_FOUND', 'Room not found.'); end if;
  if rm.room_type_id <> r.room_type_id then perform app.fail('E_INVALID', 'The room must be of the booked room type.'); end if;
  if not rm.is_active or rm.condition = 'out_of_order' then perform app.fail('E_INVALID', rm.room_number || ' cannot be used right now.'); end if;
  perform app.release_rooms(p_id);
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, r.arrival_date, r.departure_date);
    update public.reservation_nights set room_id = p_room_id where reservation_id = p_id;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is already assigned to another stay on these dates.');
  end;
  perform app.log_res(r, 'assign_room', null, jsonb_build_object('room_id', p_room_id, 'room_number', rm.room_number));
end $function$

;

CREATE OR REPLACE FUNCTION public.extend_stay(p_id uuid, p_new_departure date, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_max int; d date; v_amt numeric; v_room uuid; v_rn text;
begin
  r := app.reservation_for_write(p_id, 'fo.stay.extend');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house stays can be extended.'); end if;
  if p_new_departure is null or p_new_departure <= r.departure_date then
    perform app.fail('E_INVALID', 'The new departure must be after ' || to_char(r.departure_date, 'DD Mon YYYY') || '.'); end if;
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
    perform app.fail('E_ROOM_TAKEN', v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
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
      perform app.fail('E_ROOM_TAKEN', v_rn || ' is booked for another guest on those dates. Move the guest to another room first.');
    end;
  end loop;

  perform set_config('app.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.reservations set departure_date = p_new_departure,
    total_amount = (select coalesce(sum(rate_amount), 0) from public.reservation_nights where reservation_id = p_id),
    updated_at = now()
  where id = p_id;
  perform set_config('app.audit_reason', '', true);
end $function$

;

CREATE OR REPLACE FUNCTION public.get_assignable_rooms(p_id uuid)
 RETURNS TABLE(id uuid, room_number text, floor text, condition text, is_occupied boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations;
begin
  select * into r from public.reservations x where x.id = p_id and x.tenant_id = app.my_tenant();
  if r.id is null or not app.can('res.view', r.property_id) then perform app.fail('E_NOT_FOUND', 'Reservation not found.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.condition, rm.is_occupied
  from public.rooms rm
  where rm.room_type_id = r.room_type_id and rm.is_active and rm.condition <> 'out_of_order'
    and not app.room_blocked(rm.id, r.arrival_date, greatest(r.departure_date, r.arrival_date + 1))
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id <> r.id
        and daterange(a.from_date, a.to_date, '[)') && daterange(r.arrival_date, greatest(r.departure_date, r.arrival_date + 1), '[)'))
  order by rm.room_number collate app.natural;
end $function$

;

CREATE OR REPLACE FUNCTION public.get_front_desk_rooms(p_property_id uuid, p_room_type_id uuid, p_from date, p_to date, p_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, room_number text, floor text, room_type_id uuid, room_type_code text, condition text, is_occupied boolean, is_ready boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not app.can('fo.view', p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view the front desk.'); end if;
  if p_from is null or p_to is null or p_to < p_from then perform app.fail('E_INVALID', 'Departure cannot be before arrival.'); end if;
  return query
  select rm.id, rm.room_number, rm.floor, rm.room_type_id, rt.code, rm.condition, rm.is_occupied, app.room_ready(rm)
  from public.rooms rm join public.room_types rt on rt.id = rm.room_type_id
  where rm.property_id = p_property_id and rm.is_active and rm.condition <> 'out_of_order'
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and not app.room_blocked(rm.id, p_from, p_to)
    and not exists (select 1 from public.room_assignments a
      where a.room_id = rm.id and a.is_active and a.reservation_id is distinct from p_reservation_id
        and daterange(a.from_date, a.to_date, '[)') && daterange(p_from, greatest(p_to, p_from + 1), '[)'))
  order by rt.code, rm.room_number collate app.natural;
end $function$

;

CREATE OR REPLACE FUNCTION public.inspect_hk_task(p_id uuid, p_pass boolean, p_result text DEFAULT 'inspected'::text, p_defects jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      (select room_number from public.rooms where id = t.room_id) || ': ' || (select string_agg(x, ', ') from jsonb_array_elements_text(v_defects) x));
  end if;
end $function$

;

CREATE OR REPLACE FUNCTION public.move_room(p_id uuid, p_room_id uuid, p_reason text, p_room_override_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; s public.stays; rm public.rooms; old_rm public.rooms; v_bdate date; v_from date; v_stay uuid;
begin
  r := app.reservation_for_write(p_id, 'fo.room.move');
  if r.status <> 'checked_in' then perform app.fail('E_INVALID', 'Only in-house guests can be moved.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into s from public.stays where reservation_id = p_id and status = 'in_house' for update;
  if s.room_id = p_room_id then perform app.fail('E_INVALID', 'The guest is already in this room.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  v_from := greatest(v_bdate, r.arrival_date);
  if v_from >= r.departure_date then perform app.fail('E_INVALID', 'The guest departs today. Check them out instead.'); end if;

  rm := app.check_arrival_room(r.property_id, p_room_id, p_room_override_reason);
  if rm.room_type_id <> r.room_type_id then
    perform app.assert_available(r.property_id, rm.room_type_id, v_from, r.departure_date, p_id);
  end if;

  update public.room_assignments set is_active = false, released_at = now() where reservation_id = p_id and is_active;
  begin
    insert into public.room_assignments(tenant_id, property_id, reservation_id, room_id, from_date, to_date)
    values (r.tenant_id, r.property_id, p_id, p_room_id, v_from, r.departure_date);
    update public.reservation_nights set room_id = null where reservation_id = p_id and stay_date >= v_from;
    update public.reservation_nights set room_id = p_room_id, room_type_id = rm.room_type_id
    where reservation_id = p_id and stay_date >= v_from;
  exception when exclusion_violation or unique_violation then
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is assigned to another stay on these dates.');
  end;
  if rm.room_type_id <> r.room_type_id then
    update public.reservations set room_type_id = rm.room_type_id, updated_at = now() where id = p_id;
  end if;

  select * into old_rm from public.rooms where id = s.room_id;
  update public.stays set status = 'moved', checked_out_at = now() where id = s.id;
  update public.rooms set is_occupied = false, condition = 'dirty' where id = s.room_id;
  perform app.hk_new_turnover(s.room_id, s.id, 'Room move ' || r.number);
  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration, room_override_reason)
  values (r.tenant_id, r.property_id, p_id, p_room_id, v_bdate, s.registration,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end)
  returning id into v_stay;
  update public.rooms set is_occupied = true where id = p_room_id;
  perform app.log_res(r, 'move_room', p_reason, jsonb_build_object('from_room', old_rm.room_number, 'room_number', rm.room_number));
  return v_stay;
end $function$

;

CREATE OR REPLACE FUNCTION public.post_room_charges(p_property_id uuid, p_business_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.properties; v_date date; cc public.charge_codes; s record; v_key text; v_id uuid; v_folio uuid;
  v_posted int := 0; v_skipped int := 0; l record;
begin
  perform app.assert_writable();
  perform app.require('fin.nightaudit.run', p_property_id);
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if p.id is null then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  v_date := coalesce(p_business_date, p.business_date);
  if v_date > p.business_date then perform app.fail('E_INVALID', 'Room charges cannot be posted for a future date.'); end if;
  select * into cc from public.charge_codes where property_id = p.id and category = 'room' and is_active order by (code = 'ROOM') desc, code limit 1;
  if cc.id is null then perform app.fail('E_INVALID', 'Add an active room charge code in Setup first.'); end if;

  create temp table if not exists _room_tax (line_no int, tax_code text, tax_name text, percent numeric, taxable_base numeric, amount numeric) on commit drop;

  for s in
    select st.reservation_id, n.rate_amount, rm.room_number, r.number
    from public.stays st
    join public.reservations r on r.id = st.reservation_id
    join public.reservation_nights n on n.reservation_id = r.id and n.stay_date = v_date
    join public.rooms rm on rm.id = st.room_id
    where st.property_id = p.id and st.status = 'in_house'
  loop
    v_key := 'room:' || s.reservation_id || ':' || v_date;
    if exists (select 1 from public.folio_transactions where tenant_id = p.tenant_id and idempotency_key = v_key) then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_folio := app.ensure_main_folio(s.reservation_id);
    if (select status from public.folios where id = v_folio) <> 'open' or round(s.rate_amount, 2) <= 0 then
      v_skipped := v_skipped + 1; continue;
    end if;
    delete from _room_tax where true;
    if cc.is_taxable then insert into _room_tax select * from public.calculate_tax(p.id, round(s.rate_amount, 2), false); end if;
    begin
      insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, charge_code_id, amount, currency, fx_rate,
        base_amount, tax_inclusive, description, reference, idempotency_key, business_date)
      values (p.tenant_id, p.id, v_folio, 'charge', cc.id, round(s.rate_amount, 2), p.base_currency, 1, round(s.rate_amount, 2), false,
        s.room_number || ' · ' || to_char(v_date, 'DD Mon YYYY'), s.number, v_key, v_date)
      returning id into v_id;
    exception when unique_violation then
      v_skipped := v_skipped + 1; continue;
    end;
    for l in select * from _room_tax order by line_no loop
      insert into public.folio_tax_lines(tenant_id, property_id, transaction_id, line_no, tax_code, tax_name, percent, taxable_base, amount, base_amount)
      values (p.tenant_id, p.id, v_id, l.line_no, l.tax_code, l.tax_name, l.percent, l.taxable_base, l.amount, l.amount);
    end loop;
    v_posted := v_posted + 1;
  end loop;
  return jsonb_build_object('business_date', v_date, 'posted', v_posted, 'skipped', v_skipped);
end $function$

;

CREATE OR REPLACE FUNCTION public.request_room_block(p_room_id uuid, p_type text, p_from date, p_to date, p_reason text, p_ticket_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    perform app.fail('E_INVALID', rm.room_number || ' already has a block on these dates.');
  end;
  return v_id;
end $function$

;

CREATE OR REPLACE FUNCTION public.undo_checkout(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  if rm.is_occupied then perform app.fail('E_ROOM_TAKEN', rm.room_number || ' is occupied again. Undo is not possible.'); end if;

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
    perform app.fail('E_ROOM_TAKEN', rm.room_number || ' has been assigned to another booking.');
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
end $function$

;