-- ============================================================
-- HauntLog — Step 24 migration
-- Team Investigations
-- ============================================================
-- An investigation is an umbrella for multiple individual hunts
-- by members of the same team, at the same venue, on the same
-- night. Owner/admin starts it. Members one-tap join. Each
-- person still runs their own hunt and seals their own case.
-- Cases auto-link to the active investigation on seal.
--
-- Future-ready: a `group_id` column exists on investigation_members
-- and cases for the planned "groups within investigations" feature
-- (multiple sub-parties splitting up). We don't expose groups yet
-- in the UI, but the schema is shaped to add them in a future
-- migration without breaking changes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. investigations table
-- ------------------------------------------------------------
create table if not exists public.investigations (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  -- Optional human label. If null, derived as "{venue_name} · {date}".
  name text,
  -- Venue info. We allow either a verified venue_id reference, or a
  -- free-form location string (matches the hunt flow which supports both).
  venue_id text references public.locations(id) on delete set null,
  location_name text not null,
  -- 6-char shareable code. Generated server-side. Unique among
  -- ACTIVE investigations only (recycled after close).
  join_code text not null unique,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  -- Activity heartbeat. Updated whenever a member joins or a case is
  -- linked. Used by the auto-close job to find idle investigations.
  last_activity_at timestamptz not null default now()
);

create index if not exists investigations_team_idx
  on public.investigations (team_id, status, started_at desc);
create index if not exists investigations_join_code_idx
  on public.investigations (join_code) where status = 'open';
create index if not exists investigations_last_activity_idx
  on public.investigations (last_activity_at) where status = 'open';

alter table public.investigations enable row level security;

-- Anyone on the team can READ the investigation. (Includes closed ones
-- for archival viewing.)
drop policy if exists investigations_read on public.investigations;
create policy investigations_read on public.investigations
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = investigations.team_id
        and tm.user_id = auth.uid()
    )
  );

-- INSERT: only owner/admin of the team can start one.
drop policy if exists investigations_insert on public.investigations;
create policy investigations_insert on public.investigations
  for insert with check (
    host_id = auth.uid()
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = investigations.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- UPDATE: only the host or a team owner can update (e.g., close it,
-- rename it, update heartbeat).
drop policy if exists investigations_update on public.investigations;
create policy investigations_update on public.investigations
  for update using (
    host_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = investigations.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- DELETE: only team owner can delete (rare; usually just close).
drop policy if exists investigations_delete on public.investigations;
create policy investigations_delete on public.investigations
  for delete using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = investigations.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- 2. investigation_members table
-- ------------------------------------------------------------
create table if not exists public.investigation_members (
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- Placeholder for the future Groups feature. null = unassigned /
  -- "main party". Groups will be a separate table later.
  group_id uuid,
  primary key (investigation_id, user_id)
);

create index if not exists investigation_members_user_idx
  on public.investigation_members (user_id);

alter table public.investigation_members enable row level security;

-- READ: any team member of the parent investigation's team can see
-- who else joined.
drop policy if exists investigation_members_read on public.investigation_members;
create policy investigation_members_read on public.investigation_members
  for select using (
    exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_members.investigation_id
        and tm.user_id = auth.uid()
    )
  );

-- INSERT: a user joins themselves to an investigation if they are
-- on the same team as the parent investigation and it's still open.
drop policy if exists investigation_members_insert on public.investigation_members;
create policy investigation_members_insert on public.investigation_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_members.investigation_id
        and tm.user_id = auth.uid()
        and inv.status = 'open'
    )
  );

-- UPDATE: only update yourself (e.g., setting left_at).
drop policy if exists investigation_members_update on public.investigation_members;
create policy investigation_members_update on public.investigation_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: leave yourself, or team owner removes someone.
drop policy if exists investigation_members_delete on public.investigation_members;
create policy investigation_members_delete on public.investigation_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_members.investigation_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- 3. Add investigation_id + group_id to cases
-- ------------------------------------------------------------
alter table public.cases
  add column if not exists investigation_id uuid references public.investigations(id) on delete set null;

alter table public.cases
  add column if not exists group_id uuid;

create index if not exists cases_investigation_idx
  on public.cases (investigation_id) where investigation_id is not null;

-- ------------------------------------------------------------
-- 4. join code generator
-- ------------------------------------------------------------
-- Six-character codes from an unambiguous alphabet (no 0/O/1/I).
create or replace function public.gen_investigation_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  tries int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Ensure uniqueness among OPEN investigations.
    if not exists (
      select 1 from public.investigations where join_code = code and status = 'open'
    ) then
      return code;
    end if;
    tries := tries + 1;
    if tries > 25 then
      raise exception 'could not generate unique investigation code';
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 5. RPC: create_investigation
-- ------------------------------------------------------------
-- Server-side helper that:
--   - validates the caller is owner/admin of the team
--   - generates a unique join code
--   - creates the row
--   - auto-joins the host as the first member
create or replace function public.create_investigation(
  p_team_id uuid,
  p_location_name text,
  p_venue_id text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv_id uuid;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_uid
      and role in ('owner', 'admin')
  ) then
    raise exception 'only team owners or admins can start investigations';
  end if;
  if p_location_name is null or length(trim(p_location_name)) = 0 then
    raise exception 'location is required';
  end if;

  v_code := public.gen_investigation_code();
  insert into public.investigations (
    team_id, host_id, name, venue_id, location_name, join_code
  ) values (
    p_team_id, v_uid, nullif(trim(p_name), ''), p_venue_id, trim(p_location_name), v_code
  )
  returning id into v_inv_id;

  -- Auto-join host as a member.
  insert into public.investigation_members (investigation_id, user_id)
  values (v_inv_id, v_uid);

  return v_inv_id;
