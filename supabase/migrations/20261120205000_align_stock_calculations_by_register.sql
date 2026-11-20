create or replace function app_private.enforce_nonnegative_ems_stock()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_units numeric; v_packages numeric; v_sign numeric; v_section text;
begin
  if tg_op <> 'UPDATE' or old.status = 'posted' or new.status <> 'posted' then return new; end if;
  select p.control_book_section into v_section from public.ems_explosive_products p where p.id=new.product_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if not exists(select 1 from public.ems_explosive_products p where p.id=new.product_id and p.is_active=true and p.approval_status='approved') then
    raise exception 'Only approved and active products can be posted to stock.';
  end if;
  v_section := coalesce(new.control_book_section,v_section);
  select
    coalesce(sum(case when t.transaction_type in ('receipt','return') then coalesce(t.unit_quantity,t.quantity)
      when t.transaction_type='issue' then -coalesce(t.unit_quantity,t.quantity)
      when t.adjustment_direction='increase' then coalesce(t.unit_quantity,t.quantity)
      else -coalesce(t.unit_quantity,t.quantity) end),0),
    coalesce(sum(case when t.transaction_type in ('receipt','return') then coalesce(t.package_quantity,0)
      when t.transaction_type='issue' then -coalesce(t.package_quantity,0)
      when t.adjustment_direction='increase' then coalesce(t.package_quantity,0)
      else -coalesce(t.package_quantity,0) end),0)
  into v_units,v_packages
  from public.ems_stock_transactions t
  where t.product_id=new.product_id and t.status='posted' and t.id<>new.id
    and (t.control_book_section=v_section or
      (t.control_book_section is null and v_section=(select p.control_book_section from public.ems_explosive_products p where p.id=new.product_id)));
  v_sign := case when new.transaction_type in ('receipt','return') then 1 when new.transaction_type='issue' then -1
    when new.adjustment_direction='increase' then 1 else -1 end;
  if v_units+v_sign*coalesce(new.unit_quantity,new.quantity)<0 then
    raise exception 'Insufficient stock in the selected register section. Available: %, requested: %.',v_units,coalesce(new.unit_quantity,new.quantity);
  end if;
  if v_packages+v_sign*coalesce(new.package_quantity,0)<0 then
    raise exception 'Insufficient package balance in the selected register section. Available: %, requested: %.',v_packages,coalesce(new.package_quantity,0);
  end if;
  return new;
end;
$function$;

create or replace function public.ems_record_purchase_delivery(
  p_order_id uuid,p_supplier_delivery_note text,p_received_date date,p_notes text,p_lines jsonb
) returns uuid language plpgsql set search_path to 'public','app_private'
as $function$
declare
  v_role text:=app_private.current_role()::text; v_status text; v_delivery_id uuid; v_line jsonb;
  v_order_item_id uuid; v_qty numeric; v_remaining numeric; v_all_received boolean; v_actor_name text;
  v_product_id uuid; v_item_description text; v_unit text; v_section text; v_order_number bigint;
  v_supplier_name text; v_product_name text;
begin
  if not app_private.is_active_user() or v_role not in ('admin','magazine_master') then raise exception 'Only the Magazine Master or administrator can record supplier deliveries.'; end if;
  select full_name into v_actor_name from public.ems_profiles where user_id=auth.uid() and is_active=true;
  if v_actor_name is null then raise exception 'Active EMS profile not found.'; end if;
  if nullif(btrim(p_supplier_delivery_note),'') is null then raise exception 'Supplier delivery note reference is required.'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Enter at least one received quantity.'; end if;
  select status,order_number,supplier_name into v_status,v_order_number,v_supplier_name from public.ems_purchase_orders where id=p_order_id for update;
  if v_status not in ('approved','ordered','partially_delivered') then raise exception 'This order is not ready to receive a delivery.'; end if;
  insert into public.ems_purchase_deliveries(order_id,supplier_delivery_note,received_date,received_by,received_by_name,notes)
    values(p_order_id,btrim(p_supplier_delivery_note),coalesce(p_received_date,current_date),auth.uid(),v_actor_name,nullif(btrim(p_notes),'')) returning id into v_delivery_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_order_item_id:=(v_line->>'order_item_id')::uuid; v_qty:=nullif(v_line->>'quantity_received','')::numeric;
    if v_qty is null or v_qty<=0 then raise exception 'Received quantities must be greater than zero.'; end if;
    select oi.quantity-coalesce(sum(di.quantity_received),0) into v_remaining
      from public.ems_purchase_order_items oi
      left join public.ems_purchase_deliveries d on d.order_id=oi.order_id
      left join public.ems_purchase_delivery_items di on di.delivery_id=d.id and di.order_item_id=oi.id
      where oi.id=v_order_item_id and oi.order_id=p_order_id group by oi.quantity;
    if v_remaining is null then raise exception 'A delivery line does not belong to this purchase order.'; end if;
    if v_qty>v_remaining then raise exception 'Received quantity exceeds the outstanding quantity for an order line.'; end if;
    select oi.product_id,oi.item_description,oi.unit_of_measure,p.control_book_section
      into v_product_id,v_item_description,v_unit,v_section
      from public.ems_purchase_order_items oi join public.ems_explosive_products p on p.id=oi.product_id
      where oi.id=v_order_item_id and oi.order_id=p_order_id;
    if v_product_id is null then raise exception 'Link every delivered inventory line to an approved product in the Explosives Inventory before recording delivery.'; end if;
    select product_name into v_product_name from public.ems_explosive_products where id=v_product_id and is_active=true and approval_status='approved';
    if v_product_name is null then raise exception 'Purchase order line % is linked to a product that is not approved and active.',v_item_description; end if;
    if v_section not in ('Boxes','Bags','Tamping') then raise exception 'The linked product must have an approved Boxes, Bags or Tamping register section.'; end if;
    insert into public.ems_purchase_delivery_items(delivery_id,order_item_id,quantity_received,notes)
      values(v_delivery_id,v_order_item_id,v_qty,nullif(btrim(v_line->>'notes'), ''));
    insert into public.ems_stock_transactions(
      transaction_type,product_id,quantity,unit_quantity,package_quantity,transaction_date,reference_number,
      source_or_destination,purpose,notes,created_by,control_book_section,item_type,item_description,adjustment_direction,status
    ) values(
      'receipt',v_product_id,v_qty,v_qty,0,coalesce(p_received_date,current_date)::timestamp with time zone+interval '12 hours',
      btrim(p_supplier_delivery_note),v_supplier_name,'Supplier delivery receipt for PO-'||v_order_number,
      concat_ws(' · ',nullif(btrim(p_notes),''),nullif(btrim(v_line->>'notes'),''),'Purchase delivery record '||v_delivery_id),
      auth.uid(),v_section,v_unit,v_item_description,'increase','pending_approval'
    );
  end loop;
  select bool_and(oi.quantity<=coalesce((select sum(di.quantity_received) from public.ems_purchase_deliveries d
    join public.ems_purchase_delivery_items di on di.delivery_id=d.id where d.order_id=p_order_id and di.order_item_id=oi.id),0))
    into v_all_received from public.ems_purchase_order_items oi where oi.order_id=p_order_id;
  update public.ems_purchase_orders set status=case when v_all_received then 'delivered' else 'partially_delivered' end,updated_at=now() where id=p_order_id;
  return v_delivery_id;
end;
$function$;

revoke all on function public.ems_record_purchase_delivery(uuid,text,date,text,jsonb) from public,anon;
grant execute on function public.ems_record_purchase_delivery(uuid,text,date,text,jsonb) to authenticated;
