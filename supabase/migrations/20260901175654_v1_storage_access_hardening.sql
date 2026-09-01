-- v1 release hardening: prevent anonymous public uploads and public patient habit photos.

-- Brand/content assets remain publicly readable, but uploads require an authenticated session
-- and are constrained to expected image formats and a bounded size.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'assets';

drop policy if exists "Public Upload" on storage.objects;
create policy "Authenticated asset upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'assets');

-- Habit photos may contain patient lifestyle/health information and must not be public.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic']::text[]
where id = 'habit-photos';

drop policy if exists "habit_photos_public_read" on storage.objects;
drop policy if exists "habit_photos_upload" on storage.objects;
drop policy if exists "habit_photos_delete_own" on storage.objects;

create policy "habit_photos_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'habit-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "habit_photos_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'habit-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "habit_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'habit-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
