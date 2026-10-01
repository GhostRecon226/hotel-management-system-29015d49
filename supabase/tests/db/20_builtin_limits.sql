-- Decision 6c: built-in roles carry approval limits, set per hotel. A hotel no longer has to copy a role to
-- give front desk a discount limit. One hotel's limit never reaches another hotel.
begin;

-- A front desk clerk who holds only the built-in Front Desk role (the fixture clerk also holds a copied role).
do $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_uid, 'fdo2@test.local', now(), 'authenticated', 'authenticated');
  perform t.put('fdo2', v_uid);
  perform t.login('adminA');
  perform public.register_invited_user(v_uid, 'Femi Frontdesk', null);
  perform public.assign_role(v_uid, t.id('propA'), (select id from public.roles where tenant_id is null and code = 'FDO'));
  perform t.admin();
end $$;

do $$
declare v_fdo uuid := (select id from public.roles where tenant_id is null and code = 'FDO');
  v_res uuid; v_f uuid; v_tx uuid; j jsonb; v_copy uuid;
begin
  perform t.login('fdo2');
  perform t.eq(app.approval_limit('fin.discount.apply', t.id('propA')), 0::numeric, '[6c] before a limit is set, front desk can approve no discount by itself');
  perform t.raises(format('select public.set_approval_limit(%L, %L, 5000)', v_fdo, 'fin.discount.apply'), 'E_FORBIDDEN', '[6c] front desk cannot set limits');

  perform t.login('adminA');
  perform t.lives(format('select public.set_approval_limit(%L, %L, 5000)', v_fdo, 'fin.discount.apply'), '[6c] the administrator sets a limit on the built-in Front Desk role');
  perform t.eq((select (p->>'max_amount')::numeric from jsonb_array_elements(public.admin_roles()) r, jsonb_array_elements(r->'permissions') p
    where r->>'code' = 'FDO' and p->>'key' = 'fin.discount.apply'), 5000::numeric, '[6c] the Admin screen shows the limit on the built-in role');

  perform t.login('fdo2');
  perform t.eq(app.approval_limit('fin.discount.apply', t.id('propA')), 5000.0000, '[6c] front desk now has that limit');
  v_res := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('101'), null, null);
  v_f := t.main_folio(v_res);
  v_tx := public.post_charge(v_f, t.cc('REST'), 20000, false, 'Dinner', null, 'lim-1');
  j := public.apply_discount(v_tx, 3000, 'Late food', 'lim-d1');
  perform t.eq(j->>'status', 'posted', '[6c] a discount within the limit posts straight away');
  j := public.apply_discount(v_tx, 6000, 'Very late food', 'lim-d2');
  perform t.eq(j->>'status', 'pending', '[6c] a discount above the limit waits for an approver');

  -- Hotel B is not affected and cannot see hotel A's limit.
  perform t.login('adminB');
  perform t.eq((select count(*)::int from public.approval_limits where role_id = v_fdo), 0, '[6c] another hotel does not see this hotel''s limit');
  perform t.eq((select (p->>'max_amount') from jsonb_array_elements(public.admin_roles()) r, jsonb_array_elements(r->'permissions') p
    where r->>'code' = 'FDO' and p->>'key' = 'fin.discount.apply'), null::text, '[6c] and its Admin screen shows no limit for the same role');
  perform t.lives(format('select public.set_approval_limit(%L, %L, 1000)', v_fdo, 'fin.discount.apply'), '[6c] another hotel sets its own limit on the same built-in role');
  perform t.login('fdo2');
  perform t.eq(app.approval_limit('fin.discount.apply', t.id('propA')), 5000.0000, '[6c] which does not change this hotel''s limit');

  -- Copying the built-in role copies this hotel's limit only.
  perform t.login('adminA');
  v_copy := public.copy_role(v_fdo, 'FDOX', 'Front desk (copy)');
  perform t.eq((select max_amount from public.approval_limits where role_id = v_copy and permission_key = 'fin.discount.apply'), 5000.0000,
    '[6c] copying the built-in role keeps this hotel''s limit');
  perform t.eq((select count(*)::int from public.approval_limits where role_id = v_copy), 1, '[6c] and nothing from other hotels');

  -- A permission the role does not hold, a negative amount, and clearing the limit.
  perform t.raises(format('select public.set_approval_limit(%L, %L, 100)', v_fdo, 'adm.role.manage'), 'E_NOT_FOUND', '[6c] only permissions the role holds can carry a limit');
  perform t.raises(format('select public.set_approval_limit(%L, %L, -1)', v_fdo, 'fin.discount.apply'), 'E_INVALID', '[6c] a limit cannot be negative');
  perform public.set_approval_limit(v_fdo, 'fin.discount.apply', null);
  perform t.login('fdo2');
  perform t.eq(app.approval_limit('fin.discount.apply', t.id('propA')), 0::numeric, '[6c] clearing the limit puts front desk back to zero');

  -- Role assignment still works with a limit in place in another hotel.
  perform t.login('adminA');
  perform t.lives(format('select public.assign_role(%L, %L, %L)', t.id('fdo2'), t.id('propA'), v_fdo), '[6c] the administrator can still give someone the built-in role');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('built-in role limits', sqlerrm);
end $$;

rollback;