end;
$$;

grant execute on function public.create_investigation(uuid, text, text, text)
  to authenticated;

-- ------------------------------------------------------------
-- 6. RPC: join_investigation_by_code
-- ------------------------------------------------------------
-- Lets a team member join a still-open investigation by entering its
-- code. Verifies team membership and open status server-side.
create or replace function public.join_investigation_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv_id uuid;
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select id, team_id into v_inv_id, v_team_id
  from public.investigations
  where join_code = upper(trim(p_code))
    and status = 'open'
  limit 1;
  if v_inv_id is null then
    raise exception 'investigation not found or already closed';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = v_team_id and user_id = v_uid
  ) then
    raise exception 'you are not a member of that team';
  end if;
  insert into public.investigation_members (investigation_id, user_id)
  values (v_inv_id, v_uid)
  on conflict (investigation_id, user_id) do update set left_at = null;

  -- Heartbeat
  update public.investigations
    set last_activity_at = now()
    where id = v_inv_id;

  return v_inv_id;
end;
$$;

grant execute on function public.join_investigation_by_code(text) to authenticated;

-- ------------------------------------------------------------
-- 7. RPC: close_investigation
-- ------------------------------------------------------------
create or replace function public.close_investigation(p_investigation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select host_id, team_id into v_host, v_team
  from public.investigations
  where id = p_investigation_id;
  if v_host is null then
    raise exception 'investigation not found';
  end if;
  -- Allow host OR team owner.
  if v_host <> v_uid and not exists (
    select 1 from public.team_members
    where team_id = v_team and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the host or team owner can close an investigation';
  end if;

  update public.investigations
    set status = 'closed', closed_at = now()
    where id = p_investigation_id;
end;
$$;

grant execute on function public.close_investigation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 8. RPC: auto_close_idle_investigations
-- ------------------------------------------------------------
-- Closes any open investigation with no activity in the last 24h.
-- Designed to be called from a Supabase scheduled function or
-- pg_cron. Safe to run repeatedly.
create or replace function public.auto_close_idle_investigations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with closed as (
    update public.investigations
      set status = 'closed', closed_at = now()
      where status = 'open'
        and last_activity_at < now() - interval '24 hours'
      returning 1
  )
  select count(*) into v_count from closed;
  return v_count;
end;
$$;

grant execute on function public.auto_close_idle_investigations() to authenticated;

-- ------------------------------------------------------------
-- 9. Helper: list_active_investigations_for_user
-- ------------------------------------------------------------
-- Returns all open investigations across teams the user belongs to.
-- Used by the banner that shows "Your team is investigating X".
create or replace function public.list_active_investigations_for_user()
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  team_slug text,
  host_id uuid,
  host_handle text,
  name text,
  location_name text,
  venue_id text,
  join_code text,
  started_at timestamptz,
  last_activity_at timestamptz,
  member_count bigint,
  i_am_member boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    inv.id,
    inv.team_id,
    t.name as team_name,
    t.slug as team_slug,
    inv.host_id,
    p.handle as host_handle,
    inv.name,
    inv.location_name,
    inv.venue_id,
    inv.join_code,
    inv.started_at,
    inv.last_activity_at,
    (select count(*) from public.investigation_members
       where investigation_id = inv.id and left_at is null) as member_count,
    exists (
      select 1 from public.investigation_members im
      where im.investigation_id = inv.id and im.user_id = auth.uid()
        and im.left_at is null
    ) as i_am_member
  from public.investigations inv
  join public.teams t on t.id = inv.team_id
  join public.profiles p on p.id = inv.host_id
  where inv.status = 'open'
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = inv.team_id and tm.user_id = auth.uid()
    )
  order by inv.started_at desc;
$$;

grant execute on function public.list_active_investigations_for_user() to authenticated;

-- ------------------------------------------------------------
-- 10. Helper: list_investigation_cases
-- ------------------------------------------------------------
create or replace function public.list_investigation_cases(p_investigation_id uuid)
returns setof public.cases
language sql
security definer
set search_path = public
stable
as $$
  select c.*
  from public.cases c
  where c.investigation_id = p_investigation_id
    and c.deleted_at is null
    and exists (
      select 1 from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = p_investigation_id
        and tm.user_id = auth.uid()
    )
  order by c.started_at asc;
$$;

grant execute on function public.list_investigation_cases(uuid) to authenticated;

-- ------------------------------------------------------------
-- 11. Auto-heartbeat on case link
-- ------------------------------------------------------------
-- Whenever a case is inserted or updated with investigation_id set,
-- bump the parent investigation's last_activity_at. Keeps the
-- auto-close timer accurate.
create or replace function public.bump_investigation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.investigation_id is not null then
    update public.investigations
      set last_activity_at = now()
      where id = new.investigation_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists cases_bump_investigation on public.cases;
create trigger cases_bump_investigation
  after insert or update of investigation_id on public.cases
  for each row execute function public.bump_investigation_activity();
