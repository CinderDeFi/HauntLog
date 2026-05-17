-- ============================================================
-- HauntLog — Step 19 migration
-- Avatar upload (profile + team logos)
-- ============================================================
-- One bucket: `avatars` (PUBLIC, since avatars are visible to
-- everyone who can see the profile/team they belong to).
--
-- Path layout: `{owner_id}/{photo_uuid}.jpg`
--   - For user profile avatars: owner_id = auth.uid()::text
--   - For team logos: owner_id = team.id::text (uuid)
--
-- *** ONE MANUAL STEP REQUIRED BEFORE RUNNING THIS SQL ***
-- Create a Storage bucket named `avatars` in the Supabase dashboard:
--   1. Project → Storage → New bucket
--   2. Name: `avatars`
--   3. Public bucket: ON  (avatars are public)
--   4. File size limit: 2 MB
--   5. Allowed MIME types: image/jpeg, image/png, image/webp
--   6. Create
-- ============================================================

-- Storage policies — apply only if storage schema exists (will be true
-- on Supabase production; may not be locally).
do $$ begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found; skipping avatar storage policies';
    return;
  end if;

  -- READ: avatars bucket is public, so everyone (including anon) can read.
  execute $sql$
    drop policy if exists avatars_storage_read on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_read on storage.objects
      for select using (bucket_id = 'avatars');
  $sql$;

  -- INSERT: a user can upload to their own user-id prefix, OR to a team
  -- prefix where they're an owner. Two policies (one for each case) to
  -- keep them readable.
  execute $sql$
    drop policy if exists avatars_storage_insert_self on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_insert_self on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (string_to_array(name, '/'))[1] = auth.uid()::text
      );
  $sql$;

  execute $sql$
    drop policy if exists avatars_storage_insert_team on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_insert_team on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (string_to_array(name, '/'))[1]
            and tm.user_id = auth.uid()
            and tm.role = 'owner'
        )
      );
  $sql$;

  -- DELETE: same logic as insert. A user can delete avatars under their
  -- own prefix, OR under a team they own.
  execute $sql$
    drop policy if exists avatars_storage_delete_self on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_delete_self on storage.objects
      for delete using (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (string_to_array(name, '/'))[1] = auth.uid()::text
      );
  $sql$;

  execute $sql$
    drop policy if exists avatars_storage_delete_team on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_delete_team on storage.objects
      for delete using (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and exists (
          select 1 from public.team_members tm
          where tm.team_id::text = (string_to_array(name, '/'))[1]
            and tm.user_id = auth.uid()
            and tm.role = 'owner'
        )
      );
  $sql$;

  -- UPDATE: storage allows MIME-type changes etc. Lock down with same
  -- logic. (Rarely used in practice but keeps the surface tight.)
  execute $sql$
    drop policy if exists avatars_storage_update_self on storage.objects;
  $sql$;
  execute $sql$
    create policy avatars_storage_update_self on storage.objects
      for update using (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (string_to_array(name, '/'))[1] = auth.uid()::text
      );
  $sql$;
end $$;
