-- Signup, country templates, booking extras, arrivals, voids, documents, service requests,
-- receipts, housekeeping scope, tickets, blocks and roll failures (ported from reference 17_more_features).
begin;

do $$
declare r record; v_gh uuid := gen_random_uuid();
begin
  perform t.login('unconfirmed');
  perform t.raises('select public.create_hotel(''X Ltd'', ''NG'', ''X'', ''X'', ''Lagos'')', 'E_EMAIL_NOT_CONFIRMED', '[PLT-002] an unconfirmed email cannot create a hotel');
  perform t.login('adminA');
  perform t.raises('select public.create_hotel(''Y Ltd'', ''NG'', ''Y'', ''Y'', ''Lagos'')', 'E_ALREADY_HAS_HOTEL', '[PLT-002] an account can only belong to one hotel');
  perform t.admin();
  perform t.eq((select count(*)::int from public.tax_rates where property_id = t.id('propA')), 3, '[PLT-004] Nigeria template seeded three tax lines');
  perform t.ok((select bool_and(description ilike 'UNVERIFIED%') from public.tax_rates where property_id = t.id('propA')), '[PLT-004] all seeded tax lines start unverified');
  perform t.eq((select percent from public.tax_rates where property_id = t.id('propA') and code = 'VAT'), 7.5, '[PLT-004] VAT is seeded at 7.5%');
  perform t.eq((select base_currency::text from public.properties where id = t.id('propA')), 'NGN', '[PLT-004] Nigeria property uses naira');
  perform t.eq((select timezone from public.properties where id = t.id('propA')), 'Africa/Lagos', '[PLT-004][NFR-005] and the Lagos timezone');
  perform t.ok((select count(*) from public.charge_codes where property_id = t.id('propA') and code in ('ROOM', 'REST', 'LAUNDRY')) = 3, '[PLT-004] the engine''s charge codes exist for every property');
  perform t.eq((select status from public.tenant_subscriptions where tenant_id = t.id('tenantB')), 'trial', '[PLT-001] a new hotel starts on trial');
  perform t.ok((select trial_ends_at::date - created_at::date from public.tenant_subscriptions where tenant_id = t.id('tenantB')) = 30, '[PLT-001] for thirty days');
  insert into auth.users (id, email, email_confirmed_at, aud, role) values (v_gh, 'gh@test.local', now(), 'authenticated', 'authenticated');
  perform t.put('adminGH', v_gh);
  perform t.login('adminGH');
  select * into r from public.create_hotel('Accra Stays Ltd', 'GH', 'Accra Stays', 'Kofi Mensah', 'Accra');
  perform t.admin();
  perform t.eq((select base_currency::text from public.properties where id = r.property_id), 'GHS', '[PLT-004] Ghana property uses cedi');
  perform t.eq((select count(*)::int from public.tax_rates where property_id = r.property_id), 0, '[PLT-004] no tax lines are guessed for other countries');
exception when others then perform t.admin(); perform t.crash('signup and templates', sqlerrm);
end $$;

-- Booking extras.
do $$
declare v_r uuid; v_t uuid;
begin
  perform t.login('fdo');
  v_r := public.create_reservation(t.id('propA'), gen_random_uuid()::text, t.id('g1'), t.bdate() + 5, t.bdate() + 6, t.id('std'), t.id('bar'), 2, 0,
    'confirmed', 'corporate', 'Dangote Group', null, null, 'company', null, null, null, null);
  perform t.eq((select company_name from public.reservations where id = v_r), 'Dangote Group', '[RES-011] a corporate booking keeps the company name');
  perform t.eq((select source from public.reservations where id = v_r), 'corporate', '[RES-011] and its booking source');
  perform public.set_reservation_guests(v_r, t.id('g1'), array[t.id('g2')]);
  perform t.eq((select count(*)::int from public.reservation_guests where reservation_id = v_r), 2, '[RES-013] additional guests can be added to a booking');
  perform t.ok(exists (select 1 from information_schema.columns where table_name = 'reservations' and column_name in ('arrival_ready', 'is_arrival_ready')),
    '[RES-013] the arrival-ready flag exists and is a flag, not a status');
  v_t := public.create_reservation(t.id('propA'), gen_random_uuid()::text, t.id('g2'), t.bdate() + 5, t.bdate() + 6, t.id('std'), t.id('bar'), 1, 0,
    'tentative', 'direct', null, null, null, 'none', now() + interval '1 day', null, null, null);
  perform t.ok((select hold_until is not null from public.reservations where id = v_t), '[RES-005] a tentative booking has a hold expiry');
  perform public.confirm_reservation(v_t);
  perform t.ok((select hold_until is null and status = 'confirmed' from public.reservations where id = v_t), '[RES-005] confirming removes the hold expiry');
  perform t.raises(format('select public.confirm_reservation(%L)', v_t), 'E_INVALID', '[RES-005] a confirmed booking cannot be confirmed again');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('booking extras', sqlerrm);
