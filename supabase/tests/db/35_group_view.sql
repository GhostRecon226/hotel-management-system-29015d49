-- Hotel group view (GRP-001 to GRP-004): an all-branches summary for owners and group managers, a Group Manager role,
-- and copying room types and rates from one branch to a new one.
begin;

-- The Pro plan allows three branches.
update public.tenant_subscriptions set plan_code = 'pro' where tenant_id = (select tenant_id from public.properties where id = t.id('propA'));

do $$
declare v_north uuid; v_o jsonb; v_row jsonb; v_gm uuid; v_cnt int;
begin
  perform t.login('adminA');
  v_north := public.create_property('North Branch', 'Abuja', 'Nigeria');
  perform t.put('propN', v_north);
  perform t.admin();

  -- GRP-001: the permission exists and goes to the right built-in roles only
  perform t.ok(exists (select 1 from public.permissions where key = 'rpt.group.view'), '[GRP-001] permission rpt.group.view exists');
  perform t.ok((select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where rp.permission_key = 'rpt.group.view' and r.tenant_id is null and r.code in ('SYSADMIN', 'GM', 'GROUPMGR')) = 3,
    '[GRP-001] System Administrator, General Manager and Group Manager hold it');
  perform t.ok((select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where rp.permission_key = 'rpt.group.view' and r.tenant_id is null) = 3, '[GRP-001] no other built-in role holds it');
  perform t.ok(exists (select 1 from public.roles where tenant_id is null and code = 'GROUPMGR' and is_system and name = 'Group Manager'),
    '[GRP-001] the Group Manager built-in role exists');
  perform t.ok(not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
      where r.code = 'GROUPMGR' and r.tenant_id is null and rp.permission_key ~ '(post|create|edit|cancel|checkin|checkout|manage|run|assign|approve)'),
    '[GRP-001] Group Manager is view only');

  -- GRP-002: the overview
  perform t.login('adminA');
  v_o := public.group_overview();
  perform t.ok(jsonb_array_length(v_o->'properties') = 2, '[GRP-002] an administrator sees both branches');
  perform t.ok(not exists (select 1 from jsonb_array_elements(v_o->'properties') e where (e->>'property_id')::uuid = t.id('propB')),
    '[GRP-002] another hotel group is never listed');
  select e into v_row from jsonb_array_elements(v_o->'properties') e where (e->>'property_id')::uuid = t.id('propA');
  perform t.eq((v_row->>'rooms_total')::int, (select count(*)::int from public.rooms where property_id = t.id('propA') and is_active),
    '[GRP-002] rooms total comes from the database');
  perform t.eq((v_row->>'business_date')::date, t.bdate(), '[GRP-002] each branch shows its own business date');
  select e into v_row from jsonb_array_elements(v_o->'properties') e where (e->>'property_id')::uuid = t.id('propN');
  perform t.eq((v_row->>'rooms_total')::int, 0, '[GRP-002] a new branch has no rooms yet');
  perform t.ok(v_row->>'occupancy' is null or (v_row->>'occupancy')::numeric = 0, '[GRP-002] no rooms means no division error');
  perform t.eq((v_o->'totals'->>'rooms_total')::int, (select count(*)::int from public.rooms r join public.properties p on p.id = r.property_id
      where p.tenant_id = t.id('tenantA') and r.is_active), '[GRP-002] totals add up the branches');
  perform t.ok(v_o->'totals'->'revenue_by_currency' is not null, '[GRP-002] revenue is totalled per currency, never mixed');
  perform t.admin();

  -- Staff without the permission are refused
  perform t.login('fdo');
  perform t.raises('select public.group_overview()', 'E_FORBIDDEN', '[GRP-002] front desk cannot open the group view');
  perform t.login('adminB');
  v_o := public.group_overview();
  perform t.ok(jsonb_array_length(v_o->'properties') = 1 and (v_o->'properties'->0->>'property_id')::uuid = t.id('propB'),
    '[GRP-002] hotel B sees only its own branch');
  perform t.admin();

  -- A Group Manager sees only the branches they hold the role on
  select id into v_gm from public.roles where tenant_id is null and code = 'GROUPMGR';
  perform t.login('adminA');
  perform public.assign_role(t.id('att'), t.id('propA'), v_gm);
  perform t.login('att');
  v_o := public.group_overview();
  perform t.ok(jsonb_array_length(v_o->'properties') = 1, '[GRP-003] a Group Manager sees only the branches they are assigned');
  perform t.login('adminA');
  perform public.assign_role(t.id('att'), t.id('propN'), v_gm);
  perform t.login('att');
  v_o := public.group_overview();
  perform t.ok(jsonb_array_length(v_o->'properties') = 2, '[GRP-003] assigning the second branch adds it');
  perform t.ok(not app.can('fin.charge.post', t.id('propA')) and not app.can('fo.checkin', t.id('propA')) and app.can('rpt.group.view', t.id('propA')),
    '[GRP-003] a Group Manager can look but not post charges or check guests in');
  perform t.admin();
