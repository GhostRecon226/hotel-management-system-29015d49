-- Setup import (SET-010) and its AI start (AI-006).
-- A hotel pastes its room list. The AI only drafts the list (server side). This function checks the whole list and
-- adds all of it or nothing: room types first, then rooms. Existing codes and room names are skipped, so repeating
-- the same import adds nothing new. Preview mode (the default) writes nothing.

create or replace function app.ai_begin(p_feature text, p_property uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t uuid := app.my_tenant(); s public.ai_settings; v_id uuid;
begin
  select * into s from public.ai_settings where tenant_id = v_t;
  if not coalesce(s.enabled, false) then
    perform app.fail('E_AI_OFF', 'AI helpers are switched off for this hotel.');
  end if;
  if app.ai_used_this_month(v_t) >= s.monthly_cap then
    perform app.fail('E_AI_LIMIT', 'The monthly AI limit has been reached.');
  end if;
  insert into public.ai_usage(tenant_id, property_id, user_id, feature) values (v_t, p_property, auth.uid(), p_feature) returning id into v_id;
  return v_id;
end $$;

-- Start an import draft. The AI sees only the hotel's own room type codes and a room count, never guest data.
create or replace function public.ai_import_start(p_property_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform app.require('setup.room.manage', p_property_id);
  v_id := app.ai_begin('setup_import', p_property_id);
  return jsonb_build_object('usage_id', v_id, 'context', jsonb_build_object(
    'room_type_codes', coalesce((select jsonb_agg(code order by code) from public.room_types where property_id = p_property_id), '[]'::jsonb),
    'room_count', (select count(*)::int from public.rooms where property_id = p_property_id)));
end $$;

create or replace function public.apply_setup_import(p_property_id uuid, p_payload jsonb, p_preview boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tenant uuid; v_types jsonb; v_rooms jsonb; e jsonb; v_code text; v_name text; v_label text; v_tcode text; v_adults int; v_kids int;
  v_new_types jsonb[] := '{}'; v_new_rooms jsonb[] := '{}'; v_skip_types text[] := '{}'; v_skip_rooms int := 0;
  v_known text[]; v_seen_codes text[] := '{}'; v_seen_rooms text[] := '{}'; v_invalid jsonb := '[]'::jsonb;
  v_created_types int := 0; v_created_rooms int := 0; v_limit int; v_now int; x jsonb;
begin
  perform app.require('setup.room.manage', p_property_id);
  v_tenant := app.my_tenant();
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then perform app.fail('E_INVALID', 'The import list is empty or not in the right shape.'); end if;
  v_types := coalesce(p_payload->'room_types', '[]'::jsonb);
  v_rooms := p_payload->'rooms';
  if jsonb_typeof(v_types) <> 'array' or v_rooms is null or jsonb_typeof(v_rooms) <> 'array' then
    perform app.fail('E_INVALID', 'The import list is not in the right shape.'); end if;
  if jsonb_array_length(v_types) > 50 then perform app.fail('E_INVALID', 'An import can add at most 50 room types.'); end if;
  if jsonb_array_length(v_rooms) > 500 then perform app.fail('E_INVALID', 'An import can add at most 500 rooms.'); end if;

  select coalesce(array_agg(code), '{}') into v_known from public.room_types where property_id = p_property_id;

  for e in select value from jsonb_array_elements(v_types) loop
    v_code := upper(btrim(coalesce(e->>'code', '')));
    v_name := btrim(coalesce(e->>'name', ''));
    if v_code = '' or v_name = '' then
      v_invalid := v_invalid || jsonb_build_object('label', coalesce(nullif(v_code, ''), '(no code)'), 'reason', 'A room type needs a code and a name.'); continue; end if;
    v_adults := case when e->>'max_adults' is null then 2 when e->>'max_adults' ~ '^\d{1,2}$' then (e->>'max_adults')::int else 0 end;
    v_kids := case when e->>'max_children' is null then 0 when e->>'max_children' ~ '^\d{1,2}$' then (e->>'max_children')::int else -1 end;
    if v_adults < 1 or v_kids < 0 then
      v_invalid := v_invalid || jsonb_build_object('label', v_code, 'reason', 'Guest limits must be whole numbers, at least 1 adult.'); continue; end if;
    if v_code = any (v_seen_codes) then continue; end if;
    v_seen_codes := v_seen_codes || v_code;
    if v_code = any (v_known) then v_skip_types := v_skip_types || v_code;
    else
      v_new_types := v_new_types || jsonb_build_object('code', v_code, 'name', v_name, 'max_adults', v_adults, 'max_children', v_kids);
      v_known := v_known || v_code;
    end if;
  end loop;

  for e in select value from jsonb_array_elements(v_rooms) loop
    v_tcode := upper(btrim(coalesce(e->>'type_code', '')));
    begin
      v_label := app.room_label(e->>'number');
    exception when others then
      v_invalid := v_invalid || jsonb_build_object('label', btrim(coalesce(e->>'number', '')), 'reason', regexp_replace(sqlerrm, '^\[[A-Z_]+\] ', ''));
      continue;
    end;
    if not (v_tcode = any (v_known)) then
      v_invalid := v_invalid || jsonb_build_object('label', v_label, 'reason', 'Unknown room type: ' || coalesce(nullif(v_tcode, ''), '(none)')); continue; end if;
    if lower(v_label) = any (v_seen_rooms)
       or exists (select 1 from public.rooms r where r.property_id = p_property_id and lower(r.room_number) = lower(v_label)) then
      v_skip_rooms := v_skip_rooms + 1;
    else
      v_new_rooms := v_new_rooms || jsonb_build_object('number', v_label, 'type_code', v_tcode, 'floor', nullif(btrim(coalesce(e->>'floor', '')), ''));
    end if;
    v_seen_rooms := v_seen_rooms || lower(v_label);
  end loop;

  select pl.max_rooms into v_limit from public.tenant_subscriptions s join public.plans pl on pl.code = s.plan_code where s.tenant_id = v_tenant;
  select count(*)::int into v_now from public.rooms where tenant_id = v_tenant and is_active;

  if not coalesce(p_preview, true) then
    if jsonb_array_length(v_invalid) > 0 then
      perform app.fail('E_INVALID', format('%s item(s) cannot be imported, for example "%s": %s. Nothing was added.',
        jsonb_array_length(v_invalid), v_invalid->0->>'label', v_invalid->0->>'reason'));
    end if;
    foreach x in array v_new_types loop
      insert into public.room_types(tenant_id, property_id, code, name, max_adults, max_children)
      values (v_tenant, p_property_id, x->>'code', x->>'name', (x->>'max_adults')::int, (x->>'max_children')::int);
      v_created_types := v_created_types + 1;
    end loop;
    -- The plan limit trigger refuses the first room over the limit, which undoes the whole import.
    foreach x in array v_new_rooms loop
      insert into public.rooms(tenant_id, property_id, room_number, room_type_id, floor)
      select v_tenant, p_property_id, x->>'number', rt.id, x->>'floor' from public.room_types rt
      where rt.property_id = p_property_id and rt.code = x->>'type_code';
      v_created_rooms := v_created_rooms + 1;
    end loop;
    insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
    values (v_tenant, auth.uid(), 'apply_setup_import', 'properties', p_property_id::text,
      jsonb_build_object('room_types', v_created_types, 'rooms', v_created_rooms, 'skipped_rooms', v_skip_rooms));
  end if;

  return jsonb_build_object(
    'would_create_types', (select coalesce(jsonb_agg(t->>'code'), '[]'::jsonb) from unnest(v_new_types) t),
    'skipped_types', to_jsonb(v_skip_types), 'would_create_rooms', coalesce(array_length(v_new_rooms, 1), 0),
    'skipped_rooms', v_skip_rooms, 'invalid', v_invalid,
    'created_types', v_created_types, 'created_rooms', v_created_rooms, 'room_limit', v_limit, 'rooms_now', v_now);
end $$;

revoke all on function app.ai_begin(text, uuid) from public, anon, authenticated;
revoke all on function public.ai_import_start(uuid), public.apply_setup_import(uuid, jsonb, boolean) from public, anon;
grant execute on function public.ai_import_start(uuid), public.apply_setup_import(uuid, jsonb, boolean) to authenticated;
