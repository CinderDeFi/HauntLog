-- ============================================================
-- HauntLog — Step 4 migration
-- Data layer migration: server-side seal RPC, helpers
-- ============================================================

-- ------------------------------------------------------------
-- 1. seal_case_with_logs — atomic case + logs insertion
-- ------------------------------------------------------------
-- When a hunt ends, the client has a draft case and many log entries
-- locally. Inserting them in one transaction prevents half-sealed states
-- where the case exists but some logs failed to insert.
--
-- The client builds a JSON payload of logs; we insert them all together.
-- ------------------------------------------------------------

create or replace function public.seal_case_with_logs(
  p_id text,
  p_title text,
  p_summary text,
  p_location_id text,
  p_location_name text,
  p_zone text,
  p_lat double precision,
  p_lng double precision,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_visibility visibility_t,
  p_gps_verified boolean,
  p_equipment_used text[],
  p_custom_equipment jsonb,
  p_tags text[],
  p_team_id uuid,
  p_logs jsonb           -- array of {id?, timestamp, equipment_id, equipment_label?, observation, note?, starred?, data?}
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_log jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- If team_id provided, verify the caller is a member of that team.
  if p_team_id is not null and not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_uid
  ) then
    raise exception 'not a member of the specified team';
  end if;

  insert into public.cases (
    id, owner_id, team_id, title, summary,
    location_id, location_name, zone, lat, lng,
    started_at, ended_at, visibility, gps_verified,
    equipment_used, custom_equipment, tags, sealed
  ) values (
    p_id, v_uid, p_team_id, p_title, nullif(trim(p_summary), ''),
    p_location_id, p_location_name, nullif(trim(p_zone), ''), p_lat, p_lng,
    p_started_at, p_ended_at, p_visibility, p_gps_verified,
    p_equipment_used, p_custom_equipment, p_tags, true
  );

  if p_logs is not null then
    for v_log in select * from jsonb_array_elements(p_logs) loop
      insert into public.log_entries (
        case_id, logged_by, timestamp, equipment_id, equipment_label,
        observation, note, starred, data
      ) values (
        p_id,
        v_uid,
        (v_log->>'timestamp')::timestamptz,
        v_log->>'equipment_id',
        v_log->>'equipment_label',
        v_log->>'observation',
        v_log->>'note',
        coalesce((v_log->>'starred')::boolean, false),
        case when v_log ? 'data' then v_log->'data' else null end
      );
    end loop;
  end if;

  return p_id;
end;
$$;

-- ------------------------------------------------------------
-- 2. Update CASE_ID format on cases
-- ------------------------------------------------------------
-- Cases use text ids (short shareable like 'X4M-PT9'), already in
-- place. Nothing to change.

-- ------------------------------------------------------------
-- 3. Public team cases view for the team profile page
-- ------------------------------------------------------------
-- Selecting from cases with a team_id join is fine via existing RLS,
-- but the team profile page needs a single round trip. We could just
-- query cases directly. Skipping a view; doing it from the client.

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
grant execute on function public.seal_case_with_logs(
  text, text, text, text, text, text, double precision, double precision,
  timestamptz, timestamptz, visibility_t, boolean,
  text[], jsonb, text[], uuid, jsonb
) to authenticated;
