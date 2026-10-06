-- Wave 1, item 2 part 2 (decisions of 6 Oct 2026): FO-003 registration card, FO-007 room upgrades, PLT-007 second property.
begin;

create function t.audits(p_action text, p_record uuid) returns setof public.audit_events language sql stable security definer as $$
  select * from public.audit_events where action = p_action and record_id = p_record::text order by created_at $$;
grant execute on function t.audits(text, uuid) to authenticated;

do $$ begin
  perform t.login('adminA');
  perform public.save_room(t.id('propA'), null, n, t.id('std'), '1', true) from unnest(array['171','172','173','174','175','176']) n;
  perform public.save_room(t.id('propA'), null, n, t.id('dlx'), '2', true) from unnest(array['271','272','273']) n;
end $$;

-- FO-003: the registration card must be accepted. The screen always sends the tick; a call that leaves it out is
-- not refused (recorded limit: the shared test helper and API callers send no tick).
do $$
declare v_r uuid; v_w uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r,
    '{"id_type":"passport","id_number":"A1","registration_accepted":false}', t.room('171')), 'E_REQUIRED', '[FO-003] not accepted: check-in is refused');
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_r,
    '{"id_type":"passport","id_number":"A1","registration_accepted":"yes"}', t.room('171')), 'E_REQUIRED', '[FO-003] only a real tick counts');
  perform t.raises(format('select public.walk_in_check_in(%L, %L, %L, %L, %L, %L, 1, 0, %L, %L::jsonb, null, null, null, null, null, null)',
    t.id('propA'), 'fo003-w', t.id('g3'), t.bdate() + 1, t.id('std'), t.id('bar'), t.room('172'),
    '{"id_type":"passport","id_number":"W1","registration_accepted":false}'), 'E_REQUIRED', '[FO-003] the same rule applies to walk-ins');
  perform public.check_in(v_r, '{"id_type":"passport","id_number":"A1","registration_accepted":true}'::jsonb, t.room('171'), null, null);
  perform t.admin();
  perform t.ok((select (registration->>'registration_accepted')::boolean from public.stays where reservation_id = v_r and status = 'in_house'),
    '[FO-003] the stay records that the card was accepted');
  perform t.login('fdo');
  v_w := public.walk_in_check_in(t.id('propA'), 'fo003-w2', t.id('g3'), t.bdate() + 1, t.id('std'), t.id('bar'), 1, 0, t.room('172'), t.reg(), null, null, null, null, null, null);
  perform t.ok(v_w is not null, '[FO-003] known limit: a direct call that leaves the tick out is not refused');
end $$;

