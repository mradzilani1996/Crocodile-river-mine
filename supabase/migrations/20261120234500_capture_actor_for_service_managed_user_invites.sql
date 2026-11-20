
create or replace function app_private.capture_ems_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_id text;
  v_actor_id uuid;
  v_actor_name text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_old := v_row;
    v_new := null;
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    v_old := to_jsonb(old);
    v_new := v_row;
  else
    v_row := to_jsonb(new);
    v_old := null;
    v_new := v_row;
  end if;

  v_id := coalesce(
    v_row->>'id',
    v_row->>'transaction_number',
    v_row->>'order_number',
    v_row->>'delivery_number',
    v_row->>'incident_number',
    v_row->>'inspection_number',
    v_row->>'access_number',
    v_row->>'user_id'
  );

  v_actor_id := auth.uid();
  if v_actor_id is null then
    v_actor_id := coalesce(
      nullif(v_row->>'created_by','')::uuid,
      nullif(v_row->>'submitted_by','')::uuid,
      nullif(v_row->>'requested_by','')::uuid,
      nullif(v_row->>'approved_by','')::uuid,
      nullif(v_row->>'posted_by','')::uuid,
      nullif(v_row->>'logged_by','')::uuid,
      nullif(v_row->>'counted_by','')::uuid,
      nullif(v_row->>'handed_over_by','')::uuid,
      nullif(v_row->>'received_by','')::uuid,
      nullif(v_row->>'uploaded_by','')::uuid,
      nullif(v_row->>'inspector_id','')::uuid,
      nullif(v_row->>'reported_by','')::uuid
    );
  end if;

  select p.full_name into v_actor_name
  from public.ems_profiles p
  where p.user_id = v_actor_id
  limit 1;

  insert into public.ems_audit_log(
    actor_user_id, actor_name, action, table_name, record_id, old_data, new_data
  )
  values (
    v_actor_id,
    coalesce(v_actor_name, case when v_actor_id is null then 'System / automated' else 'Name unavailable' end),
    tg_op,
    tg_table_name,
    v_id,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
