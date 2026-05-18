-- ============================================================
-- HauntLog — Step 26 migration
-- Multi-group membership + leader tagging on hunt start
-- ============================================================
-- Step 25 stored one group per user via investigation_members.group_id.
-- The real-world model is different: people can split, regroup, or
-- belong to multiple parties during one investigation night.
--
-- This migration:
--   - Adds a junction table `investigation_group_members` for the
--     true many-to-many relationship between users and groups.
--   - Keeps `investigation_members.group_id` but treats it as
--     a "currently active" hint, not a constraint.
--   - Adds RPCs: tag_into_group, untag_from_group, create_group_with_members.
--   - Allows being in multiple groups at once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Junction table
-- ------------------------------------------------------------
create table if not exists public.investigation_group_members (
  group_id uuid not null references public.investigation_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);

create index if not exists igm_user_idx
  on public.investigation_group_members (user_id) where left_at is null;
create index if not exists igm_group_idx
  on public.investigation_group_members (group_id) where left_at is null;

alter table public.investigation_group_members enable row level security;

-- READ: any member of the parent investigation's team can see the
-- assignments.
drop policy if exists igm_read on public.investigation_group_members;
create policy igm_read on public.investigation_group_members
  for select using (
    exists (
      select 1
      from public.investigation_groups g
      join public.investigations inv on inv.id = g.investigation_id
      join public.team_members tm on tm.team_id = inv.team_id
      where g.id = investigation_group_members.group_id
        and tm.user_id = auth.uid()
    )
  );

-- INSERT: handled exclusively via RPCs below for proper validation
-- (only members of the parent investigation can be tagged; only
-- group leader or tagged self can add).
drop policy if exists igm_insert on public.investigation_group_members;
create policy igm_insert on public.investigation_group_members
  for insert with check (
    -- Either the user is adding themselves (self-select),
    -- OR the leader is adding someone to their own group.
    (user_id = auth.uid() and added_by = auth.uid())
    or exists (
      select 1
      from public.investigation_groups g
      where g.id = investigation_group_members.group_id
        and g.leader_id = auth.uid()
    )
  );

-- UPDATE: update yourself (set left_at) or leader updates anyone.
drop policy if exists igm_update on public.investigation_group_members;
create policy igm_update on public.investigation_group_members
  for update using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.investigation_groups g
      where g.id = investigation_group_members.group_id
        and g.leader_id = auth.uid()
    )
  );

-- DELETE: self or leader.
drop policy if exists igm_delete on public.investigation_group_members;
create policy igm_delete on public.investigation_group_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.investigation_groups g
      where g.id = investigation_group_members.group_id
        and g.leader_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2. Update list_investigation_groups to use the junction table
-- ------------------------------------------------------------
-- Member counts now come from the junction.
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
      select count(*) from public.investigation_group_members igm
      where igm.group_id = g.id and igm.left_at is null
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

