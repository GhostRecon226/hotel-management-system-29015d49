-- Default-deny grants (audit findings M1, M8, S1, S2, S4).
--
-- Before: Supabase gave the browser roles (anon, authenticated) insert, update and delete on every
-- table, and row-level security was the only barrier. Seven policies allowed direct writes to roles,
-- role permissions, role assignments, approval limits, profiles and properties, which let a user with
-- "manage roles" bypass the escalation checks in the admin functions.
--
-- After: the browser can only read (filtered by row-level security) and call functions. Every change
-- goes through a security definer function that checks permission first. The screens already work
-- this way; none of them writes to a table directly.

-- 1. Remove every policy that allowed a direct write.
drop policy if exists roles_write on public.roles;
drop policy if exists role_permissions_write on public.role_permissions;
drop policy if exists approval_limits_write on public.approval_limits;
drop policy if exists upr_write on public.user_property_roles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists properties_update on public.properties;

-- 2. Take every table, view and sequence right away from the browser roles, then give back read only.
revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and c.relname <> 'guest_documents'   -- ID numbers are read only through get_guest(), masked
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('grant select on %s to authenticated', r.rel);
  end loop;
end $$;

-- 3. Functions: nobody who is not signed in may call any app function. Signed-in users keep exactly
--    the functions they could call before, now granted by name rather than through PUBLIC.
do $$
declare r record; v_auth boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    v_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    execute format('revoke all on function %s from public, anon', r.fn);
    if v_auth then execute format('grant execute on function %s to authenticated', r.fn); end if;
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;

-- 4. Future objects created by migrations start with no browser rights at all.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public grant select on tables to authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
