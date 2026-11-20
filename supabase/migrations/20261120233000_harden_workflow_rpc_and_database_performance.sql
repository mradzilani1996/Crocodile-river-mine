
alter function public.ems_process_daily_order(uuid,text,jsonb,text) set schema app_private;
alter function public.ems_fulfil_daily_order(uuid,boolean) set schema app_private;

grant usage on schema app_private to authenticated;
revoke all on function app_private.ems_process_daily_order(uuid,text,jsonb,text) from public, anon;
grant execute on function app_private.ems_process_daily_order(uuid,text,jsonb,text) to authenticated;
revoke all on function app_private.ems_fulfil_daily_order(uuid,boolean) from public, anon;
grant execute on function app_private.ems_fulfil_daily_order(uuid,boolean) to authenticated;

create or replace function public.ems_process_daily_order(
  p_order_id uuid,
  p_decision text,
  p_items jsonb default '[]'::jsonb,
  p_comments text default null
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select app_private.ems_process_daily_order(p_order_id,p_decision,p_items,p_comments);
$function$;

create or replace function public.ems_fulfil_daily_order(
  p_order_id uuid,
  p_miner_acknowledged boolean
)
returns integer
language sql
security invoker
set search_path = ''
as $function$
  select app_private.ems_fulfil_daily_order(p_order_id,p_miner_acknowledged);
$function$;

revoke all on function public.ems_process_daily_order(uuid,text,jsonb,text) from public, anon;
grant execute on function public.ems_process_daily_order(uuid,text,jsonb,text) to authenticated;
revoke all on function public.ems_fulfil_daily_order(uuid,boolean) from public, anon;
grant execute on function public.ems_fulfil_daily_order(uuid,boolean) to authenticated;

drop policy if exists "Active users report EMS incidents" on public.ems_incidents;
create policy "Active users report EMS incidents" on public.ems_incidents
for insert to authenticated
with check ((select app_private.is_active_user()) and reported_by = (select auth.uid()));

drop policy if exists "Active users view EMS incidents" on public.ems_incidents;
create policy "Active users view EMS incidents" on public.ems_incidents
for select to authenticated
using ((select app_private.is_active_user()));

drop policy if exists "Management reviews EMS incidents" on public.ems_incidents;
create policy "Management reviews EMS incidents" on public.ems_incidents
for update to authenticated
using ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]))
with check ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

drop policy if exists "Authorised users create EMS inspections" on public.ems_inspections;
create policy "Authorised users create EMS inspections" on public.ems_inspections
for insert to authenticated
with check (
  (select app_private.is_active_user())
  and inspector_id = (select auth.uid())
  and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'magazine_master'::public.ems_user_role,'authorising_officer'::public.ems_user_role,'management'::public.ems_user_role])
);

drop policy if exists "Active users view EMS inspections" on public.ems_inspections;
create policy "Active users view EMS inspections" on public.ems_inspections
for select to authenticated using ((select app_private.is_active_user()));

drop policy if exists "Management updates EMS inspections" on public.ems_inspections;
create policy "Management updates EMS inspections" on public.ems_inspections
for update to authenticated
using ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]))
with check ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

drop policy if exists "Magazine team records shift handovers" on public.ems_shift_handovers;
create policy "Magazine team records shift handovers" on public.ems_shift_handovers
for insert to authenticated
with check (
  (select app_private.is_active_user())
  and handed_over_by = (select auth.uid())
  and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'magazine_master'::public.ems_user_role,'issuer'::public.ems_user_role])
);

drop policy if exists "Active EMS users view shift handovers" on public.ems_shift_handovers;
create policy "Active EMS users view shift handovers" on public.ems_shift_handovers
for select to authenticated using ((select app_private.is_active_user()));

drop policy if exists "Magazine team records stocktakes" on public.ems_stocktakes;
create policy "Magazine team records stocktakes" on public.ems_stocktakes
for insert to authenticated
with check (
  (select app_private.is_active_user())
  and counted_by = (select auth.uid())
  and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'magazine_master'::public.ems_user_role])
);

drop policy if exists "Active EMS users view stocktakes" on public.ems_stocktakes;
create policy "Active EMS users view stocktakes" on public.ems_stocktakes
for select to authenticated using ((select app_private.is_active_user()));

drop policy if exists "Management verifies stocktakes" on public.ems_stocktakes;
create policy "Management verifies stocktakes" on public.ems_stocktakes
for update to authenticated
using ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]))
with check ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

drop policy if exists "Magazine team logs magazine access" on public.ems_magazine_access_log;
create policy "Magazine team logs magazine access" on public.ems_magazine_access_log
for insert to authenticated
with check (
  (select app_private.is_active_user())
  and logged_by = (select auth.uid())
  and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'magazine_master'::public.ems_user_role,'issuer'::public.ems_user_role])
);

drop policy if exists "Active EMS users view magazine access log" on public.ems_magazine_access_log;
create policy "Active EMS users view magazine access log" on public.ems_magazine_access_log
for select to authenticated using ((select app_private.is_active_user()));

