-- ============================================================
-- HauntLog — Step 7 migration
-- Follow system
-- ============================================================

-- ------------------------------------------------------------
-- 1. follows table
-- ------------------------------------------------------------
-- One-way directed graph. Composite primary key prevents duplicate
-- follow rows. CHECK constraint prevents self-follow at the DB level.
-- ------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx
  on public.follows (followee_id, created_at desc);
create index if not exists follows_follower_idx
  on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

-- Anyone signed in can read any follow row. We need this for follower
-- counts on public profiles and for the "following" feed filter to
-- work. The follow graph is intentionally public for now.
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select using (auth.uid() is not null);

-- A user can only insert their OWN follows. Prevents impersonation.
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
  for insert with check (follower_id = auth.uid());

-- A user can only delete their OWN follows (i.e. unfollow).
drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows
  for delete using (follower_id = auth.uid());
