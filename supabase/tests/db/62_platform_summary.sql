-- Platform summary (PLT-024): the owner's one-glance view. Hotels by status, new hotels, trials ending, hotels gone quiet
-- and the monthly list price of paying hotels. Operators only, with two-step sign-in. Account data only.
begin;

create function t.as_user(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function t.as_user(uuid, text) to authenticated;

-- Access: the same two doors as every platform function.
do $$
declare v_op uuid := gen_random_uuid();
begin
  perform t.admin();
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_op, 'summary-op@platform.test', now(), 'authenticated', 'authenticated');
  perform t.put('sumop', v_op);
  perform app.add_platform_operator('summary-op@platform.test');
  perform t.as_user(v_op, 'aal1');
  perform t.raises('select public.platform_summary()', 'E_MFA_REQUIRED', '[PLT-024] a password-only operator session is refused');
  perform t.as_user(t.id('adminA'), 'aal2');
  perform t.raises('select public.platform_summary()', 'E_FORBIDDEN', '[PLT-024] a hotel administrator is refused, even with two-step sign-in');
  perform t.anon();
  perform t.raises('select public.platform_summary()', 'permission denied', '[PLT-024] signed-out visitors cannot call it');
  perform t.admin();
end $$;

-- Counts by status and new hotels.
do $$
declare j jsonb; v_total int; v_sum int; v_j7 int; v_j30 int;
begin
  perform t.admin();
  update public.tenant_subscriptions set status = 'active', current_period_end = now() + interval '20 days' where tenant_id = t.id('tenantA');
  update public.tenant_subscriptions set status = 'trial', trial_ends_at = now() + interval '40 days' where tenant_id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  select count(*)::int into v_total from public.platform_list_tenants();
  perform t.eq((j->>'hotels')::int, v_total, '[PLT-024] the summary counts every hotel the list shows');
  select sum(value::int) into v_sum from jsonb_each_text(j->'by_status');
  perform t.eq(v_sum, v_total, '[PLT-024] the status counts add up to the hotel count');
  perform t.ok((j->'by_status'->>'active')::int >= 1 and (j->'by_status'->>'trial')::int >= 1, '[PLT-024] active and trial hotels are counted');
  v_j7 := (j->>'joined_7d')::int; v_j30 := (j->>'joined_30d')::int;
  perform t.ok(v_j7 >= 2 and v_j30 >= v_j7, '[PLT-024] hotels created today count as new this week and this month');
  perform t.admin();
  update public.tenants set created_at = now() - interval '20 days' where id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.eq((j->>'joined_7d')::int, v_j7 - 1, '[PLT-024] a hotel from 20 days ago is not new this week');
  perform t.eq((j->>'joined_30d')::int, v_j30, '[PLT-024] but is still new this month');
  perform t.eq((j->>'joined_prev_7d')::int, 0, '[PLT-024] and is not in the week before either (8 to 14 days ago)');
  perform t.ok(j->'joined_change_pct' = 'null'::jsonb, '[PLT-024] with no hotel in the week before there is no percentage change');
  perform t.admin();
  update public.tenants set created_at = now() - interval '10 days' where id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.eq((j->>'joined_prev_7d')::int, 1, '[PLT-024] a hotel from 10 days ago counts in the week before');
  perform t.eq((j->>'joined_change_pct')::int, ((v_j7 - 1) - 1) * 100, '[PLT-024] the change on the week before is worked out in percent');
  perform t.eq(jsonb_array_length(j->'joined_weekly'), 8, '[PLT-024] the trend line has the last 8 weeks');
  perform t.eq((j->'joined_weekly'->>7)::int, v_j7 - 1, '[PLT-024] and its last point is this week');
  perform t.eq((j->'joined_weekly'->>6)::int, 1, '[PLT-024] and the point before is the week before');
  perform t.admin();
end $$;

-- Trials ending within 14 days.
do $$
declare j jsonb; r jsonb;
begin
  perform t.admin();
  update public.tenant_subscriptions set status = 'trial', trial_ends_at = now() + interval '3 days' where tenant_id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  select e into r from jsonb_array_elements(j->'trials_ending') e where e->>'tenant_id' = t.id('tenantB')::text;
  perform t.ok(r is not null, '[PLT-024] a trial ending in 3 days is listed');
  perform t.ok(r->>'hotel_name' is not null and (r->>'days')::int between 2 and 3, '[PLT-024] with the hotel name and the days left');
  perform t.admin();
  update public.tenant_subscriptions set trial_ends_at = now() + interval '20 days' where tenant_id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'trials_ending') e where e->>'tenant_id' = t.id('tenantB')::text),
    '[PLT-024] a trial ending in 20 days is not listed');
  perform t.admin();
  update public.tenant_subscriptions set status = 'active', current_period_end = now() + interval '20 days', trial_ends_at = now() + interval '3 days' where tenant_id = t.id('tenantB');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'trials_ending') e where e->>'tenant_id' = t.id('tenantB')::text),
    '[PLT-024] a paying hotel is not listed as a trial, whatever its old trial date');
  perform t.admin();
