-- ============================================================
-- HauntLog — Step 43: hunt_drafts (server-side active-hunt backup)
-- ============================================================
-- Reconstructs a table that existed in the pre-rebuild project but was
-- never captured as a migration, so the rebuilt DB is missing it and the
-- app 404s on load. The frontend calls it from three places in
-- src/lib/dataLayer.ts:
--   saveHuntDraft   -> upsert onConflict 'owner_id'
--   fetchHuntDraft  -> select * eq owner_id .maybeSingle()
--   deleteHuntDraft -> delete eq owner_id
--
-- Column shape (names / types / nullability / default) is taken verbatim
-- from src/lib/database.types.ts (`hunt_drafts`), which was generated from
-- the old DB and is authoritative:
--     owner_id   string        -> uuid, not null (PRIMARY KEY)
--     hunt_id    string        -> text, not null
--     payload    any           -> jsonb, not null
--     started_at string        -> timestamptz, not null
--     updated_at string (opt.) -> timestamptz, not null default now()
--
-- Purpose: exactly ONE in-progress ("live") hunt draft per user, backed up
-- to the server (debounced) so a dead phone / cleared browser doesn't lose
-- logged observations. This is PRIVATE working state — visible only to its
-- owner (unlike check_ins/cases, which are publicly readable).
--
-- Touches ONLY the new public.hunt_drafts table. Idempotent — safe to re-run.
-- ============================================================

create table if not exists public.hunt_drafts (
  -- One draft per user, so owner_id IS the primary key. The client upserts
  -- with { onConflict: 'owner_id' } and reads/deletes via .eq('owner_id', …);
  -- the primary key's unique index serves every one of those access paths,
  -- so no secondary index is required. FK + cascade mirrors check_ins/cases
  -- and equipment_loadouts (owner_id -> profiles.id, and profiles.id IS
  -- auth.users.id, which is why `owner_id = auth.uid()` works in RLS below).
  owner_id   uuid        primary key references public.profiles(id) on delete cascade,
  hunt_id    text        not null,          -- client-generated 'live-…' id
  payload    jsonb       not null,          -- JSON-serialized ActiveHunt snapshot
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- No secondary index: the only query patterns are upsert-onConflict(owner_id),
-- select .eq(owner_id), and delete .eq(owner_id) — all fully served by the
-- primary-key index on owner_id. A separate owner_id index would be redundant.

-- Keep updated_at fresh on every UPDATE (matches the repo convention used by
-- equipment_loadouts et al.; set_updated_at() is defined in 01-schema.sql).
-- The app also sets updated_at explicitly on upsert; the trigger just makes
-- the column authoritative regardless of caller.
drop trigger if exists hunt_drafts_updated_at on public.hunt_drafts;
create trigger hunt_drafts_updated_at
  before update on public.hunt_drafts
  for each row execute function set_updated_at();

-- --------------------------------------------------------------
-- Row Level Security — PRIVATE, owner-only.
-- Enabling RLS is mandatory (every table in 01-schema.sql does). Policies
-- are modeled on the owner-scoped private table equipment_loadouts
-- (32-loadouts.sql): a user can only see/insert/update/delete rows whose
-- owner_id is their own auth.uid(). SELECT is owner-scoped (NOT `using(true)`)
-- because a draft is private working state, not public content.
-- --------------------------------------------------------------
alter table public.hunt_drafts enable row level security;

drop policy if exists hunt_drafts_select_own on public.hunt_drafts;
create policy hunt_drafts_select_own on public.hunt_drafts
  for select using (owner_id = auth.uid());

drop policy if exists hunt_drafts_insert_own on public.hunt_drafts;
create policy hunt_drafts_insert_own on public.hunt_drafts
  for insert with check (owner_id = auth.uid());

drop policy if exists hunt_drafts_update_own on public.hunt_drafts;
create policy hunt_drafts_update_own on public.hunt_drafts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists hunt_drafts_delete_own on public.hunt_drafts;
create policy hunt_drafts_delete_own on public.hunt_drafts
  for delete using (owner_id = auth.uid());
