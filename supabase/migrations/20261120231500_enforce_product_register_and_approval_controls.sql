
alter table public.ems_explosive_products
  alter column control_book_section set not null;

create or replace function app_private.enforce_ems_product_approval()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_role text := app_private.current_role()::text;
begin
  if tg_op = 'INSERT' then
    if new.control_book_section not in ('Boxes','Bags','Tamping') then
      raise exception 'Choose the correct Boxes, Bags or Tamping register for this product.';
    end if;
    if new.approval_status <> 'pending_approval'
      or new.is_active is distinct from false
      or new.submitted_by is distinct from auth.uid()
      or new.created_by is distinct from auth.uid()
    then
      raise exception 'New products must be submitted by the signed-in Magazine Master or Administrator for approval.';
    end if;
    return new;
  end if;

  if old.approval_status = 'pending_approval'
    and new.approval_status in ('approved','rejected') then
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
      raise exception 'Product details cannot be changed during approval. Submit a corrected product record instead.';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
    new.is_active := (new.approval_status = 'approved');
    return new;
  end if;

  raise exception 'Approved or rejected product records cannot be edited. Submit a new controlled product record for any change.';
end;
$function$;

drop trigger if exists ems_product_approval_guard on public.ems_explosive_products;
create trigger ems_product_approval_guard
before insert or update on public.ems_explosive_products
for each row execute function app_private.enforce_ems_product_approval();

drop policy if exists "Magazine masters and admins submit products for approval"
  on public.ems_explosive_products;
create policy "Magazine masters and admins submit products for approval"
on public.ems_explosive_products
for insert
to authenticated
with check (
  (select app_private.is_active_user())
  and (select app_private.current_role()) in ('admin'::public.ems_user_role,'magazine_master'::public.ems_user_role)
  and approval_status = 'pending_approval'
  and submitted_by = (select auth.uid())
  and created_by = (select auth.uid())
  and is_active = false
  and control_book_section in ('Boxes','Bags','Tamping')
);

create or replace function app_private.enforce_ems_stocktake_register()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_section text;
begin
  select p.control_book_section into v_section
  from public.ems_explosive_products p
  where p.id = new.product_id and p.is_active = true and p.approval_status = 'approved';

  if not found or v_section is null then
    raise exception 'Select an approved product assigned to a stock register.';
  end if;
  if new.control_book_section is null then
    new.control_book_section := v_section;
  elsif new.control_book_section <> v_section then
    raise exception 'The stocktake register does not match the product register.';
  end if;
  return new;
end;
$function$;

drop trigger if exists ems_stocktake_register_guard on public.ems_stocktakes;
create trigger ems_stocktake_register_guard
before insert or update of product_id, control_book_section on public.ems_stocktakes
for each row execute function app_private.enforce_ems_stocktake_register();
