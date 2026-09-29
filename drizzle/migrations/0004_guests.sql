-- Guests: profiles, ID documents, feedback, search, merge and anonymise.
-- Guests belong to the tenant (shared by all its properties).

insert into public.permissions(key, description, module) values
  ('guest.document.view', 'See guest ID document numbers', 'guests'),
  ('guest.anonymise',     'Anonymise guest profiles',      'guests')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, x.perm, 'Y'
from public.roles r
join (values
  ('SYSADMIN','guest.document.view'),('GM','guest.document.view'),('FOM','guest.document.view'),
  ('FDO','guest.document.view'),('RES','guest.document.view'),
  ('SYSADMIN','guest.anonymise'),('GM','guest.anonymise')
) as x(code, perm) on x.code = r.code
where r.tenant_id is null
on conflict do nothing;

create table public.guests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  first_name     text not null,
  last_name      text not null default '',
  phone          text,
  email          text,
  nationality    text,
  address        text,
  notes          text,
  status         text not null default 'active' check (status in ('active','merged')),
  merged_into    uuid references public.guests(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  anonymised_at  timestamptz
);
create index guests_tenant_name_idx on public.guests(tenant_id, lower(last_name), lower(first_name));
create index guests_tenant_phone_idx on public.guests(tenant_id, phone);
create index guests_tenant_email_idx on public.guests(tenant_id, lower(email));

create table public.guest_documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  guest_id    uuid not null references public.guests(id) on delete cascade,
  doc_type    text not null check (doc_type in ('passport','national_id','drivers_licence','voters_card','other')),
  doc_number  text not null,
  expiry      date,
  created_at  timestamptz not null default now()
);
create index guest_documents_guest_idx on public.guest_documents(guest_id);

create table public.guest_feedback (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  guest_id    uuid not null references public.guests(id) on delete cascade,
  category    text not null check (category in ('compliment','complaint','request','other')),
  text        text not null,
  status      text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index guest_feedback_guest_idx on public.guest_feedback(guest_id);

grant select on public.guests to authenticated;
grant select on public.guest_feedback to authenticated;
grant all on public.guests, public.guest_documents, public.guest_feedback to service_role;

alter table public.guests enable row level security;
alter table public.guest_documents enable row level security;
alter table public.guest_feedback enable row level security;

create policy "Guest viewers read guests" on public.guests for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('guest.view'));
create policy "Guest viewers read feedback" on public.guest_feedback for select to authenticated
  using (tenant_id = app.my_tenant() and app.can('guest.view'));
-- guest_documents: no client access; read through get_guest(), which masks numbers.

create trigger guests_enforce_writable before insert or update or delete on public.guests
  for each row execute function app.enforce_writable();
create trigger guest_documents_enforce_writable before insert or update or delete on public.guest_documents
  for each row execute function app.enforce_writable();
create trigger guest_feedback_enforce_writable before insert or update or delete on public.guest_feedback
  for each row execute function app.enforce_writable();

