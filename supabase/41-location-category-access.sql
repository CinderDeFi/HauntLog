-- ============================================================
-- HauntLog — Step 41: category + access on locations
-- ============================================================
-- Adds two nullable filter columns used by the 325-venue catalog
-- import (hauntlog_locations_import.csv). Run AFTER 01–40 and after
-- the profiles privilege-escalation fix.
--
--   category : building type   (e.g. 'Prison / Jail', 'Hotel / Inn')
--   access   : how you can visit (e.g. 'Overnight investigations',
--              'Public tours', 'Restricted — off-limits')
--
-- Both are plain text with a controlled vocabulary enforced in the
-- app, not the DB, so new values don't need a migration.
-- ============================================================

alter table public.locations
  add column if not exists category text,
  add column if not exists access   text;

-- Optional: index if you'll filter the map by these often.
create index if not exists locations_category_idx on public.locations (category);
create index if not exists locations_access_idx   on public.locations (access);

-- RLS: no new policies needed. These columns ride on the existing
-- locations row policies (public read of all locations, etc.).

-- Verify:
--   select column_name from information_schema.columns
--   where table_name = 'locations' and column_name in ('category','access');
