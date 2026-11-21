-- Transaction evidence attachments and immutable authenticated approval acknowledgements.
create table if not exists public.ems_transaction_attachments (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null check (entity_type in ('stock_transaction','purchase_order','daily_order','stocktake','explosive_product','incident','inspection')),
 entity_id uuid not null,
 file_name text not null,
 storage_path text not null unique,
 mime_type text not null,
 file_size bigint not null check (file_size > 0 and file_size <= 26214400),
 uploaded_by uuid not null references auth.users(id),
 uploaded_by_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists ems_transaction_attachments_entity_idx on public.ems_transaction_attachments(entity_type,entity_id,created_at desc);
alter table public.ems_transaction_attachments enable row level security;
drop policy if exists "Active EMS users read transaction attachments" on public.ems_transaction_attachments;
create policy "Active EMS users read transaction attachments" on public.ems_transaction_attachments for select to authenticated using (app_private.is_active_user());
drop policy if exists "Active EMS users upload transaction attachments" on public.ems_transaction_attachments;
create policy "Active EMS users upload transaction attachments" on public.ems_transaction_attachments for insert to authenticated with check (app_private.is_active_user() and uploaded_by=auth.uid() and exists(select 1 from public.ems_profiles p where p.user_id=auth.uid() and p.is_active and p.full_name=uploaded_by_name));
drop policy if exists "Active EMS users upload evidence files" on storage.objects;
create policy "Active EMS users upload evidence files" on storage.objects for insert to authenticated with check (bucket_id='ems-documents' and app_private.is_active_user() and (storage.foldername(name))[1]=auth.uid()::text);

create table if not exists public.ems_approval_acknowledgements (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null check (entity_type in ('stock_transaction','purchase_order','daily_order','stocktake','explosive_product','incident','inspection')),
 entity_id uuid not null,
 approval_stage text not null check (approval_stage in ('shift_boss','mine_manager','admin','management_review','verification')),
 decision text not null check (decision in ('approved','rejected','reviewed','closed')),
 actor_id uuid not null references auth.users(id),
 actor_name text not null,
 actor_role text not null,
 acknowledgement_text text not null default 'I confirm that I have reviewed this transaction and its supporting evidence, and I personally authorise the recorded decision.',
 comments text,
 signature_method text not null default 'authenticated_user_confirmation' check (signature_method='authenticated_user_confirmation'),
 acknowledged_at timestamptz not null default now()
);
create index if not exists ems_approval_ack_entity_idx on public.ems_approval_acknowledgements(entity_type,entity_id,acknowledged_at desc);
alter table public.ems_approval_acknowledgements enable row level security;
drop policy if exists "Active EMS users read approval acknowledgements" on public.ems_approval_acknowledgements;
create policy "Active EMS users read approval acknowledgements" on public.ems_approval_acknowledgements for select to authenticated using (app_private.is_active_user());

create or replace function public.ems_record_approval_acknowledgement(p_entity_type text,p_entity_id uuid,p_approval_stage text,p_decision text,p_comments text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_name text; v_role text; v_id uuid;
begin
 if not app_private.is_active_user() then raise exception 'An active EMS profile is required.'; end if;
 select full_name,role::text into v_name,v_role from public.ems_profiles where user_id=auth.uid() and is_active=true;
 if v_name is null then raise exception 'Active EMS profile not found.'; end if;
 if p_entity_type not in ('stock_transaction','purchase_order','daily_order','stocktake','explosive_product','incident','inspection') then raise exception 'Unsupported approval record type.'; end if;
 if p_decision not in ('approved','rejected','reviewed','closed') then raise exception 'Unsupported approval decision.'; end if;
 if p_approval_stage='shift_boss' and v_role not in ('authorising_officer','admin') then raise exception 'Only an authorised Shiftboss or Admin can acknowledge this stage.';
 elsif p_approval_stage='mine_manager' and v_role not in ('management','admin') then raise exception 'Only Management or Admin can acknowledge this stage.';
 elsif p_approval_stage in ('admin','management_review','verification') and v_role not in ('management','admin') then raise exception 'Your EMS role cannot acknowledge this action.';
 elsif p_approval_stage not in ('shift_boss','mine_manager','admin','management_review','verification') then raise exception 'Unsupported approval stage.'; end if;
 insert into public.ems_approval_acknowledgements(entity_type,entity_id,approval_stage,decision,actor_id,actor_name,actor_role,comments)
 values(p_entity_type,p_entity_id,p_approval_stage,p_decision,auth.uid(),v_name,v_role,nullif(btrim(p_comments),'')) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.ems_record_approval_acknowledgement(text,uuid,text,text,text) from public,anon;
grant execute on function public.ems_record_approval_acknowledgement(text,uuid,text,text,text) to authenticated;
create or replace function public.ems_prevent_evidence_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Evidence and approval acknowledgements are immutable and cannot be changed or deleted.'; end; $$;
drop trigger if exists ems_approval_ack_immutable on public.ems_approval_acknowledgements;
create trigger ems_approval_ack_immutable before update or delete on public.ems_approval_acknowledgements for each row execute function public.ems_prevent_evidence_mutation();
