-- AI helpers, first one: the owner's morning brief (AI-001 to AI-004).
-- Rules: off by default, a monthly limit, numbers only from the database, no guest or ID details leave the database.
begin;

do $$
declare v_start jsonb; v_facts jsonb; v_u1 uuid; v_u2 uuid; v_s jsonb; v_name text; v_f uuid; v_r uuid; v_bd date; v_expected numeric;
begin
  -- AI-001: switched off by default
  perform t.login('adminA');
  v_s := public.ai_status();
  perform t.eq((v_s->>'enabled')::boolean, false, '[AI-001] AI helpers are off by default');
  perform t.raises(format('select public.ai_morning_brief_start(%L)', t.id('propA')), 'E_AI_OFF', '[AI-001] the brief refuses while AI is off');
  perform t.login('fdo');
  perform t.raises('select public.set_ai_settings(true, 10)', 'E_FORBIDDEN', '[AI-001] front desk cannot switch AI on');
  perform t.login('acc');
  perform t.raises('select public.set_ai_settings(true, 10)', 'E_FORBIDDEN', '[AI-001] nor the accountant');
  perform t.login('adminA');
  perform t.raises('select public.set_ai_settings(true, -1)', 'E_INVALID', '[AI-001] the monthly limit cannot be negative');
  perform t.raises('select public.set_ai_settings(true, 5000)', 'E_INVALID', '[AI-001] nor above 1000');
  perform public.set_ai_settings(true, 2);
  v_s := public.ai_status();
  perform t.ok((v_s->>'enabled')::boolean and (v_s->>'monthly_cap')::int = 2 and (v_s->>'used')::int = 0 and (v_s->>'remaining')::int = 2,
    '[AI-001] status shows on, limit 2, none used');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where action = 'set_ai_settings' and tenant_id = t.id('tenantA')), '[AI-001] the switch is audited');
  perform t.ok(exists (select 1 from public.permissions where key = 'adm.ai.manage'), '[AI-001] permission adm.ai.manage exists');
  perform t.ok((select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where rp.permission_key = 'adm.ai.manage' and r.tenant_id is null) = 2, '[AI-001] only two built-in roles hold it');
  perform t.login('adminB');
  perform t.eq((public.ai_status()->>'enabled')::boolean, false, '[AI-001] another hotel is not switched on by this one');
  perform t.admin();

  -- AI-002: facts. Counts and money only; no names or ID details.
  perform t.login('acc');
  v_start := public.ai_morning_brief_start(t.id('propA'));
  v_u1 := (v_start->>'usage_id')::uuid;
  v_facts := v_start->'facts';
  perform t.ok(v_u1 is not null, '[AI-002] starting a brief returns a usage id');
  perform t.eq((select array_agg(k order by k) from jsonb_object_keys(v_facts) k),
    array['attention', 'business_date', 'currency', 'lines', 'property', 'today', 'yesterday'],
    '[AI-002] the facts hold only these sections: no guest, room or ID fields');
  perform t.ok(jsonb_array_length(v_facts->'lines') >= 4, '[AI-002] the facts come as plain lines');
  select name into v_name from public.properties where id = t.id('propA');
  perform t.eq(v_facts->>'property', v_name, '[AI-002] the facts name the property');
  perform t.eq((v_facts->>'business_date')::date, t.bdate(), '[AI-002] the facts carry the business date');
  perform t.eq((v_facts->'today'->>'in_house')::int, (select count(*)::int from public.stays where property_id = t.id('propA') and status = 'in_house'),
    '[AI-002] in house comes from the stays');
  perform t.eq((v_facts->'attention'->>'pending_approvals')::int, (select count(*)::int from public.approvals where property_id = t.id('propA') and status = 'pending'),
    '[AI-002] approvals waiting come from the approvals');
  perform t.ok(not (v_facts::text ~* '(passport|A1234567|first_name|last_name|guest_name)'), '[AI-002] no guest or ID wording in the facts');
  perform t.admin();
  perform t.ok(not exists (select 1 from public.guests g where v_facts::text ilike '%' || g.last_name || '%' and length(g.last_name) > 2),
    '[AI-002] no guest surname appears in the facts');

  -- AI-003: monthly limit
  perform t.login('acc');
  v_u2 := (public.ai_morning_brief_start(t.id('propA'))->>'usage_id')::uuid;
  perform t.raises(format('select public.ai_morning_brief_start(%L)', t.id('propA')), 'E_AI_LIMIT', '[AI-003] the third brief in the month is refused at limit 2');
  perform public.ai_call_finish(v_u2, false);
  perform t.eq((public.ai_status()->>'used')::int, 1, '[AI-003] a failed call does not count');
  perform t.lives(format('select public.ai_morning_brief_start(%L)', t.id('propA')), '[AI-003] so another can start');
  perform public.ai_call_finish(v_u1, true);
  perform t.raises(format('select public.ai_call_finish(%L, true)', v_u1), 'E_NOT_FOUND', '[AI-003] a call finishes only once');
  perform t.login('adminA');
  perform t.raises(format('select public.ai_call_finish(%L, false)', v_u1), 'E_NOT_FOUND', '[AI-003] and only by the person who started it');
  perform t.admin();
