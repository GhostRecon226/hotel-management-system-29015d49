-- [MNT-004] Photos on maintenance tickets.
-- Files go to the private bucket maintenance-photos (2 MB, JPEG/PNG/WebP). The browser has no storage access:
-- the server signs a one-time upload link and 60-second view links after these functions pass.
-- File names are random ids. Up to 5 photos per ticket. Audit rows hold ids only.
-- Who: add = raised the ticket, is assigned, or has mnt.ticket.create / mnt.ticket.work.
--      view = the same people plus mnt.view. Remove = the person who added it, or mnt.ticket.assign.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('maintenance-photos', 'maintenance-photos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.ticket_photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id),
  ticket_id     uuid not null references public.maintenance_tickets(id),
  storage_path  text not null unique,
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes between 1 and 2097152),
  status        text not null default 'pending' check (status in ('pending', 'ready', 'deleting', 'deleted')),
  uploaded_by   uuid not null default auth.uid(),
  uploaded_at   timestamptz not null default now(),
  ready_at      timestamptz,
  deleted_by    uuid,
  deleted_at    timestamptz,
  delete_reason text
);
create index ticket_photos_ticket_idx on public.ticket_photos(ticket_id);
create index ticket_photos_open_idx on public.ticket_photos(status) where status in ('pending', 'deleting');
alter table public.ticket_photos enable row level security;
revoke all on public.ticket_photos from public, anon, authenticated;
grant all on public.ticket_photos to service_role;