end $$;

-- GRP-004: copy setup to a new branch
do $$
declare v_res jsonb; v_empty uuid; v_types int; v_rp int; v_prices int;
begin
  perform t.login('adminA');
  v_empty := public.create_property('East Branch', 'Ibadan', 'Nigeria');
  perform t.put('propE', v_empty);
  v_types := (select count(*) from public.room_types where property_id = t.id('propA'));
  v_rp := (select count(*) from public.rate_plans where property_id = t.id('propA'));
  v_prices := (select count(*) from public.rate_plan_prices where property_id = t.id('propA'));
  perform t.ok(v_types > 0 and v_rp > 0, '[GRP-004] the source branch has setup to copy');

  v_res := public.copy_property_setup(t.id('propA'), t.id('propE'));
  perform t.eq((v_res->>'room_types')::int, v_types, '[GRP-004] every room type is copied');
  perform t.eq((v_res->>'rate_plans')::int, v_rp, '[GRP-004] every rate plan is copied');
  perform t.eq((v_res->>'rate_prices')::int, v_prices, '[GRP-004] every price row is copied');
  perform t.eq((select count(*)::int from public.room_types where property_id = t.id('propE')), v_types, '[GRP-004] the new branch has the room types');
  perform t.eq((select count(*)::int from public.rate_plan_prices p join public.room_types rt on rt.id = p.room_type_id
      where p.property_id = t.id('propE') and rt.property_id = t.id('propE')), v_prices,
    '[GRP-004] copied prices point at the new branch room types, not the old ones');
  perform t.eq((select count(*)::int from public.rooms where property_id = t.id('propE')), 0, '[GRP-004] rooms are not copied');
  perform t.eq((select count(*)::int from public.rate_plan_prices where property_id = t.id('propA')), v_prices, '[GRP-004] the source is unchanged');
  perform t.raises(format('select public.copy_property_setup(%L, %L)', t.id('propA'), t.id('propE')), 'E_NOT_EMPTY',
    '[GRP-004] copying twice is refused');
  perform t.raises(format('select public.copy_property_setup(%L, %L)', t.id('propA'), t.id('propA')), 'E_INVALID',
    '[GRP-004] a branch cannot copy to itself');
  perform t.raises(format('select public.copy_property_setup(%L, %L)', t.id('propB'), t.id('propN')), 'E_NOT_FOUND',
    '[GRP-004] another hotel group cannot be the source');
  perform t.login('fdo');
  perform t.raises(format('select public.copy_property_setup(%L, %L)', t.id('propA'), t.id('propN')), 'E_FORBIDDEN',
    '[GRP-004] front desk cannot copy setup');
  perform t.admin();
  perform t.ok(exists (select 1 from public.audit_events where action = 'copy_property_setup' and record_id = t.id('propE')::text),
    '[GRP-004] the copy is in the audit log');
end $$;

select t.admin();
rollback;
