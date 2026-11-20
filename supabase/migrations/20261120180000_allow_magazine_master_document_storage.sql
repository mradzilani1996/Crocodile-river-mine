-- Allow active Magazine Masters, in addition to Admin and Management, to manage private controlled documents.
drop policy if exists "Management upload controlled documents" on storage.objects;
create policy "Management upload controlled documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role, 'magazine_master'::ems_user_role)
);

drop policy if exists "Management update controlled documents" on storage.objects;
create policy "Management update controlled documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role, 'magazine_master'::ems_user_role)
)
with check (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role, 'magazine_master'::ems_user_role)
);

drop policy if exists "Management delete controlled documents" on storage.objects;
create policy "Management delete controlled documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ems-documents'
  and app_private.is_active_user()
  and app_private.current_role() in ('admin'::ems_user_role, 'management'::ems_user_role, 'magazine_master'::ems_user_role)
);