
create or replace function app_private.validate_magazine_master_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role public.ems_user_role;
  v_active boolean;
begin
  if new.responsible_user_id is null then
    return new;
  end if;

  select role,is_active into v_role,v_active
  from public.ems_profiles
  where user_id = new.responsible_user_id;

  if not found or v_active is distinct from true or v_role <> 'magazine_master'::public.ems_user_role then
    raise exception 'The appointed Magazine Master must have an active EMS profile with the Magazine Master role.';
  end if;

  return new;
end;
$function$;

drop trigger if exists ems_magazine_master_assignment_guard on public.ems_magazine;
create trigger ems_magazine_master_assignment_guard
before insert or update of responsible_user_id on public.ems_magazine
for each row execute function app_private.validate_magazine_master_assignment();

create or replace function app_private.prevent_last_admin_lockout()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_other_active_admins integer;
begin
  if old.user_id = auth.uid() and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'You cannot change or deactivate your own administrator access.';
  end if;

  if old.role = 'admin'::public.ems_user_role
    and old.is_active = true
    and (new.role <> 'admin'::public.ems_user_role or new.is_active = false) then
    select count(*) into v_other_active_admins
    from public.ems_profiles p
    where p.role = 'admin'::public.ems_user_role
      and p.is_active = true
      and p.user_id <> old.user_id;

    if v_other_active_admins = 0 then
      raise exception 'At least one active System Administrator must remain in the EMS.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists ems_profiles_admin_safety on public.ems_profiles;
create trigger ems_profiles_admin_safety
before update on public.ems_profiles
for each row execute function app_private.prevent_last_admin_lockout();
