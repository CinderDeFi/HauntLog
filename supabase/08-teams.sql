-- ============================================================
-- HauntLog — Step 3.9 migration
-- Teams (invites + socials) + profile socials
-- ============================================================

-- ------------------------------------------------------------
-- 1. Social columns on teams
-- ------------------------------------------------------------
alter table public.teams
  add column if not exists instagram text,
  add column if not exists tiktok text,
  add column if not exists facebook text,
  add column if not exists youtube text;

-- ------------------------------------------------------------
-- 2. Social columns on profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists tiktok text,
  add column if not exists facebook text,
  add column if not exists youtube text;

-- ------------------------------------------------------------
-- 3. team_invites table
-- ------------------------------------------------------------
-- A pending invite from a team owner/admin to a specific user (by handle).
-- The recipient resolves to a profile.id at invite time (we look it up).
-- Status: 'pending' / 'accepted' / 'declined' / 'rescinded' / 'expired'
-- Invites auto-expire after 14 days.

do $$ begin
  create type invite_status_t as enum ('pending', 'accepted', 'declined', 'rescinded', 'expired');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.team_invites (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  role team_role_t not null default 'member',
  message text,
  status invite_status_t not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- One pending invite per (team, invitee). Re-inviting is fine after a
-- decline / rescind / expire — the old row stays for history.
create unique index if not exists team_invites_unique_pending
  on public.team_invites (team_id, invitee_id)
  where status = 'pending';

create index if not exists team_invites_invitee_idx
  on public.team_invites (invitee_id, status);

alter table public.team_invites enable row level security;

-- Read: the invitee can see invites addressed to them. Team owners/admins
-- can see invites for their team. Admins of the platform can see anything.
drop policy if exists team_invites_read on public.team_invites;
create policy team_invites_read on public.team_invites
  for select using (
    invitee_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.team_members
      where team_members.team_id = team_invites.team_id
        and team_members.user_id = auth.uid()
        and team_members.role in ('owner', 'admin')
    )
  );

-- Insert: only team owners/admins can create invites.
-- The invited_by must be the caller.
drop policy if exists team_invites_insert on public.team_invites;
create policy team_invites_insert on public.team_invites
  for insert with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.team_members
      where team_members.team_id = team_invites.team_id
        and team_members.user_id = auth.uid()
        and team_members.role in ('owner', 'admin')
    )
  );

-- Update: the invitee can update their own (to accept/decline); owners/admins
-- can rescind. Done via RPCs below; the policy gates anything direct.
drop policy if exists team_invites_update on public.team_invites;
create policy team_invites_update on public.team_invites
  for update using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.team_members
      where team_members.team_id = team_invites.team_id
        and team_members.user_id = auth.uid()
        and team_members.role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 4. team_members RLS: tighten so members can self-leave
-- ------------------------------------------------------------
-- A user can delete their own row to "leave" a team.
drop policy if exists team_members_delete_self on public.team_members;
create policy team_members_delete_self on public.team_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- 5. RPCs
-- ------------------------------------------------------------

-- ----- create_team_invite -----
-- Looks up the invitee by handle, validates the caller is an owner/admin
-- of the team, creates a pending invite.
create or replace function public.create_team_invite(
  p_team_id uuid,
  p_invitee_handle text,
  p_role team_role_t default 'member',
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee_id uuid;
  v_invite_id uuid;
  v_already_member boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Must be owner/admin of this team
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  ) then
    raise exception 'not authorized: must be an owner or admin of this team';
  end if;

  -- Resolve handle. Normalize: ensure leading @.
  if p_invitee_handle is null or length(trim(p_invitee_handle)) = 0 then
    raise exception 'invitee handle is required';
  end if;

  select id into v_invitee_id
    from public.profiles
    where handle = case when p_invitee_handle like '@%' then p_invitee_handle else '@' || p_invitee_handle end;

  if v_invitee_id is null then
    raise exception 'no investigator with that handle';
  end if;

  if v_invitee_id = auth.uid() then
    raise exception 'cannot invite yourself';
  end if;

  -- Already a member?
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_invitee_id
  ) into v_already_member;

  if v_already_member then
    raise exception 'that investigator is already on the team';
  end if;

  insert into public.team_invites (team_id, invitee_id, invited_by, role, message)
    values (p_team_id, v_invitee_id, auth.uid(), p_role, p_message)
    returning id into v_invite_id;

  return v_invite_id;
end;
$$;

