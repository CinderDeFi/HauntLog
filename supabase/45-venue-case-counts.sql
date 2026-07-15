-- ============================================================
-- HauntLog — Step 45: public case count per venue
-- ============================================================
-- Powers a REAL community case count on the Atlas (each venue row), replacing
-- the per-viewer "N by you" stopgap. Aggregates public + anonymous, non-deleted
-- cases by the venue they were logged at.
--
-- Mirrors the existing count views (investigator_public_case_counts,
-- team_public_case_counts in 13/14): filters to visibility in
-- ('public','anonymous') and deleted_at is null, then grants read to anon +
-- authenticated. The visibility filter is what keeps private cases out of the
-- aggregate regardless of who queries it.
--
-- NOTE: only CATALOG venues have a cases.location_id (user-created venues log
-- with location_id = NULL, keeping just a name snapshot), so this view counts
-- catalog venues only. User venues simply won't appear (treated as 0 in-app).
--
-- Touches ONLY the new view. Idempotent (create or replace).
-- ============================================================

create or replace view public.venue_public_case_counts as
select
  c.location_id,
  count(*)::int as public_case_count
from public.cases c
where c.location_id is not null
  and c.visibility in ('public', 'anonymous')
  and c.deleted_at is null
group by c.location_id;

grant select on public.venue_public_case_counts to anon, authenticated;

-- Verify:
--   select * from public.venue_public_case_counts order by public_case_count desc limit 10;