create or replace function app.audit_ticket_photo(p_action text, f public.ticket_photos, p_reason text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (f.tenant_id, auth.uid(), p_action, 'ticket_photos', f.id::text,
    jsonb_build_object('ticket_id', f.ticket_id, 'mime_type', f.mime_type, 'size_bytes', f.size_bytes), p_reason)
$$;

create or replace function app.ticket_photo_can(t public.maintenance_tickets, p_action text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select t.created_by = auth.uid() or t.assignee_id = auth.uid()
      or app.can('mnt.ticket.work', t.property_id)
      or (p_action = 'add' and app.can('mnt.ticket.create', t.property_id))
      or (p_action = 'view' and app.can('mnt.view', t.property_id))
$$;

create or replace function public.begin_ticket_photo_upload(p_ticket_id uuid, p_mime text, p_size integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets; v_id uuid := gen_random_uuid(); v_path text;
begin
  perform app.assert_writable();
  t := app.mnt_ticket_for_write(p_ticket_id);
  if not app.ticket_photo_can(t, 'add') then perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  if t.status in ('closed', 'cancelled') then perform app.fail('E_INVALID', 'This ticket is finished. Reopen it to add photos.'); end if;
  if p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    perform app.fail('E_INVALID', 'Use a photo (JPEG, PNG or WebP).'); end if;
  if p_size is null or p_size < 1 or p_size > 2097152 then perform app.fail('E_INVALID', 'The photo must be 2 MB or smaller.'); end if;
  if (select count(*) from public.ticket_photos where ticket_id = t.id and status in ('pending', 'ready')) >= 5 then
    perform app.fail('E_LIMIT', 'A ticket holds at most 5 photos. Remove one first.'); end if;
  v_path := t.tenant_id::text || '/' || v_id::text || case p_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end;
  insert into public.ticket_photos(id, tenant_id, property_id, ticket_id, storage_path, mime_type, size_bytes)
  values (v_id, t.tenant_id, t.property_id, t.id, v_path, p_mime, p_size);
  return jsonb_build_object('file_id', v_id, 'path', v_path, 'bucket', 'maintenance-photos');
end $$;

create or replace function public.finish_ticket_photo_upload(p_file_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.ticket_photos; o record; v_size bigint;
begin
  perform app.assert_writable();
  select * into f from public.ticket_photos
   where id = p_file_id and tenant_id = app.my_tenant() and status = 'pending' and uploaded_by = auth.uid() for update;
  if f.id is null then perform app.fail('E_NOT_FOUND', 'This upload was not found. Start again.'); end if;
  select metadata into o from storage.objects where bucket_id = 'maintenance-photos' and name = f.storage_path;
  if o is null then perform app.fail('E_NOT_FOUND', 'The photo did not arrive. Try again.'); end if;
  v_size := (o.metadata->>'size')::bigint;
  if v_size is null or v_size < 1 or v_size > 2097152 then perform app.fail('E_INVALID', 'The photo is larger than 2 MB.'); end if;
  if o.metadata->>'mimetype' is distinct from f.mime_type then perform app.fail('E_INVALID', 'The file type does not match what was sent.'); end if;
  update public.ticket_photos set status = 'ready', size_bytes = v_size, ready_at = now() where id = f.id returning * into f;
  perform app.audit_ticket_photo('ticket_photo_uploaded', f, null);
  return jsonb_build_object('file_id', f.id, 'status', f.status, 'mime_type', f.mime_type, 'size_bytes', f.size_bytes);
end $$;

create or replace function public.list_ticket_photos(p_ticket_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t public.maintenance_tickets;
begin
  select * into t from public.maintenance_tickets where id = p_ticket_id and tenant_id = app.my_tenant();
  if t.id is null then perform app.fail('E_NOT_FOUND', 'Ticket not found.'); end if;
  if not app.ticket_photo_can(t, 'view') then perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'mime_type', f.mime_type, 'size_bytes', f.size_bytes,
      'uploaded_at', f.uploaded_at, 'uploaded_by_name', pr.full_name, 'mine', f.uploaded_by = auth.uid()) order by f.uploaded_at)
    from public.ticket_photos f left join public.profiles pr on pr.id = f.uploaded_by
    where f.ticket_id = t.id and f.status = 'ready'), '[]'::jsonb);
end $$;

create or replace function public.open_ticket_photo(p_file_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.ticket_photos; t public.maintenance_tickets;
begin
  select * into f from public.ticket_photos where id = p_file_id and tenant_id = app.my_tenant() and status = 'ready';
  if f.id is null then perform app.fail('E_NOT_FOUND', 'Photo not found.'); end if;
  select * into t from public.maintenance_tickets where id = f.ticket_id;
  if not app.ticket_photo_can(t, 'view') then perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  perform app.audit_ticket_photo('ticket_photo_viewed', f, null);
  return f.storage_path;
end $$;

create or replace function public.delete_ticket_photo(p_file_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.ticket_photos; t public.maintenance_tickets;
begin
  perform app.assert_writable();
  select * into f from public.ticket_photos where id = p_file_id and tenant_id = app.my_tenant() and status in ('pending', 'ready') for update;
  if f.id is null then perform app.fail('E_NOT_FOUND', 'Photo not found.'); end if;
  select * into t from public.maintenance_tickets where id = f.ticket_id;
  if not (f.uploaded_by = auth.uid() or app.can('mnt.ticket.assign', f.property_id)) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to do this.'); end if;
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  update public.ticket_photos set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(), delete_reason = btrim(p_reason)
   where id = f.id returning * into f;
  perform app.audit_ticket_photo('ticket_photo_deleted', f, btrim(p_reason));
end $$;

-- Server only (service role): marks uploads never finished, then lists every file waiting to leave storage.
create or replace function public.ticket_photo_cleanup_due(p_limit integer default 200)
returns table(file_id uuid, path text) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.ticket_photos x set status = 'deleting', deleted_at = now(), delete_reason = 'Upload not finished'
   where x.status = 'pending' and x.uploaded_at < now() - interval '1 day';
  return query select x.id, x.storage_path from public.ticket_photos x
   where x.status = 'deleting' order by x.deleted_at limit greatest(coalesce(p_limit, 200), 1);
end $$;

create or replace function public.ticket_photo_files_removed(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v integer;
begin
  update public.ticket_photos set status = 'deleted' where id = any (p_ids) and status = 'deleting';
  get diagnostics v = row_count;
  return v;
end $$;

revoke all on function app.audit_ticket_photo(text, public.ticket_photos, text), app.ticket_photo_can(public.maintenance_tickets, text) from public, anon, authenticated;
revoke all on function public.begin_ticket_photo_upload(uuid, text, integer), public.finish_ticket_photo_upload(uuid),
  public.list_ticket_photos(uuid), public.open_ticket_photo(uuid), public.delete_ticket_photo(uuid, text) from public, anon;
grant execute on function public.begin_ticket_photo_upload(uuid, text, integer), public.finish_ticket_photo_upload(uuid),
  public.list_ticket_photos(uuid), public.open_ticket_photo(uuid), public.delete_ticket_photo(uuid, text) to authenticated;
revoke all on function public.ticket_photo_cleanup_due(integer), public.ticket_photo_files_removed(uuid[]) from public, anon, authenticated;
grant execute on function public.ticket_photo_cleanup_due(integer), public.ticket_photo_files_removed(uuid[]) to service_role;
