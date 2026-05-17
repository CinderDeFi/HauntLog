-- ============================================================
-- HauntLog — Step 10 migration
-- Investigator stats — extend the discover views with more aggregates
-- ============================================================

-- ------------------------------------------------------------
-- Extended investigator stats view
-- ------------------------------------------------------------
-- Replaces investigator_public_case_counts with additional columns:
--   - public_log_count       — total log entries across public/anon cases
--   - public_starred_count   — starred log entries across same
--   - distinct_locations     — distinct location_name values (catalog
--                              + user-created) across same
--   - total_hours            — sum of ended_at - started_at across same
--
-- All counts respect deleted_at IS NULL on cases.
-- Anonymous cases are counted (they ARE the user's hunts, just un-attributed
-- publicly — the stat sits on their own profile which they control).
-- ------------------------------------------------------------

create or replace view public.investigator_public_case_counts as
select
  p.id,
  p.handle,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.tier,
  p.created_at,
  count(c.id) filter (
    where c.visibility in ('public', 'anonymous')
      and c.deleted_at is null
  ) as public_case_count,
  max(c.created_at) filter (
    where c.visibility in ('public', 'anonymous')
      and c.deleted_at is null
  ) as last_case_at,
  -- Log entries across this user's public/anonymous cases
  (
    select count(l.id)
    from public.log_entries l
    join public.cases cc on cc.id = l.case_id
    where cc.owner_id = p.id
      and cc.visibility in ('public', 'anonymous')
      and cc.deleted_at is null
  ) as public_log_count,
  -- Starred entries across the same
  (
    select count(l.id)
    from public.log_entries l
    join public.cases cc on cc.id = l.case_id
    where cc.owner_id = p.id
      and cc.visibility in ('public', 'anonymous')
      and cc.deleted_at is null
      and l.starred = true
  ) as public_starred_count,
  -- Distinct location names. Using location_name (text) instead of
  -- location_id (uuid) because user-created venues have NULL location_id
  -- but still have a name. So a hunter at "the crib" and another at
  -- "Stanley Hotel" each count as 1.
  (
    select count(distinct cc.location_name)
    from public.cases cc
    where cc.owner_id = p.id
      and cc.visibility in ('public', 'anonymous')
      and cc.deleted_at is null
      and cc.location_name is not null
  ) as distinct_locations,
  -- Total hours hunted. Coalesces NULL ended_at (unfinished) to started_at
  -- so unsealed-but-somehow-in-view rows don't blow up. Sealed cases
  -- always have ended_at though.
  coalesce(
    (
      select extract(epoch from sum(
        cc.ended_at - cc.started_at
      )) / 3600.0
      from public.cases cc
      where cc.owner_id = p.id
        and cc.visibility in ('public', 'anonymous')
        and cc.deleted_at is null
        and cc.ended_at is not null
    ),
    0
  )::numeric(10,2) as total_hours
from public.profiles p
left join public.cases c on c.owner_id = p.id
group by p.id;

-- ------------------------------------------------------------
-- Grants (the view was already public from step 9; reasserting)
-- ------------------------------------------------------------
grant select on public.investigator_public_case_counts to anon, authenticated;
