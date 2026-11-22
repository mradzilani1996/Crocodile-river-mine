-- Two-stage product authorisation: Shiftboss first, then Management.
alter table public.ems_explosive_products
  add column if not exists shiftboss_approved_by uuid references auth.users(id),
  add column if not exists shiftboss_approved_at timestamptz,
  add column if not exists management_approved_by uuid references auth.users(id),
  add column if not exists management_approved_at timestamptz;

alter table public.ems_explosive_products
  drop constraint if exists ems_explosive_products_approval_status_check;
alter table public.ems_explosive_products
  add constraint ems_explosive_products_approval_status_check
  check (approval_status in ('pending_approval','pending_shift_boss','pending_management','approved','rejected'));

create or replace function app_private.enforce_ems_product_approval()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role text := app_private.current_role()::text;
begin
  if tg_op = 'INSERT' then
    if new.control_book_section not in ('Boxes','Bags','Tamping')
      or new.approval_status <> 'pending_shift_boss'
      or new.is_active is distinct from false
      or new.submitted_by is distinct from auth.uid()
      or new.created_by is distinct from auth.uid() then
      raise exception 'New products must be submitted by the signed-in Magazine Master or Administrator for Shiftboss approval.';
    end if;
    return new;
  end if;

  if old.approval_status in ('pending_approval','pending_shift_boss')
     and new.approval_status in ('pending_management','rejected') then
    if auth.uid() is null or not app_private.is_active_user() then
      raise exception 'An active EMS profile is required to review products.';
    end if;
    if v_role not in ('admin','authorising_officer') then
      raise exception 'Only the Shiftboss can complete the first product approval stage.';
    end if;
    if old.submitted_by = auth.uid() then
      raise exception 'A product must be reviewed by someone other than the person who submitted it.';
    end if;
    if (to_jsonb(new) - array['approval_status','shiftboss_approved_by','shiftboss_approved_at','approved_by','approved_at','approval_notes','is_active','updated_at'])
       <> (to_jsonb(old) - array['approval_status','shiftboss_approved_by','shiftboss_approved_at','approved_by','approved_at','approval_notes','is_active','updated_at']) then
      raise exception 'Product details cannot be changed during approval.';
    end if;
    new.shiftboss_approved_by := auth.uid();
    new.shiftboss_approved_at := now();
    new.approved_by := null;
    new.approved_at := null;
    new.management_approved_by := null;
    new.management_approved_at := null;
    new.is_active := false;
    return new;
  end if;

  if old.approval_status = 'pending_management'
     and new.approval_status in ('approved','rejected') then
    if auth.uid() is null or not app_private.is_active_user() then
      raise exception 'An active EMS profile is required to review products.';
    end if;
    if v_role not in ('admin','management') then
      raise exception 'Only Management can complete the final product approval stage.';
    end if;
    if old.submitted_by = auth.uid() or old.shiftboss_approved_by = auth.uid() then
      raise exception 'Final approval must be completed by Management, independently of the submitter and Shiftboss.';
    end if;
    if (to_jsonb(new) - array['approval_status','management_approved_by','management_approved_at','approved_by','approved_at','approval_notes','is_active','updated_at'])
       <> (to_jsonb(old) - array['approval_status','management_approved_by','management_approved_at','approved_by','approved_at','approval_notes','is_active','updated_at']) then
      raise exception 'Product details cannot be changed during approval.';
    end if;
    new.management_approved_by := auth.uid();
    new.management_approved_at := now();
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.is_active := (new.approval_status = 'approved');
    return new;
  end if;

  raise exception 'This product is not at a reviewable approval stage. Approved or rejected product details cannot be edited.';
end;
$function$;

-- Existing single-stage pending products enter the first stage, never skip to Management.
update public.ems_explosive_products
set approval_status = 'pending_shift_boss'
where approval_status = 'pending_approval';

