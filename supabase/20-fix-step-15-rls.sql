-- ============================================================
-- HauntLog — Step 15 fix2
-- Resolve RLS issues from 19-location-managers.sql
-- ============================================================
-- Two bugs in step 15:
--
-- 1. zones_write_owner was created with `for all`, which gates SELECTs
--    behind a complex check that errored at runtime. Causes every
--    venue page (which reads zones) to 500.
--
-- 2. location_managers_write recursed: its USING clause queried
--    location_managers, which itself triggered policy evaluation,
--    which queried location_managers, etc. ERROR 42P17.
--
-- This migration is idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Fix 1: split location_zones policies (read public, writes guarded)
-- ------------------------------------------------------------
drop policy if exists zones_write_owner on public.location_zones;
drop policy if exists zones_read_all on public.location_zones;

create policy zones_read_all on public.location_zones
  for select using (true);

create policy zones_insert_owner on public.location_zones
  for insert
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

create policy zones_update_owner on public.location_zones
  for update
  using (
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

create policy zones_delete_owner on public.location_zones
  for delete
  using (
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
-- Fix 2: location_managers — wide public read, security-definer
-- helper for the owner check so writes don't recurse
-- ------------------------------------------------------------
drop policy if exists location_managers_write on public.location_managers;
drop policy if exists location_managers_read on public.location_managers;
drop policy if exists location_managers_insert on public.location_managers;
drop policy if exists location_managers_update on public.location_managers;
drop policy if exists location_managers_delete on public.location_managers;

create policy location_managers_read on public.location_managers
  for select using (true);

create or replace function public.is_venue_owner(p_location_id text, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.location_managers
    where location_id = p_location_id
      and user_id = p_user_id
      and role = 'owner'
  );
$$;

grant execute on function public.is_venue_owner(text, uuid) to authenticated;

create policy location_managers_insert on public.location_managers
  for insert
  with check (
    public.is_admin()
    or public.is_venue_owner(location_id, auth.uid())
  );

create policy location_managers_update on public.location_managers
  for update
  using (
    public.is_admin()
    or public.is_venue_owner(location_id, auth.uid())
  )
  with check (
    public.is_admin()
    or public.is_venue_owner(location_id, auth.uid())
  );

create policy location_managers_delete on public.location_managers
  for delete
  using (
    public.is_admin()
    or public.is_venue_owner(location_id, auth.uid())
  );
