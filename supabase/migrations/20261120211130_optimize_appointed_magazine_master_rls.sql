drop policy if exists "Appointed magazine master and admins submit products" on public.ems_explosive_products;
create policy "Appointed magazine master and admins submit products"
on public.ems_explosive_products for insert to authenticated
with check (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or (select app_private.is_assigned_magazine_master())
  )
  and approval_status = 'pending_approval'
  and submitted_by = (select auth.uid())
  and created_by = (select auth.uid())
  and is_active = false
  and control_book_section in ('Boxes','Bags','Tamping')
);

drop policy if exists "Appointed product managers and authorised approvers can update products" on public.ems_explosive_products;
create policy "Appointed product managers and authorised approvers can update products"
on public.ems_explosive_products for update to authenticated
using (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or (select app_private.is_assigned_magazine_master())
    or (select app_private.current_role()) in ('authorising_officer'::public.ems_user_role,'management'::public.ems_user_role)
  )
)
with check (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or (select app_private.is_assigned_magazine_master())
    or (select app_private.current_role()) in ('authorising_officer'::public.ems_user_role,'management'::public.ems_user_role)
  )
);

drop policy if exists "Admins and appointed magazine master record receipts returns adjustments" on public.ems_stock_transactions;
create policy "Admins and appointed magazine master record receipts returns adjustments"
on public.ems_stock_transactions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (
      transaction_type in ('receipt'::public.ems_transaction_type,'return'::public.ems_transaction_type,'adjustment'::public.ems_transaction_type)
      and (
        (select app_private.current_role()) = 'admin'::public.ems_user_role
        or (select app_private.is_assigned_magazine_master())
      )
    )
    or (
      transaction_type = 'issue'::public.ems_transaction_type
      and (select app_private.current_role()) in ('admin'::public.ems_user_role,'issuer'::public.ems_user_role)
    )
  )
);

drop policy if exists "Authorised officers approve and appointed magazine master posts" on public.ems_stock_transactions;
create policy "Authorised officers approve and appointed magazine master posts"
on public.ems_stock_transactions for update to authenticated
using (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or (
      (select app_private.current_role()) = 'authorising_officer'::public.ems_user_role
      and status = 'pending_approval'::public.ems_transaction_status
      and created_by <> (select auth.uid())
    )
    or (
      (select app_private.is_assigned_magazine_master())
      and status = 'approved'::public.ems_transaction_status
    )
  )
)
with check (
  (select app_private.is_active_user())
  and (
    (
      (select app_private.current_role()) = 'admin'::public.ems_user_role
      and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status,'posted'::public.ems_transaction_status)
    )
    or (
      (select app_private.current_role()) = 'authorising_officer'::public.ems_user_role
      and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status)
      and created_by <> (select auth.uid())
    )
    or (
      (select app_private.is_assigned_magazine_master())
      and status = 'posted'::public.ems_transaction_status
    )
  )
);
