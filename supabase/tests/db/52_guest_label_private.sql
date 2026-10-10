-- [RPT-008] The name helper used by the Latest activity feed is private: signed-in users reach it only through recent_activity.
begin;

do $$
begin
  perform t.ok(not has_function_privilege('authenticated', 'app.guest_label(public.guests)', 'execute'), '[RPT-008] signed-in users cannot call the name helper directly');
  perform t.ok(not has_function_privilege('anon', 'app.guest_label(public.guests)', 'execute'), '[RPT-008] visitors cannot call the name helper');
  perform t.login('adminA');
  perform t.ok(jsonb_typeof(public.recent_activity(t.id('propA'), 3)) = 'array', '[RPT-008] the Latest activity feed still works without the direct grant');
  perform t.admin();
end $$;

rollback;
