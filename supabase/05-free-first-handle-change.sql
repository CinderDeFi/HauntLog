-- ============================================================
-- HauntLog — Step 3.5 fix: free one-time handle change
-- ============================================================
-- Reset handle_changed_at back to NULL for users whose handle still
-- matches their auto-generated default (i.e. they never changed it).
-- After this runs, anyone with their original handle gets one free
-- change. Anyone who already changed their handle keeps the cooldown.
--
-- Heuristic: if handle_changed_at equals created_at (the backfill
-- value), we know they never actually changed it.
-- ============================================================

update public.profiles
  set handle_changed_at = null
  where handle_changed_at is not null
    and handle_changed_at = created_at;