end $$;

-- Arrivals, in house, room board and voiding a check-in.
do $$
declare v_r uuid;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g3'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform t.ok(exists (select 1 from public.v_arrivals where id = v_r and guest_name ilike '%Balogun%'), '[FO-001] the arrivals list shows the guest due today');
  perform public.check_in(v_r, t.reg(), t.room('103'), null, null);
  perform t.ok(not exists (select 1 from public.v_arrivals where id = v_r), '[FO-001] a checked-in guest leaves the arrivals list');
  perform t.eq((select room_number from public.v_in_house where reservation_id = v_r), '103', '[FO-002] and appears in house with the room number');
  perform t.ok((select is_occupied from public.v_room_board where id = t.room('103')), '[FO-013] the room board shows occupied');
  perform t.raises(format('select public.void_check_in(%L, %L)', v_r, 'Wrong guest'), 'E_FORBIDDEN', '[FO-012] front desk cannot void a check-in');
  perform t.login('fom');
  perform t.lives(format('select public.void_check_in(%L, %L)', v_r, 'Wrong guest'), '[FO-012] a same-day check-in can be voided');
  perform t.eq((select status from public.reservations where id = v_r), 'confirmed', '[FO-012] the booking is confirmed again');
  perform t.ok(not (select is_occupied from public.rooms where id = t.room('103')), '[FO-012] the room is vacant');
  perform t.ok(exists (select 1 from public.room_assignments where reservation_id = v_r and room_id = t.room('103') and is_active), '[FO-012] and held for the guest');
  perform t.login('fdo');
  perform t.lives(format('select public.check_in(%L, t.reg(), %L, null, null)', v_r, t.room('103')), '[FO-012] the guest can be checked in again straight away');
  v_r := t.book(t.id('g1'), t.bdate(), t.bdate() + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('102'), null, null);
  perform t.put('res_svc', v_r);
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('arrivals and void', sqlerrm);
end $$;

-- ID documents are shown only to roles allowed to see them.
do $$
declare j jsonb;
begin
  perform t.login('fdo');
  perform public.save_guest_document(null, t.id('g3'), 'passport', 'P0001111', null);
  j := public.get_guest(t.id('g3'));
  perform t.ok(j::text ~ 'P0001111', '[GST-002] front desk sees ID documents');
  perform t.login('rsv');
  j := public.get_guest(t.id('g3'));
  perform t.ok(j::text !~ 'P0001111', '[GST-002] reservation officers do not see ID documents');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('documents', sqlerrm);
end $$;

-- Guest service requests.
do $$
declare v_s uuid; v_f uuid; v_b numeric;
begin
  perform t.login('fdo');
  v_f := t.main_folio(t.id('res_svc'));
  v_b := t.balance(v_f);
  v_s := public.create_service_request(t.id('res_svc'), 'laundry', 'Two shirts', true, 3000, t.cc('LAUNDRY'), null);
  perform t.ok(v_s is not null, '[SVC-001] a request is logged for a guest in house');
  perform public.assign_service_request(v_s, t.id('fdo'));
  perform public.start_service_request(v_s);
  perform public.complete_service_request(v_s);
  perform t.eq(t.balance(v_f) - v_b, 3547.5000, '[SVC-002] completing a chargeable request posts the charge with tax');
  perform t.eq((select status from public.service_requests where id = v_s), 'completed', '[SVC-001] the request is completed');
  perform t.lives(format('select public.complete_service_request(%L)', v_s), '[SVC-002] completing again is harmless');
  perform t.eq(t.balance(v_f) - v_b, 3547.5000, '[SVC-002] a request is charged once');
  v_s := public.create_service_request(t.id('res_svc'), 'food', 'Late snack', false, null, null, null);
  perform t.login('fom');
  perform public.cancel_service_request(v_s, 'Guest changed mind');
  perform t.eq((select status from public.service_requests where id = v_s), 'cancelled', '[SVC-001] a request can be cancelled');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('service requests', sqlerrm);
end $$;

-- Interim documents and receipts.
do $$
declare v_i uuid; v_f uuid;
begin
  perform t.login('fdo');
  v_f := t.main_folio(t.id('res_svc'));
  v_i := public.issue_invoice(v_f, 'interim', 'int-1');
  perform t.ok((select balance > 0 from public.invoices where id = v_i), '[FIN-012] an interim document shows what is still due');
  perform t.ok((select number ~ '^INT-' from public.invoices where id = v_i), '[FIN-012] interim documents have their own number series (INT-)');
  v_i := public.issue_invoice(v_f, 'interim', 'int-2');
  perform t.eq((select number from public.invoices where id = v_i), 'INT-000002', '[FIN-012] interim numbers run on without gaps');
  perform t.eq((select count(*)::int from public.invoices where number like 'INV-%' and property_id = t.id('propA')), 0, '[FIN-012] interim documents use no final invoice numbers');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('receipts', sqlerrm);