end $$;

-- AI-004: who may ask, and what is closed to the browser
do $$
begin
  perform t.login('fdo');
  perform t.raises(format('select public.ai_morning_brief_start(%L)', t.id('propA')), 'E_FORBIDDEN', '[AI-004] front desk cannot ask for the brief');
  perform t.login('hks');
  perform t.raises(format('select public.ai_morning_brief_start(%L)', t.id('propA')), 'E_FORBIDDEN', '[AI-004] nor the housekeeping supervisor (finance figures)');
  perform t.login('adminB');
  perform t.raises(format('select public.ai_morning_brief_start(%L)', t.id('propA')), 'E_FORBIDDEN', '[AI-004] another hotel cannot ask for this hotel''s brief');
  perform t.login('acc');
  perform t.raises('insert into public.ai_usage(tenant_id, user_id, feature, status) values (gen_random_uuid(), gen_random_uuid(), ''x'', ''done'')',
    'permission denied', '[AI-004] the browser cannot write the usage log');
  perform t.raises('select * from public.ai_usage', 'permission denied', '[AI-004] nor read it');
  perform t.raises('update public.ai_settings set enabled = true', 'permission denied', '[AI-004] nor change the switch directly');
  perform t.login('adminA');
  perform t.eq((select count(*) from public.ai_settings), 1::bigint, '[AI-004] a hotel reads only its own AI settings');
  perform t.admin();
end $$;

-- AI-002: overdue money in the facts comes from the ledger
do $$
declare v_bd date; v_r uuid; v_f uuid; v_facts jsonb; v_exp numeric; v_stat text;
begin
  perform t.login('fdo');
  v_bd := t.bdate();
  v_r := public.create_reservation(t.id('propA'), 'ai-1', t.id('g1'), v_bd + 2, v_bd + 3, t.id('std'), t.id('bar'), 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);
  perform t.admin();
  perform app.ensure_main_folio(v_r);
  v_f := t.main_folio(v_r);
  perform t.login('fom');
  perform public.post_charge(v_f, t.cc('ROOM'), 40000, false, 'Room', null, 'ai-room-1');
  perform t.admin();
  update public.ai_settings set monthly_cap = 50 where tenant_id = t.id('tenantA');
  perform t.set_bdate(t.id('propA'), v_bd + 50);
  perform t.login('acc');
  v_facts := public.ai_morning_brief_start(t.id('propA'))->'facts';
  select coalesce(sum(balance), 0) into v_exp from public.report_outstanding_balances(t.id('propA'))
    where balance > 0 and departure_date < t.bdate() - 30 and currency = 'NGN';
  perform t.ok(v_exp > 0, 'set-up: there is an overdue balance');
  perform t.eq((v_facts->'attention'->>'overdue_over_30_days')::numeric, v_exp, '[AI-002] money overdue by more than 30 days comes from the ledger');
  perform t.ok(exists (select 1 from jsonb_array_elements_text(v_facts->'lines') l where l like '%' || to_char(v_exp, 'FM999,999,999,990.00') || '%'),
    '[AI-002] the plain line shows the same amount, formatted by the database');
  perform t.admin();
end $$;

select t.admin();
rollback;
