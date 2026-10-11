-- PAG-001: guest search, booking search and the audit log return the next page when asked.
begin;

do $$
declare v_a uuid[]; v_b uuid[]; v_all int; v_ra uuid[]; v_rb uuid[]; v_rall int; v_aa jsonb; v_ab jsonb;
begin
  perform t.login('fdo');
  perform t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.book(t.id('g1'), t.bdate() + 2, t.bdate() + 3, t.id('std'), t.id('bar'));

  select count(*)::int into v_all from public.search_guests('', 200, 0);
  perform t.ok(v_all >= 2, '[PAG-001] the test hotel has at least two guests');
  select array_agg(id) into v_a from public.search_guests('', 1, 0);
  select array_agg(id) into v_b from public.search_guests('', 1, 1);
  perform t.ok(v_a[1] is not null and v_b[1] is not null and v_a[1] <> v_b[1], '[PAG-001] guest page two starts after page one');
  perform t.eq((select count(*)::int from public.search_guests('', 200, v_all)), 0, '[PAG-001] guest search past the end is empty');
  perform t.eq((select count(*)::int from public.search_guests('')), v_all, '[PAG-001] guest search without an offset still works');

  select count(*)::int into v_rall from public.search_reservations(t.id('propA'), '', null, null, null, 500, 0);
  perform t.ok(v_rall >= 2, '[PAG-001] the test property has at least two bookings');
  select array_agg(id) into v_ra from public.search_reservations(t.id('propA'), '', null, null, null, 1, 0);
  select array_agg(id) into v_rb from public.search_reservations(t.id('propA'), '', null, null, null, 1, 1);
  perform t.ok(v_ra[1] is not null and v_rb[1] is not null and v_ra[1] <> v_rb[1], '[PAG-001] booking page two starts after page one');
  perform t.eq((select count(*)::int from public.search_reservations(t.id('propA'), '', null, null, null, 500, v_rall)), 0,
    '[PAG-001] booking search past the end is empty');
  perform t.admin();

  perform t.login('adminA');
  v_aa := public.audit_log(null, null, null, null, null, 1, 0);
  v_ab := public.audit_log(null, null, null, null, null, 1, 1);
  perform t.ok(jsonb_array_length(v_aa) = 1 and jsonb_array_length(v_ab) = 1
    and v_aa->0->>'id' <> v_ab->0->>'id', '[PAG-001] audit log page two starts after page one');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('list paging', sqlerrm);
end $$;

rollback;
