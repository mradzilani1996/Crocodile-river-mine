drop policy if exists "Appointed product managers and admins submit products" on public.ems_explosive_products;
create policy "Appointed product managers and admins submit products"
on public.ems_explosive_products
for insert
to authenticated
with check (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or (select app_private.is_assigned_magazine_master())
  )
  and approval_status = 'pending_shift_boss'
  and submitted_by = (select auth.uid())
  and created_by = (select auth.uid())
  and is_active = false
  and control_book_section in ('Boxes','Bags','Tamping')
);