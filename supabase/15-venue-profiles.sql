-- ============================================================
-- HauntLog — Step 11 migration
-- Rich venue profiles (read-only) + zones + verified-location example
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend `locations` with additional profile fields
-- ------------------------------------------------------------
-- The `locations` table already has most of what we need from step 1:
-- description, address parts, website, hours, booking_url, tags, photos.
-- We add:
--   - built_year            small integer for "EST. 1804" type headers
--   - tagline               short italicized line under the title
--   - hero_image            single big image for the venue header
--   - claim_status          enum: unclaimed / claimed / verified
--   - claimed_by_team_id    the team that operates this venue (when verified)
--   - youtube_url / fb_url / ig_url / tiktok_url
--   - features              text[]   small badges like "24/7 LIVE CAMERAS"
--   - operating_window      text     e.g. "PRIVATE BOOKINGS · 7PM – 7AM"
--   - pricing               jsonb    flexible day-of-week tiers
-- ------------------------------------------------------------

do $$ begin
  create type location_claim_status_t as enum ('unclaimed', 'claimed', 'verified');
exception
  when duplicate_object then null;
end $$;

alter table public.locations
  add column if not exists built_year smallint,
  add column if not exists tagline text,
  add column if not exists hero_image text,
  add column if not exists claim_status location_claim_status_t not null default 'unclaimed',
  add column if not exists claimed_by_team_id uuid references public.teams(id) on delete set null,
  add column if not exists youtube_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists features text[] not null default '{}',
  add column if not exists operating_window text,
  add column if not exists pricing jsonb;

