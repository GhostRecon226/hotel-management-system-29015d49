-- Tenant isolation (ported from reference 11_isolation). Hotel B must never see or change hotel A.
begin;
do $$
declare v_res uuid; v_folio uuid; v_n int;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g1'), t.bdate() + 10, t.bdate() + 12, t.id('std'), t.id('bar'));
  perform t.admin();
  v_folio := t.main_folio(v_res);

  perform t.login('adminB');
  select count(*) into v_n from public.guests;              perform t.eq(v_n, 0, '[PLT-003] B sees none of A''s guests');
  select count(*) into v_n from public.reservations;        perform t.eq(v_n, 0, '[PLT-003] B sees none of A''s reservations');
  select count(*) into v_n from public.folios;              perform t.eq(v_n, 0, '[PLT-003] B sees none of A''s folios');
  select count(*) into v_n from public.properties;          perform t.eq(v_n, 1, '[PLT-003] B sees only its own property');
  select count(*) into v_n from public.rooms;               perform t.eq(v_n, 0, '[PLT-003] B sees none of A''s rooms');
  select count(*) into v_n from public.audit_events where tenant_id = t.id('tenantA'); perform t.eq(v_n, 0, '[PLT-003] B cannot read A''s audit trail');
  select count(*) into v_n from public.tenants;             perform t.eq(v_n, 1, '[PLT-003] B sees only its own tenant');
  select count(*) into v_n from public.v_folio_balances;    perform t.eq(v_n, 0, '[PLT-003] B sees no folio balances of A');

  perform t.raises(format('select public.cancel_reservation(%L, %L, false, null)', v_res, 'x'), 'E_NOT_FOUND|E_FORBIDDEN', '[PLT-003] B cannot cancel A''s reservation');
  perform t.raises(format('select public.post_charge(%L, %L, 100, false, %L, null, %L)', v_folio, t.cc('REST'), 'x', gen_random_uuid()),
    'E_NOT_FOUND|E_FORBIDDEN', '[PLT-003] B cannot post to A''s folio');
  perform t.raises(format('insert into public.guests (tenant_id, first_name, last_name) values (%L, %L, %L)', t.id('tenantA'), 'X', 'Y'),
    'permission denied|row-level security', '[PLT-003] B cannot insert a guest into A');
  perform t.raises(format('select public.save_room_type(%L, null, %L, %L, 2, 0, null, true)', t.id('propA'), 'ZZ', 'Z'),
    'E_FORBIDDEN|E_NOT_FOUND', '[PLT-003] B cannot add a room type to A');
  perform t.raises(format('select * from public.get_availability(%L, %L, %L)', t.id('propA'), t.bdate(), t.bdate() + 1),
    'E_FORBIDDEN|E_NOT_FOUND', '[PLT-003] B cannot read A''s availability');
  begin
    update public.guests set first_name = 'Hacked' where id = t.id('g1');
  exception when others then null;
  end;
  perform t.admin();
  perform t.eq((select first_name from public.guests where id = t.id('g1')), 'Chinedu', '[PLT-003] B''s update of A''s guest changed nothing');

  perform t.login('nobody');
  select count(*) into v_n from public.properties; perform t.eq(v_n, 0, 'a user without a hotel sees no properties');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g1'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar')),
    'E_FORBIDDEN|E_NOT_FOUND|E_READ_ONLY', 'a user without a hotel cannot book');

  perform t.login('hks');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g1'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar')),
    'E_FORBIDDEN', 'housekeeping supervisor cannot book');
  select count(*) into v_n from public.folio_transactions; perform t.eq(v_n, 0, 'housekeeping cannot read ledger rows');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('isolation', sqlerrm);
end $$;
rollback;
