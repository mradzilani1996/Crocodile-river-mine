-- Resolve daily explosive request notifications when the request leaves the approval queue.
-- Also applied to the live Supabase project during this release.
create or replace function app_private.resolve_ems_daily_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'submitted'
     and new.status in ('approved','rejected','cancelled') then
    update public.ems_user_notifications
       set read_at = coalesce(read_at, now())
     where entity_type = 'ems_daily_orders'
       and entity_id = new.id
       and read_at is null;
  end if;
  return new;
end;
$function$;

revoke all on function app_private.resolve_ems_daily_order_notifications() from public, anon, authenticated;

drop trigger if exists ems_daily_order_resolve_notifications on public.ems_daily_orders;
create trigger ems_daily_order_resolve_notifications
after update of status on public.ems_daily_orders
for each row execute function app_private.resolve_ems_daily_order_notifications();

-- Existing notifications for completed requests are resolved by the trigger
-- logic above on future status changes; clean up current stale rows separately.
update public.ems_user_notifications n
set read_at = coalesce(n.read_at, now())
where n.entity_type = 'ems_daily_orders'
  and n.read_at is null
  and exists (
    select 1 from public.ems_daily_orders d
    where d.id = n.entity_id
      and d.status in ('approved','rejected','cancelled')
  );