-- ------------------------------------------------------------
-- 2. zones — rooms / areas inside a venue
-- ------------------------------------------------------------
-- Each venue can have N zones, each with a name, an icon hint,
-- and a short list of "what's been reported here" tags.
-- These appear in the DOCUMENTED ZONES section of the venue page.
-- ------------------------------------------------------------
create table if not exists public.location_zones (
  id uuid primary key default uuid_generate_v4(),
  location_id text not null references public.locations(id) on delete cascade,
  name text not null,
  icon text,                -- lucide-react icon key like 'home', 'door', 'camera'
  tags text[] not null default '{}',  -- short labels like "EVP REPORTS", "FOOTSTEPS"
  description text,         -- optional longer description (not used in the basic strip)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists location_zones_location_idx
  on public.location_zones (location_id, sort_order);

alter table public.location_zones enable row level security;

-- Public read: anyone can see zones for any location.
drop policy if exists zones_read_all on public.location_zones;
create policy zones_read_all on public.location_zones
  for select using (true);

-- Insert/update/delete: only admins, OR a member of the team that
-- claims this venue (when verified). Future claim-flow gates the rest.
drop policy if exists zones_write_owner on public.location_zones;
create policy zones_write_owner on public.location_zones
  for all using (
    public.is_admin()
    or exists (
      select 1
      from public.locations loc
      join public.team_members tm on tm.team_id = loc.claimed_by_team_id
      where loc.id = location_zones.location_id
        and loc.claim_status = 'verified'
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.locations loc
      join public.team_members tm on tm.team_id = loc.claimed_by_team_id
      where loc.id = location_zones.location_id
        and loc.claim_status = 'verified'
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 3. Tighten the existing locations update policy
-- ------------------------------------------------------------
-- Today, the locations RLS for writes was wide-open for admins only.
-- Extend it so a verified-location's claiming team can also edit it.
-- (We don't add an editor UI in step A, but the policy is correct
-- ahead of time so step D won't need a schema change.)
-- ------------------------------------------------------------
drop policy if exists locations_update_managers on public.locations;
create policy locations_update_managers on public.locations
  for update using (
    public.is_admin()
    or (
      claim_status = 'verified'
      and claimed_by_team_id is not null
      and exists (
        select 1 from public.team_members
        where team_id = locations.claimed_by_team_id
          and user_id = auth.uid()
          and role in ('owner', 'admin')
      )
    )
  );

-- ------------------------------------------------------------
-- 4. Seed: Samuel Miller Mansion
-- ------------------------------------------------------------
-- This is hardcoded as the showcase verified location. It demonstrates
-- the rich profile while we test the read-only page.
--
-- We try to attach it to an existing "My Haunted Manor USA" team if
-- the slug exists; otherwise leave claimed_by_team_id null and let
-- the venue page render with "Verified Location" without team
-- attribution.
-- ------------------------------------------------------------
insert into public.locations (
  id, source, name, lat, lng,
  description, tagline,
  street, city, state, country,
  built_year,
  website, booking_url, hours,
  operating_window,
  features,
  youtube_url, instagram_url, facebook_url,
  hero_image,
  pricing,
  claim_status,
  tags,
  created_by_handle
) values (
  'samuel-miller-mansion',
  'catalog',
  'Samuel Miller Mansion',
  40.0349,         -- Columbia, PA — approximate
  -76.5046,
  'Built in 1804 by Samuel Miller for his family, this Columbia, PA landmark has served as a feed mill, a toy shop, and now a print shop. The building has documented ties to the Underground Railroad, and the My Haunted Manor team has produced extensive evidence linked to the surrounding folklore of Chickies Rock. Investigate your way — the entire manor is yours overnight, with 24/7 surveillance and the full team''s documented evidence to compare against.',
  'Home of My Haunted Manor USA',
  'Locust St',
  'Columbia',
  'PA',
  'USA',
  1804,
  'https://myhauntedmanor.com',
  'https://myhauntedmanor.com/book',     -- placeholder — replace with real booking URL when known
  '7 PM – 7 AM (private bookings)',
  'PRIVATE BOOKINGS · 7PM – 7AM',
  array['24/7 LIVE CAMERAS', 'CONTENT CREATORS WELCOME'],
  'https://www.youtube.com/@MyHauntedManorUSA',
  'https://instagram.com/myhauntedproject',
  'https://facebook.com/SamuelMillerMansion',
  null,
  '{
    "currency": "USD",
    "tiers": [
      {
        "label": "FRI – SAT",
        "price": 550,
        "subtitle": "up to 10 guests"
      },
      {
        "label": "SUN – THU",
        "price": 400,
        "subtitle": "up to 10 guests · weeknight",
        "promo": "SAVE $150"
      }
    ],
    "fine_print": "+$50 per additional guest over 10 · 7-day cancel or reschedule policy"
  }'::jsonb,
  'verified',
  array['historic-home', 'underground-railroad', 'overnight-bookings', 'evp', 'apparitions'],
  '@hauntlog'
)
on conflict (id) do update set
  description        = excluded.description,
  tagline            = excluded.tagline,
  built_year         = excluded.built_year,
  hero_image         = excluded.hero_image,
  operating_window   = excluded.operating_window,
  features           = excluded.features,
  youtube_url        = excluded.youtube_url,
  instagram_url      = excluded.instagram_url,
  facebook_url       = excluded.facebook_url,
  pricing            = excluded.pricing,
  claim_status       = excluded.claim_status,
  tags               = excluded.tags,
  updated_at         = now();

-- Attempt to attach to an existing My Haunted Manor team if any team
-- has a matching slug. Safe no-op if not present.
update public.locations
  set claimed_by_team_id = t.id
from public.teams t
where locations.id = 'samuel-miller-mansion'
  and t.slug in ('my-haunted-manor', 'my-haunted-manor-usa', 'myhauntedmanor');

-- ------------------------------------------------------------
-- 5. Seed zones for Samuel Miller Mansion
-- ------------------------------------------------------------
delete from public.location_zones where location_id = 'samuel-miller-mansion';

insert into public.location_zones (location_id, name, icon, tags, sort_order)
values
  ('samuel-miller-mansion', 'The Baker Room',     'box',         array['EVP REPORTS', 'GUEST EXPERIENCES'],         1),
  ('samuel-miller-mansion', 'The White Room',     'box',         array['COLD SPOT CLAIMS', 'FOOTSTEPS'],            2),
  ('samuel-miller-mansion', 'The Blue Room',      'octagon',     array['APPARITION SIGHTINGS'],                     3),
  ('samuel-miller-mansion', 'The Kids Room',      'smile',       array['TOYS MOVING', 'CHILD VOICES'],              4),
  ('samuel-miller-mansion', 'Servant''s Quarters','door-open',   array['KNOCKING', 'DOOR ACTIVITY'],                5),
  ('samuel-miller-mansion', 'Magic Window Room',  'panels-top-left', array['LIGHT ANOMALIES', 'SHADOWS'],          6),
  ('samuel-miller-mansion', 'Room X',             'box',         array['OFTEN-REQUESTED', 'UNDISCLOSED'],           7),
  ('samuel-miller-mansion', 'Sitting Room',       'sofa',        array['EMF', 'ELECTRONIC INTERFERENCE'],           8),
  ('samuel-miller-mansion', 'Basement Mill',      'arrow-down-from-line', array['UNDERGROUND RAILROAD HISTORY'],   9),
  ('samuel-miller-mansion', 'Control Room',       'monitor-dot', array['LIVE 24/7 CAMERA FEED', 'TEAM HQ'],        10);
