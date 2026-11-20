alter table public.ems_audit_log add column if not exists actor_name text;

update public.ems_audit_log a
set actor_name = p.full_name
from public.ems_profiles p
where a.actor_user_id = p.user_id
  and a.actor_name is null;

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

  select p.full_name into v_actor_name
  from public.ems_profiles p
  where p.user_id = auth.uid()
  limit 1;

  insert into public.ems_audit_log(
    actor_user_id, actor_name, action, table_name, record_id, old_data, new_data
  )
  values (
    auth.uid(),
    coalesce(v_actor_name, case when auth.uid() is null then 'System / automated' else 'Name unavailable' end),
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

do $block$
declare
  v_table text;
  v_tables text[] := array[
    'ems_explosive_products',
    'ems_magazine',
    'ems_profiles',
    'ems_stock_transactions',
    'ems_daily_orders',
    'ems_daily_order_items',
    'ems_purchase_orders',
    'ems_purchase_order_items',
    'ems_purchase_order_approvals',
    'ems_purchase_deliveries',
    'ems_purchase_delivery_items',
    'ems_incidents',
    'ems_inspections',
    'ems_document_register',
    'ems_magazine_access_log',
    'ems_shift_handovers',
    'ems_stocktakes'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists ems_full_audit on public.%I', v_table);
      execute format(
        'create trigger ems_full_audit after insert or update or delete on public.%I for each row execute function app_private.capture_ems_audit()',
        v_table
      );
    end if;
  end loop;
end;
$block$;