-- ------------------------------------------------------------
-- 3. RPC: create_investigation_group_with_members
-- ------------------------------------------------------------
-- Creates a group with the caller as leader AND auto-tags an array
-- of teammates into it. Used by the new HuntStart flow.
create or replace function public.create_investigation_group_with_members(
  p_investigation_id uuid,
  p_zone text,
  p_member_ids uuid[]
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
  v_member uuid;
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

  -- Add the leader to the junction.
  insert into public.investigation_group_members (group_id, user_id, added_by)
  values (v_group_id, v_uid, v_uid)
  on conflict (group_id, user_id) do nothing;

  -- Tag the additional members. Only those who are actually members
  -- of this investigation (and not already in a different open group)
  -- — silently skip the rest.
  if p_member_ids is not null then
    foreach v_member in array p_member_ids loop
      if v_member is null or v_member = v_uid then
        continue;
      end if;
      if exists (
        select 1 from public.investigation_members
        where investigation_id = p_investigation_id
          and user_id = v_member
          and left_at is null
      ) then
        insert into public.investigation_group_members (group_id, user_id, added_by)
        values (v_group_id, v_member, v_uid)
        on conflict (group_id, user_id) do nothing;
      end if;
    end loop;
  end if;

  -- Heartbeat the investigation.
  update public.investigations
    set last_activity_at = now()
    where id = p_investigation_id;

  return v_group_id;
end;
$$;

grant execute on function public.create_investigation_group_with_members(uuid, text, uuid[])
  to authenticated;

-- ------------------------------------------------------------
-- 4. RPC: tag_member_into_group
-- ------------------------------------------------------------
-- Adds a single user to an existing group. Only the group leader
-- (or the user themselves, for self-select) can call this.
create or replace function public.tag_member_into_group(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leader uuid;
  v_inv_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select leader_id, investigation_id into v_leader, v_inv_id
  from public.investigation_groups
  where id = p_group_id and ended_at is null;
  if v_leader is null then
    raise exception 'group not found or has ended';
  end if;
  -- Only leader OR the user themselves can add.
  if v_leader <> v_uid and p_user_id <> v_uid then
    raise exception 'only the group leader can tag others';
  end if;
  -- Validate the target user is a member of the parent investigation.
  if not exists (
    select 1 from public.investigation_members
    where investigation_id = v_inv_id
      and user_id = p_user_id
      and left_at is null
  ) then
    raise exception 'that user is not in this investigation';
  end if;

  insert into public.investigation_group_members (group_id, user_id, added_by)
  values (p_group_id, p_user_id, v_uid)
  on conflict (group_id, user_id) do update set left_at = null;

  update public.investigations
    set last_activity_at = now()
    where id = v_inv_id;
end;
$$;

grant execute on function public.tag_member_into_group(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. RPC: untag_member_from_group
-- ------------------------------------------------------------
create or replace function public.untag_member_from_group(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leader uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select leader_id into v_leader from public.investigation_groups where id = p_group_id;
  if v_leader is null then
    raise exception 'group not found';
  end if;
  if v_leader <> v_uid and p_user_id <> v_uid then
    raise exception 'only the group leader can untag others';
  end if;

  delete from public.investigation_group_members
  where group_id = p_group_id and user_id = p_user_id;
end;
$$;

grant execute on function public.untag_member_from_group(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Helper: list_my_groups_in_investigation
-- ------------------------------------------------------------
-- Returns all (active) group memberships for the caller in a
-- specific investigation.
create or replace function public.list_my_groups_in_investigation(p_investigation_id uuid)
returns setof public.investigation_group_members
language sql
security definer
set search_path = public
stable
as $$
  select igm.*
  from public.investigation_group_members igm
  join public.investigation_groups g on g.id = igm.group_id
  where g.investigation_id = p_investigation_id
    and igm.user_id = auth.uid()
    and igm.left_at is null
  order by igm.added_at asc;
$$;

grant execute on function public.list_my_groups_in_investigation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. Helper: list_group_members
-- ------------------------------------------------------------
-- Returns the active members of a single group with profile info.
create or replace function public.list_group_members(p_group_id uuid)
returns table (
  user_id uuid,
  added_at timestamptz,
  added_by uuid,
  handle text,
  display_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    igm.user_id,
    igm.added_at,
    igm.added_by,
    p.handle,
    p.display_name,
    p.avatar_url
  from public.investigation_group_members igm
  join public.profiles p on p.id = igm.user_id
  join public.investigation_groups g on g.id = igm.group_id
  where igm.group_id = p_group_id
    and igm.left_at is null
    and exists (
      select 1
      from public.investigations inv
      join public.team_members tm on tm.team_id = inv.team_id
      where inv.id = g.investigation_id
        and tm.user_id = auth.uid()
    )
  order by igm.added_at asc;
$$;

grant execute on function public.list_group_members(uuid) to authenticated;
