-- ID document photos (stage 2, decisions of 6 Oct 2026): GST-007 private storage, GST-008 audit,
-- GST-009 delete on anonymise and move on merge, GST-010 keep period, SET-009 per-hotel switches, GST-002 roles.
-- Files live in the private bucket guest-id-documents; the database keeps one row per file. The tests stand in for
-- the storage upload by inserting the storage.objects row the Storage API would create.
begin;

create function t.fake_upload(p_path text, p_size integer, p_mime text) returns void language plpgsql security definer as $$
begin
  insert into storage.objects(bucket_id, name, metadata) values ('guest-id-documents', p_path, jsonb_build_object('size', p_size, 'mimetype', p_mime));
end $$;
create function t.audit_count(p_action text, p_record text) returns integer language sql stable security definer as $$
  select count(*)::int from public.audit_events where action = p_action and record_id = p_record
$$;
grant execute on function t.fake_upload(text, integer, text), t.audit_count(text, text) to authenticated, service_role;

-- Switched off by default; only setup roles change the switches.
do $$
declare j jsonb;
begin
  perform t.login('fdo');
  j := public.get_id_photo_settings(t.id('propA'));
  perform t.eq((j->>'allow')::boolean, false, '[SET-009] Allow ID photos is off by default');
  perform t.eq((j->>'require')::boolean, false, '[SET-009] Require ID photo at check-in is off by default');
  perform t.eq((j->>'keep_months')::int, 12, '[GST-010] the keep period is 12 months after the last check-out');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'front', 'image/jpeg'),
    'E_DISABLED', '[SET-009] uploads are refused while the switch is off');
  perform t.raises(format('select public.set_id_photo_settings(%L, true, false)', t.id('propA')), 'E_FORBIDDEN', '[SET-009] front desk cannot change the switches');
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), false, true);
  perform t.eq((public.get_id_photo_settings(t.id('propA'))->>'require_effective')::boolean, false, '[SET-009] Require applies only when Allow is on');
  perform public.set_id_photo_settings(t.id('propA'), true, false);
  perform t.eq((public.get_id_photo_settings(t.id('propA'))->>'allow')::boolean, true, '[SET-009] an administrator switches ID photos on');
  perform t.ok(t.audit_count('set_id_photo_settings', t.id('propA')::text) = 2, '[GST-008] changing the switches is audited');
end $$;

-- Upload: roles, file types, size, a real file must arrive, audit without personal data.
do $$
declare j jsonb; v_file uuid; v_path text; v_doc uuid; a public.audit_events;
begin
  perform t.login('rsv');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'front', 'image/jpeg'),
    'E_FORBIDDEN', '[GST-002] a reservation officer cannot upload ID photos');
  perform t.login('acc');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'front', 'image/jpeg'),
    'E_FORBIDDEN', '[GST-002] an accountant cannot upload ID photos');
  perform t.login('fdo');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'front', 'image/gif'),
    'E_INVALID', '[GST-007] only JPEG, PNG, WebP and PDF are accepted');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 2097153)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'front', 'image/jpeg'),
    'E_INVALID', '[GST-007] files over 2 MB are refused');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g1'), 'passport', 'A1234567', 'middle', 'image/jpeg'),
    'E_INVALID', '[GST-007] a file is the front or the back');
  j := public.begin_id_photo_upload(t.id('propA'), t.id('g1'), 'passport', 'a1234567', (t.bdate() + 365), 'front', 'image/jpeg', 1000);
  v_file := (j->>'file_id')::uuid; v_path := j->>'path'; v_doc := (j->>'document_id')::uuid;
  perform t.ok(v_path like t.id('tenantA')::text || '/%' and v_path not like '%A1234567%' and v_path not like '%Chinedu%',
    '[GST-007] the stored file name has no guest name or ID number');
  perform t.admin();
  perform t.eq((select expiry from public.guest_documents where id = v_doc), t.bdate() + 365, '[GST-007] the ID type, number and expiry are kept on the document');
  perform t.login('fdo');
  perform t.raises(format('select public.finish_id_photo_upload(%L)', v_file), 'E_NOT_FOUND', '[GST-007] finishing without the file in storage is refused');
  perform t.login('fom');
  perform t.fake_upload(v_path, 900, 'image/jpeg');
  perform t.raises(format('select public.finish_id_photo_upload(%L)', v_file), 'E_NOT_FOUND', '[GST-007] only the person who started the upload can finish it');
  perform t.login('fdo');
  j := public.finish_id_photo_upload(v_file);
  perform t.eq(j->>'status', 'ready', '[GST-007] the upload is finished');
  perform t.put('file1', v_file); perform t.put('doc1', v_doc);
  perform t.admin();
  select * into a from public.audit_events where action = 'id_photo_uploaded' and record_id = v_file::text;
  perform t.ok(a.id is not null, '[GST-008] the upload is audited');
  perform t.ok(coalesce(a.after::text, '') !~* 'A1234567|Chinedu|Okafor|passport' and a.after ? 'side', '[GST-008] the audit entry has no personal data');
