-- Allow signed-in, active EMS users to resolve colleagues' names and roles in reports.
-- Exposes only the minimum directory fields and never exposes email addresses.
create or replace function public.ems_get_profile_directory()
returns table (user_id uuid, full_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, p.role::text
  from public.ems_profiles p
  where p.is_active = true
    and app_private.is_active_user()
    and auth.uid() is not null
  order by p.full_name;
$$;

revoke all on function public.ems_get_profile_directory() from public, anon;
grant execute on function public.ems_get_profile_directory() to authenticated;
