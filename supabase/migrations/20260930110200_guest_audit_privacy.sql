-- No personal data in the audit trail (audit finding M5, requirement GST-003).
--
-- Before: every change to guests and guest_documents copied the whole row, before and after, into
-- audit_events. Anyone allowed to read the audit log saw phone numbers, emails and ID numbers that the
-- guest screen deliberately masks.
--
-- After: the audit row says which fields changed, never their values.
--   insert: after = {"fields": [names of fields that were filled in]}
--   update: after = {"changed": [names of fields that changed]}
--   delete: after = {"deleted": true}

create or replace function app.audit_guest_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_after jsonb;
  v_skip text[] := array['id', 'tenant_id', 'created_at', 'updated_at'];
begin
  if current_setting('app.skip_guest_audit', true) = 'on' then return null; end if;
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);
  v_after := case tg_op
    when 'INSERT' then jsonb_build_object('fields', coalesce((select jsonb_agg(k order by k) from jsonb_each(v_new) e(k, v)
                         where v <> 'null'::jsonb and k <> all (v_skip)), '[]'::jsonb))
    when 'UPDATE' then jsonb_build_object('changed', coalesce((select jsonb_agg(k order by k) from jsonb_each(v_new) e(k, v)
                         where v is distinct from v_old -> k and k <> all (v_skip)), '[]'::jsonb))
    else jsonb_build_object('deleted', true) end;
  insert into public.audit_events(tenant_id, actor_id, action, table_name, record_id, before, after, reason)
  values ((v_row->>'tenant_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, v_row->>'id',
          null, v_after, nullif(current_setting('app.audit_reason', true), ''));
  return null;
end $$;

-- Clean the rows already written: keep what happened and which fields, drop the values.
update public.audit_events a
   set after = case a.action
         when 'insert' then jsonb_build_object('fields', coalesce((select jsonb_agg(k order by k) from jsonb_each(a.after) e(k, v)
                              where v <> 'null'::jsonb and k not in ('id', 'tenant_id', 'created_at', 'updated_at')), '[]'::jsonb))
         when 'update' then jsonb_build_object('changed', coalesce((select jsonb_agg(k order by k) from jsonb_each(a.after) e(k, v)
                              where v is distinct from a.before -> k and k not in ('id', 'tenant_id', 'created_at', 'updated_at')), '[]'::jsonb))
         else jsonb_build_object('deleted', true) end,
       before = null
 where a.table_name in ('guests', 'guest_documents')
   and (a.before is not null or (a.after is not null and not (a.after ? 'fields' or a.after ? 'changed' or a.after ? 'deleted')));
