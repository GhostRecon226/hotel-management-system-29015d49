-- RPT-008: Latest activity on the dashboard. The newest things that happened at one hotel, as plain lines.
-- Read only. Each kind of line needs the right to see that kind of record, so nobody learns more here than on its own screen:
--   new bookings: res.view · check-ins and check-outs: fo.view · payments: fin.folio.view · clean rooms: hk.view above "own tasks only".
-- A room move is not shown as a second check-in (only the first room of the stay is). Voided check-ins are not shown.

create or replace function app.guest_label(g public.guests)
returns text language sql immutable security definer set search_path = public, pg_temp as $$
  select case when g.anonymised_at is not null then 'Guest' else coalesce(nullif(trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), ''), 'Guest') end
$$;
revoke all on function app.guest_label(public.guests) from public, anon;
grant execute on function app.guest_label(public.guests) to authenticated;

create or replace function public.recent_activity(p_property_id uuid, p_limit integer default 8)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.properties; v_res boolean; v_fo boolean; v_fin boolean; v_hk boolean; v_n integer; v_out jsonb;
begin
  select * into p from public.properties where id = p_property_id and tenant_id = app.my_tenant();
  if p.id is null or not app.has_property_access(p.id) then perform app.fail('E_NOT_FOUND', 'Property not found.'); end if;
  v_res := app.can('res.view', p.id);
  v_fo  := app.can('fo.view', p.id);
  v_fin := app.can('fin.folio.view', p.id);
  v_hk  := coalesce(app.my_level('hk.view', p.id), 'O') in ('Y', 'L');
  if not (v_res or v_fo or v_fin or v_hk) then perform app.fail('E_FORBIDDEN', 'You do not have access to the activity feed.'); end if;
  if p_limit is null or p_limit < 1 then perform app.fail('E_INVALID', 'Ask for at least one line.'); end if;
  v_n := least(p_limit, 50);

  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'title', x.title, 'detail', x.detail, 'at', x.at, 'amount', x.amount, 'currency', x.currency)
                            order by x.at desc, x.kind, x.detail), '[]'::jsonb) into v_out
  from (
    select * from (
      select * from (
        select 'reservation_created'::text as kind, 'Reservation created'::text as title,
               concat_ws(' - ', app.guest_label(g), r.number) as detail, r.created_at as at, null::numeric as amount, null::text as currency
        from public.reservations r join public.guests g on g.id = r.guest_id
        where v_res and r.property_id = p.id and r.tenant_id = p.tenant_id
        order by r.created_at desc limit v_n) a
      union all
      select * from (
        select 'checked_in', 'Guest checked in', concat_ws(' - ', app.guest_label(g), 'Room ' || rm.room_number), s.checked_in_at, null::numeric, null::text
        from public.stays s
        join public.reservations r on r.id = s.reservation_id
        join public.guests g on g.id = r.guest_id
        join public.rooms rm on rm.id = s.room_id
        where v_fo and s.property_id = p.id and s.tenant_id = p.tenant_id and s.status in ('in_house', 'checked_out', 'moved') and s.checked_in_at is not null
          and not exists (select 1 from public.stays m where m.reservation_id = s.reservation_id and m.status = 'moved'
                          and m.room_id <> s.room_id and m.checked_in_at <= s.checked_in_at)
        order by s.checked_in_at desc limit v_n) b
      union all
      select * from (
        select 'checked_out', 'Guest checked out', concat_ws(' - ', app.guest_label(g), 'Room ' || rm.room_number), s.checked_out_at, null::numeric, null::text
        from public.stays s
        join public.reservations r on r.id = s.reservation_id
        join public.guests g on g.id = r.guest_id
        join public.rooms rm on rm.id = s.room_id
        where v_fo and s.property_id = p.id and s.tenant_id = p.tenant_id and s.status = 'checked_out' and s.checked_out_at is not null
        order by s.checked_out_at desc limit v_n) c
      union all
      select * from (
        select 'payment', 'Payment posted', app.guest_label(g), t.posted_at, (-t.amount)::numeric, t.currency::text
        from public.folio_transactions t
        join public.folios f on f.id = t.folio_id
        join public.guests g on g.id = f.guest_id
        where v_fin and t.property_id = p.id and t.tenant_id = p.tenant_id and t.kind = 'payment'
        order by t.posted_at desc limit v_n) d
      union all
      select * from (
        select 'room_clean', 'Room marked clean', 'Housekeeping - Room ' || rm.room_number, coalesce(h.inspected_at, h.completed_at), null::numeric, null::text
        from public.hk_tasks h join public.rooms rm on rm.id = h.room_id
        where v_hk and h.property_id = p.id and h.tenant_id = p.tenant_id and h.status = 'inspected'
        order by coalesce(h.inspected_at, h.completed_at) desc limit v_n) e
    ) u
    order by u.at desc, u.kind, u.detail
    limit v_n
  ) x;
  return v_out;
end $$;

revoke all on function public.recent_activity(uuid, integer) from public, anon;
grant execute on function public.recent_activity(uuid, integer) to authenticated;
