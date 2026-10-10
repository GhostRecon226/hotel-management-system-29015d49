-- Every function we own fixes its search path, helpers included (QA-07, AGENTS rule 4).
begin;

do $$
declare v text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname) into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  perform t.eq(coalesce(v, ''), '', '[NFR-007] every function in app and public pins its search path');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('helper search path', sqlerrm);
end $$;

rollback;
