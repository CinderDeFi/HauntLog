-- ============================================================
-- HauntLog — Step 20: venue-photos bucket
-- ============================================================
-- A public bucket for venue hero images. Each location manager
-- (any role on `location_managers`) can upload/delete photos
-- under their venue's id-prefixed folder.
--
-- Path layout: `{location_id}/hero-{uuid}.jpg`
--
-- *** MANUAL STEP REQUIRED FIRST ***
-- Create the bucket in the Supabase dashboard:
--   1. Project → Storage → New bucket
--   2. Name: `venue-photos`
--   3. Public bucket: ON  (so hero images load on venue pages)
--   4. File size limit: 6 MB
--   5. Allowed MIME types: image/jpeg, image/png, image/webp
--   6. Create
-- ============================================================

-- READ: public bucket — everyone (including anon) can read.
drop policy if exists venue_photos_read on storage.objects;
create policy venue_photos_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'venue-photos');

-- INSERT: any location manager of the venue (the folder name is the
-- location_id) can upload.
drop policy if exists venue_photos_insert on storage.objects;
create policy venue_photos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'venue-photos'
    and exists (
      select 1 from public.location_managers lm
      where lm.location_id = (storage.foldername(name))[1]
        and lm.user_id = auth.uid()
    )
  );

-- DELETE: same — any manager can clean up photos for their venue.
drop policy if exists venue_photos_delete on storage.objects;
create policy venue_photos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'venue-photos'
    and exists (
      select 1 from public.location_managers lm
      where lm.location_id = (storage.foldername(name))[1]
        and lm.user_id = auth.uid()
    )
  );

-- UPDATE: usually not needed (every upload writes a new uuid file), but
-- supports upsert flows.
drop policy if exists venue_photos_update on storage.objects;
create policy venue_photos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'venue-photos'
    and exists (
      select 1 from public.location_managers lm
      where lm.location_id = (storage.foldername(name))[1]
        and lm.user_id = auth.uid()
    )
  );

-- ============================================================
-- DIAGNOSTIC: verify policies installed by running this in the SQL
-- editor:
--
--   select polname, polcmd
--   from pg_policy
--   where polrelid = 'storage.objects'::regclass
--     and polname like 'venue_photos_%'
--   order by polname;
--
-- You should see 4 rows.
-- ============================================================
