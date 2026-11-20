-- All stock movements must be approved by an independent Authorising Officer before posting.
create or replace function app_private.prepare_ems_transaction()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare v_role public.ems_user_role;
begin
  v_role := app_private.current_role();
  if tg_op = 'INSERT' then
    new.status := 'pending_approval';
    new.approved_by := null;
    new.approved_at := null;
    new.posted_by := null;
    new.posted_at := null;
    if new.transaction_type <> 'adjustment' then new.adjustment_direction := 'decrease'; end if;
    return new;
  end if;
  if v_role = 'admin' then
    if old.status = 'pending_approval' and new.status in ('approved','rejected') then
      new.approved_by := auth.uid(); new.approved_at := now();
    elsif old.status = 'approved' and new.status = 'posted' then
      new.posted_by := auth.uid(); new.posted_at := now();
    elsif old.status = new.status then
      raise exception 'Admin updates must record an approval, rejection or posting transition.';
    end if;
    return new;
  end if;
  if v_role = 'authorising_officer' then
    if old.status <> 'pending_approval' or old.created_by = auth.uid()
      or new.status not in ('approved','rejected')
      or (to_jsonb(new) - array['status','approved_by','approved_at','updated_at']) <> (to_jsonb(old) - array['status','approved_by','approved_at','updated_at'])
    then raise exception 'Authorising Officers may only approve or reject pending stock movements submitted by another user.'; end if;
    new.approved_by := auth.uid(); new.approved_at := now(); return new;
  end if;
  if v_role = 'magazine_master' then
    if old.status <> 'approved' or new.status <> 'posted'
      or (to_jsonb(new) - array['status','posted_by','posted_at','updated_at']) <> (to_jsonb(old) - array['status','posted_by','posted_at','updated_at'])
    then raise exception 'Magazine Master may only post approved stock movements without changing their details.'; end if;
    new.posted_by := auth.uid(); new.posted_at := now(); return new;
  end if;
  raise exception 'You are not authorised to update stock transactions.';
end;
$function$;
drop policy if exists "Admins and authorising officers can process issue approvals" on public.ems_stock_transactions;
create policy "Authorised officers approve and magazine masters post stock movements"
on public.ems_stock_transactions for update to authenticated
using (app_private.is_active_user() and (
  app_private.current_role() = 'admin'::ems_user_role
  or (app_private.current_role() = 'authorising_officer'::ems_user_role and status = 'pending_approval'::ems_transaction_status and created_by <> auth.uid())
  or (app_private.current_role() = 'magazine_master'::ems_user_role and status = 'approved'::ems_transaction_status)
))
with check (app_private.is_active_user() and (
  (app_private.current_role() = 'admin'::ems_user_role and status in ('approved'::ems_transaction_status,'rejected'::ems_transaction_status,'posted'::ems_transaction_status))
  or (app_private.current_role() = 'authorising_officer'::ems_user_role and status in ('approved'::ems_transaction_status,'rejected'::ems_transaction_status) and created_by <> auth.uid())
  or (app_private.current_role() = 'magazine_master'::ems_user_role and status = 'posted'::ems_transaction_status)
));
create index if not exists ems_stock_transactions_status_date_idx on public.ems_stock_transactions(status,transaction_date desc);
create index if not exists ems_stock_transactions_product_status_idx on public.ems_stock_transactions(product_id,status,transaction_date,transaction_number);