drop policy if exists "Authorised officers approve and magazine masters post stock mov" on public.ems_stock_transactions;
create policy "Authorised officers approve and magazine masters post stock movements"
on public.ems_stock_transactions
for update to authenticated
using (
  (select app_private.is_active_user())
  and (
    (select app_private.current_role()) = 'admin'::public.ems_user_role
    or ((select app_private.current_role()) = 'authorising_officer'::public.ems_user_role and status = 'pending_approval'::public.ems_transaction_status and created_by <> (select auth.uid()))
    or ((select app_private.current_role()) = 'magazine_master'::public.ems_user_role and status = 'approved'::public.ems_transaction_status)
  )
)
with check (
  (select app_private.is_active_user())
  and (
    ((select app_private.current_role()) = 'admin'::public.ems_user_role and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status,'posted'::public.ems_transaction_status))
    or ((select app_private.current_role()) = 'authorising_officer'::public.ems_user_role and status in ('approved'::public.ems_transaction_status,'rejected'::public.ems_transaction_status) and created_by <> (select auth.uid()))
    or ((select app_private.current_role()) = 'magazine_master'::public.ems_user_role and status = 'posted'::public.ems_transaction_status)
  )
);

drop policy if exists "Admins manage EMS document register" on public.ems_document_register;
drop policy if exists "Active users view EMS document register" on public.ems_document_register;
create policy "Active users view EMS document register" on public.ems_document_register
for select to authenticated using ((select app_private.is_active_user()));

create policy "Admins insert EMS document register" on public.ems_document_register
for insert to authenticated
with check ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

create policy "Admins update EMS document register" on public.ems_document_register
for update to authenticated
using ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]))
with check ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

create policy "Admins delete EMS document register" on public.ems_document_register
for delete to authenticated
using ((select app_private.is_active_user()) and (select app_private.current_role()) = any(array['admin'::public.ems_user_role,'management'::public.ems_user_role]));

drop index if exists public.ems_stock_transactions_daily_order_item_idx;
create index if not exists ems_stock_transactions_daily_order_item_id_fkey_idx
  on public.ems_stock_transactions(daily_order_item_id);

create index if not exists ems_audit_log_actor_user_id_fkey_idx on public.ems_audit_log(actor_user_id);
create index if not exists ems_daily_order_items_product_id_fkey_idx on public.ems_daily_order_items(product_id);
create index if not exists ems_daily_orders_approved_by_fkey_idx on public.ems_daily_orders(approved_by);
create index if not exists ems_daily_orders_issued_by_fkey_idx on public.ems_daily_orders(issued_by);
create index if not exists ems_document_register_uploaded_by_fkey_idx on public.ems_document_register(uploaded_by);
create index if not exists ems_explosive_products_approved_by_fkey_idx on public.ems_explosive_products(approved_by);
create index if not exists ems_explosive_products_created_by_fkey_idx on public.ems_explosive_products(created_by);
create index if not exists ems_explosive_products_submitted_by_fkey_idx on public.ems_explosive_products(submitted_by);
create index if not exists ems_incidents_reported_by_fkey_idx on public.ems_incidents(reported_by);
create index if not exists ems_incidents_reviewed_by_fkey_idx on public.ems_incidents(reviewed_by);
create index if not exists ems_inspections_inspector_id_fkey_idx on public.ems_inspections(inspector_id);
create index if not exists ems_inspections_verified_by_fkey_idx on public.ems_inspections(verified_by);
create index if not exists ems_magazine_responsible_user_id_fkey_idx on public.ems_magazine(responsible_user_id);
create index if not exists ems_magazine_access_log_logged_by_fkey_idx on public.ems_magazine_access_log(logged_by);
create index if not exists ems_profiles_created_by_fkey_idx on public.ems_profiles(created_by);
create index if not exists ems_purchase_deliveries_received_by_fkey_idx on public.ems_purchase_deliveries(received_by);
create index if not exists ems_purchase_delivery_items_delivery_id_fkey_idx on public.ems_purchase_delivery_items(delivery_id);
create index if not exists ems_purchase_order_approvals_actioned_by_fkey_idx on public.ems_purchase_order_approvals(actioned_by);
create index if not exists ems_purchase_order_items_product_id_fkey_idx on public.ems_purchase_order_items(product_id);
create index if not exists ems_purchase_orders_requested_by_fkey_idx on public.ems_purchase_orders(requested_by);
create index if not exists ems_shift_handovers_handed_over_by_fkey_idx on public.ems_shift_handovers(handed_over_by);
create index if not exists ems_shift_handovers_received_by_fkey_idx on public.ems_shift_handovers(received_by);
create index if not exists ems_stock_transactions_approved_by_fkey_idx on public.ems_stock_transactions(approved_by);
create index if not exists ems_stock_transactions_created_by_fkey_idx on public.ems_stock_transactions(created_by);
create index if not exists ems_stock_transactions_posted_by_fkey_idx on public.ems_stock_transactions(posted_by);
create index if not exists ems_stocktakes_counted_by_fkey_idx on public.ems_stocktakes(counted_by);
create index if not exists ems_stocktakes_product_id_fkey_idx on public.ems_stocktakes(product_id);
create index if not exists ems_stocktakes_verified_by_fkey_idx on public.ems_stocktakes(verified_by);

drop index if exists public.ems_transactions_status_idx;
