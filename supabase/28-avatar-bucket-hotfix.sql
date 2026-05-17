-- ============================================================
-- HauntLog — Step 19 HOTFIX: avatar storage policies
-- ============================================================
-- The original step 19 policies used string_to_array() and weren't
-- scoped to the `authenticated` role. This caused "new row violates
-- row-level security policy" errors on upload.
--
-- This migration replaces them with the canonical Supabase pattern:
--   (storage.foldername(name))[1] = auth.uid()::text
-- and properly scopes everything to the `authenticated` role.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- READ: avatars bucket is public; let everyone (including anon) read.
drop policy if exists avatars_storage_read on storage.objects;
create policy avatars_storage_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- INSERT (own user folder): authenticated users can upload to a folder
-- named after their auth.uid().
drop policy if exists avatars_storage_insert_self on storage.objects;
create policy avatars_storage_insert_self
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT (team folder): authenticated users can upload to a folder
-- named after a team's uuid, if they're an owner of that team.
drop policy if exists avatars_storage_insert_team on storage.objects;
create policy avatars_storage_insert_team
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- DELETE (own user folder)
drop policy if exists avatars_storage_delete_self on storage.objects;
create policy avatars_storage_delete_self
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE (team folder)
drop policy if exists avatars_storage_delete_team on storage.objects;
create policy avatars_storage_delete_team
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1 from public.team_members tm
      where tm.team_id::text = (storage.foldername(name))[1]
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- UPDATE (own user folder) — for upsert support if needed later
drop policy if exists avatars_storage_update_self on storage.objects;
create policy avatars_storage_update_self
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- DIAGNOSTIC: after running this, verify policies exist by running
-- this query in the SQL editor:
--
--   select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
--                  pg_get_expr(polwithcheck, polrelid) as check_expr
--   from pg_policy
--   where polrelid = 'storage.objects'::regclass
--     and polname like 'avatars_storage_%'
--   order by polname;
--
-- You should see 6 rows.
-- ============================================================
