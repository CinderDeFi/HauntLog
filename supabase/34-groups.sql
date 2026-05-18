-- ============================================================
-- HauntLog — Step 25 migration
-- Groups within investigations
-- ============================================================
-- A "group" is a smaller party within an investigation — e.g.,
-- "Basement Sweep" or "Third Floor Detail". The investigation
-- leader (or any member, with the leader's nod) announces a group
-- and other members self-select to join. Each person still seals
-- their own case; the case auto-links to whichever group they
-- were in at seal time.
--
-- Builds on step 24:
--   - investigation_members.group_id placeholder column already exists
--   - cases.group_id placeholder column already exists
-- We just add the parent table + RLS + RPCs.
-- ============================================================

-- ------------------------------------------------------------
-- 1. investigation_groups table
-- ------------------------------------------------------------
create table if not exists public.investigation_groups (
  id uuid primary key default uuid_generate_v4(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  leader_id uuid not null references public.profiles(id) on delete cascade,
  -- The zone / area this group is covering. Free text. e.g. "Basement",
  -- "Third floor & bell tower". Required so members can tell groups apart.
  zone text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint investigation_groups_zone_check check (
    char_length(zone) between 1 and 80
  )
);

create index if not exists investigation_groups_inv_idx
  on public.investigation_groups (investigation_id, created_at asc);
create index if not exists investigation_groups_leader_idx
  on public.investigation_groups (leader_id);

alter table public.investigation_groups enable row level security;

-- READ: any team member of the parent investigation's team can see the
-- groups within it. Matches investigation visibility.
drop policy if exists groups_read on public.investigation_groups;
create policy groups_read on public.investigation_groups
  for select using (
    exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_groups.investigation_id
        and tm.user_id = auth.uid()
    )
  );

-- INSERT: any member of the investigation can announce a group (with
-- themselves as the leader). The investigation must still be open.
drop policy if exists groups_insert on public.investigation_groups;
create policy groups_insert on public.investigation_groups
  for insert with check (
    leader_id = auth.uid()
    and exists (
      select 1
      from public.investigations inv
      join public.investigation_members im
        on im.investigation_id = inv.id and im.user_id = auth.uid()
      where inv.id = investigation_groups.investigation_id
        and inv.status = 'open'
        and im.left_at is null
    )
  );

-- UPDATE: only the leader can update (rename zone, end the group).
-- Team owner can override.
drop policy if exists groups_update on public.investigation_groups;
create policy groups_update on public.investigation_groups
  for update using (
    leader_id = auth.uid()
    or exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_groups.investigation_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- DELETE: leader or team owner.
drop policy if exists groups_delete on public.investigation_groups;
create policy groups_delete on public.investigation_groups
  for delete using (
    leader_id = auth.uid()
    or exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = investigation_groups.investigation_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- 2. Add the foreign key constraint we couldn't add in step 24
-- ------------------------------------------------------------
-- Now that investigation_groups exists, we can wire up the
-- group_id column on investigation_members and cases.

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'investigation_members'
      and constraint_name = 'investigation_members_group_id_fkey'
  ) then
    alter table public.investigation_members
      add constraint investigation_members_group_id_fkey
      foreign key (group_id) references public.investigation_groups(id)
      on delete set null;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'cases'
      and constraint_name = 'cases_group_id_fkey'
  ) then
    alter table public.cases
      add constraint cases_group_id_fkey
      foreign key (group_id) references public.investigation_groups(id)
      on delete set null;
  end if;
end$$;

create index if not exists cases_group_idx
  on public.cases (group_id) where group_id is not null;
create index if not exists investigation_members_group_idx
  on public.investigation_members (group_id) where group_id is not null;

-- ------------------------------------------------------------
-- 3. RPC: create_investigation_group
-- ------------------------------------------------------------
-- Creates a group with the caller as leader, and auto-joins the
-- caller to the group. Verifies the caller is a member of the
-- parent investigation and that it's still open.
create or replace function public.create_investigation_group(
  p_investigation_id uuid,
  p_zone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
  v_zone text := trim(p_zone);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_zone is null or length(v_zone) = 0 then
    raise exception 'zone is required';
  end if;
  if not exists (
    select 1
    from public.investigations inv
    join public.investigation_members im
      on im.investigation_id = inv.id and im.user_id = v_uid
    where inv.id = p_investigation_id
      and inv.status = 'open'
      and im.left_at is null
  ) then
    raise exception 'you are not a member of an open investigation';
  end if;

  insert into public.investigation_groups (investigation_id, leader_id, zone)
  values (p_investigation_id, v_uid, v_zone)
  returning id into v_group_id;

  -- Auto-join leader to the group. If they were in a different group,
  -- move them.
  update public.investigation_members
    set group_id = v_group_id
    where investigation_id = p_investigation_id
      and user_id = v_uid;

  -- Heartbeat the investigation
  update public.investigations
    set last_activity_at = now()
    where id = p_investigation_id;

  return v_group_id;
end;
$$;

grant execute on function public.create_investigation_group(uuid, text)
  to authenticated;

-- ------------------------------------------------------------
-- 4. RPC: join_investigation_group
-- ------------------------------------------------------------
-- Member self-selects into a group. Sets their group_id on the
-- investigation_members row. Replaces any prior group assignment
-- (one group per investigation per user).
create or replace function public.join_investigation_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select investigation_id into v_inv_id
  from public.investigation_groups
  where id = p_group_id;

  if v_inv_id is null then
    raise exception 'group not found';
  end if;

  -- Confirm the caller is a member of the parent investigation
  -- and it's still open.
  if not exists (
    select 1
    from public.investigations inv
    join public.investigation_members im
      on im.investigation_id = inv.id and im.user_id = v_uid
    where inv.id = v_inv_id
      and inv.status = 'open'
      and im.left_at is null
  ) then
    raise exception 'you are not an active member of this open investigation';
  end if;

  -- Reject if the group has ended.
  if exists (
    select 1 from public.investigation_groups
    where id = p_group_id and ended_at is not null
  ) then
    raise exception 'that group has already ended';
  end if;

  update public.investigation_members
    set group_id = p_group_id
    where investigation_id = v_inv_id
      and user_id = v_uid;

  update public.investigations
    set last_activity_at = now()
    where id = v_inv_id;
end;
$$;

grant execute on function public.join_investigation_group(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. RPC: leave_investigation_group
-- ------------------------------------------------------------
-- Clears the caller's group_id. They become "solo" within the
-- investigation again.
create or replace function public.leave_investigation_group(p_investigation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.investigation_members
    set group_id = null
    where investigation_id = p_investigation_id
      and user_id = v_uid;
end;
$$;

grant execute on function public.leave_investigation_group(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. RPC: end_investigation_group
-- ------------------------------------------------------------
-- Leader (or team owner) closes the group. Members are NOT
-- auto-removed — their group_id stays set so post-hoc analysis can
-- show "this case was logged as part of the basement sweep."
-- Members can still leave the group manually.
create or replace function public.end_investigation_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leader uuid;
  v_inv_id uuid;
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select leader_id, investigation_id into v_leader, v_inv_id
  from public.investigation_groups
  where id = p_group_id;
  if v_leader is null then
    raise exception 'group not found';
  end if;
  select team_id into v_team_id from public.investigations where id = v_inv_id;
  -- Allow leader OR team owner.
  if v_leader <> v_uid and not exists (
    select 1 from public.team_members
    where team_id = v_team_id and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'only the group leader or team owner can end a group';
  end if;

  update public.investigation_groups
    set ended_at = now()
    where id = p_group_id
      and ended_at is null;
end;
$$;

grant execute on function public.end_investigation_group(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. Helper: list_investigation_groups
-- ------------------------------------------------------------
-- Returns all groups for an investigation with member counts and
-- leader info, ordered by creation time.
create or replace function public.list_investigation_groups(p_investigation_id uuid)
returns table (
  id uuid,
  investigation_id uuid,
  leader_id uuid,
  leader_handle text,
  leader_display_name text,
  leader_avatar_url text,
  zone text,
  created_at timestamptz,
  ended_at timestamptz,
  member_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    g.investigation_id,
    g.leader_id,
    p.handle as leader_handle,
    p.display_name as leader_display_name,
    p.avatar_url as leader_avatar_url,
    g.zone,
    g.created_at,
    g.ended_at,
    (
      select count(*) from public.investigation_members im
      where im.group_id = g.id and im.left_at is null
    ) as member_count
  from public.investigation_groups g
  join public.profiles p on p.id = g.leader_id
  where g.investigation_id = p_investigation_id
    and exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = g.investigation_id
        and tm.user_id = auth.uid()
    )
  order by g.created_at asc;
$$;

grant execute on function public.list_investigation_groups(uuid) to authenticated;