end $$;

-- Quiet hotels: older than a week, no staff sign-in for 7 days.
do $$
declare j jsonb;
begin
  perform t.admin();
  update public.tenants set created_at = now() - interval '30 days' where id = t.id('tenantA');
  update auth.users set last_sign_in_at = now() - interval '10 days' where id in (select id from public.profiles where tenant_id = t.id('tenantA'));
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(exists (select 1 from jsonb_array_elements(j->'quiet') e where e->>'tenant_id' = t.id('tenantA')::text),
    '[PLT-024] a hotel whose staff last signed in 10 days ago is quiet');
  perform t.eq((select (e->>'days_inactive')::int from jsonb_array_elements(j->'quiet') e where e->>'tenant_id' = t.id('tenantA')::text), 10,
    '[PLT-024] with the days since the last sign-in');
  perform t.ok((select e->>'country' is not null from jsonb_array_elements(j->'quiet') e where e->>'tenant_id' = t.id('tenantA')::text),
    '[PLT-024] and the hotel country');
  perform t.admin();
  update auth.users set last_sign_in_at = now() - interval '1 day' where id in (select id from public.profiles where tenant_id = t.id('tenantA'));
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'quiet') e where e->>'tenant_id' = t.id('tenantA')::text),
    '[PLT-024] a hotel whose staff signed in yesterday is not quiet');
  perform t.admin();
  update public.tenants set created_at = now() - interval '2 days' where id = t.id('tenantA');
  update auth.users set last_sign_in_at = null where id in (select id from public.profiles where tenant_id = t.id('tenantA'));
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(not exists (select 1 from jsonb_array_elements(j->'quiet') e where e->>'tenant_id' = t.id('tenantA')::text),
    '[PLT-024] a hotel under a week old is not called quiet');
  perform t.admin();
end $$;

-- Monthly list price of paying hotels, worked out by the database.
do $$
declare j jsonb; v_active int; v_ngn numeric; v_all_ngn boolean;
begin
  perform t.admin();
  update public.plans set prices = jsonb_set(prices, '{NGN}', '{"month": 4500000, "year": 45000000}'::jsonb) where code = 'standard';
  update public.tenant_subscriptions set status = 'active', plan_code = 'standard', current_period_end = now() + interval '20 days' where tenant_id = t.id('tenantA');
  update public.tenant_subscriptions set status = 'trial', plan_code = 'standard', trial_ends_at = now() + interval '40 days' where tenant_id = t.id('tenantB');
  select count(*)::int into v_active from public.tenant_subscriptions where status = 'active';
  select bool_and(coalesce((select base_currency from public.properties p where p.tenant_id = s.tenant_id order by created_at, id limit 1), 'NGN') = 'NGN')
    into v_all_ngn from public.tenant_subscriptions s where status = 'active';
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  select (e->>'amount')::numeric into v_ngn from jsonb_array_elements(j->'monthly_value') e where e->>'currency' = 'NGN';
  perform t.ok(v_all_ngn, '[PLT-024] the test hotels are priced in naira');
  perform t.eq(v_ngn, v_active * 45000::numeric, '[PLT-024] monthly value is the naira list price of each active hotel, in whole naira');
  perform t.admin();
  update public.tenant_subscriptions set status = 'past_due' where tenant_id = t.id('tenantA');
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(coalesce((select (e->>'amount')::numeric from jsonb_array_elements(j->'monthly_value') e where e->>'currency' = 'NGN'), 0) = (v_active - 1) * 45000::numeric,
    '[PLT-024] a past due hotel is not counted as paying');
  perform t.admin();
end $$;

-- Account data only.
do $$
declare j jsonb;
begin
  perform t.as_user(t.id('sumop'), 'aal2');
  j := public.platform_summary();
  perform t.ok(j::text !~* '@|guest|phone|balance|reservation', '[PLT-024] the summary carries no guest, contact, booking or balance data');
  perform t.admin();
end $$;

rollback;
