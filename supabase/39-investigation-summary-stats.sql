-- ============================================================
-- HauntLog — Step 39 migration
-- Investigation summary stats
-- ============================================================
-- When the host closes an investigation, the page should render a
-- "the night at a glance" header with aggregate counts. This RPC
-- returns those counts in one round-trip so the client doesn't
-- need 5 separate queries.
--
-- Stats:
--   - total_cases: cases sealed under this investigation
--   - total_log_entries: log entries across all those cases
--   - total_photos: photos attached to those log entries
--   - total_audio: audio clips attached to those log entries
--   - duration_seconds: seconds between started_at and closed_at
--                       (or now() if still open)
--
-- RLS: only callable by someone who can see the investigation
-- (i.e., a team member of its parent team).
-- ============================================================

create or replace function public.investigation_summary_stats(
  p_investigation_id uuid
)
returns table (
  total_cases bigint,
  total_log_entries bigint,
  total_photos bigint,
  total_audio bigint,
  duration_seconds bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select inv.id, inv.started_at, inv.closed_at
    from public.investigations inv
    join public.team_members tm on tm.team_id = inv.team_id
    where inv.id = p_investigation_id
      and tm.user_id = auth.uid()
  ),
  case_ids as (
    select c.id
    from public.cases c
    where c.investigation_id = p_investigation_id
      and c.deleted_at is null
      and exists (select 1 from allowed)
  )
  select
    (select count(*) from case_ids) as total_cases,
    (select count(*) from public.log_entries le
       where le.case_id in (select id from case_ids)) as total_log_entries,
    (select count(*) from public.log_entry_photos lep
       where lep.log_entry_id in (
         select le.id from public.log_entries le
         where le.case_id in (select id from case_ids)
       )) as total_photos,
    (select count(*) from public.log_entry_audio lea
       where lea.log_entry_id in (
         select le.id from public.log_entries le
         where le.case_id in (select id from case_ids)
       )) as total_audio,
    (select
      extract(epoch from (coalesce(a.closed_at, now()) - a.started_at))::bigint
      from allowed a
    ) as duration_seconds;
$$;

grant execute on function public.investigation_summary_stats(uuid) to authenticated;
