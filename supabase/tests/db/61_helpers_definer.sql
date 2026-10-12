-- Rule 4 (PLT-018): the day-61 helper functions are security definer with a fixed search path, like every other function.
begin;

do $$
declare r record; n integer := 0;
begin
  perform t.admin();
  for r in
    select p.proname, p.prosecdef, p.proconfig::text as cfg
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'app' and p.proname in ('trial_plan', 'plan_price_text', 'trial_plan_sentence', 'run_subscription_clock')
  loop
    n := n + 1;
    perform t.ok(r.prosecdef, '[PLT-018] app.' || r.proname || ' is security definer');
    perform t.ok(r.cfg like '%search_path=public, pg_temp%', '[PLT-018] app.' || r.proname || ' has a fixed search path');
  end loop;
  perform t.eq(n, 4, '[PLT-018] all four subscription helpers were checked');
  perform t.ok(not has_function_privilege('authenticated', 'app.trial_plan_sentence(text,text)', 'execute'), '[PLT-018] signed-in users cannot call trial_plan_sentence');
  perform t.ok(not has_function_privilege('anon', 'app.trial_plan_sentence(text,text)', 'execute'), '[PLT-018] visitors cannot call trial_plan_sentence');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('helper definer check', sqlerrm);
end $$;

rollback;
