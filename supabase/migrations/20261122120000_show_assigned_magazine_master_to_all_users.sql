create or replace function public.ems_get_assigned_magazine_master_name()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $function$
declare
  assigned_name text;
begin
  if auth.uid() is null or not app_private.is_active_user() then
    return null;
  end if;

  select p.full_name
    into assigned_name
  from public.ems_magazine m
  join public.ems_profiles p on p.user_id = m.responsible_user_id
  where m.singleton = true
    and p.is_active = true
    and p.role = 'magazine_master'
  limit 1;

  return assigned_name;
end;
$function$;

revoke all on function public.ems_get_assigned_magazine_master_name() from public;
grant execute on function public.ems_get_assigned_magazine_master_name() to authenticated;
