-- ============================================================
-- HauntLog — Step 38 migration
-- Schedule auto-close of idle investigations
-- ============================================================
-- Investigations that go 24h with no activity should close themselves.
-- The RPC auto_close_idle_investigations() (from step 24) does the
-- threshold check; this migration schedules it to run hourly via
-- pg_cron.
--
-- pg_cron is available on Supabase but must be enabled per project.
-- See: https://supabase.com/docs/guides/database/extensions/pg_cron
-- ============================================================

-- 1. Enable pg_cron. Safe to run repeatedly.
create extension if not exists pg_cron with schema extensions;

-- 2. Unschedule any prior job with this name (idempotent re-runs).
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'hauntlog_auto_close_idle_investigations';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

-- 3. Schedule it to run hourly at minute 7 (offset from 0 to avoid
-- clustering with other hourly jobs). The RPC itself only closes
-- investigations that have been idle for 24h+, so running every hour
-- means we catch them within an hour of becoming idle.
select cron.schedule(
  'hauntlog_auto_close_idle_investigations',
  '7 * * * *',
  $$select public.auto_close_idle_investigations();$$
);

-- 4. Sanity check helper — call this manually to verify the job is
-- registered. Read-only, safe.
create or replace function public.debug_list_auto_close_jobs()
returns table (jobid bigint, schedule text, command text, jobname text)
language sql
security definer
set search_path = public, cron
stable
as $$
  select jobid, schedule, command, jobname
  from cron.job
  where jobname like 'hauntlog%';
$$;

grant execute on function public.debug_list_auto_close_jobs() to authenticated;
