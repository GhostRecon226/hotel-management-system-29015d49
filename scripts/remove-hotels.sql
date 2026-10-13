-- Remove demo hotels completely (PLT-025). A one-time tool, not a migration. Never run it by hand on a real hotel.
--
-- What it does: deletes every row that belongs to the named hotels (all tables with tenant_id), the hotels
-- themselves and the staff sign-in accounts of those hotels. It leaves other hotels, the plan list, the permission
-- list and every platform operator untouched.
--
-- How to use (the wrapper sets the hotel ids; see docs/runbook-remove-hotels.md):
--   begin;
--   \i scripts/remove-hotels.sql
--   select pg_temp.remove_hotels(array['<hotel id>']::uuid[], true);   -- true = dry run: does everything, then stops with E_DRY_RUN
--   rollback;                                                          -- for the real run: false, then commit
--
-- Why it turns off the ledger locks: the ledger and audit log refuse every delete (rule 6). A removed hotel has no
-- owner left, so the locks are lifted for this one transaction only (session_replication_role = replica, local).
-- Every check below runs before anything is deleted, and the checks after the delete roll the whole run back
-- if anything is left behind.

create or replace function pg_temp.remove_hotels(p_ids uuid[], p_dry boolean default true)
returns text language plpgsql as $fn$
declare
  r record; n bigint; v_rows bigint := 0; v_tables int := 0; v_users uuid[]; v_names text; v_accounts int := 0;
  v_before bigint; v_after bigint; v_orphans bigint;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception '[E_INVALID] Name at least one hotel id.'; end if;
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from public.tenants t where t.id = i)) then
    raise exception '[E_NOT_FOUND] One of the hotel ids does not exist in this database. Nothing was removed.'; end if;
  if (select count(*) from public.tenants) <= array_length(p_ids, 1) then
    raise notice 'This removes every hotel in the database.'; end if;

  select string_agg(t.name || ' (' || t.id || ')', ', ' order by t.created_at) into v_names from public.tenants t where t.id = any(p_ids);
  raise notice 'Hotels to remove: %', v_names;

  select coalesce(array_agg(p.id), '{}') into v_users from public.profiles p where p.tenant_id = any(p_ids);
  if exists (select 1 from app.platform_operators o where o.user_id = any(v_users)) then
    raise exception '[E_FORBIDDEN] A platform operator is a staff member of one of these hotels. Nothing was removed.'; end if;

  -- ID photo files live in storage, outside the database. Remove them first so none is left behind.
  if to_regclass('public.guest_document_files') is not null then
    execute 'select count(*) from public.guest_document_files where tenant_id = any($1)' into n using p_ids;
    if n > 0 then
      raise exception '[E_FILES_LEFT] These hotels still have % ID photo file(s). Delete them first.', n; end if;
  end if;

  -- Orphans that exist before we start (so we only complain about ones we cause).
  v_before := 0;
  for r in
    select format('select count(*) from %s c where c.%I is not null and not exists (select 1 from %s p where p.%I = c.%I)',
                  c.conrelid::regclass, a.attname, c.confrelid::regclass, fa.attname, a.attname) as q
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and c.connamespace in ('public'::regnamespace, 'app'::regnamespace)
  loop execute r.q into n; v_before := v_before + n; end loop;

  perform set_config('session_replication_role', 'replica', true);
  if current_setting('session_replication_role') <> 'replica' then
    raise exception '[E_PRIVILEGE] This database role cannot lift the ledger locks. Nothing was removed.'; end if;

  for r in
    select c.table_schema as s, c.table_name as t
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.column_name = 'tenant_id' and c.table_schema in ('public', 'app')
    order by 1, 2
  loop
    execute format('delete from %I.%I where tenant_id = any($1)', r.s, r.t) using p_ids;
    get diagnostics n = row_count;
    if n > 0 then
      v_rows := v_rows + n; v_tables := v_tables + 1;
      raise notice '  % rows from %.%', lpad(n::text, 6), r.s, r.t;
    end if;
  end loop;
  delete from public.tenants where id = any(p_ids);
  get diagnostics n = row_count;
  if n <> array_length(p_ids, 1) then
    raise exception '[E_INCOMPLETE] Removed % hotel record(s), expected %. Rolled back.', n, array_length(p_ids, 1); end if;

  -- Locks back on, then the sign-in accounts (their own sessions and identities go with them).
  perform set_config('session_replication_role', 'origin', true);
  if cardinality(v_users) > 0 then
    delete from auth.users where id = any(v_users);
    get diagnostics v_accounts = row_count;
  end if;

  -- Checks after the delete: nothing of these hotels is left, and no row points at something that is gone.
  for r in
    select c.table_schema as s, c.table_name as t
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.column_name = 'tenant_id' and c.table_schema in ('public', 'app')
  loop
    execute format('select count(*) from %I.%I where tenant_id = any($1)', r.s, r.t) into n using p_ids;
    if n > 0 then raise exception '[E_INCOMPLETE] % rows are left in %.%. Rolled back.', n, r.s, r.t; end if;
  end loop;
  v_after := 0;
  for r in
    select format('select count(*) from %s c where c.%I is not null and not exists (select 1 from %s p where p.%I = c.%I)',
                  c.conrelid::regclass, a.attname, c.confrelid::regclass, fa.attname, a.attname) as q
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and c.connamespace in ('public'::regnamespace, 'app'::regnamespace)
  loop execute r.q into n; v_after := v_after + n; end loop;
  v_orphans := v_after - v_before;
  if v_orphans > 0 then
    raise exception '[E_INCOMPLETE] % row(s) now point at something that was removed. Rolled back.', v_orphans; end if;

  raise notice 'Removed % hotel(s), % rows in % tables, % sign-in account(s).', array_length(p_ids, 1), v_rows, v_tables, v_accounts;
  if p_dry then
    raise exception '[E_DRY_RUN] Dry run. Everything above worked, and nothing was removed.'; end if;
  return format('Removed %s hotel(s), %s rows, %s sign-in account(s).', array_length(p_ids, 1), v_rows, v_accounts);
end $fn$;
