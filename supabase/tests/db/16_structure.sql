-- Structure: business date, notifications, lost and found, audit immutability (ported from reference 16).
-- Grant and direct-write checks from that file live in 10_security.sql.
begin;

do $$ begin
  perform t.admin();
  perform t.raises(format('update public.properties set business_date = business_date + 1 where id = %L', t.id('propA')), 'E_INVALID', '[SET-001] nobody edits the business date by hand, not even the owner');
exception when others then perform t.crash('business date', sqlerrm);
end $$;

-- Notifications go to the right people and only they see them.
do $$
declare j jsonb; v_n int;
begin
  perform t.login('fdo');
  j := public.apply_discount(public.post_charge(public.open_main_folio(t.book(t.id('g1'), t.bdate() + 3, t.bdate() + 4, t.id('std'), t.id('bar'))),
    t.cc('REST'), 20000, false, 'Party', null, 'nt-chg'), 9000, 'Big group', 'nt-disc');
  perform t.login('fom');
  select count(*) into v_n from public.notifications where entity_id = (j->>'approval_id')::uuid;
  perform t.ok(v_n >= 1, '[ADM-008] the manager has a notification for the approval');
  perform t.ok(not exists (select 1 from public.notifications where user_id <> t.id('fom')), '[ADM-008] and sees only their own');
  perform t.login('fdo');
  perform t.ok(not exists (select 1 from public.notifications where entity_id = (j->>'approval_id')::uuid), '[ADM-008] the requester without approval rights is not notified');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('notifications', sqlerrm);
end $$;

do $$
declare v uuid;
begin
  perform t.login('hks');
  v := public.save_lost_found_item(t.id('propA'), 'Black umbrella', 'Lobby', now(), null);
  perform t.eq((select status from public.lost_found_items where id = v), 'stored', '[HK-006] housekeeping logs a lost and found item');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('lost and found', sqlerrm);
end $$;

-- [S5][ADM-006] The audit trail cannot be changed or deleted, even by the database owner.
do $$ begin
  perform t.admin();
  perform t.raises('update public.audit_events set reason = ''changed''', 'E_IMMUTABLE', '[ADM-006] the audit trail cannot be changed, even by the owner');
  perform t.raises('delete from public.audit_events', 'E_IMMUTABLE', '[ADM-006] the audit trail cannot be deleted');
  perform t.raises('truncate public.audit_events', 'E_IMMUTABLE', '[ADM-006] the audit trail cannot be truncated');
exception when others then perform t.crash('audit immutability', sqlerrm);
end $$;

rollback;
