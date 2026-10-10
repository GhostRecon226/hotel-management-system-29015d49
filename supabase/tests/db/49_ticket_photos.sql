-- [MNT-004] Photos on maintenance tickets: private storage, up to 5 per ticket, 2 MB, audited by ids only.
begin;

create function t.fake_tk_upload(p_path text, p_size integer, p_mime text) returns void language plpgsql security definer as $$
begin
  insert into storage.objects(bucket_id, name, metadata) values ('maintenance-photos', p_path, jsonb_build_object('size', p_size, 'mimetype', p_mime));
end $$;
create function t.tk_audit(p_action text) returns integer language sql stable security definer as $$
  select count(*)::int from public.audit_events where action = p_action
$$;
grant execute on function t.fake_tk_upload(text, integer, text), t.tk_audit(text) to authenticated, service_role;

do $$
declare v_tk uuid; j jsonb; v_f uuid; v_path text; v_f2 uuid; i int; v_list jsonb;
begin
  perform t.login('att');
  v_tk := public.create_ticket(t.id('propA'), 'Cracked mirror', 'Bathroom mirror is cracked', t.room('201'), null, 'normal', null);
  j := public.begin_ticket_photo_upload(v_tk, 'image/jpeg', 100000);
  v_f := (j->>'file_id')::uuid; v_path := j->>'path';
  perform t.ok(v_path is not null and v_path not like '%mirror%', '[MNT-004] the stored name is random, never a title or room');
  perform t.raises(format('select public.finish_ticket_photo_upload(%L)', v_f), 'E_NOT_FOUND', '[MNT-004] finishing before the file arrives is refused');
  perform t.admin();
  perform t.fake_tk_upload(v_path, 100000, 'image/jpeg');
  perform t.login('att');
  j := public.finish_ticket_photo_upload(v_f);
  perform t.eq(j->>'status', 'ready', '[MNT-004] the person who raised the ticket can add a photo');
  perform t.raises(format('select public.begin_ticket_photo_upload(%L, ''application/pdf'', 1000)', v_tk), 'E_INVALID', '[MNT-004] only JPEG, PNG or WebP photos');
  perform t.raises(format('select public.begin_ticket_photo_upload(%L, ''image/png'', 3000000)', v_tk), 'E_INVALID', '[MNT-004] a photo must be 2 MB or smaller');
  perform t.admin();

  perform t.login('acc');
  perform t.raises(format('select public.begin_ticket_photo_upload(%L, ''image/jpeg'', 1000)', v_tk), 'E_FORBIDDEN', '[MNT-004] staff with no maintenance role cannot add photos');
  perform t.raises(format('select public.list_ticket_photos(%L)', v_tk), 'E_FORBIDDEN', '[MNT-004] or list them');
  perform t.raises(format('select public.open_ticket_photo(%L)', v_f), 'E_FORBIDDEN', '[MNT-004] or open them');
  perform t.admin();

  perform t.login('mnt');
  v_list := public.list_ticket_photos(v_tk);
  perform t.eq(jsonb_array_length(v_list), 1, '[MNT-004] maintenance staff see the ticket''s photos');
  perform t.eq(public.open_ticket_photo(v_f), v_path, '[MNT-004] opening a photo returns its storage name for the server to sign');
  perform t.admin();
  perform t.ok(t.tk_audit('ticket_photo_viewed') = 1 and t.tk_audit('ticket_photo_uploaded') = 1, '[MNT-004] uploads and views are audited');

  -- Up to 5 photos per ticket.
  perform t.login('att');
  for i in 1..4 loop
    j := public.begin_ticket_photo_upload(v_tk, 'image/png', 5000);
    perform t.admin();
    perform t.fake_tk_upload(j->>'path', 5000, 'image/png');
    perform t.login('att');
    perform public.finish_ticket_photo_upload((j->>'file_id')::uuid);
  end loop;
  perform t.raises(format('select public.begin_ticket_photo_upload(%L, ''image/png'', 5000)', v_tk), 'E_LIMIT', '[MNT-004] a ticket holds at most 5 photos');

  -- Removing: the uploader or a supervisor, never someone else.
  perform t.login('mnt');
  perform t.raises(format('select public.delete_ticket_photo(%L, ''Wrong photo'')', v_f), 'E_FORBIDDEN', '[MNT-004] another worker cannot remove a photo they did not add');
  perform t.login('hks');
  perform public.delete_ticket_photo(v_f, 'Wrong photo');
  perform t.admin();
  perform t.eq((select status from public.ticket_photos where id = v_f), 'deleting', '[MNT-004] a supervisor can remove a photo; it is marked for deletion');
  perform t.login('mnt');
  perform t.eq(jsonb_array_length(public.list_ticket_photos(v_tk)), 4, '[MNT-004] a removed photo is no longer listed');
  perform t.raises(format('select public.open_ticket_photo(%L)', v_f), 'E_NOT_FOUND', '[MNT-004] or opened');
  perform t.admin();

  -- Server clean-up (service role) removes marked files and abandoned uploads.
  perform t.login('att');
  j := public.begin_ticket_photo_upload(v_tk, 'image/jpeg', 1000);
  perform t.admin();
  update public.ticket_photos set uploaded_at = now() - interval '2 days' where id = (j->>'file_id')::uuid;
  perform t.eq((select count(*)::int from public.ticket_photo_cleanup_due(200)), 2, '[MNT-004] clean-up lists the removed photo and the abandoned upload');
  perform t.eq(public.ticket_photo_files_removed(array(select file_id from public.ticket_photo_cleanup_due(200))), 2, '[MNT-004] clean-up confirms the files are gone');
  perform t.eq((select count(*)::int from public.ticket_photo_cleanup_due(200)), 0, '[MNT-004] nothing is left to clean');

  -- Closed tickets take no new photos.
  perform t.login('hks');
  perform public.cancel_ticket(v_tk, 'Duplicate');
  perform t.login('att');
  perform t.raises(format('select public.begin_ticket_photo_upload(%L, ''image/jpeg'', 1000)', v_tk), 'E_INVALID', '[MNT-004] a cancelled ticket takes no new photos');
  perform t.admin();
exception when others then perform t.admin(); perform t.crash('ticket photos', sqlerrm);
end $$;

rollback;