-- FO-007: a move to a dearer room type charges the new rate unless a GM or FOM gives it free, with a reason and an audit row.
do $$
declare v_a uuid; v_b uuid; v_c uuid; q jsonb;
begin
  perform t.login('fdo');
  v_a := t.book(t.id('g1'), t.bdate(), t.bdate() + 3, t.id('std'), t.id('bar'));
  perform public.check_in(v_a, t.reg(), t.room('173'), null, null);
  q := public.preview_move_rate(v_a, t.room('271'));
  perform t.ok((q->>'is_upgrade')::boolean and (q->>'current_total')::numeric = 150000 and (q->>'new_total')::numeric = 270000,
    '[FO-007] the screen is told the move is an upgrade and both totals: ' || q::text);
  perform t.ok(not (q->>'can_keep_rate')::boolean, '[FO-007] front desk is told it cannot keep the rate on an upgrade');
  perform t.raises(format('select public.move_room(%L, %L, %L, null, true)', v_a, t.room('271'), 'Upgrade'), 'E_FORBIDDEN',
    '[FO-007] front desk cannot keep the old rate on a dearer room type');
  perform public.move_room(v_a, t.room('271'), 'Guest asked for a bigger room', null, false);
  perform t.eq((select total_amount from public.reservations where id = v_a), 270000::numeric, '[FO-007] charging the new rate reprices the remaining nights');
  perform t.eq((select count(*)::int from public.reservation_nights where reservation_id = v_a and rate_amount = 90000), 3, '[FO-007] every remaining night is at the new rate');

  v_b := t.book(t.id('g2'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_b, t.reg(), t.room('174'), null, null);
  perform t.login('fom');
  perform t.ok((public.preview_move_rate(v_b, t.room('272'))->>'can_keep_rate')::boolean, '[FO-007] a front office manager may keep the rate');
  perform public.move_room(v_b, t.room('272'), 'Complimentary: loyal guest', null, true);
  perform t.eq((select total_amount from public.reservations where id = v_b), 100000::numeric, '[FO-007] a complimentary upgrade keeps the booked rate');
  perform t.eq((select room_type_id from public.reservations where id = v_b), t.id('dlx'), '[FO-007] and the booking is now for the new room type');
  perform t.ok(exists (select 1 from t.audits('complimentary_upgrade', v_b) a where a.reason = 'Complimentary: loyal guest'
    and (a.after->>'kept_total')::numeric = 100000 and (a.after->>'new_rate_total')::numeric = 180000 and a.actor_id = t.id('fom')),
    '[FO-007] the complimentary upgrade is audited with the reason, both totals and who gave it');

  -- Same or lower rate: open to front desk, either way.
  perform t.login('fdo');
  perform public.move_room(v_b, t.room('175'), 'Back to standard', null, true);
  perform t.eq((select total_amount from public.reservations where id = v_b), 100000::numeric, '[FO-007] front desk can move to a cheaper type and keep the rate');
  perform t.ok(not exists (select 1 from t.audits('complimentary_upgrade', v_b) a where a.reason = 'Back to standard'), '[FO-007] that is not a complimentary upgrade');
exception when others then perform t.admin(); perform t.crash('FO-007 upgrades', sqlerrm);
end $$;

-- FO-007: a night already posted to the folio keeps its posted price; only later nights are repriced.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g3'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('176'), null, null);
  perform t.login('adminA');
  perform public.post_room_charges(t.id('propA'), null);
  perform t.login('fdo');
  perform public.move_room(v_r, t.room('273'), 'Upgrade, paying', null, false);
  perform t.eq((select rate_amount from public.reservation_nights where reservation_id = v_r and stay_date = t.bdate()), 50000::numeric,
    '[FO-007] tonight was already charged, so it keeps its price');
  perform t.eq((select rate_amount from public.reservation_nights where reservation_id = v_r and stay_date = t.bdate() + 1), 90000::numeric,
    '[FO-007] later nights take the new rate');
exception when others then perform t.admin(); perform t.crash('FO-007 posted nights', sqlerrm);
end $$;

-- PLT-007: only the System Administrator adds a property, within the plan's property limit.
do $$
declare v_p uuid;
begin
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'starter' where tenant_id = t.id('tenantA');
  perform t.login('fom');
  perform t.raises(format('select public.create_property(%L, %L, %L)', 'Sunrise Annex', 'Ibadan', 'Nigeria'), 'E_FORBIDDEN', '[PLT-007] a front office manager cannot add a property');
  perform t.login('gm');
  perform t.raises(format('select public.create_property(%L, %L, %L)', 'Sunrise Annex', 'Ibadan', 'Nigeria'), 'E_PLAN_LIMIT', '[PLT-007][ADM-002] a general manager can add a property too (decision of 6 Oct 2026), within the plan limit');
  perform t.login('adminA');
  perform t.raises(format('select public.create_property(%L, %L, %L)', 'Sunrise Annex', 'Ibadan', 'Nigeria'), 'E_PLAN_LIMIT', '[PLT-007] the plan''s property limit applies');
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'pro' where tenant_id = t.id('tenantA');
  perform t.login('adminA');
  v_p := public.create_property('Sunrise Annex', 'Ibadan', 'Nigeria');
  perform t.ok(app.can('setup.property.edit', v_p), '[PLT-007] the administrator can manage the new property');
  perform t.admin();
  perform t.eq((select count(*)::int from public.payment_methods where property_id = v_p), 4, '[PLT-007] the new property gets the same defaults');
  perform t.eq((select tenant_id from public.properties where id = v_p), t.id('tenantA'), '[PLT-007] it belongs to the same hotel');
  perform t.ok(exists (select 1 from public.audit_events where action = 'create_property' and record_id = v_p::text), '[PLT-007] adding a property is audited');
  perform t.login('gm');
  perform t.ok(public.create_property('Sunrise Lekki', 'Lagos', 'Nigeria') is not null, '[PLT-007][ADM-002] the general manager adds a property when the plan allows');
  perform t.admin();
  perform t.login('fdo');
  perform t.ok(not app.can('fo.view', v_p), '[PLT-007] staff get no access to it until they are given a role there');
  perform t.admin();
  update public.tenant_subscriptions set plan_code = 'standard' where tenant_id = t.id('tenantA');
exception when others then perform t.admin(); perform t.crash('PLT-007', sqlerrm);
end $$;

rollback;
