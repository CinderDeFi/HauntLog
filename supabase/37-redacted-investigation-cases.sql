-- ============================================================
-- HauntLog — Step 29 migration
-- Investigation members can see redacted private case entries
-- ============================================================
-- A teammate's sealed PRIVATE case under an investigation should
-- still show up in the CASES SEALED list — but with title/summary
-- redacted. The team needs to count and credit each hunter's work
-- without leaking the contents.
--
-- Behavior:
--   - Public / anonymous / team cases: shown in full
--   - Private cases owned by you: shown in full
--   - Private cases owned by someone else: stub row only
--       title = '[Private case]'
--       summary = null
--       logs / equipment / zone hidden
--       owner_id and timing remain so the row is countable
-- ============================================================

-- Returns a shape compatible with public.cases.* PLUS a redacted flag
-- so the client knows to render a stub card instead of linking to
-- the case body (which would 404 due to RLS).

-- Drop the prior version from step 24 since the return signature
-- changes — Postgres won't allow CREATE OR REPLACE across signature
-- changes.
drop function if exists public.list_investigation_cases(uuid);

create or replace function public.list_investigation_cases(p_investigation_id uuid)
returns table (
  id text,
  owner_id uuid,
  team_id uuid,
  title text,
  summary text,
  location_id text,
  location_name text,
  zone text,
  lat double precision,
  lng double precision,
  started_at timestamptz,
  ended_at timestamptz,
  visibility visibility_t,
  gps_verified boolean,
  equipment_used text[],
  custom_equipment jsonb,
  tags text[],
  sealed boolean,
  investigation_id uuid,
  group_id uuid,
  redacted boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select 1
    from public.investigations inv
    join public.team_members tm on tm.team_id = inv.team_id
    where inv.id = p_investigation_id
      and tm.user_id = auth.uid()
  )
  select
    c.id,
    c.owner_id,
    c.team_id,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then '[Private case]'
      else c.title
    end as title,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.summary
    end as summary,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.location_id
    end as location_id,
    -- Location name stays visible — the investigation already named it.
    c.location_name,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.zone
    end as zone,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.lat
    end as lat,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.lng
    end as lng,
    c.started_at,
    c.ended_at,
    c.visibility,
    c.gps_verified,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.equipment_used
    end as equipment_used,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.custom_equipment
    end as custom_equipment,
    case
      when c.visibility = 'private' and c.owner_id <> auth.uid()
        then null
      else c.tags
    end as tags,
    c.sealed,
    c.investigation_id,
    c.group_id,
    (c.visibility = 'private' and c.owner_id <> auth.uid()) as redacted,
    c.created_at,
    c.updated_at
  from public.cases c
  where c.investigation_id = p_investigation_id
    and c.deleted_at is null
    and exists (select 1 from allowed)
  order by c.started_at asc;
$$;

grant execute on function public.list_investigation_cases(uuid) to authenticated;
