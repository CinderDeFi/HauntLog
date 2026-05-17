-- ============================================================
-- One-time consolidation
-- ============================================================
-- Apply the Samuel Miller Mansion rich profile data to your
-- EXISTING `my-haunted-manor-usa` row (the one you can see in the
-- Atlas), then remove the duplicate seed row created by step 11.
--
-- After this runs:
--   - /app/atlas/venue/my-haunted-manor-usa  → still works (legacy page)
--   - /v/my-haunted-manor-usa                → rich profile (NEW)
--   - Atlas pin → routes to /v/my-haunted-manor-usa (because verified=true)
-- ============================================================

begin;

-- 1. Apply all rich profile fields to your existing row.
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
  verified         = true,
  pricing          = '{
    "currency": "USD",
    "tiers": [
      {"label": "FRI – SAT", "price": 550, "subtitle": "up to 10 guests"},
      {"label": "SUN – THU", "price": 400, "subtitle": "up to 10 guests · weeknight", "promo": "SAVE $150"}
    ],
    "fine_print": "+$50 per additional guest over 10 · 7-day cancel or reschedule policy"
  }'::jsonb,
  updated_at       = now()
where id = 'my-haunted-manor-usa';

-- 2. Move zones from the duplicate seed row to your existing row,
--    then delete the duplicate.
update public.location_zones
  set location_id = 'my-haunted-manor-usa'
where location_id = 'samuel-miller-mansion';

delete from public.locations where id = 'samuel-miller-mansion';

commit;

-- Verify:
-- select id, name, claim_status, verified, jsonb_array_length(pricing->'tiers') as tier_count
-- from public.locations where id = 'my-haunted-manor-usa';
-- select count(*) from public.location_zones where location_id = 'my-haunted-manor-usa';
