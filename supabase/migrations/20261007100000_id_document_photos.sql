-- ID document photos (stage 2, decisions of 6 Oct 2026). Requirements GST-007 to GST-010, SET-009, GST-002.
--
-- Before: a guest's ID document was typed details only (type, number, expiry). No file storage existed.
-- After:
--   * Per hotel: "Allow ID photos" (off by default) and "Require ID photo at check-in" (applies only when Allow
--     is on). Upload, view and list are refused while Allow is off.
--   * Files go to the private storage bucket guest-id-documents (2 MB, JPEG/PNG/WebP/PDF). The browser has no
--     storage access: the server signs a one-time upload link and 60-second view links after these functions
--     have checked the permission. File names are random ids, never a name or ID number.
--   * One row per file in guest_document_files (front or back of a document). No browser access to the table.
--   * New permissions: upload and view (System Administrator, General Manager, Front Office Manager, Front Desk),
--     delete by hand with a reason (System Administrator, General Manager, Front Office Manager). Not
--     reservation officers (decision 6b) or accountants.
--   * Every upload, view and deletion is audited with ids only, no personal data (GST-003).
--   * Anonymising a guest marks their files for deletion; merging moves them. The server removes marked files
--     from storage at once where it can, and the daily clean-up does the rest.
--   * Keep period: one setting, app.settings, key id_photo_keep_months (12). Change it with one UPDATE, no migration.
--     A photo is deleted that many months after the guest's last check-out (or upload, if later), unless the
--     guest has a booking that is not over.
--   * Check-in records the ID expiry date when given.

-- One place for platform-wide settings, in the internal schema. No browser or server-key access; functions read it.
create table app.settings (
  key         text primary key,
  value       text not null,
  description text not null,
  updated_at  timestamptz not null default now()
);
alter table app.settings enable row level security;
revoke all on app.settings from public, anon, authenticated, service_role;
insert into app.settings(key, value, description) values
  ('id_photo_keep_months', '12', 'ID photos are deleted this many months after the guest''s last check-out (GST-010). Change with one UPDATE; no migration needed.');

create or replace function app.setting_int(p_key text)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select value::integer from app.settings where key = p_key
$$;

alter table public.properties
  add column allow_id_photos boolean not null default false,
  add column require_id_photo boolean not null default false;

insert into public.permissions(key, description, module) values
  ('guest.document.file.upload', 'Upload photos or scans of guest ID documents', 'guests'),
  ('guest.document.file.view',   'View photos or scans of guest ID documents',   'guests'),
  ('guest.document.file.delete', 'Delete photos or scans of guest ID documents', 'guests')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key, grant_level)
select r.id, x.perm, 'Y'
from public.roles r
join (values
  ('SYSADMIN','guest.document.file.upload'),('SYSADMIN','guest.document.file.view'),('SYSADMIN','guest.document.file.delete'),
  ('GM','guest.document.file.upload'),('GM','guest.document.file.view'),('GM','guest.document.file.delete'),
  ('FOM','guest.document.file.upload'),('FOM','guest.document.file.view'),('FOM','guest.document.file.delete'),
  ('FDO','guest.document.file.upload'),('FDO','guest.document.file.view')
) as x(code, perm) on x.code = r.code
where r.tenant_id is null
on conflict do nothing;

-- Private bucket. No storage policies are added, so signed-in users cannot read, list or write it directly.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('guest-id-documents', 'guest-id-documents', false, 2097152, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.guest_document_files (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id),
  guest_id      uuid not null references public.guests(id),
  document_id   uuid references public.guest_documents(id) on delete set null,
  side          text not null check (side in ('front', 'back')),
  storage_path  text not null unique,
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes    integer not null check (size_bytes between 1 and 2097152),
  status        text not null default 'pending' check (status in ('pending', 'ready', 'deleting', 'deleted')),
  uploaded_by   uuid not null default auth.uid(),
  uploaded_at   timestamptz not null default now(),
  ready_at      timestamptz,
  deleted_by    uuid,
  deleted_at    timestamptz,
  delete_reason text
);
create unique index guest_document_files_one_ready on public.guest_document_files(document_id, side) where status = 'ready';
create index guest_document_files_guest_idx on public.guest_document_files(guest_id);
create index guest_document_files_open_idx on public.guest_document_files(status) where status in ('pending', 'deleting');
alter table public.guest_document_files enable row level security;
revoke all on public.guest_document_files from public, anon, authenticated;
grant all on public.guest_document_files to service_role;