end $$;

-- A file whose storage object is too big or of another type than declared is refused.
do $$
declare j jsonb;
begin
  perform t.login('fdo');
  j := public.begin_id_photo_upload(t.id('propA'), t.id('g1'), 'passport', 'A1234567', null, 'back', 'image/jpeg', 1000);
  perform t.fake_upload(j->>'path', 3000000, 'image/jpeg');
  perform t.raises(format('select public.finish_id_photo_upload(%L)', j->>'file_id'), 'E_INVALID', '[GST-007] a stored file over 2 MB is refused at finish');
  j := public.begin_id_photo_upload(t.id('propA'), t.id('g2'), 'national_id', 'NIN9', null, 'front', 'image/jpeg', 1000);
  perform t.fake_upload(j->>'path', 1000, 'text/html');
  perform t.raises(format('select public.finish_id_photo_upload(%L)', j->>'file_id'), 'E_INVALID', '[GST-007] a stored file of another type is refused at finish');
end $$;

-- No direct access to the file rows or the stored files; other hotels see nothing.
do $$ begin
  perform t.login('fdo');
  perform t.raises('select count(*) from public.guest_document_files', 'permission denied', '[GST-007] the browser cannot read the file table');
  perform t.eq((select count(*)::int from storage.objects where bucket_id = 'guest-id-documents'), 0, '[GST-007] the browser cannot list the stored files');
  perform t.admin();
  perform t.ok(not (select public from storage.buckets where id = 'guest-id-documents'), '[GST-007] the storage bucket is private');
  perform t.login('adminB');
  perform t.raises(format('select public.open_id_photo(%L, %L)', t.id('file1'), t.id('propB')), 'E_DISABLED|E_NOT_FOUND|E_FORBIDDEN', '[GST-007] another hotel cannot open the photo');
  perform public.set_id_photo_settings(t.id('propB'), true, false);
  perform t.raises(format('select public.open_id_photo(%L, %L)', t.id('file1'), t.id('propB')), 'E_NOT_FOUND', '[GST-007] not even with its own switch on');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propB'), t.id('g1'), 'passport', 'X1', 'front', 'image/jpeg'),
    'E_NOT_FOUND', '[GST-007] nor upload to this hotel''s guest');
end $$;

-- Viewing: roles, the switch, every view audited, the list shows no storage names.
do $$
declare v_path text; j jsonb;
begin
  perform t.login('fdo');
  v_path := public.open_id_photo(t.id('file1'), t.id('propA'));
  perform t.ok(v_path like t.id('tenantA')::text || '/%', '[GST-007] front desk can open the photo (the server turns this into a 60-second link)');
  perform public.open_id_photo(t.id('file1'), t.id('propA'));
  perform t.eq(t.audit_count('id_photo_viewed', t.id('file1')::text), 2, '[GST-008] every view is audited');
  j := public.list_id_photos(t.id('g1'), t.id('propA'));
  perform t.eq(jsonb_array_length(j), 1, '[GST-007] the guest has one photo');
  perform t.ok(not (j->0 ? 'path') and not (j->0 ? 'storage_path') and j->0->>'side' = 'front', '[GST-007] the list gives the side, not the storage name');
  perform t.login('rsv');
  perform t.raises(format('select public.open_id_photo(%L, %L)', t.id('file1'), t.id('propA')), 'E_FORBIDDEN', '[GST-002] a reservation officer cannot open ID photos');
  perform t.raises(format('select public.list_id_photos(%L, %L)', t.id('g1'), t.id('propA')), 'E_FORBIDDEN', '[GST-002] or list them');
  perform t.login('acc');
  perform t.raises(format('select public.open_id_photo(%L, %L)', t.id('file1'), t.id('propA')), 'E_FORBIDDEN', '[GST-002] nor can an accountant');
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), false, false);
  perform t.login('fdo');
  perform t.raises(format('select public.open_id_photo(%L, %L)', t.id('file1'), t.id('propA')), 'E_DISABLED', '[SET-009] viewing is refused while the switch is off');
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), true, false);
end $$;

