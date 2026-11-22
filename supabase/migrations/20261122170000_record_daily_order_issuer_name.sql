alter table public.ems_daily_orders add column if not exists issuer_name text;
alter table public.ems_stock_transactions add column if not exists issuer_name text;

create or replace function public.ems_set_daily_order_issuer(p_order_id uuid, p_issuer_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.ems_daily_orders%rowtype;
  v_role text := app_private.current_role()::text;
begin
  if auth.uid() is null or not app_private.is_active_user() then
    raise exception 'An active EMS profile is required.';
  end if;
  if v_role not in ('admin','magazine_master','issuer') then
    raise exception 'Only the Magazine Master, Issuer or Administrator can record the issuer name.';
  end if;
  if nullif(btrim(p_issuer_name),'') is null then
    raise exception 'Enter the full name of the person issuing the explosives.';
  end if;
  select * into v_order from public.ems_daily_orders where id=p_order_id for update;
  if not found or v_order.status not in ('approved','issued_pending_posting') then
    raise exception 'Only an approved daily request can have an issuer assigned.';
  end if;
  if v_role <> 'admin' and v_order.requested_by=auth.uid() then
    raise exception 'The person who requested the explosives cannot issue the same request.';
  end if;
  update public.ems_daily_orders set issuer_name=btrim(p_issuer_name) where id=p_order_id;
end;
$$;
revoke all on function public.ems_set_daily_order_issuer(uuid,text) from public, anon;
grant execute on function public.ems_set_daily_order_issuer(uuid,text) to authenticated;

create or replace function app_private.ems_copy_daily_order_issuer_to_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.daily_order_item_id is not null then
    select o.issuer_name into new.issuer_name
    from public.ems_daily_order_items i
    join public.ems_daily_orders o on o.id=i.order_id
    where i.id=new.daily_order_item_id;
  end if;
  return new;
end;
$$;
drop trigger if exists ems_stock_copy_daily_order_issuer on public.ems_stock_transactions;
create trigger ems_stock_copy_daily_order_issuer
before insert on public.ems_stock_transactions
for each row execute function app_private.ems_copy_daily_order_issuer_to_stock();
