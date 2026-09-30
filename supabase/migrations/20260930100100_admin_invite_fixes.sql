-- Admin and invite fixes (audit findings M2, M6, S2, ADM-003).

-- M2: set_role_permissions crashed on every call, because both inserts left out the role id.
create or replace function public.set_role_permissions(p_role_id uuid, p_permissions jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role public.roles; r record;
begin
  perform app.assert_writable();
  v_tenant := app.my_tenant();
  if not app.can('adm.role.manage', null) then perform app.fail('E_FORBIDDEN', 'You cannot manage roles.'); end if;
  select * into v_role from public.roles where id = p_role_id;
  if v_role.id is null or v_role.tenant_id is distinct from v_tenant then
    perform app.fail('E_NOT_FOUND', 'Role not found.'); end if;
  if v_role.is_system then perform app.fail('E_SYSTEM_ROLE', 'Built-in roles cannot be changed. Copy one instead.'); end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then
    perform app.fail('E_INVALID', 'A list of permissions is required.');
  end if;

  for r in
    select x->>'key' as k,
           upper(coalesce(x->>'level', 'Y'))::char as lvl,
           nullif(x->>'max_amount', '')::numeric as lim
    from jsonb_array_elements(p_permissions) x
  loop
    if not exists (select 1 from public.permissions where key = r.k) then
      perform app.fail('E_NOT_FOUND', format('Unknown permission "%s".', r.k));
    end if;
    if r.lvl not in ('Y', 'L', 'O') then
      perform app.fail('E_INVALID', 'Grant level must be Y, L or O.');
    end if;
    perform app.assert_can_grant(r.k, r.lvl, r.lim, null);
  end loop;

  delete from public.role_permissions where role_id = p_role_id;
  delete from public.approval_limits where role_id = p_role_id;

  insert into public.role_permissions(role_id, permission_key, grant_level)
  select p_role_id, x->>'key', upper(coalesce(x->>'level', 'Y'))::char
  from jsonb_array_elements(p_permissions) x;

  insert into public.approval_limits(role_id, permission_key, max_amount)
  select p_role_id, x->>'key', (x->>'max_amount')::numeric
  from jsonb_array_elements(p_permissions) x
  where upper(coalesce(x->>'level', 'Y')) = 'L' and nullif(x->>'max_amount', '') is not null;
end $$;

-- S2: staff edit their own name and phone through a function, now that profiles are read only.
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.my_tenant() is null then perform app.fail('E_FORBIDDEN', 'You do not have access to a hotel.'); end if;
  if coalesce(btrim(p_full_name), '') = '' then perform app.fail('E_REQUIRED', 'Your name is required.'); end if;
  update public.profiles set full_name = btrim(p_full_name), phone = nullif(btrim(p_phone), '')
  where id = auth.uid();
end $$;

-- M6: the invite server function asks this before it creates any account or sends any email.
create or replace function public.require_permission(p_key text, p_property_id uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if app.my_tenant() is null or not app.can(p_key, p_property_id) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.');
  end if;
end $$;

-- M6: find an existing sign-in account by email. Server side only (service role), never the browser.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1
$$;

-- M6: whether an invited account has accepted its invite, for the resend button. Server side only.
create or replace function public.invite_pending(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select email_confirmed_at is null and last_sign_in_at is null from auth.users where id = p_user_id), false)
$$;

-- ADM-003: a disabled user, or someone signed out, is told they have no access,
-- not that the hotel's subscription expired.
create or replace function app.assert_writable(p_allow_when_read_only boolean default false)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if app.my_tenant() is null then
    perform app.fail('E_FORBIDDEN', 'You do not have access to a hotel. Ask your administrator.');
  end if;
  if p_allow_when_read_only then return; end if;
  if not app.tenant_writable(app.my_tenant()) then
    perform app.fail('E_READ_ONLY',
      'Your subscription is expired or suspended, so the hotel is read-only. Settlement and check-out are still allowed.');
  end if;
end $$;

revoke all on function public.set_role_permissions(uuid, jsonb), public.update_my_profile(text, text),
  public.require_permission(text, uuid), public.find_user_id_by_email(text), public.invite_pending(uuid) from public, anon;
grant execute on function public.set_role_permissions(uuid, jsonb), public.update_my_profile(text, text),
  public.require_permission(text, uuid) to authenticated;
grant execute on function public.find_user_id_by_email(text), public.invite_pending(uuid) to service_role;
