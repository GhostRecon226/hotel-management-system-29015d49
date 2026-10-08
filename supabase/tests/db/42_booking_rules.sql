-- SET-012: booking rules (longest stay, tentative hold hours).
begin;

do $$ begin
  perform t.login('fom');
  perform t.raises(format('select public.set_booking_rules(%L, 14, 12)', t.id('propA')), 'E_FORBIDDEN', '[SET-012] only someone who edits the property can change booking rules');
  perform t.login('adminA');
  perform t.raises(format('select public.set_booking_rules(%L, 0, 12)', t.id('propA')), 'E_INVALID', '[SET-012] a longest stay of 0 is refused');
  perform t.raises(format('select public.set_booking_rules(%L, 366, 12)', t.id('propA')), 'E_INVALID', '[SET-012] a longest stay over 365 is refused');
  perform t.raises(format('select public.set_booking_rules(%L, 14, 0)', t.id('propA')), 'E_INVALID', '[SET-012] a hold of 0 hours is refused');
  perform t.raises(format('select public.set_booking_rules(%L, 14, 721)', t.id('propA')), 'E_INVALID', '[SET-012] a hold over 720 hours is refused');
  perform public.set_booking_rules(t.id('propA'), 3, 12);
  perform t.admin();
  perform t.eq((select max_stay_nights from public.properties where id = t.id('propA')), 3, '[SET-012] the longest stay is saved');
  perform t.eq((select tentative_hold_hours from public.properties where id = t.id('propA')), 12, '[SET-012] the hold time is saved');
  perform t.ok((select (before->>'max_stay_nights')::int = 30 and (after->>'max_stay_nights')::int = 3
                from public.audit_events where action = 'set_booking_rules' order by created_at desc limit 1),
    '[SET-012] the change is audited with the old and new values');
  perform t.login('adminA');
  perform t.raises(format('select t.book(%L, %L, %L, %L, %L)', t.id('g1'), t.bdate() + 10, t.bdate() + 14, t.id('std'), t.id('bar')),
    'E_INVALID', '[SET-012] a booking longer than the new limit is refused');
  perform public.set_booking_rules(t.id('propA'), 30, 24);
  perform t.admin();
end $$;

rollback;
