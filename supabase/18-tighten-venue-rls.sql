-- ============================================================
-- HauntLog — Step 14 migration
-- Tighten locations update RLS
-- ============================================================
-- Step 1 created `locations_update_authenticated` which allowed any
-- signed-in user to update any location row. That was acceptable when
-- locations were collaboratively edited like a wiki, but now that
-- verified venues are owned by claiming teams, it's too loose.
--
-- We drop the wide-open policy. The narrower
-- `locations_update_managers` from step 11 (which lets admins or a
-- verified team's owner/admin update) is now the only path.
-- ============================================================

drop policy if exists locations_update_authenticated on public.locations;

-- (locations_update_managers, from step 11, remains in place.)