create or replace function app.audit_guest_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb; v_new jsonb; v_row jsonb;
begin
  if current_setting('app.skip_guest_audit', true) = 'on' then return null; end if;
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values ((v_row->>'tenant_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, v_row->>'id',
          v_old, v_new, nullif(current_setting('app.audit_reason', true), ''));
  return null;
end $$;

create trigger audit_guests after insert or update or delete on public.guests
  for each row execute function app.audit_guest_row();
create trigger audit_guest_documents after insert or update or delete on public.guest_documents
  for each row execute function app.audit_guest_row();

create or replace function app.require_any(p_permission_key text)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.assert_writable(false);
  if not app.can(p_permission_key, null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.');
  end if;
end $$;
revoke all on function app.require_any(text) from public;
grant execute on function app.require_any(text) to authenticated, service_role;

create or replace function app.guest_for_write(p_id uuid)
returns public.guests language plpgsql stable security definer set search_path = public, pg_temp as $$
declare g public.guests;
begin
  select * into g from public.guests where id = p_id and tenant_id = app.my_tenant();
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Guest not found.'); end if;
  if g.status = 'merged' then perform app.fail('E_INVALID', 'This guest was merged into another profile.'); end if;
  if g.anonymised_at is not null then perform app.fail('E_INVALID', 'This guest has been anonymised.'); end if;
  return g;
end $$;

create or replace function public.search_guests(p_query text, p_limit integer default 50)
returns table(id uuid, first_name text, last_name text, phone text, email text, nationality text,
              anonymised_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := lower(btrim(coalesce(p_query, ''))); v_digits text; v_lim int;
begin
  if not app.can('guest.view', null) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view guests.'); end if;
  v_lim := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_digits := regexp_replace(v_q, '\D', '', 'g');
  return query
  select g.id, g.first_name, g.last_name, g.phone, g.email, g.nationality, g.anonymised_at, g.created_at
  from public.guests g
  where g.tenant_id = app.my_tenant() and g.status = 'active'
    and (v_q = ''
      or lower(g.first_name || ' ' || g.last_name) like '%' || v_q || '%'
      or lower(g.last_name || ' ' || g.first_name) like '%' || v_q || '%'
      or lower(coalesce(g.email, '')) like '%' || v_q || '%'
      or (length(v_digits) >= 3 and regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'))
  order by case when v_q = '' then null else lower(g.last_name) end, g.created_at desc
  limit v_lim;
end $$;

create or replace function public.get_guest(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare g public.guests; v_docs boolean;
begin
  if not app.can('guest.view', null) then perform app.fail('E_FORBIDDEN', 'You do not have permission to view guests.'); end if;
  select * into g from public.guests where id = p_id and tenant_id = app.my_tenant();
  if g.id is null then perform app.fail('E_NOT_FOUND', 'Guest not found.'); end if;
  v_docs := app.can('guest.document.view', null);
  return jsonb_build_object(
    'guest', to_jsonb(g),
    'can_view_documents', v_docs,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'doc_type', d.doc_type, 'expiry', d.expiry,
        'doc_number', case when v_docs then d.doc_number else null end,
        'doc_number_masked', case when length(d.doc_number) > 2 then repeat('•', length(d.doc_number) - 2) || right(d.doc_number, 2) else '••' end
      ) order by d.created_at)
      from public.guest_documents d where d.guest_id = g.id), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc)
      from public.guest_feedback f where f.guest_id = g.id), '[]'::jsonb),
    'stays', '[]'::jsonb
  );
end $$;