create or replace function app_private.notify_ems_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  row_data jsonb := to_jsonb(new);
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
  if tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    previous_status := old_data->>'status';
    if tg_table_name = 'ems_explosive_products' then previous_status := old_data->>'approval_status'; end if;
  end if;

  current_status := row_data->>'status';
  if tg_table_name = 'ems_explosive_products' then current_status := row_data->>'approval_status'; end if;
  if current_status is null or current_status = previous_status then return new; end if;

  if tg_table_name in ('ems_incidents','ems_inspections') and tg_op = 'UPDATE'
     and previous_status not in ('closed','rejected') then return new; end if;

  entity_id_value := (row_data->>'id')::uuid;
  target_roles := array['management','admin'];
  entity_type_value := tg_table_name;
  label_value := coalesce(row_data->>'order_number',row_data->>'transaction_number',row_data->>'incident_number',row_data->>'inspection_number',row_data->>'product_code',row_data->>'id');

  if tg_table_name = 'ems_stock_transactions' then
    if current_status = 'pending_approval' then
      target_roles := array['authorising_officer','admin']; title_value := 'Stock movement awaiting Shiftboss approval';
    elsif current_status = 'shiftboss_approved' then
      target_roles := array['management','admin']; title_value := 'Stock movement awaiting Management approval';
    else return new; end if;
    message_value := 'Stock movement EMS-'||label_value||' requires your approval.';
  elsif tg_table_name = 'ems_daily_orders' then
    if current_status <> 'submitted' then return new; end if;
    target_roles := array['authorising_officer','admin']; title_value := 'Daily explosive request awaiting approval';
    message_value := 'Daily request ORDER-'||label_value||' has been submitted and needs review.';
  elsif tg_table_name = 'ems_explosive_products' then
    if current_status = 'pending_shift_boss' then
      target_roles := array['authorising_officer','admin']; title_value := 'New product awaiting Shiftboss approval';
      message_value := 'Product '||coalesce(row_data->>'product_code','')||' - '||coalesce(row_data->>'product_name','')||' requires first-stage Shiftboss approval.';
    elsif current_status = 'pending_management' then
      target_roles := array['management','admin']; title_value := 'Product awaiting Management approval';
      message_value := 'Shiftboss approved product '||coalesce(row_data->>'product_code','')||' - '||coalesce(row_data->>'product_name','')||'. Final Management approval is required.';
    else return new; end if;
  elsif tg_table_name = 'ems_purchase_orders' then
    if current_status = 'pending_shift_boss' then
      target_roles := array['authorising_officer','admin']; title_value := 'Supplier purchase order awaiting Shiftboss approval';
    elsif current_status = 'pending_mine_overseer' then
      target_roles := array['management','admin']; title_value := 'Supplier purchase order awaiting Management approval';
    else return new; end if;
    message_value := 'Purchase order PO-'||label_value||' for '||coalesce(row_data->>'supplier_name','supplier')||' requires your approval.';
  elsif tg_table_name = 'ems_incidents' then
    if current_status in ('closed','rejected') then return new; end if;
    target_roles := array['management','admin']; title_value := 'Incident awaiting Management review';
    message_value := 'Incident INC-'||label_value||' ('||coalesce(row_data->>'severity','')||') requires review.';
  elsif tg_table_name = 'ems_inspections' then
    if current_status in ('closed','rejected') then return new; end if;
    target_roles := array['management','admin']; title_value := 'Inspection awaiting verification';
    message_value := 'Inspection INSP-'||label_value||' requires verification.';
  else return new;
  end if;

  insert into public.ems_user_notifications
    (recipient_user_id,title,message,href,entity_type,entity_id)
  select p.user_id,title_value,message_value,'/approvals',entity_type_value,entity_id_value
  from public.ems_profiles p
  where p.is_active = true and p.role::text = any(target_roles)
    and not exists (
      select 1 from public.ems_user_notifications n
      where n.recipient_user_id=p.user_id and n.entity_type=entity_type_value
        and n.entity_id=entity_id_value and n.title=title_value and n.read_at is null
    );
  return new;
end;
$function$;

drop trigger if exists trg_notify_ems_products on public.ems_explosive_products;
create trigger trg_notify_ems_products
after insert or update of approval_status on public.ems_explosive_products
for each row execute function app_private.notify_ems_approval();