end $$;

-- Housekeeping scope and inspection setting.
do $$
declare v_a uuid; v_b uuid; v_n int;
begin
  perform t.login('hks');
  v_a := public.create_hk_task(t.room('101'), 'deep_clean', 'normal', t.id('att'), null);
  v_b := public.create_hk_task(t.room('102'), 'deep_clean', 'normal', t.id('hks'), null);
  perform t.login('att');
  perform t.ok(not exists (select 1 from public.v_hk_board where id = v_b), '[HK-002] an attendant sees only their own tasks');
  perform t.ok(exists (select 1 from public.v_hk_board where id = v_a), '[HK-002] and does see their own');
  perform t.admin();
  perform t.ok(exists (select 1 from information_schema.columns where table_name = 'properties' and column_name = 'inspection_required'),
    '[SET-008] inspection can be switched off per property');
exception when others then perform t.admin(); perform t.crash('housekeeping scope', sqlerrm);
end $$;

-- Tickets reopen and cancel.
do $$
declare v_tk uuid;
begin
  perform t.login('hks');
  v_tk := public.create_ticket(t.id('propA'), 'Broken lamp', null, t.room('101'), null, 'low', t.id('mnt'));
  perform t.login('mnt');
  perform public.start_ticket(v_tk);
  perform public.resolve_ticket(v_tk, 'New bulb');
  perform t.raises(format('select public.reopen_ticket(%L, %L)', v_tk, ''), 'E_REQUIRED', '[MNT-003] reopening needs a reason');
  perform t.lives(format('select public.reopen_ticket(%L, %L)', v_tk, 'Still flickers'), '[MNT-003] a resolved ticket can be reopened with a reason');
  perform t.login('att');
  perform t.raises(format('select public.cancel_ticket(%L, %L)', v_tk, 'x'), 'E_FORBIDDEN', '[MNT-003] a room attendant cannot cancel tickets');
  perform t.login('fom');
  perform t.lives(format('select public.cancel_ticket(%L, %L)', v_tk, 'Lamp removed'), '[MNT-003] a ticket can be cancelled with a reason');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('tickets', sqlerrm);
end $$;

-- Blocks cannot oversell; expired holds and failed rolls.
do $$
declare d date := t.bdate() + 90; v_r uuid; v_hold uuid; v_d0 date; j jsonb;
begin
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), d, d + 1, t.id('dlx'), t.id('bar'));
  perform t.login('fom');
  perform t.raises(format('select public.request_room_block(%L, %L, %L, %L, %L, null)', t.room('201'), 'out_of_order', d, d + 1, 'Paint'), 'E_OVERSOLD|E_ROOM_TAKEN', '[ROOM-003] a block that would leave the type oversold is refused');

  perform t.admin();
  perform t.set_bdate(t.id('propA'), t.bdate() - 1);
  v_d0 := t.bdate();
  perform t.login('fdo');
  v_hold := public.create_reservation(t.id('propA'), gen_random_uuid()::text, t.id('g2'), v_d0 + 3, v_d0 + 4, t.id('std'), t.id('bar'), 1, 0,
    'tentative', 'direct', null, null, null, 'none', now() + interval '1 hour', null, null, null);
  perform t.admin();
  update public.reservations set hold_until = now() - interval '1 minute' where id = v_hold;
  perform t.login('adminA');
  perform public.set_rollover_time(t.id('propA'), '00:00');
  perform public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq((select status from public.reservations where id = v_hold), 'cancelled', '[RES-005] an expired hold is released at the roll');
  perform t.ok((select status_reason ilike '%hold%' from public.reservations where id = v_hold), '[RES-005] with the reason recorded');

  -- a failed roll changes nothing and tells the managers
  perform t.set_bdate(t.id('propA'), t.bdate() - 1);
  v_d0 := t.bdate();
  perform t.login('fdo');
  v_r := t.book(t.id('g1'), v_d0, v_d0 + 2, t.id('std'), t.id('bar'));
  perform public.check_in(v_r, t.reg(), t.room('101'), null, null);
  perform t.admin();
  update public.charge_codes set is_active = false where property_id = t.id('propA') and code = 'ROOM';
  perform t.login('adminA');
  perform public.run_due_rollovers_now();
  perform t.admin();
  perform t.eq(t.bdate(), v_d0, '[DAY-004] a failed roll changes nothing');
  perform t.ok(exists (select 1 from public.notifications where user_id = t.id('fom') and kind ilike '%roll%'), '[DAY-004] and tells the managers');
exception when others then perform t.admin(); perform t.crash('blocks and roll failures', sqlerrm);
end $$;

rollback;
