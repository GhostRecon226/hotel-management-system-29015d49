-- Security: default-deny grants, privilege escalation and direct writes.
-- Findings M1, M2, M6, M8, S1, S2, S4 of docs/status-report.md, plus reference file 16.
begin;

-- [M8] The browser holds no write rights on any table, and anon holds nothing at all.
do $$
declare v text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or exists (select 1 from information_schema.column_privileges cp where cp.table_schema = 'public'
                 and cp.table_name = c.relname and cp.grantee = 'authenticated' and cp.privilege_type in ('INSERT', 'UPDATE')));
  perform t.eq(coalesce(v, ''), '', '[M8][NFR-002] no table or view is writable by signed-in users');

  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'));
  perform t.eq(coalesce(v, ''), '', '[M8] anon holds no table privileges');

  select string_agg(p.polrelid::regclass::text || ':' || p.polname, ', ') into v
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and p.polcmd <> 'r';
  perform t.eq(coalesce(v, ''), '', '[M1][M8] no row-level security policy allows writes');

  select string_agg(p.proname, ', ' order by p.proname) into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
  perform t.eq(coalesce(v, ''), '', '[S4] no app function can be called by someone not signed in');

  select string_agg(n.nspname || '.' || p.proname, ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  perform t.eq(coalesce(v, ''), '', '[NFR-001] every security definer function pins its search path');

  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform t.eq(coalesce(v, ''), '', '[NFR-001] every table has row-level security');

  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname not in ('plans', 'permissions', 'tenants')
    and not exists (select 1 from information_schema.columns k where k.table_schema = 'public'
                    and k.table_name = c.relname and k.column_name = 'tenant_id');
  perform t.eq(coalesce(v, ''), '', '[NFR-001] every hotel table has tenant_id');
exception when others then perform t.crash('grants', sqlerrm);
end $$;

-- [M1][M2] A user with only "manage staff and roles" cannot give themselves more.
do $$
declare v_hr uuid := gen_random_uuid(); v_role uuid; v_sys uuid := (select id from public.roles where tenant_id is null and code = 'SYSADMIN');
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_hr, 'hr@test.local', now(), 'authenticated', 'authenticated');
  perform t.put('hr', v_hr);
  perform t.login('adminA');
  v_role := public.copy_role((select id from public.roles where tenant_id is null and code = 'RA'), 'HR', 'HR');
  perform t.put('role_hr', v_role);
  perform t.lives(format($q$select public.set_role_permissions(%L, '[{"key":"adm.role.manage"},{"key":"adm.user.manage"}]'::jsonb)$q$, v_role),
    '[M2] an administrator can set a custom role''s permissions');
  perform t.eq((select string_agg(permission_key, ',' order by permission_key) from public.role_permissions where role_id = v_role),
    'adm.role.manage,adm.user.manage', '[M2] the role now holds exactly the chosen permissions');
  perform public.register_invited_user(v_hr, 'Helen HR', null);
  perform public.assign_role(v_hr, t.id('propA'), v_role);

  perform t.login('hr');
  perform t.raises(format($q$select public.set_role_permissions(%L, '[{"key":"adm.role.manage"},{"key":"adm.user.manage"},{"key":"fin.refund.approve"}]'::jsonb)$q$, v_role),
    'E_ESCALATION', '[ADM-004] cannot add a permission they do not hold through the function');
  perform t.raises(format('select public.assign_role(%L, %L, %L)', v_hr, t.id('propA'), v_sys),
    'E_ESCALATION', '[ADM-002] cannot make themselves System Administrator through the function');
  perform t.raises(format('select public.set_approval_limit(%L, %L, 999999999)', v_role, 'fin.discount.apply'),
    'E_ESCALATION|E_NOT_FOUND|E_INVALID', '[ADM-005] cannot set an approval limit for a permission they do not hold');
  perform t.raises(format('insert into public.role_permissions(role_id, permission_key, grant_level, tenant_id) values (%L, %L, %L, %L)',
    v_role, 'fin.refund.approve', 'Y', t.id('tenantA')), 'permission denied', '[M1] cannot add a permission by writing to role_permissions');
  perform t.raises(format('insert into public.user_property_roles(tenant_id, user_id, property_id, role_id) values (%L, %L, %L, %L)',
    t.id('tenantA'), v_hr, t.id('propA'), v_sys), 'permission denied', '[M1] cannot make themselves System Administrator by writing to user_property_roles');
  perform t.raises(format('insert into public.approval_limits(role_id, permission_key, max_amount, tenant_id) values (%L, %L, 999999999, %L)',
    v_role, 'fin.discount.apply', t.id('tenantA')), 'permission denied', '[M1] cannot set a limit by writing to approval_limits');
  perform t.raises(format('update public.roles set name = %L where id = %L', 'Boss', v_role), 'permission denied', '[M1] cannot rename a role by writing to roles');
  perform t.raises(format('delete from public.user_property_roles where user_id = %L', t.id('fdo')), 'permission denied', '[M1] cannot remove other staff roles by writing to user_property_roles');
  perform t.ok(not app.can('fin.refund.approve', t.id('propA')), '[M1] after all attempts they still cannot approve refunds');
  perform t.ok(not app.can('fin.payment.post', t.id('propA')), '[M1] and still cannot take payments');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('escalation', sqlerrm);
end $$;

