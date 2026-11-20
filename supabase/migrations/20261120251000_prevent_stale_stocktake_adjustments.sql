create index if not exists ems_stocktakes_adjustment_transaction_id_idx
  on public.ems_stocktakes(adjustment_transaction_id)
  where adjustment_transaction_id is not null;

create or replace function app_private.review_ems_stocktake(p_stocktake_id uuid,p_decision text,p_notes text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text := app_private.current_role()::text;
  v_row public.ems_stocktakes%rowtype;
  v_product public.ems_explosive_products%rowtype;
  v_current numeric;
  v_name text;
  v_tx_id uuid;
begin
  if v_user is null or not app_private.is_active_user() then raise exception 'An active EMS profile is required.'; end if;
  if v_role not in ('admin','management') then raise exception 'Only Management or the Administrator may review a stocktake.'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Choose approve or reject.'; end if;
  select * into v_row from public.ems_stocktakes where id=p_stocktake_id for update;
  if not found then raise exception 'Stocktake record not found.'; end if;
  if v_row.status <> 'pending_verification' then raise exception 'This stocktake has already been reviewed.'; end if;
  if v_row.counted_by=v_user then raise exception 'The person who counted the stock cannot approve their own count.'; end if;
  if v_row.variance <> 0 and nullif(btrim(p_notes),'') is null then raise exception 'Management notes are required for a stock variance.'; end if;
  select full_name into v_name from public.ems_profiles where user_id=v_user and is_active=true;
  if p_decision='reject' then
    update public.ems_stocktakes set status='rejected',verified_by=v_user,verified_by_name=v_name,verified_at=now(),
      verification_notes=nullif(btrim(p_notes),''),approval_notes=nullif(btrim(p_notes),'') where id=p_stocktake_id;
    return;
  end if;
  if v_row.variance=0 then
    update public.ems_stocktakes set status='verified',verified_by=v_user,verified_by_name=v_name,verified_at=now(),
      verification_notes=nullif(btrim(p_notes),''),approval_notes=nullif(btrim(p_notes),'') where id=p_stocktake_id;
    return;
  end if;
  select * into v_product from public.ems_explosive_products where id=v_row.product_id for update;
  if not found or not v_product.is_active or v_product.approval_status<>'approved' then
    raise exception 'The registered product is no longer active and approved.';
  end if;
  select coalesce(sum(case
    when t.transaction_type in ('receipt','return') then coalesce(nullif(t.unit_quantity,0),t.quantity,0)
    when t.transaction_type='issue' then -coalesce(nullif(t.unit_quantity,0),t.quantity,0)
    when t.transaction_type='adjustment' and t.adjustment_direction='increase' then coalesce(nullif(t.unit_quantity,0),t.quantity,0)
    else -coalesce(nullif(t.unit_quantity,0),t.quantity,0)
  end),0) into v_current
  from public.ems_stock_transactions t
  where t.product_id=v_row.product_id and t.status='posted'
    and coalesce(t.control_book_section,v_product.control_book_section)=coalesce(v_row.control_book_section,'');
  if v_current is distinct from v_row.system_balance then
    raise exception 'Stock movements were posted after this count. Record a fresh physical count before approving the variance.';
  end if;
  insert into public.ems_stock_transactions(transaction_type,status,product_id,quantity,unit_quantity,package_quantity,transaction_date,reference_number,notes,created_by,approved_by,approved_at,posted_by,posted_at,adjustment_direction,control_book_section)
  values('adjustment','posted',v_row.product_id,abs(v_row.variance),abs(v_row.variance),0,(v_row.count_date::timestamp at time zone 'Africa/Johannesburg'),
    'STOCKTAKE-'||v_row.stocktake_number,'Approved stocktake variance. '||coalesce(nullif(btrim(p_notes),''),''),v_user,v_user,now(),v_user,now(),
    case when v_row.variance>0 then 'increase' else 'decrease' end,v_row.control_book_section)
  returning id into v_tx_id;
  update public.ems_stocktakes set status='adjustment_posted',verified_by=v_user,verified_by_name=v_name,verified_at=now(),
    verification_notes=nullif(btrim(p_notes),''),approval_notes=nullif(btrim(p_notes),''),adjustment_transaction_id=v_tx_id,adjustment_posted_at=now()
  where id=p_stocktake_id;
end;
$$;
revoke all on function app_private.review_ems_stocktake(uuid,text,text) from public,anon;
grant execute on function app_private.review_ems_stocktake(uuid,text,text) to authenticated;