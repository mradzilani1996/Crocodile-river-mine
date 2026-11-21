-- Route every approval-stage submission to the correct EMS approvers.
-- The existing stocktake-specific trigger remains in place.

create or replace function app_private.notify_ems_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  row_data jsonb := to_jsonb(NEW);
  old_data jsonb;
  current_status text;
  previous_status text;
  entity_id_value uuid;
  entity_type_value text;
  title_value text;
  message_value text;
  target_roles text[];
  label_value text;
begin
  if TG_OP = 'UPDATE' then
    old_data := to_jsonb(OLD);
    previous_status := old_data->>'status';
    if TG_TABLE_NAME = 'ems_explosive_products' then previous_status := old_data->>'approval_status'; end if;
  end if;

  current_status := row_data->>'status';
  if TG_TABLE_NAME = 'ems_explosive_products' then current_status := row_data->>'approval_status'; end if;
  if current_status is null or current_status = previous_status then return NEW; end if;

  -- Incidents and inspections stay in the Management review queue until closed.
  -- Do not generate repeat alerts every time Management updates their review status.
  if TG_TABLE_NAME in ('ems_incidents','ems_inspections') and TG_OP = 'UPDATE'
     and previous_status not in ('closed','rejected') then
    return NEW;
  end if;

  entity_id_value := (row_data->>'id')::uuid;
  target_roles := array['management','admin'];
  entity_type_value := TG_TABLE_NAME;
  label_value := coalesce(row_data->>'order_number', row_data->>'transaction_number', row_data->>'incident_number', row_data->>'inspection_number', row_data->>'product_code', row_data->>'id');

  if TG_TABLE_NAME = 'ems_stock_transactions' then
    if current_status = 'pending_approval' then
      target_roles := array['authorising_officer','admin'];
      title_value := 'Stock movement awaiting Shiftboss approval';
    elsif current_status = 'shiftboss_approved' then
      target_roles := array['management','admin'];
      title_value := 'Stock movement awaiting Management approval';
    else return NEW; end if;
    message_value := 'Stock movement EMS-'||label_value||' requires your approval.';
  elsif TG_TABLE_NAME = 'ems_daily_orders' then
    if current_status <> 'submitted' then return NEW; end if;
    target_roles := array['authorising_officer','admin'];
    title_value := 'Daily explosive request awaiting approval';
    message_value := 'Daily request ORDER-'||label_value||' has been submitted and needs review.';
  elsif TG_TABLE_NAME = 'ems_explosive_products' then
    if current_status <> 'pending_approval' then return NEW; end if;
    target_roles := array['authorising_officer','management','admin'];
    title_value := 'New explosive product awaiting approval';
    message_value := 'Product '||coalesce(row_data->>'product_code','')||' - '||coalesce(row_data->>'product_name','')||' needs approval.';
  elsif TG_TABLE_NAME = 'ems_purchase_orders' then
    if current_status = 'pending_shift_boss' then
      target_roles := array['authorising_officer','admin'];
      title_value := 'Supplier purchase order awaiting Shiftboss approval';
    elsif current_status = 'pending_mine_overseer' then
      target_roles := array['management','admin'];
      title_value := 'Supplier purchase order awaiting Management approval';
    else return NEW; end if;
    message_value := 'Purchase order PO-'||label_value||' for '||coalesce(row_data->>'supplier_name','supplier')||' requires your approval.';
  elsif TG_TABLE_NAME = 'ems_incidents' then
    if current_status in ('closed','rejected') then return NEW; end if;
    target_roles := array['management','admin'];
    title_value := 'Incident awaiting Management review';
    message_value := 'Incident INC-'||label_value||' ('||coalesce(row_data->>'severity','')||') requires review.';
  elsif TG_TABLE_NAME = 'ems_inspections' then
    if current_status in ('closed','rejected') then return NEW; end if;
    target_roles := array['management','admin'];
    title_value := 'Inspection awaiting verification';
    message_value := 'Inspection INSP-'||label_value||' requires verification.';
  else
    return NEW;
  end if;

  insert into public.ems_user_notifications
    (recipient_user_id,title,message,href,entity_type,entity_id)
  select p.user_id,title_value,message_value,'/approvals',entity_type_value,entity_id_value
  from public.ems_profiles p
  where p.is_active = true
    and p.role::text = any(target_roles)
    and not exists (
      select 1 from public.ems_user_notifications n
      where n.recipient_user_id=p.user_id
        and n.entity_type=entity_type_value
        and n.entity_id=entity_id_value
        and n.title=title_value
        and n.read_at is null
    );

  return NEW;
end;
$function$;

drop trigger if exists trg_notify_ems_stock_transactions on public.ems_stock_transactions;
create trigger trg_notify_ems_stock_transactions after insert or update of status on public.ems_stock_transactions for each row execute function app_private.notify_ems_approval();

drop trigger if exists trg_notify_ems_daily_orders on public.ems_daily_orders;
create trigger trg_notify_ems_daily_orders after insert or update of status on public.ems_daily_orders for each row execute function app_private.notify_ems_approval();

drop trigger if exists trg_notify_ems_products on public.ems_explosive_products;
create trigger trg_notify_ems_products after insert or update of approval_status on public.ems_explosive_products for each row execute function app_private.notify_ems_approval();

drop trigger if exists trg_notify_ems_purchase_orders on public.ems_purchase_orders;
create trigger trg_notify_ems_purchase_orders after insert or update of status on public.ems_purchase_orders for each row execute function app_private.notify_ems_approval();

drop trigger if exists trg_notify_ems_incidents on public.ems_incidents;
create trigger trg_notify_ems_incidents after insert or update of status on public.ems_incidents for each row execute function app_private.notify_ems_approval();

drop trigger if exists trg_notify_ems_inspections on public.ems_inspections;
create trigger trg_notify_ems_inspections after insert or update of status on public.ems_inspections for each row execute function app_private.notify_ems_approval();
