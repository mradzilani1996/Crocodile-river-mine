-- Private document storage for the Crocodile River Mine EMS document register.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ems-documents',
  'ems-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active EMS users read controlled documents" on storage.objects;
create policy "Active EMS users read controlled documents"
on storage.objects for select to authenticated
using (bucket_id = 'ems-documents' and app_private.is_active_user());

drop policy if exists "Management upload controlled documents" on storage.objects;
create policy "Management upload controlled documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role)
);

drop policy if exists "Management update controlled documents" on storage.objects;
create policy "Management update controlled documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role)
)
with check (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role)
);

drop policy if exists "Management delete controlled documents" on storage.objects;
create policy "Management delete controlled documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role)
);