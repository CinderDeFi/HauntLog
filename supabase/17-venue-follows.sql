-- ============================================================
-- HauntLog — Step 13 migration
-- Venue follows
-- ============================================================
-- Parallel to the people-follow graph from step 7, but the followee
-- is a location_id (text PK) instead of a profile id. Same one-way,
-- public-graph design.
-- ============================================================

-- ------------------------------------------------------------
-- 1. venue_follows table
-- ------------------------------------------------------------
create table if not exists public.venue_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, location_id)
);

create index if not exists venue_follows_location_idx
  on public.venue_follows (location_id, created_at desc);
create index if not exists venue_follows_follower_idx
  on public.venue_follows (follower_id, created_at desc);

alter table public.venue_follows enable row level security;

-- Anyone signed in can read any venue-follow row (needed for follower
-- counts on the venue page).
drop policy if exists venue_follows_read on public.venue_follows;
create policy venue_follows_read on public.venue_follows
  for select using (auth.uid() is not null);

-- A user can only insert their OWN venue follows.
drop policy if exists venue_follows_insert_self on public.venue_follows;
create policy venue_follows_insert_self on public.venue_follows
  for insert with check (follower_id = auth.uid());

-- A user can only delete their OWN follows (unfollow).
drop policy if exists venue_follows_delete_self on public.venue_follows;
create policy venue_follows_delete_self on public.venue_follows
  for delete using (follower_id = auth.uid());
