drop policy if exists "Admins and magazine master can record receipts returns and adju" on public.ems_stock_transactions;
create policy "Admins and appointed magazine master record receipts returns adjustments"
on public.ems_stock_transactions for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (
      transaction_type in ('receipt'::public.ems_transaction_type,'return'::public.ems_transaction_type,'adjustment'::public.ems_transaction_type)
      and (app_private.current_role() = 'admin'::public.ems_user_role or app_private.is_assigned_magazine_master())
    )
    or (
      transaction_type = 'issue'::public.ems_transaction_type
      and app_private.current_role() in ('admin'::public.ems_user_role,'issuer'::public.ems_user_role)
    )
  )
);

drop policy if exists "Authorised officers approve and magazine masters post stock mov" on public.ems_stock_transactions;
create policy "Authorised officers approve and appointed magazine master posts"
on public.ems_stock_transactions for update to authenticated
using (
  app_private.is_active_user()
  and (
    app_private.current_role() = 'admin'::public.ems_user_role
    or (app_private.current_role() = 'authorising_officer'::public.ems_user_role and status = 'pending_approval'::public.ems_transaction_status and created_by <> auth.uid())
    or (app_private.is_assigned_magazine_master() and status = 'approved'::public.ems_transaction_status)
  )
)
with check (
  app_private.is_active_user()
  and (
    (app_private.current_role() = 'admin'::public.ems_user_role and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status,'posted'::public.ems_transaction_status))
    or (app_private.current_role() = 'authorising_officer'::public.ems_user_role and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status) and created_by <> auth.uid())
    or (app_private.is_assigned_magazine_master() and status = 'posted'::public.ems_transaction_status)
  )
);
