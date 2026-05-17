-- ============================================================
-- HauntLog — Step 15 migration
-- Venue ownership refactor: location_managers
-- ============================================================
-- Until now, venue management was scoped to a team via
-- `locations.claimed_by_team_id`. That was conceptually muddy — a
-- venue is owned by a *person* or a small staff, not by an
-- investigation crew. This migration introduces a first-class
-- ownership table:
--
--   location_managers (location_id, user_id, role)
--
-- Owners and managers of a venue have edit rights. The legacy team
-- claim path stays in place as a fallback for now; both paths work
-- side-by-side. Long-term, the team path can be retired.
-- ============================================================

-- ------------------------------------------------------------
-- 1. location_manager_role_t enum
-- ------------------------------------------------------------
do $$ begin
  create type location_manager_role_t as enum ('owner', 'manager');
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 2. location_managers table
-- ------------------------------------------------------------
create table if not exists public.location_managers (
  location_id text not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role location_manager_role_t not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

create index if not exists location_managers_user_idx
  on public.location_managers (user_id);
create index if not exists location_managers_location_idx
  on public.location_managers (location_id);

alter table public.location_managers enable row level security;

-- Anyone can read manager rows — needed to render "Managed by" on the
-- public venue page and to know who claimed a location.
drop policy if exists location_managers_read on public.location_managers;
create policy location_managers_read on public.location_managers
  for select using (true);

-- Only owners of a venue + platform admins can add/remove managers.
-- Owners can add new owners or managers; managers cannot escalate
-- privileges by adding more managers (only owners can).
drop policy if exists location_managers_write on public.location_managers;
create policy location_managers_write on public.location_managers
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.location_managers
      where location_id = location_managers.location_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.location_managers
      where location_id = location_managers.location_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- 3. Update locations write RLS to ALSO allow location_managers
-- ------------------------------------------------------------
-- The step 14 policy (locations_update_managers) only allowed
-- platform admins or team admins of a claimed-by team. We extend it
-- to also allow direct location_managers.
-- ------------------------------------------------------------
drop policy if exists locations_update_managers on public.locations;
create policy locations_update_managers on public.locations
  for update
  using (
    public.is_admin()
    or (
      -- Legacy team-claim path
      claim_status = 'verified'
      and claimed_by_team_id is not null
      and exists (
        select 1 from public.team_members
        where team_id = locations.claimed_by_team_id
          and user_id = auth.uid()
          and role in ('owner', 'admin')
      )
    )
    or (
      -- New manager-based path
      exists (
        select 1 from public.location_managers
        where location_id = locations.id
          and user_id = auth.uid()
          and role in ('owner', 'manager')
      )
    )
  );

-- ------------------------------------------------------------
-- 4. Same dual permission for location_zones
-- ------------------------------------------------------------
drop policy if exists zones_write_owner on public.location_zones;
create policy zones_write_owner on public.location_zones
  for all
  using (
    public.is_admin()
    or exists (
      -- Legacy team path
      select 1
      from public.locations loc
      join public.team_members tm on tm.team_id = loc.claimed_by_team_id
      where loc.id = location_zones.location_id
        and loc.claim_status = 'verified'
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
    or exists (
      -- New manager-based path
      select 1 from public.location_managers
      where location_id = location_zones.location_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
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
    or exists (
      select 1 from public.location_managers
      where location_id = location_zones.location_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- ------------------------------------------------------------
-- 5. Seed: make @raycrobins the owner of Samuel Miller Mansion
-- ------------------------------------------------------------
-- This gives the existing showcase venue an actual human owner so
-- the new UI has something to render. Idempotent.
-- ------------------------------------------------------------
insert into public.location_managers (location_id, user_id, role)
select
  'my-haunted-manor-samuel-miller-mansion',
  p.id,
  'owner'::location_manager_role_t
from public.profiles p
where p.handle = '@raycrobins'
  and exists (select 1 from public.locations where id = 'my-haunted-manor-samuel-miller-mansion')
on conflict (location_id, user_id) do nothing;

-- Sanity: how did the seed go?
select
  l.id as location_id,
  l.name as location_name,
  p.handle as manager_handle,
  lm.role
from public.location_managers lm
join public.locations l on l.id = lm.location_id
join public.profiles p on p.id = lm.user_id
order by l.name, lm.role, p.handle;