-- Replacing a side, and deleting by hand (managers, with a reason).
do $$
declare j jsonb; v_new uuid; v_due boolean;
begin
  perform t.login('fdo');
  j := public.begin_id_photo_upload(t.id('propA'), t.id('g1'), 'passport', 'A1234567', null, 'front', 'image/png', 2000);
  v_new := (j->>'file_id')::uuid;
  perform t.fake_upload(j->>'path', 2000, 'image/png');
  perform public.finish_id_photo_upload(v_new);
  perform t.eq(jsonb_array_length(public.list_id_photos(t.id('g1'), t.id('propA'))), 1, '[GST-007] a new front replaces the old one');
  perform t.ok(t.audit_count('id_photo_deleted', t.id('file1')::text) = 1, '[GST-008] the replaced photo is deleted and audited');
  perform t.raises(format('select public.delete_id_photo(%L, %L, %L)', v_new, t.id('propA'), 'Blurred'), 'E_FORBIDDEN', '[GST-007] front desk cannot delete a photo by hand');
  perform t.login('fom');
  perform t.raises(format('select public.delete_id_photo(%L, %L, %L)', v_new, t.id('propA'), ' '), 'E_REQUIRED', '[GST-007] deleting needs a reason');
  perform public.delete_id_photo(v_new, t.id('propA'), 'Wrong guest');
  perform t.eq(jsonb_array_length(public.list_id_photos(t.id('g1'), t.id('propA'))), 0, '[GST-007] a manager deletes the photo');
  perform t.admin();
  perform t.eq((select reason from public.audit_events where action = 'id_photo_deleted' and record_id = v_new::text), 'Wrong guest', '[GST-008] with the reason in the audit');
  set local role service_role;
  v_due := exists (select 1 from public.id_photo_cleanup_due(null, 100) where file_id = v_new);
  perform public.id_photo_files_removed(array[v_new]);
  reset role;
  perform t.ok(v_due, '[GST-007] the server is told to remove the stored file');
  perform t.eq((select status from public.guest_document_files where id = v_new), 'deleted', '[GST-007] and records it as removed');
  perform t.login('fdo');
  perform t.raises('select * from public.id_photo_cleanup_due(null, 10)', 'permission denied', '[GST-007] staff cannot call the clean-up');
end $$;

-- Removing a whole document that has photos needs the photo-delete permission, and marks the photos for deletion.
do $$
declare j jsonb; v_file uuid; v_g uuid;
begin
  perform t.login('fdo');
  v_g := public.save_guest(null, 'Femi', 'Doc', '08030000301', null, 'NG', null, null);
  j := public.begin_id_photo_upload(t.id('propA'), v_g, 'voters_card', 'VC1', null, 'front', 'image/jpeg', 800);
  v_file := (j->>'file_id')::uuid;
  perform t.fake_upload(j->>'path', 800, 'image/jpeg');
  perform public.finish_id_photo_upload(v_file);
  perform t.raises(format('select public.remove_guest_document(%L)', j->>'document_id'), 'E_FORBIDDEN', '[GST-007] front desk cannot remove a document that has photos');
  perform t.login('fom');
  perform public.remove_guest_document((j->>'document_id')::uuid);
  perform t.admin();
  perform t.eq((select status from public.guest_document_files where id = v_file), 'deleting', '[GST-007] removing the document marks its photos for deletion');
  perform t.ok(t.audit_count('id_photo_deleted', v_file::text) = 1, '[GST-008] and audits it');
end $$;

-- Merge moves photos; anonymise deletes them.
do $$
declare j jsonb; v_keep uuid; v_remove uuid; v_file uuid;
begin
  perform t.login('fdo');
  v_keep := public.save_guest(null, 'Ngozi', 'Eze', '08030000101', null, 'NG', null, null);
  v_remove := public.save_guest(null, 'Ngozi', 'Eze', '08030000102', null, 'NG', null, null);
  j := public.begin_id_photo_upload(t.id('propA'), v_remove, 'drivers_licence', 'DL55', null, 'front', 'application/pdf', 5000);
  v_file := (j->>'file_id')::uuid;
  perform t.fake_upload(j->>'path', 5000, 'application/pdf');
  perform public.finish_id_photo_upload(v_file);
  perform t.login('adminA');
  perform public.merge_guests(v_keep, v_remove, 'Same person');
  perform t.login('fdo');
  perform t.eq(jsonb_array_length(public.list_id_photos(v_keep, t.id('propA'))), 1, '[GST-009] merging moves the photo to the kept guest');
  perform t.login('adminA');
  perform public.anonymise_guest(v_keep, 'Guest asked');
  perform t.login('fdo');
  perform t.eq(jsonb_array_length(public.list_id_photos(v_keep, t.id('propA'))), 0, '[GST-009] anonymising removes the guest''s photos');
  perform t.admin();
  perform t.eq((select status from public.guest_document_files where id = v_file), 'deleting', '[GST-009] and marks the stored file for removal');
  perform t.eq((select delete_reason from public.guest_document_files where id = v_file), 'Guest anonymised', '[GST-009] with the reason');
  perform t.ok(t.audit_count('id_photo_deleted', v_file::text) = 1, '[GST-008] the deletion on anonymising is audited');
