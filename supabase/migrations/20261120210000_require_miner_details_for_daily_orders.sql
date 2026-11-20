-- Capture the miner receiving the explosives on each daily request.
alter table public.ems_daily_orders
  add column if not exists miner_name text,
  add column if not exists miner_company_number text;

drop function if exists public.ems_submit_daily_order(date,text,text,text,text,jsonb);

create or replace function public.ems_submit_daily_order(
  p_order_date date,
  p_shift text,
  p_work_area text,
  p_blast_site text,
  p_purpose text,
  p_items jsonb,
  p_miner_name text,
  p_miner_company_number text
)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_order_id uuid;
  v_requester_name text;
  v_item jsonb;
begin
  if auth.uid() is null or not app_private.is_active_user() then
    raise exception 'An active EMS profile is required.';
  end if;
  if p_shift not in ('day','night') then
    raise exception 'Select a valid shift.';
  end if;
  if length(trim(coalesce(p_work_area,''))) = 0 or length(trim(coalesce(p_purpose,''))) = 0 then
    raise exception 'Work area and purpose are required.';
  end if;
  if length(trim(coalesce(p_miner_name,''))) = 0 or length(trim(coalesce(p_miner_company_number,''))) = 0 then
    raise exception 'Enter the miner name and company number for the person who needs the explosives.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one explosive product to the order.';
  end if;

  select full_name into v_requester_name
  from public.ems_profiles
  where user_id = auth.uid() and is_active = true;

  insert into public.ems_daily_orders (
    order_date, shift, work_area, blast_site, requested_by, requester_name, purpose,
    miner_name, miner_company_number
  ) values (
    p_order_date, p_shift, trim(p_work_area), nullif(trim(coalesce(p_blast_site,'')), ''),
    auth.uid(), v_requester_name, trim(p_purpose),
    trim(p_miner_name), trim(p_miner_company_number)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.ems_daily_order_items(order_id, product_id, quantity_requested, notes)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity_requested')::numeric,
      nullif(trim(coalesce(v_item->>'notes','')), '')
    );
  end loop;
  return v_order_id;
end;
$function$;

revoke all on function public.ems_submit_daily_order(date,text,text,text,text,jsonb,text,text) from public;
grant execute on function public.ems_submit_daily_order(date,text,text,text,text,jsonb,text,text) to authenticated;
