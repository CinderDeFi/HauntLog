-- ============================================================
-- HauntLog — Step 18 migration
-- Photo upload on log entries
-- ============================================================
-- Adds the metadata table for log photos, RLS policies that inherit
-- case visibility, storage policies on the 'log-photos' bucket, and
-- updates seal_case_with_logs to honor client-supplied log entry ids
-- so we can match photos to log rows after sealing.
--
-- *** ONE MANUAL STEP REQUIRED BEFORE RUNNING THIS SQL ***
-- Create a Storage bucket named `log-photos` in the Supabase dashboard:
--   1. Project → Storage → New bucket
--   2. Name: `log-photos`
--   3. Public bucket: OFF
--   4. File size limit: 4 MB
--   5. Allowed MIME types: image/jpeg, image/png, image/webp
--   6. Create
-- ============================================================

-- 1. log_entry_photos table
create table if not exists public.log_entry_photos (
  id uuid primary key default uuid_generate_v4(),
  log_entry_id uuid not null references public.log_entries(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  bytes integer not null,
  width integer,
  height integer,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists log_entry_photos_log_idx
  on public.log_entry_photos (log_entry_id, created_at asc);
create index if not exists log_entry_photos_case_idx
  on public.log_entry_photos (case_id, created_at asc);
create index if not exists log_entry_photos_owner_idx
  on public.log_entry_photos (owner_id);

alter table public.log_entry_photos enable row level security;

-- 2. RLS on log_entry_photos
drop policy if exists log_photos_read on public.log_entry_photos;
create policy log_photos_read on public.log_entry_photos
  for select using (
    exists (
      select 1 from public.cases c
      where c.id = log_entry_photos.case_id
        and c.deleted_at is null
        and (
          c.visibility in ('public', 'anonymous')
          or c.owner_id = auth.uid()
          or (
            c.team_id is not null
            and exists (
              select 1 from public.team_members tm
              where tm.team_id = c.team_id and tm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists log_photos_insert on public.log_entry_photos;
create policy log_photos_insert on public.log_entry_photos
  for insert with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = log_entry_photos.case_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists log_photos_delete on public.log_entry_photos;
create policy log_photos_delete on public.log_entry_photos
  for delete using (
    owner_id = auth.uid() or public.is_admin()
  );

drop policy if exists log_photos_update on public.log_entry_photos;
create policy log_photos_update on public.log_entry_photos
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 3. Storage policies on `log-photos` bucket
create or replace function public.can_read_log_photo(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id text;
  v_owner uuid;
  v_visibility text;
  v_team_id uuid;
  v_uid uuid := auth.uid();
begin
  v_case_id := split_part(p_path, '/', 2);
  if v_case_id is null or v_case_id = '' then
    return false;
  end if;

  select owner_id, visibility, team_id
    into v_owner, v_visibility, v_team_id
  from public.cases
  where id = v_case_id and deleted_at is null;
  if v_owner is null then
    return false;
  end if;

  if v_visibility in ('public', 'anonymous') then return true; end if;
  if v_owner = v_uid then return true; end if;
  if v_team_id is not null and exists (
    select 1 from public.team_members where team_id = v_team_id and user_id = v_uid
  ) then return true; end if;
  return false;
end;
$$;

grant execute on function public.can_read_log_photo(text) to authenticated, anon;

drop policy if exists log_photos_storage_read on storage.objects;
create policy log_photos_storage_read on storage.objects
  for select using (
    bucket_id = 'log-photos'
    and public.can_read_log_photo(name)
  );

drop policy if exists log_photos_storage_insert on storage.objects;
create policy log_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'log-photos'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists log_photos_storage_delete on storage.objects;
create policy log_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'log-photos'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  );

-- 4. RPC: list_case_photos
create or replace function public.list_case_photos(p_case_id text)
returns setof public.log_entry_photos
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.log_entry_photos
  where case_id = p_case_id
    and exists (
      select 1 from public.cases c
      where c.id = p_case_id and c.deleted_at is null
    )
  order by created_at asc;
$$;

grant execute on function public.list_case_photos(text) to authenticated, anon;

-- 5. seal_case_with_logs — honor client-supplied log ids
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
        coalesce(v_log_id, uuid_generate_v4()),
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
