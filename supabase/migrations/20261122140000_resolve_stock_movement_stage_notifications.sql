create or replace function app_private.resolve_ems_stock_movement_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'pending_approval'
     and new.status in ('shiftboss_approved','posted','rejected') then
    update public.ems_user_notifications
       set read_at = coalesce(read_at, now())
     where entity_type = 'ems_stock_transactions'
       and entity_id = new.id
       and title ilike '%Shiftboss%'
       and read_at is null;
  end if;

  if new.status in ('posted','rejected')
     and old.status is distinct from new.status then
    update public.ems_user_notifications
       set read_at = coalesce(read_at, now())
     where entity_type = 'ems_stock_transactions'
       and entity_id = new.id
       and read_at is null;
  end if;

  return new;
end;
$function$;

drop trigger if exists ems_resolve_stock_movement_notifications on public.ems_stock_transactions;
create trigger ems_resolve_stock_movement_notifications
after update of status on public.ems_stock_transactions
for each row
when (old.status is distinct from new.status)
execute function app_private.resolve_ems_stock_movement_notifications();

update public.ems_user_notifications n
set read_at = coalesce(n.read_at, now())
from public.ems_stock_transactions t
where n.entity_type = 'ems_stock_transactions'
  and n.entity_id = t.id
  and n.read_at is null
  and (
    (n.title ilike '%Shiftboss%' and t.status::text <> 'pending_approval')
    or
    (n.title ilike '%Management%' and t.status::text <> 'shiftboss_approved')
  );
