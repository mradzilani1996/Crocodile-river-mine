
-- Keep internal helpers private. Trigger execution does not require client EXECUTE grants.
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

revoke all on function app_private.enforce_nonnegative_ems_stock() from public, anon, authenticated;
revoke all on function app_private.sync_daily_order_issue_posting() from public, anon, authenticated;

-- Client-facing RPCs are authenticated-only. Their function bodies still enforce role and ownership checks.
revoke all on function public.ems_place_purchase_order(uuid,text) from public, anon;
grant execute on function public.ems_place_purchase_order(uuid,text) to authenticated;
revoke all on function public.ems_process_purchase_order_approval(uuid,text,text) from public, anon;
grant execute on function public.ems_process_purchase_order_approval(uuid,text,text) to authenticated;
revoke all on function public.ems_record_purchase_delivery(uuid,text,date,text,jsonb) from public, anon;
grant execute on function public.ems_record_purchase_delivery(uuid,text,date,text,jsonb) to authenticated;
revoke all on function public.ems_submit_daily_order(date,text,text,text,text,jsonb,text,text) from public, anon;
grant execute on function public.ems_submit_daily_order(date,text,text,text,text,jsonb,text,text) to authenticated;
revoke all on function public.ems_submit_purchase_order(text,text,text,text,text,date,date,text,text,jsonb) from public, anon;
grant execute on function public.ems_submit_purchase_order(text,text,text,text,text,date,date,text,text,jsonb) to authenticated;

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

  if new.role = 'admin'::public.ems_user_role
    and old.role is distinct from 'admin'::public.ems_user_role then
    raise exception 'Administrator access cannot be assigned from the staff access screen. Use the controlled administrator bootstrap process.';
  end if;

  if exists (
    select 1
    from public.ems_magazine m
    where m.responsible_user_id = old.user_id
      and m.is_active = true
      and (new.role is distinct from 'magazine_master'::public.ems_user_role or new.is_active is distinct from true)
  ) then
    raise exception 'This person is the appointed Magazine Master. Reassign the magazine first before changing or deactivating this profile.';
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