create or replace function public.save_guest(p_id uuid, p_first_name text, p_last_name text, p_phone text,
  p_email text, p_nationality text, p_address text, p_notes text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_email text := nullif(lower(btrim(p_email)), '');
begin
  if coalesce(btrim(p_first_name), '') = '' then perform app.fail('E_REQUIRED', 'First name is required.'); end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform app.fail('E_INVALID', 'Enter a valid email address.'); end if;
  if length(coalesce(p_notes, '')) > 2000 then perform app.fail('E_INVALID', 'Notes must be under 2000 characters.'); end if;
  if p_id is null then
    perform app.require_any('guest.create');
    insert into public.guests(tenant_id, first_name, last_name, phone, email, nationality, address, notes)
    values (app.my_tenant(), btrim(p_first_name), coalesce(btrim(p_last_name), ''), nullif(btrim(p_phone), ''),
            v_email, nullif(btrim(p_nationality), ''), nullif(btrim(p_address), ''), nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    perform app.require_any('guest.edit');
    perform app.guest_for_write(p_id);
    update public.guests set first_name = btrim(p_first_name), last_name = coalesce(btrim(p_last_name), ''),
      phone = nullif(btrim(p_phone), ''), email = v_email, nationality = nullif(btrim(p_nationality), ''),
      address = nullif(btrim(p_address), ''), notes = nullif(btrim(p_notes), ''), updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.save_guest_document(p_id uuid, p_guest_id uuid, p_doc_type text,
  p_doc_number text, p_expiry date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform app.require_any('guest.edit');
  if not app.can('guest.document.view', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to manage ID documents.'); end if;
  perform app.guest_for_write(p_guest_id);
  if p_doc_type not in ('passport','national_id','drivers_licence','voters_card','other') then
    perform app.fail('E_INVALID', 'Choose a document type.'); end if;
  if coalesce(btrim(p_doc_number), '') = '' then perform app.fail('E_REQUIRED', 'Document number is required.'); end if;
  if p_id is null then
    insert into public.guest_documents(tenant_id, guest_id, doc_type, doc_number, expiry)
    values (app.my_tenant(), p_guest_id, p_doc_type, upper(btrim(p_doc_number)), p_expiry)
    returning id into v_id;
  else
    update public.guest_documents set doc_type = p_doc_type, doc_number = upper(btrim(p_doc_number)), expiry = p_expiry
    where id = p_id and guest_id = p_guest_id returning id into v_id;
    if v_id is null then perform app.fail('E_NOT_FOUND', 'Document not found.'); end if;
  end if;
  return v_id;
end $$;

create or replace function public.remove_guest_document(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guest uuid;
begin
  perform app.require_any('guest.edit');
  if not app.can('guest.document.view', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to manage ID documents.'); end if;
  select guest_id into v_guest from public.guest_documents where id = p_id and tenant_id = app.my_tenant();
  if v_guest is null then perform app.fail('E_NOT_FOUND', 'Document not found.'); end if;
  perform app.guest_for_write(v_guest);
  delete from public.guest_documents where id = p_id;
end $$;

create or replace function public.add_guest_feedback(p_guest_id uuid, p_category text, p_text text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform app.require_any('guest.edit');
  perform app.guest_for_write(p_guest_id);
  if p_category not in ('compliment','complaint','request','other') then perform app.fail('E_INVALID', 'Choose a category.'); end if;
  if coalesce(btrim(p_text), '') = '' then perform app.fail('E_REQUIRED', 'Feedback text is required.'); end if;
  if length(p_text) > 2000 then perform app.fail('E_INVALID', 'Feedback must be under 2000 characters.'); end if;
  insert into public.guest_feedback(tenant_id, guest_id, category, text)
  values (app.my_tenant(), p_guest_id, p_category, btrim(p_text)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_guest_feedback_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.require_any('guest.edit');
  if p_status not in ('open','in_progress','resolved','closed') then perform app.fail('E_INVALID', 'Choose a status.'); end if;
  update public.guest_feedback set status = p_status where id = p_id and tenant_id = app.my_tenant();
  if not found then perform app.fail('E_NOT_FOUND', 'Feedback not found.'); end if;
end $$;

-- When new tables reference guests (reservations, folios...), move them here too.
create or replace function public.merge_guests(p_keep uuid, p_remove uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.merge');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  if p_keep = p_remove then perform app.fail('E_INVALID', 'Choose two different guests.'); end if;
  perform 1 from public.guests where id in (p_keep, p_remove) and tenant_id = v_tenant for update;
  perform app.guest_for_write(p_keep);
  perform app.guest_for_write(p_remove);
  perform set_config('app.audit_reason', btrim(p_reason), true);

  update public.guest_documents set guest_id = p_keep where guest_id = p_remove;
  update public.guest_feedback set guest_id = p_keep where guest_id = p_remove;
  update public.guests set status = 'merged', merged_into = p_keep, updated_at = now() where id = p_remove;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (v_tenant, auth.uid(), 'merge_guests', 'guests', p_keep::text,
          jsonb_build_object('kept', p_keep, 'removed', p_remove), btrim(p_reason));
  perform set_config('app.audit_reason', '', true);
end $$;

create or replace function public.anonymise_guest(p_guest uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid := app.my_tenant();
begin
  perform app.require_any('guest.anonymise');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  perform app.guest_for_write(p_guest);

  perform set_config('app.skip_guest_audit', 'on', true);
  delete from public.guest_documents where guest_id = p_guest;
  update public.guest_feedback set text = '[Removed when the guest was anonymised]' where guest_id = p_guest;
  update public.guests set first_name = 'Anonymised', last_name = 'Guest', phone = null, email = null,
    nationality = null, address = null, notes = null, anonymised_at = now(), updated_at = now()
  where id = p_guest;
  perform set_config('app.skip_guest_audit', '', true);

  update public.audit_events set before = null, after = null
  where tenant_id = v_tenant
    and ((table_name = 'guests' and record_id = p_guest::text)
      or (table_name = 'guest_documents' and (after->>'guest_id' = p_guest::text or before->>'guest_id' = p_guest::text)));

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, reason)
  values (v_tenant, auth.uid(), 'anonymise_guest', 'guests', p_guest::text, btrim(p_reason));
end $$;

revoke all on function public.search_guests(text, integer), public.get_guest(uuid),
  public.save_guest(uuid, text, text, text, text, text, text, text),
  public.save_guest_document(uuid, uuid, text, text, date), public.remove_guest_document(uuid),
  public.add_guest_feedback(uuid, text, text), public.set_guest_feedback_status(uuid, text),
  public.merge_guests(uuid, uuid, text), public.anonymise_guest(uuid, text) from public, anon;
grant execute on function public.search_guests(text, integer), public.get_guest(uuid),
  public.save_guest(uuid, text, text, text, text, text, text, text),
  public.save_guest_document(uuid, uuid, text, text, date), public.remove_guest_document(uuid),
  public.add_guest_feedback(uuid, text, text), public.set_guest_feedback_status(uuid, text),
  public.merge_guests(uuid, uuid, text), public.anonymise_guest(uuid, text) to authenticated, service_role;