end $$;

-- Keep period: 12 months after the last check-out, read from one setting.
do $$
declare v_res uuid; j jsonb; v_file uuid; v_stay uuid; v_due boolean;
begin
  perform t.login('fdo');
  v_res := t.book(t.id('g3'), t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform public.check_in(v_res, t.reg(), t.room('103'), null, null);
  j := public.begin_id_photo_upload(t.id('propA'), t.id('g3'), 'passport', 'B777', null, 'front', 'image/webp', 1500);
  v_file := (j->>'file_id')::uuid;
  perform t.fake_upload(j->>'path', 1500, 'image/webp');
  perform public.finish_id_photo_upload(v_file);
  perform t.admin();
  update public.guest_document_files set uploaded_at = now() - interval '14 months' where id = v_file;
  set local role service_role;
  v_due := exists (select 1 from public.id_photo_cleanup_due(null, 100) where file_id = v_file);
  reset role;
  perform t.ok(not v_due, '[GST-010] a guest in house keeps their photo');
  select id into v_stay from public.stays where reservation_id = v_res;
  -- Pretend the stay ended 13 months ago.
  update public.stays set status = 'checked_out', checked_out_at = now() - interval '13 months' where id = v_stay;
  update public.reservations set status = 'checked_out' where id = v_res;
  update app.settings set value = '24' where key = 'id_photo_keep_months';
  set local role service_role;
  v_due := exists (select 1 from public.id_photo_cleanup_due(null, 100) where file_id = v_file);
  reset role;
  perform t.ok(not v_due, '[GST-010] with the setting at 24 months, the photo is kept');
  update app.settings set value = '12' where key = 'id_photo_keep_months';
  set local role service_role;
  v_due := exists (select 1 from public.id_photo_cleanup_due(null, 100) where file_id = v_file);
  reset role;
  perform t.ok(v_due, '[GST-010] at 12 months after check-out it is due for deletion');
  perform t.eq((select delete_reason from public.guest_document_files where id = v_file), 'Keep period ended', '[GST-010] with the reason');
  perform t.ok(t.audit_count('id_photo_deleted', v_file::text) = 1, '[GST-008] the automatic deletion is audited');
end $$;

-- Require ID photo at check-in (only when Allow is on); expiry recorded at check-in.
do $$
declare v_res uuid; j jsonb; v_g uuid;
begin
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), true, true);
  perform t.login('fdo');
  v_g := public.save_guest(null, 'Bola', 'Ade', '08030000201', null, 'NG', null, null);
  v_res := t.book(v_g, t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.raises(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_res, t.reg(), t.room('102')),
    'E_ID_PHOTO_REQUIRED', '[SET-009] with Require on, check-in needs an ID photo');
  j := public.begin_id_photo_upload(t.id('propA'), v_g, 'national_id', 'NIN12345', t.bdate() + 700, 'front', 'image/jpeg', 1200);
  perform t.fake_upload(j->>'path', 1200, 'image/jpeg');
  perform public.finish_id_photo_upload((j->>'file_id')::uuid);
  perform t.lives(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_res,
      jsonb_build_object('id_type', 'national_id', 'id_number', 'NIN12345', 'id_expiry', t.bdate() + 700), t.room('102')),
    '[SET-009] with a photo on file, check-in goes ahead');
  perform t.admin();
  perform t.eq((select expiry from public.guest_documents where guest_id = v_g and doc_number = 'NIN12345'), t.bdate() + 700, '[GST-007] the expiry date entered at check-in is kept');
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), false, true);
  perform t.login('fdo');
  v_g := public.save_guest(null, 'Kemi', 'Ola', '08030000202', null, 'NG', null, null);
  v_res := t.book(v_g, t.bdate(), t.bdate() + 1, t.id('std'), t.id('bar'));
  perform t.lives(format('select public.check_in(%L, %L::jsonb, %L, null, null)', v_res, t.reg(), t.room('101')),
    '[SET-009] with Allow off, Require does not apply');
end $$;

-- A read-only hotel cannot upload.
do $$ begin
  perform t.login('adminA');
  perform public.set_id_photo_settings(t.id('propA'), true, false);
  perform t.set_tenant_status(t.id('tenantA'), 'expired');
  perform t.login('fdo');
  perform t.raises(format('select public.begin_id_photo_upload(%L, %L, %L, %L, null, %L, %L, 1000)', t.id('propA'), t.id('g2'), 'passport', 'Z9', 'front', 'image/jpeg'),
    'E_READ_ONLY', '[GST-007] a read-only hotel cannot upload new photos');
end $$;

rollback;
