-- ============================================================
-- HauntLog — Step 15 fix3
-- locations_update_managers via security-definer helper
-- ============================================================
-- The dual-path locations_update_managers policy from step 15
-- referenced both team_members and location_managers in its USING
-- clause. PostgREST update calls silently matched zero rows — the
-- policy was either too restrictive in practice or recursing into
-- location_managers RLS.
--
-- The fix follows the same pattern as is_venue_owner: extract the
-- "can this user manage this venue?" check into a security-definer
-- function. The function runs with elevated privileges so the
-- internal queries against location_managers and team_members don't
-- trigger RLS recursion. The policy just calls the function and gets
-- back a boolean.
--
-- Idempotent — safe to re-run.
-- ============================================================

create or replace function public.can_manage_venue(p_location_id text, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  -- Admins always
  select public.is_admin()
  -- New manager path (step 15)
  or exists (
    select 1 from public.location_managers
    where location_id = p_location_id
      and user_id = p_user_id
      and role in ('owner', 'manager')
  )
  -- Legacy team-claim path (step 11)
  or exists (
    select 1
    from public.locations loc
    join public.team_members tm on tm.team_id = loc.claimed_by_team_id
    where loc.id = p_location_id
      and loc.claim_status = 'verified'
      and tm.user_id = p_user_id
      and tm.role in ('owner', 'admin')
  );
$$;

grant execute on function public.can_manage_venue(text, uuid) to authenticated;

drop policy if exists locations_update_managers on public.locations;
create policy locations_update_managers on public.locations
  for update
  using (public.can_manage_venue(id, auth.uid()))
  with check (public.can_manage_venue(id, auth.uid()));

-- We could also retrofit zones_*_owner policies from step 15 fix2
-- to use can_manage_venue() for consistency — they currently inline
-- the check. Leaving them as-is for now; they work.
