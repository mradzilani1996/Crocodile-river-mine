drop policy if exists "Appointed magazine master and admins submit products" on public.ems_explosive_products;

create or replace function app_private.resolve_ems_product_approval_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.approval_status = 'pending_shift_boss'
     and new.approval_status in ('pending_management','rejected') then
    update public.ems_user_notifications
       set read_at = coalesce(read_at, now())
     where entity_type = 'ems_explosive_products'
       and entity_id = new.id
       and title ilike '%Shiftboss%'
       and read_at is null;
  end if;

  if new.approval_status in ('approved','rejected')
     and old.approval_status is distinct from new.approval_status then
    update public.ems_user_notifications
       set read_at = coalesce(read_at, now())
     where entity_type = 'ems_explosive_products'
       and entity_id = new.id
       and read_at is null;
  end if;
  return new;
end;
$function$;