-- ----- accept_team_invite -----
-- Invitee accepts. Creates a team_members row, marks invite accepted.
create or replace function public.accept_team_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_role team_role_t;
  v_expires_at timestamptz;
  v_status invite_status_t;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select team_id, role, expires_at, status
    into v_team_id, v_role, v_expires_at, v_status
    from public.team_invites
    where id = p_invite_id and invitee_id = auth.uid();

  if v_team_id is null then
    raise exception 'invite not found';
  end if;

  if v_status <> 'pending' then
    raise exception 'invite is no longer pending';
  end if;

  if v_expires_at < now() then
    update public.team_invites
      set status = 'expired'
      where id = p_invite_id;
    raise exception 'invite has expired';
  end if;

  insert into public.team_members (team_id, user_id, role)
    values (v_team_id, auth.uid(), v_role)
    on conflict do nothing;

  update public.team_invites
    set status = 'accepted', decided_at = now()
    where id = p_invite_id;
end;
$$;

-- ----- decline_team_invite -----
create or replace function public.decline_team_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.team_invites
    set status = 'declined', decided_at = now()
    where id = p_invite_id
      and invitee_id = auth.uid()
      and status = 'pending';

  if not found then
    raise exception 'invite not found or already resolved';
  end if;
end;
$$;

-- ----- rescind_team_invite -----
-- Owner/admin cancels a pending invite.
create or replace function public.rescind_team_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select team_id into v_team_id
    from public.team_invites
    where id = p_invite_id and status = 'pending';

  if v_team_id is null then
    raise exception 'invite not found or already resolved';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = v_team_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  ) then
    raise exception 'not authorized';
  end if;

  update public.team_invites
    set status = 'rescinded', decided_at = now()
    where id = p_invite_id;
end;
$$;

-- ----- change_team_member_role -----
-- Owner changes someone's role. Can promote or demote.
-- Special case: transferring ownership (someone else becomes owner) demotes
-- the calling owner to admin so there's always exactly one owner.
create or replace function public.change_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_new_role team_role_t
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role team_role_t;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select role into v_caller_role
    from public.team_members
    where team_id = p_team_id and user_id = auth.uid();

  if v_caller_role is null then
    raise exception 'not a member of this team';
  end if;

  -- Only owners can change roles.
  if v_caller_role <> 'owner' then
    raise exception 'only the team owner can change roles';
  end if;

  -- Can't change your own role this way (would orphan the team).
  if p_user_id = auth.uid() then
    raise exception 'use leave_team or transfer ownership to a member instead';
  end if;

  -- If promoting to owner: demote the current owner to admin in same transaction.
  if p_new_role = 'owner' then
    update public.team_members
      set role = 'admin'
      where team_id = p_team_id and user_id = auth.uid();
  end if;

  update public.team_members
    set role = p_new_role
    where team_id = p_team_id and user_id = p_user_id;

  if not found then
    raise exception 'target user is not a member of this team';
  end if;
end;
$$;

-- ----- delete_team -----
-- Owner deletes the team. Cascades through team_members, team_invites.
create or replace function public.delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'only the team owner can delete the team';
  end if;

  delete from public.teams where id = p_team_id;
end;
$$;

-- ----- leave_team -----
-- A member leaves. Owners can only leave by first transferring ownership.
create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role team_role_t;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select role into v_role
    from public.team_members
    where team_id = p_team_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'not a member of this team';
  end if;

  if v_role = 'owner' then
    raise exception 'owners must transfer ownership before leaving — or delete the team';
  end if;

  delete from public.team_members
    where team_id = p_team_id and user_id = auth.uid();
end;
$$;

-- ----- create_team_with_owner -----
-- One-shot: creates a team and adds the caller as owner in the same
-- transaction. Saves an extra round trip and avoids a brief orphan state.
create or replace function public.create_team_with_owner(
  p_slug text,
  p_name text,
  p_description text default null,
  p_website text default null,
  p_instagram text default null,
  p_tiktok text default null,
  p_facebook text default null,
  p_youtube text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.teams (
    slug, name, description, website, instagram, tiktok, facebook, youtube, created_by
  ) values (
    p_slug, p_name, p_description, p_website, p_instagram, p_tiktok, p_facebook, p_youtube, auth.uid()
  ) returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role)
    values (v_team_id, auth.uid(), 'owner');

  return v_team_id;
end;
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
grant execute on function public.create_team_invite(uuid, text, team_role_t, text) to authenticated;
grant execute on function public.accept_team_invite(uuid) to authenticated;
grant execute on function public.decline_team_invite(uuid) to authenticated;
grant execute on function public.rescind_team_invite(uuid) to authenticated;
grant execute on function public.change_team_member_role(uuid, uuid, team_role_t) to authenticated;
grant execute on function public.delete_team(uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.create_team_with_owner(text, text, text, text, text, text, text, text) to authenticated;
