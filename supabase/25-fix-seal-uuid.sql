-- ============================================================
-- HauntLog — Step 18 hotfix
-- Fix: "function uuid_generate_v4() does not exist" when sealing
-- ============================================================
-- The seal_case_with_logs RPC has `set search_path = public` for
-- safety. But Supabase installs the uuid-ossp extension into the
-- `extensions` schema by default, so unqualified calls fail from
-- inside the function body even though they work fine in column
-- DEFAULT expressions.
--
-- Switching to gen_random_uuid() which is built into Postgres core
-- (since PG 13) and needs no extension at all.
--
-- This is a single-line change. The function body is otherwise
-- identical to the step-18 version.
-- ============================================================

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
  p_logs jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_log jsonb;
  v_log_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_uid
  ) then
    raise exception 'not a member of that team';
  end if;

  insert into public.cases (
    id, owner_id, title, summary, location_id, location_name, zone, lat, lng,
    started_at, ended_at, visibility, gps_verified, equipment_used,
    custom_equipment, tags, team_id, sealed
  ) values (
    p_id, v_uid, p_title, p_summary, p_location_id, p_location_name, p_zone,
    p_lat, p_lng, p_started_at, p_ended_at, p_visibility, p_gps_verified,
    p_equipment_used, p_custom_equipment, p_tags, p_team_id, true
  );

  if p_logs is not null then
    for v_log in select * from jsonb_array_elements(p_logs)
    loop
      -- Use the client-supplied id if it parses as a uuid.
      begin
        v_log_id := (v_log->>'id')::uuid;
      exception when others then
        v_log_id := null;
      end;

      insert into public.log_entries (
        id, case_id, logged_by, timestamp, equipment_id, equipment_label,
        observation, note, starred, data
      ) values (
        coalesce(v_log_id, gen_random_uuid()),   -- <-- the only changed line
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

grant execute on function public.seal_case_with_logs(
  text, text, text, text, text, text, double precision, double precision,
  timestamptz, timestamptz, visibility_t, boolean, text[], jsonb, text[], uuid, jsonb
) to authenticated;