-- Audit with ids only (GST-003, GST-008).
create or replace function app.audit_id_photo(p_action text, f public.guest_document_files, p_reason text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (f.tenant_id, auth.uid(), p_action, 'guest_document_files', f.id::text,
    jsonb_build_object('guest_id', f.guest_id, 'document_id', f.document_id, 'side', f.side, 'mime_type', f.mime_type, 'size_bytes', f.size_bytes),
    p_reason)
$$;

create or replace function app.id_photos_allowed(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select allow_id_photos from public.properties where id = p_property_id and tenant_id = app.my_tenant()), false)
$$;

create or replace function app.require_id_photos_on(p_property_id uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.id_photos_allowed(p_property_id) then
    perform app.fail('E_DISABLED', 'ID photos are switched off for this hotel. A manager can switch them on in Setup > Property.');
  end if;
end $$;

create or replace function public.get_id_photo_settings(p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.properties;
begin
  if not app.has_property_access(p_property_id) then perform app.fail('E_FORBIDDEN', 'You do not have access to this property.'); end if;
  select * into p from public.properties where id = p_property_id;
  return jsonb_build_object('allow', p.allow_id_photos, 'require', p.require_id_photo,
    'require_effective', p.allow_id_photos and p.require_id_photo,
    'keep_months', app.setting_int('id_photo_keep_months'), 'max_bytes', 2097152,
    'types', jsonb_build_array('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));
end $$;

create or replace function public.set_id_photo_settings(p_property_id uuid, p_allow boolean, p_require boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  perform app.assert_writable();
  perform app.require('setup.property.edit', p_property_id);
  update public.properties set allow_id_photos = coalesce(p_allow, false), require_id_photo = coalesce(p_require, false)
  where id = p_property_id returning tenant_id into v_tenant;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after)
  values (v_tenant, auth.uid(), 'set_id_photo_settings', 'properties', p_property_id::text,
    jsonb_build_object('allow_id_photos', coalesce(p_allow, false), 'require_id_photo', coalesce(p_require, false)));
  return public.get_id_photo_settings(p_property_id);
end $$;

-- Step 1 of an upload: checks everything, finds or creates the document, and reserves a random file name.
-- The server then signs a one-time upload link for that name. p_size is what the browser says; finish checks
-- what actually arrived.
create or replace function public.begin_id_photo_upload(p_property_id uuid, p_guest_id uuid, p_doc_type text, p_doc_number text,
  p_expiry date, p_side text, p_mime text, p_size integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.guests; v_num text := upper(nullif(btrim(p_doc_number), '')); v_doc uuid; v_id uuid := gen_random_uuid(); v_path text;
begin
  perform app.assert_writable();
  perform app.require('guest.document.file.upload', p_property_id);
  perform app.require_id_photos_on(p_property_id);
  g := app.guest_for_write(p_guest_id);
  if p_side is null or p_side not in ('front', 'back') then perform app.fail('E_INVALID', 'Choose the front or the back of the document.'); end if;
  if p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    perform app.fail('E_INVALID', 'Use a photo (JPEG, PNG or WebP) or a PDF scan.'); end if;
  if p_size is null or p_size < 1 or p_size > 2097152 then perform app.fail('E_INVALID', 'The file must be 2 MB or smaller.'); end if;
  if p_doc_type is null or p_doc_type not in ('passport','national_id','drivers_licence','voters_card','other') then
    perform app.fail('E_INVALID', 'Choose an ID type.'); end if;
  if v_num is null then perform app.fail('E_REQUIRED', 'Enter the ID number first.'); end if;
  if length(v_num) > 50 then perform app.fail('E_INVALID', 'The ID number is too long.'); end if;

  select id into v_doc from public.guest_documents where guest_id = g.id and doc_type = p_doc_type and doc_number = v_num;
  if v_doc is null then
    insert into public.guest_documents(tenant_id, guest_id, doc_type, doc_number, expiry)
    values (g.tenant_id, g.id, p_doc_type, v_num, p_expiry) returning id into v_doc;
  elsif p_expiry is not null then
    update public.guest_documents set expiry = p_expiry where id = v_doc and expiry is distinct from p_expiry;
  end if;

  v_path := g.tenant_id::text || '/' || v_id::text || case p_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png'
    when 'image/webp' then '.webp' else '.pdf' end;
  insert into public.guest_document_files(id, tenant_id, property_id, guest_id, document_id, side, storage_path, mime_type, size_bytes)
  values (v_id, g.tenant_id, p_property_id, g.id, v_doc, p_side, v_path, p_mime, p_size);
  return jsonb_build_object('file_id', v_id, 'path', v_path, 'document_id', v_doc, 'bucket', 'guest-id-documents');
end $$;

-- Step 2: the file must be in storage, within the size, of the declared type. Replaces the same side.
create or replace function public.finish_id_photo_upload(p_file_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.guest_document_files; o record; v_size bigint; old public.guest_document_files;
begin
  perform app.assert_writable();
  select * into f from public.guest_document_files
  where id = p_file_id and tenant_id = app.my_tenant() and status = 'pending' and uploaded_by = auth.uid() for update;
  if f.id is null then perform app.fail('E_NOT_FOUND', 'This upload was not found. Start again.'); end if;
  select metadata into o from storage.objects where bucket_id = 'guest-id-documents' and name = f.storage_path;
  if o is null then perform app.fail('E_NOT_FOUND', 'The file did not arrive. Try the upload again.'); end if;
  v_size := (o.metadata->>'size')::bigint;
  if v_size is null or v_size < 1 or v_size > 2097152 then perform app.fail('E_INVALID', 'The file is larger than 2 MB.'); end if;
  if o.metadata->>'mimetype' is distinct from f.mime_type then perform app.fail('E_INVALID', 'The file type does not match what was sent.'); end if;

  for old in select * from public.guest_document_files
             where document_id = f.document_id and side = f.side and status = 'ready' for update loop
    update public.guest_document_files set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(),
      delete_reason = 'Replaced by a new photo' where id = old.id;
    perform app.audit_id_photo('id_photo_deleted', old, 'Replaced by a new photo');
  end loop;
  update public.guest_document_files set status = 'ready', size_bytes = v_size, ready_at = now() where id = f.id returning * into f;
  perform app.audit_id_photo('id_photo_uploaded', f, null);
  return jsonb_build_object('file_id', f.id, 'status', f.status, 'side', f.side, 'mime_type', f.mime_type, 'size_bytes', f.size_bytes);
end $$;

-- Checks and audits one view, then returns the storage name; the server turns it into a 60-second link.
create or replace function public.open_id_photo(p_file_id uuid, p_property_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.guest_document_files;
begin
  perform app.require('guest.document.file.view', p_property_id);
  perform app.require_id_photos_on(p_property_id);
  select * into f from public.guest_document_files where id = p_file_id and tenant_id = app.my_tenant() and status = 'ready';
  if f.id is null then perform app.fail('E_NOT_FOUND', 'Photo not found.'); end if;
  perform app.audit_id_photo('id_photo_viewed', f, null);
  return f.storage_path;
end $$;

create or replace function public.list_id_photos(p_guest_id uuid, p_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform app.require('guest.document.file.view', p_property_id);
  perform app.require_id_photos_on(p_property_id);
  if not exists (select 1 from public.guests where id = p_guest_id and tenant_id = app.my_tenant()) then
    perform app.fail('E_NOT_FOUND', 'Guest not found.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'document_id', f.document_id, 'side', f.side, 'mime_type', f.mime_type,
      'size_bytes', f.size_bytes, 'uploaded_at', f.uploaded_at, 'uploaded_by_name', pr.full_name) order by f.uploaded_at)
    from public.guest_document_files f left join public.profiles pr on pr.id = f.uploaded_by
    where f.guest_id = p_guest_id and f.tenant_id = app.my_tenant() and f.status = 'ready'), '[]'::jsonb);
end $$;

create or replace function public.delete_id_photo(p_file_id uuid, p_property_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.guest_document_files;
begin
  perform app.require('guest.document.file.delete', p_property_id);
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  select * into f from public.guest_document_files where id = p_file_id and tenant_id = app.my_tenant() and status in ('pending', 'ready') for update;
  if f.id is null then perform app.fail('E_NOT_FOUND', 'Photo not found.'); end if;
  update public.guest_document_files set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(), delete_reason = btrim(p_reason)
  where id = f.id returning * into f;
  perform app.audit_id_photo('id_photo_deleted', f, btrim(p_reason));
end $$;

-- Server only (service role). Marks photos past the keep period and abandoned uploads, then returns every file
-- waiting to be removed from storage. p_guest_id limits it to one guest (used right after anonymising).
create or replace function public.id_photo_cleanup_due(p_guest_id uuid default null, p_limit integer default 200)
returns table(file_id uuid, path text) language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.guest_document_files; v_months integer := coalesce(app.setting_int('id_photo_keep_months'), 12);
begin
  for f in
    update public.guest_document_files x set status = 'deleting', deleted_at = now(), delete_reason = 'Keep period ended'
    where x.status = 'ready' and (p_guest_id is null or x.guest_id = p_guest_id)
      and not exists (select 1 from public.reservations r where r.guest_id = x.guest_id and r.status in ('tentative', 'confirmed', 'checked_in'))
      and greatest(x.uploaded_at, coalesce((select max(s.checked_out_at) from public.stays s join public.reservations r on r.id = s.reservation_id
                                            where r.guest_id = x.guest_id), x.uploaded_at))
          < now() - make_interval(months => v_months)
    returning x.*
  loop
    perform app.audit_id_photo('id_photo_deleted', f, 'Keep period ended');
  end loop;
  update public.guest_document_files x set status = 'deleting', deleted_at = now(), delete_reason = 'Upload not finished'
  where x.status = 'pending' and x.uploaded_at < now() - interval '1 day' and (p_guest_id is null or x.guest_id = p_guest_id);
  return query select x.id, x.storage_path from public.guest_document_files x
    where x.status = 'deleting' and (p_guest_id is null or x.guest_id = p_guest_id)
    order by x.deleted_at limit greatest(coalesce(p_limit, 200), 1);
end $$;

create or replace function public.id_photo_files_removed(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v integer;
begin
  update public.guest_document_files set status = 'deleted' where id = any (p_ids) and status = 'deleting';
  get diagnostics v = row_count;
  return v;
end $$;

-- SET-009: with Allow and Require on, check-in needs a finished photo for the guest.
create or replace function app.check_id_photo(p_property_id uuid, p_guest_id uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.properties where id = p_property_id and allow_id_photos and require_id_photo)
     and not exists (select 1 from public.guest_document_files where guest_id = p_guest_id and status = 'ready') then
    perform app.fail('E_ID_PHOTO_REQUIRED', 'This hotel needs a photo of the guest''s ID before check-in. Add it in the check-in form.');
  end if;
end $$;

-- Check-in keeps the ID expiry date when given (same as before otherwise).
create or replace function app.save_registration(p_guest uuid, p_reg jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := nullif(btrim(p_reg->>'id_type'), '');
  v_num text := upper(nullif(btrim(p_reg->>'id_number'), ''));
  v_exp date := nullif(btrim(p_reg->>'id_expiry'), '')::date;
  v_nat text := nullif(btrim(p_reg->>'nationality'), '');
  v_addr text := nullif(btrim(p_reg->>'address'), '');
  v_plate text := upper(nullif(btrim(p_reg->>'vehicle_plate'), ''));
  g public.guests;
begin
  if coalesce(v_type, '') = '' or coalesce(v_num, '') = '' then
    perform app.fail('E_REQUIRED', 'ID type and ID number are required at check-in.'); end if;
  if v_type not in ('passport','national_id','drivers_licence','voters_card','other') then
    perform app.fail('E_INVALID', 'Choose an ID type.'); end if;
  if length(v_num) > 50 or length(coalesce(v_addr, '')) > 500 or length(coalesce(v_nat, '')) > 60 or length(coalesce(v_plate, '')) > 20 then
    perform app.fail('E_INVALID', 'One of the registration fields is too long.'); end if;
  g := app.guest_for_write(p_guest);
  if not exists (select 1 from public.guest_documents where guest_id = p_guest and doc_type = v_type and doc_number = v_num) then
    insert into public.guest_documents(tenant_id, guest_id, doc_type, doc_number, expiry) values (g.tenant_id, p_guest, v_type, v_num, v_exp);
  elsif v_exp is not null then
    update public.guest_documents set expiry = v_exp
    where guest_id = p_guest and doc_type = v_type and doc_number = v_num and expiry is distinct from v_exp;
  end if;
  if (v_nat is not null and v_nat is distinct from g.nationality) or (v_addr is not null and v_addr is distinct from g.address) then
    update public.guests set nationality = coalesce(v_nat, nationality), address = coalesce(v_addr, address), updated_at = now()
    where id = p_guest;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'id_type', v_type, 'id_number_masked', repeat('•', greatest(length(v_num) - 4, 0)) || right(v_num, 4),
    'id_expiry', v_exp, 'nationality', v_nat, 'address', v_addr, 'vehicle_plate', v_plate));
end $$;

revoke all on function app.setting_int(text), app.audit_id_photo(text, public.guest_document_files, text), app.id_photos_allowed(uuid),
  app.require_id_photos_on(uuid), app.check_id_photo(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_id_photo_settings(uuid), public.set_id_photo_settings(uuid, boolean, boolean),
  public.begin_id_photo_upload(uuid, uuid, text, text, date, text, text, integer), public.finish_id_photo_upload(uuid),
  public.open_id_photo(uuid, uuid), public.list_id_photos(uuid, uuid), public.delete_id_photo(uuid, uuid, text) from public, anon;
grant execute on function public.get_id_photo_settings(uuid), public.set_id_photo_settings(uuid, boolean, boolean),
  public.begin_id_photo_upload(uuid, uuid, text, text, date, text, text, integer), public.finish_id_photo_upload(uuid),
  public.open_id_photo(uuid, uuid), public.list_id_photos(uuid, uuid), public.delete_id_photo(uuid, uuid, text) to authenticated;
revoke all on function public.id_photo_cleanup_due(uuid, integer), public.id_photo_files_removed(uuid[]) from public, anon, authenticated;
grant execute on function public.id_photo_cleanup_due(uuid, integer), public.id_photo_files_removed(uuid[]) to service_role;

-- Existing functions, current definitions with one addition each: check-in checks the photo rule, anonymise
-- marks the guest's files for deletion (audited), merge moves them.

CREATE OR REPLACE FUNCTION app.do_check_in(p_id uuid, p_room_id uuid, p_registration jsonb, p_room_override_reason text, p_deposit_waive_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.reservations; v_bdate date; v_room uuid; rm public.rooms; v_due numeric; v_reg jsonb; v_stay uuid;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.status not in ('tentative', 'confirmed') then perform app.fail('E_INVALID', 'Only tentative or confirmed bookings can be checked in.'); end if;
  select business_date into v_bdate from public.properties where id = r.property_id;
  if r.arrival_date > v_bdate then perform app.fail('E_INVALID', 'This booking arrives on ' || to_char(r.arrival_date, 'DD Mon YYYY') || '. Change the arrival date first.'); end if;
  if r.departure_date < v_bdate or (r.departure_date = v_bdate and r.arrival_date < v_bdate) then
    perform app.fail('E_INVALID', 'This stay has already ended.'); end if;
  if r.status = 'tentative' and r.hold_until is not null and r.hold_until <= now() then
    perform app.assert_available(r.property_id, r.room_type_id, r.arrival_date, r.departure_date, r.id);
  end if;

  if p_room_id is not null then perform app.set_arrival_room(r, p_room_id); end if;
  select room_id into v_room from public.room_assignments where reservation_id = r.id and is_active limit 1;
  if v_room is null then perform app.fail('E_NO_ROOM', 'Assign a room before check-in.'); end if;
  rm := app.check_arrival_room(r.property_id, v_room, p_room_override_reason);

  v_due := r.deposit_required - app.deposit_paid(r.id);
  if v_due > 0 then
    if coalesce(btrim(p_deposit_waive_reason), '') = '' then
      perform app.fail('E_DEPOSIT_REQUIRED', 'A deposit of ' || to_char(v_due, 'FM999,999,999,990.00') || ' is required before check-in.'); end if;
    if not app.can('fo.deposit.waive', r.property_id) then
      perform app.fail('E_FORBIDDEN', 'Only a manager can waive the deposit.'); end if;
  end if;

  v_reg := app.save_registration(r.guest_id, coalesce(p_registration, '{}'::jsonb));
  perform app.check_id_photo(r.property_id, r.guest_id);  -- SET-009

  insert into public.stays(tenant_id, property_id, reservation_id, room_id, business_date, registration,
    room_override_reason, deposit_waive_reason)
  values (r.tenant_id, r.property_id, r.id, v_room, v_bdate, v_reg,
    case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    case when v_due > 0 then btrim(p_deposit_waive_reason) else null end)
  returning id into v_stay;

  update public.rooms set is_occupied = true where id = v_room;
  update public.reservations set status = 'checked_in', hold_until = null, updated_at = now() where id = r.id;
  perform app.log_res(r, 'check_in', null, jsonb_strip_nulls(jsonb_build_object('room_number', rm.room_number,
    'room_override_reason', case when app.room_ready(rm) then null else btrim(p_room_override_reason) end,
    'deposit_waived', case when v_due > 0 then v_due end,
    'deposit_waive_reason', case when v_due > 0 then btrim(p_deposit_waive_reason) end)));
  if r.arrival_date = r.departure_date then perform app.post_same_day_charge(r.id); end if;  -- DAY-006
  return v_stay;
end $function$;

CREATE OR REPLACE FUNCTION public.anonymise_guest(p_guest uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_tenant uuid := app.my_tenant(); v_photo public.guest_document_files;
begin
  perform app.require_any('guest.anonymise');
  if coalesce(btrim(p_reason), '') = '' then perform app.fail('E_REQUIRED', 'A reason is required.'); end if;
  perform app.guest_for_write(p_guest);
  if exists (select 1 from public.reservations
             where guest_id = p_guest and status in ('tentative', 'confirmed', 'checked_in')) then
    perform app.fail('E_IN_USE', 'This guest has a booking that is not over. Cancel it or check the guest out first.');
  end if;

  perform set_config('app.skip_guest_audit', 'on', true);
  -- GST-009: the guest's ID photos are marked for removal from storage (audited); the server removes them.
  for v_photo in update public.guest_document_files set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(), delete_reason = 'Guest anonymised'
                 where guest_id = p_guest and status in ('pending', 'ready') returning * loop
    perform app.audit_id_photo('id_photo_deleted', v_photo, 'Guest anonymised');
  end loop;
  delete from public.guest_documents where guest_id = p_guest;
  update public.guest_feedback set text = '[Removed when the guest was anonymised]' where guest_id = p_guest;
  update public.guests set first_name = 'Anonymised', last_name = 'Guest', phone = null, email = null,
    nationality = null, address = null, notes = null, anonymised_at = now(), updated_at = now()
  where id = p_guest;
  perform set_config('app.skip_guest_audit', '', true);

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, reason)
  values (v_tenant, auth.uid(), 'anonymise_guest', 'guests', p_guest::text, btrim(p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.merge_guests(p_keep uuid, p_remove uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  update public.guest_document_files set guest_id = p_keep where guest_id = p_remove;  -- GST-009
  update public.guest_feedback set guest_id = p_keep where guest_id = p_remove;
  update public.reservations set guest_id = p_keep where guest_id = p_remove;
  delete from public.reservation_guests rg where rg.guest_id = p_remove
    and exists (select 1 from public.reservation_guests k where k.reservation_id = rg.reservation_id and k.guest_id = p_keep);
  update public.reservation_guests set guest_id = p_keep where guest_id = p_remove;
  update public.reservation_guests rg set is_primary = true from public.reservations r
    where r.id = rg.reservation_id and r.guest_id = p_keep and rg.guest_id = p_keep;
  update public.folios set guest_id = p_keep where guest_id = p_remove;
  update public.guests set status = 'merged', merged_into = p_keep, updated_at = now() where id = p_remove;

  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, after, reason)
  values (v_tenant, auth.uid(), 'merge_guests', 'guests', p_keep::text,
          jsonb_build_object('kept', p_keep, 'removed', p_remove), btrim(p_reason));
  perform set_config('app.audit_reason', '', true);
end $function$;

-- Removing a document: if it has photos, the photo-delete permission is needed and the photos are marked for
-- deletion (audited). Otherwise the same as before.
create or replace function public.remove_guest_document(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $function$
declare v_guest uuid; f public.guest_document_files;
begin
  perform app.require_any('guest.edit');
  if not app.can('guest.document.view', null) then
    perform app.fail('E_FORBIDDEN', 'You do not have permission to manage ID documents.'); end if;
  select guest_id into v_guest from public.guest_documents where id = p_id and tenant_id = app.my_tenant();
  if v_guest is null then perform app.fail('E_NOT_FOUND', 'Document not found.'); end if;
  perform app.guest_for_write(v_guest);
  if exists (select 1 from public.guest_document_files where document_id = p_id and status in ('pending', 'ready')) then
    if not app.can('guest.document.file.delete', null) then
      perform app.fail('E_FORBIDDEN', 'This document has photos. Ask a manager to remove it.'); end if;
    for f in update public.guest_document_files set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(), delete_reason = 'Document removed'
             where document_id = p_id and status in ('pending', 'ready') returning * loop
      perform app.audit_id_photo('id_photo_deleted', f, 'Document removed');
    end loop;
  end if;
  delete from public.guest_documents where id = p_id;
end $function$;

