-- ============================================================
-- One-time consolidation — corrected for the real venue id
-- ============================================================
-- Target row: my-haunted-manor-samuel-miller-mansion
-- (your existing venue you can see in the Atlas)
--
-- This script:
--   1. Verifies the target row exists (fails loudly if not)
--   2. Applies all rich profile fields from the Samuel Miller seed
--      to your existing row, sets verified=true and claim_status='verified'
--   3. Moves zones from the duplicate samuel-miller-mansion seed
--      to your existing row
--   4. Deletes the duplicate samuel-miller-mansion row
--
-- Run the whole thing as one block in the Supabase SQL Editor.
-- ============================================================

do $$
declare
  target_id text := 'my-haunted-manor-samuel-miller-mansion';
  duplicate_id text := 'samuel-miller-mansion';
  target_exists boolean;
begin
  -- Guard: confirm the row we're updating actually exists.
  select exists(select 1 from public.locations where id = target_id)
    into target_exists;

  if not target_exists then
    raise exception 'Target row % does not exist in locations. '
      'Check your Atlas — the venue id may have changed.', target_id;
  end if;

  -- 1. Apply rich profile fields to your existing row.
  update public.locations set
    tagline          = 'Home of My Haunted Manor USA',
    built_year       = 1804,
    description      = 'Built in 1804 by Samuel Miller for his family, this Columbia, PA landmark has served as a feed mill, a toy shop, and now a print shop. The building has documented ties to the Underground Railroad, and the My Haunted Manor team has produced extensive evidence linked to the surrounding folklore of Chickies Rock. Investigate your way — the entire manor is yours overnight, with 24/7 surveillance and the full team''s documented evidence to compare against.',
    operating_window = 'PRIVATE BOOKINGS · 7PM – 7AM',
    features         = array['24/7 LIVE CAMERAS', 'CONTENT CREATORS WELCOME'],
    youtube_url      = 'https://www.youtube.com/@MyHauntedManorUSA',
    instagram_url    = 'https://instagram.com/myhauntedproject',
    facebook_url     = 'https://facebook.com/SamuelMillerMansion',
    claim_status     = 'verified',
    verified         = true,                 -- legacy flag, what Atlas reads
    pricing          = '{
      "currency": "USD",
      "tiers": [
        {"label": "FRI – SAT", "price": 550, "subtitle": "up to 10 guests"},
        {"label": "SUN – THU", "price": 400, "subtitle": "up to 10 guests · weeknight", "promo": "SAVE $150"}
      ],
      "fine_print": "+$50 per additional guest over 10 · 7-day cancel or reschedule policy"
    }'::jsonb,
    updated_at       = now()
  where id = target_id;

  raise notice 'Updated row %', target_id;

  -- 2. Move zones from the duplicate seed to your row. The duplicate
  --    may or may not exist depending on whether you ran the original
  --    step 11 seed first.
  if exists(select 1 from public.locations where id = duplicate_id) then
    update public.location_zones
      set location_id = target_id
      where location_id = duplicate_id;
    raise notice 'Moved zones from % to %', duplicate_id, target_id;

    delete from public.locations where id = duplicate_id;
    raise notice 'Deleted duplicate row %', duplicate_id;
  else
    raise notice 'No duplicate seed row to clean up.';
  end if;
end $$;

-- Sanity check — should return your row with verified=true and 2 pricing tiers.
select id, name, claim_status, verified,
       jsonb_array_length(pricing -> 'tiers') as tier_count,
       (select count(*) from public.location_zones z where z.location_id = l.id) as zones
from public.locations l
where id = 'my-haunted-manor-samuel-miller-mansion';
