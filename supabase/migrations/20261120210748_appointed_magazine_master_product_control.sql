create or replace function app_private.is_assigned_magazine_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.ems_profiles p
      where p.user_id = auth.uid()
        and p.role = 'magazine_master'::public.ems_user_role
        and p.is_active = true
    )
    and exists (
      select 1 from public.ems_magazine m
      where m.singleton = true
        and m.is_active = true
        and m.responsible_user_id = auth.uid()
    );
$$;

revoke all on function app_private.is_assigned_magazine_master() from public, anon;
grant execute on function app_private.is_assigned_magazine_master() to authenticated;

drop policy if exists "Magazine masters and admins submit products for approval" on public.ems_explosive_products;
create policy "Appointed magazine master and admins submit products"
on public.ems_explosive_products for insert to authenticated
with check (
  app_private.is_active_user()
  and (app_private.current_role() = 'admin'::public.ems_user_role or app_private.is_assigned_magazine_master())
  and approval_status = 'pending_approval'
  and submitted_by = auth.uid()
  and created_by = auth.uid()
  and is_active = false
  and control_book_section in ('Boxes','Bags','Tamping')
);

drop policy if exists "Product managers and authorised approvers can update products" on public.ems_explosive_products;
create policy "Appointed product managers and authorised approvers can update products"
on public.ems_explosive_products for update to authenticated
using (
  app_private.is_active_user()
  and (
    app_private.current_role() = 'admin'::public.ems_user_role
    or app_private.is_assigned_magazine_master()
    or app_private.current_role() in ('authorising_officer'::public.ems_user_role,'management'::public.ems_user_role)
  )
)
with check (
  app_private.is_active_user()
  and (
    app_private.current_role() = 'admin'::public.ems_user_role
    or app_private.is_assigned_magazine_master()
    or app_private.current_role() in ('authorising_officer'::public.ems_user_role,'management'::public.ems_user_role)
  )
);

create or replace function app_private.enforce_ems_product_approval()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role text := app_private.current_role()::text;
  v_is_manager boolean := (v_role = 'admin' or app_private.is_assigned_magazine_master());
begin
  if tg_op = 'INSERT' then
    if new.control_book_section not in ('Boxes','Bags','Tamping') then
      raise exception 'Choose the correct Boxes, Bags or Tamping register for this product.';
    end if;
    if not v_is_manager then
      raise exception 'Only the appointed Magazine Master or Administrator can submit products.';
    end if;
    if new.approval_status <> 'pending_approval'
      or new.is_active is distinct from false
      or new.submitted_by is distinct from auth.uid()
      or new.created_by is distinct from auth.uid() then
      raise exception 'New products must be submitted for independent mine authorisation.';
    end if;
    return new;
  end if;

  if old.approval_status = 'pending_approval' and new.approval_status in ('approved','rejected') then
    if auth.uid() is null or not app_private.is_active_user() then
      raise exception 'An active EMS profile is required to approve products.';
    end if;
    if v_role not in ('admin','authorising_officer','management') then
      raise exception 'Only the Authorising Officer, Management or Administrator can approve products.';
    end if;
    if old.submitted_by = auth.uid() then
      raise exception 'A product must be approved by someone other than the person who submitted it.';
    end if;
    if (to_jsonb(new) - array['approval_status','approved_by','approved_at','approval_notes','is_active','updated_at'])
       <> (to_jsonb(old) - array['approval_status','approved_by','approved_at','approval_notes','is_active','updated_at']) then
      raise exception 'Product details cannot be changed during approval. Return the product for correction and resubmission.';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.is_active := (new.approval_status = 'approved');
    return new;
  end if;

  if not v_is_manager then
    raise exception 'Only the appointed Magazine Master or Administrator can maintain product details.';
  end if;
  if new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.submitted_by is distinct from old.submitted_by
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Product managers cannot change product approval history.';
  end if;
  if old.approval_status = 'rejected' then
    raise exception 'Rejected products cannot be reactivated. Submit a corrected product as a new record.';
  end if;
  if new.control_book_section not in ('Boxes','Bags','Tamping') then
    raise exception 'Choose the correct Boxes, Bags or Tamping register for this product.';
  end if;
  if new.approval_status = 'pending_approval' and new.is_active is distinct from false then
    raise exception 'A pending product cannot be active.';
  end if;
  return new;
end;
$function$;