-- [S1][S2] Property and profile changes go through the functions only.
do $$
begin
  perform t.login('adminA');
  perform t.raises(format('update public.properties set base_currency = %L where id = %L', 'USD', t.id('propA')),
    'permission denied', '[S1][SET-001] base currency cannot be changed by writing to properties');
  perform t.raises(format('update public.properties set name = %L where id = %L', 'X', t.id('propA')),
    'permission denied', '[S1] property rows cannot be written directly');
  perform t.lives(format('select public.update_property(%L, %L, null, %L, %L, %L, %L, %L)', t.id('propA'), 'Sunrise Lodge Ikeja',
    'Lagos', 'NG', 'Africa/Lagos', '14:00', '12:00'), '[SET-001] the property profile can be edited through update_property');
  perform t.eq((select base_currency::text from public.properties where id = t.id('propA')), 'NGN', '[SET-001] base currency is unchanged');
  perform t.raises(format('update public.profiles set status = %L where id = %L', 'disabled', t.id('fdo')),
    'permission denied', '[S2] staff status cannot be changed by writing to profiles');
  perform t.raises(format('update public.profiles set tenant_id = %L where id = %L', t.id('tenantB'), t.id('adminA')),
    'permission denied|E_FORBIDDEN', 'a user cannot move themselves to another hotel');
  perform t.login('fdo');
  perform t.lives(format('select public.update_my_profile(%L, %L)', 'Femi Front Desk', '08031112222'), 'a user can edit their own name and phone');
  perform t.eq((select full_name from public.profiles where id = t.id('fdo')), 'Femi Front Desk', 'their name changed');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('property and profile', sqlerrm);
end $$;

-- [NFR-002] Ledger, booking and state tables cannot be written directly (reference 16).
do $$
declare v_res uuid; v_folio uuid;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g1'), t.bdate() + 20, t.bdate() + 21, t.id('std'), t.id('bar'));
  v_folio := t.main_folio(v_res);
  perform t.raises(format('insert into public.folio_transactions(tenant_id, property_id, folio_id, kind, amount, currency, base_amount) values (%L, %L, %L, %L, 1, %L, 1)',
    t.id('tenantA'), t.id('propA'), v_folio, 'payment', 'NGN'), 'permission denied', '[FIN-006] front desk cannot insert ledger rows directly');
  perform t.raises(format('update public.reservations set status = %L where id = %L', 'cancelled', v_res), 'permission denied', 'reservations cannot be edited directly');
  perform t.raises(format('delete from public.reservations where id = %L', v_res), 'permission denied', 'reservations cannot be deleted');
  perform t.raises('update public.approvals set status = ''approved''', 'permission denied', 'approvals cannot be edited directly');
  perform t.raises('update public.stays set status = ''checked_out''', 'permission denied', 'stays cannot be edited directly');
  perform t.raises('update public.room_assignments set is_active = false', 'permission denied', 'room assignments cannot be edited directly');
  perform t.raises('update public.hk_tasks set status = ''done''', 'permission denied', 'housekeeping tasks cannot be edited directly');
  perform t.raises('update public.rooms set condition = ''clean''', 'permission denied', '[ROOM-001] room condition cannot be written directly');
  perform t.raises('update public.rooms set is_occupied = false', 'permission denied', '[ROOM-001] room occupancy cannot be written directly');
  perform t.raises('update public.daily_stats set rooms_sold = 99', 'permission denied', 'daily numbers cannot be edited');
  perform t.raises('insert into public.audit_events(tenant_id, action, table_name) values (null, ''x'', ''y'')', 'permission denied', '[ADM-006] the audit trail cannot be written by users');
  perform t.raises('update public.notifications set title = ''x''', 'permission denied', 'notification text cannot be edited');
  perform t.raises(format('insert into public.guests(tenant_id, first_name, last_name, anonymised_at) values (%L, %L, %L, now())', t.id('tenantA'), 'A', 'B'),
    'permission denied', 'a guest cannot be created directly, pre-anonymised or otherwise');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('direct writes', sqlerrm);
end $$;

-- [S4] Someone not signed in cannot call front desk or block functions, or read data.
do $$
begin
  perform t.anon();
  perform t.raises(format('select public.check_in(%L, %L::jsonb, null, null, null)', gen_random_uuid(), '{}'), 'permission denied', '[S4] anon cannot call check_in');
  perform t.raises(format('select public.move_room(%L, %L, %L, null)', gen_random_uuid(), gen_random_uuid(), 'x'), 'permission denied', '[S4] anon cannot call move_room');
  perform t.raises(format('select public.set_room_condition(%L, %L, %L)', gen_random_uuid(), 'clean', 'x'), 'permission denied', '[S4] anon cannot call set_room_condition');
  perform t.raises('select count(*) from public.guests', 'permission denied', 'anon cannot read guests');
  perform t.raises('select public.create_hotel(''x'', ''NG'', ''y'', ''z'', ''w'')', 'permission denied', 'anon cannot call create_hotel');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('anon', sqlerrm);
end $$;

-- [M6][ADM-001] The invite server function checks permission first, through require_permission.
do $$
begin
  perform t.login('fdo');
  perform t.raises(format('select public.require_permission(%L, %L)', 'adm.user.manage', t.id('propA')), 'E_FORBIDDEN',
    '[M6] front desk is refused before any invite is sent');
  perform t.login('nobody');
  perform t.raises(format('select public.require_permission(%L, %L)', 'adm.user.manage', t.id('propA')), 'E_FORBIDDEN',
    '[M6] a user with no hotel is refused before any invite is sent');
  perform t.login('adminA');
  perform t.lives(format('select public.require_permission(%L, %L)', 'adm.user.manage', t.id('propA')), '[M6] an administrator passes the check');
  perform t.raises('select public.find_user_id_by_email(''fdo@test.local'')', 'permission denied', '[M6] the browser cannot look up accounts by email');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('invite', sqlerrm);
end $$;

rollback;
