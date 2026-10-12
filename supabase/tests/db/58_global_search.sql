-- SRC-001: the top bar search finds guests, bookings and rooms, and only what the user may see.
begin;

do $$
declare v_name text; v_r jsonb;
begin
  perform t.admin();
  v_name := 'Qwertyuiop';
  update public.guests set first_name = v_name where id = t.id('g1');

  perform t.login('fdo');
  perform t.book(t.id('g1'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  v_r := public.search_everything(t.id('propA'), v_name);
  perform t.ok(exists (select 1 from jsonb_array_elements(v_r->'guests') g where g->>'id' = t.id('g1')::text), '[SRC-001] the guest is found by name');
  perform t.ok(jsonb_array_length(v_r->'reservations') >= 1, '[SRC-001] the guest booking is found by guest name');
  v_r := public.search_everything(t.id('propA'), '101');
  perform t.ok(exists (select 1 from jsonb_array_elements(v_r->'rooms') r where r->>'room_number' = '101'), '[SRC-001] room 101 is found');
  v_r := public.search_everything(t.id('propA'), left(v_name, 1));
  perform t.eq(v_r, jsonb_build_object('guests', '[]'::jsonb, 'reservations', '[]'::jsonb, 'rooms', '[]'::jsonb),
    '[SRC-001] one letter returns nothing');
  perform t.admin();

  perform t.login('adminB');
  v_r := public.search_everything(t.id('propA'), v_name);
  perform t.eq(v_r, jsonb_build_object('guests', '[]'::jsonb, 'reservations', '[]'::jsonb, 'rooms', '[]'::jsonb),
    '[SRC-001] another hotel group sees nothing of this hotel');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('global search', sqlerrm);
end $$;

rollback;
