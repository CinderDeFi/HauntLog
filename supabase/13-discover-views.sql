-- ============================================================
-- HauntLog — Step 9 migration
-- Discover page support
-- ============================================================
-- Two read-only views that pre-aggregate public case counts so the
-- discover page doesn't have to do per-row GROUP BYs from the client.
-- Views inherit RLS from the underlying tables; since `cases` already
-- restricts non-public/anonymous + deleted, this is safe to expose.
-- ============================================================

-- ------------------------------------------------------------
-- 1. investigator_public_case_counts
-- ------------------------------------------------------------
-- Per-profile counts of public + anonymous cases. Anonymous cases are
-- counted toward the user's "activity level" too — they're real
-- investigations, just un-attributed.
--
-- Profiles with zero public cases don't appear here. The discover
-- page falls back to recently-joined for that crowd.
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
  ) as last_case_at
from public.profiles p
left join public.cases c on c.owner_id = p.id
group by p.id;

-- ------------------------------------------------------------
-- 2. team_public_case_counts
-- ------------------------------------------------------------
-- Per-team counts of public + anonymous cases. Verified teams + teams
-- with cases bubble up.
-- ------------------------------------------------------------
create or replace view public.team_public_case_counts as
select
  t.id,
  t.slug,
  t.name,
  t.description,
  t.logo_url,
  t.verified,
  t.created_at,
  (
    select count(*) from public.team_members tm where tm.team_id = t.id
  ) as member_count,
  (
    select count(*) from public.cases c
    where c.team_id = t.id
      and c.visibility in ('public', 'anonymous')
      and c.deleted_at is null
  ) as public_case_count
from public.teams t;

-- ------------------------------------------------------------
-- Notes
-- ------------------------------------------------------------
-- Views are not subject to RLS directly in Postgres; security is
-- inherited from the underlying tables when accessed via the same
-- role. Since both `profiles` and `teams` already allow public reads,
-- and the case counts are filtered to public-only, these views are
-- safe to expose to anon + authenticated.
--
-- If you ever change RLS to make profiles private, you'll need to
-- recreate these views with `security_invoker = true` or convert them
-- to security-definer functions.
-- ------------------------------------------------------------

grant select on public.investigator_public_case_counts to anon, authenticated;
grant select on public.team_public_case_counts to anon, authenticated;
