-- ============================================================
-- HauntLog — Step 5 migration
-- Team-owned cases + Activity feed
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend cases read policy: team members can read their
--    team's cases regardless of visibility.
-- ------------------------------------------------------------
-- A team-owned case should be visible to every member of that team,
-- including private cases meant only for internal team discussion.
-- Public/anonymous cases are still readable by everyone (unchanged).
-- ------------------------------------------------------------
drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases
  for select using (
    visibility in ('public', 'anonymous')
    or (owner_id is not null and owner_id = auth.uid())
    or (
      team_id is not null and exists (
        select 1 from public.team_members
        where team_members.team_id = cases.team_id
          and team_members.user_id = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------
-- 2. Indexes for the activity feed
-- ------------------------------------------------------------
-- The feed is `select * from cases where visibility in (public, anonymous)
-- order by created_at desc limit 50`. A partial index on (created_at) where
-- visibility is public-ish makes this an index scan instead of a seq scan.
-- ------------------------------------------------------------
create index if not exists cases_feed_idx
  on public.cases (created_at desc)
  where visibility in ('public', 'anonymous');

create index if not exists cases_team_idx on public.cases (team_id) where team_id is not null;
