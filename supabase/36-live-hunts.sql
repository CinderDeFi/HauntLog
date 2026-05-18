-- ============================================================
-- HauntLog — Step 28 migration
-- Live hunts for an investigation
-- ============================================================
-- The investigation page already shows SEALED cases. This RPC
-- surfaces what's happening RIGHT NOW: active check-ins from
-- investigation members. Useful when teammates are spread out and
-- you want to glance at who's actively investigating where.
--
-- Only includes:
--   - investigation members (not all team members)
--   - active, non-expired check-ins
--   - public or anonymous visibility (private hunts don't create check_ins)
--
-- For each row we attach:
--   - owner profile (handle/avatar/display_name)
--   - their group within this investigation, if any (via the
--     investigation_group_members junction)
-- ============================================================

create or replace function public.list_active_hunts_in_investigation(
  p_investigation_id uuid
)
returns table (
  check_in_id uuid,
  hunt_id text,
  owner_id uuid,
  owner_handle text,
  owner_display_name text,
  owner_avatar_url text,
  is_anonymous boolean,
  location_name text,
  started_at timestamptz,
  expires_at timestamptz,
  group_id uuid,
  group_zone text
)
language sql
security definer
set search_path = public
stable
as $$
  -- Only callers who can see the investigation get any rows back.
  with allowed as (
    select 1
    from public.investigations inv
    join public.team_members tm on tm.team_id = inv.team_id
    where inv.id = p_investigation_id
      and tm.user_id = auth.uid()
  )
  select
    ci.id as check_in_id,
    ci.hunt_id,
    ci.owner_id,
    case when ci.visibility = 'anonymous' then null else p.handle end as owner_handle,
    case when ci.visibility = 'anonymous' then null else p.display_name end as owner_display_name,
    case when ci.visibility = 'anonymous' then null else p.avatar_url end as owner_avatar_url,
    (ci.visibility = 'anonymous') as is_anonymous,
    ci.location_name,
    ci.started_at,
    ci.expires_at,
    g.id as group_id,
    g.zone as group_zone
  from public.check_ins ci
  join public.profiles p on p.id = ci.owner_id
  -- Must be an active member of THIS investigation.
  join public.investigation_members im
    on im.investigation_id = p_investigation_id
    and im.user_id = ci.owner_id
    and im.left_at is null
  -- Group lookup is best-effort: a member can be in 0, 1, or many
  -- groups. We surface the most-recently-joined active group as the
  -- "currently leading" group label for display purposes.
  left join lateral (
    select g.id, g.zone
    from public.investigation_group_members igm
    join public.investigation_groups g on g.id = igm.group_id
    where igm.user_id = ci.owner_id
      and g.investigation_id = p_investigation_id
      and igm.left_at is null
      and g.ended_at is null
    order by igm.added_at desc
    limit 1
  ) g on true
  where ci.active = true
    and ci.expires_at > now()
    and exists (select 1 from allowed)
  order by ci.started_at desc;
$$;

grant execute on function public.list_active_hunts_in_investigation(uuid) to authenticated;
