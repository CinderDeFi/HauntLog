-- ============================================================
-- HauntLog — Step 17 migration
-- Notifications engine
-- ============================================================
-- Six event types in v1:
--   follow             — someone followed you (person -> person)
--   venue_follow       — someone followed your venue
--   case_at_venue      — public case logged at a venue you follow
--   claim_approved     — your venue claim was approved
--   claim_rejected     — your venue claim was rejected
--   claim_submitted    — admin notification (new claim in queue)
--   case_comment       — someone commented on your case
--
-- Self-actions are excluded at the trigger level (you don't get
-- notified when you follow your own venue, comment on your own
-- case, etc.).
-- ============================================================

-- ------------------------------------------------------------
-- 1. enum
-- ------------------------------------------------------------
do $$ begin
  create type notification_kind_t as enum (
    'follow',
    'venue_follow',
    'case_at_venue',
    'claim_approved',
    'claim_rejected',
    'claim_submitted',
    'case_comment'
  );
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 2. notifications table
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind notification_kind_t not null,
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text,
  target_id text,
  data jsonb default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Only the recipient can read their notifications. Admins NOT exempt —
-- privacy matters even for the platform owner.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (user_id = auth.uid());

-- The recipient can mark their own notifications read (update read_at).
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts only happen via security-definer triggers / RPCs — block
-- direct API inserts. (No INSERT policy = nobody can directly insert.)

-- ------------------------------------------------------------
-- 3. helper: emit a notification (security definer, callable from triggers)
-- ------------------------------------------------------------
create or replace function public.emit_notification(
  p_user_id uuid,
  p_kind notification_kind_t,
  p_actor_id uuid,
  p_target_type text,
  p_target_id text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Self-action filter: never notify yourself about your own action.
  if p_actor_id is not null and p_actor_id = p_user_id then
    return;
  end if;
  insert into public.notifications (user_id, kind, actor_id, target_type, target_id, data)
  values (p_user_id, p_kind, p_actor_id, p_target_type, p_target_id, p_data);
end;
$$;

-- ------------------------------------------------------------
-- 4. Triggers
-- ------------------------------------------------------------

-- 4a. follows -> notify the followee
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.emit_notification(
    new.followee_id,
    'follow'::notification_kind_t,
    new.follower_id,
    'profile',
    new.followee_id::text,
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists tr_notify_on_follow on public.follows;
create trigger tr_notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- 4b. venue_follows -> notify all owners/managers of the venue
create or replace function public.notify_on_venue_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_name text;
begin
  select name into v_location_name from public.locations where id = new.location_id;
  -- Fan out to every manager of the venue.
  insert into public.notifications (user_id, kind, actor_id, target_type, target_id, data)
  select
    lm.user_id,
    'venue_follow'::notification_kind_t,
    new.follower_id,
    'location',
    new.location_id,
    jsonb_build_object('location_name', coalesce(v_location_name, ''))
  from public.location_managers lm
  where lm.location_id = new.location_id
    and lm.user_id <> new.follower_id;     -- self-action filter
  return new;
end;
$$;

drop trigger if exists tr_notify_on_venue_follow on public.venue_follows;
create trigger tr_notify_on_venue_follow
  after insert on public.venue_follows
  for each row execute function public.notify_on_venue_follow();

-- 4c. case_comments -> notify the case owner
create or replace function public.notify_on_case_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  select owner_id, title into v_owner, v_title from public.cases where id = new.case_id;
  if v_owner is null then return new; end if;
  perform public.emit_notification(
    v_owner,
    'case_comment'::notification_kind_t,
    new.author_id,
    'case',
    new.case_id,
    jsonb_build_object('case_title', coalesce(v_title, ''))
  );
  return new;
end;
$$;

drop trigger if exists tr_notify_on_case_comment on public.case_comments;
create trigger tr_notify_on_case_comment
  after insert on public.case_comments
  for each row execute function public.notify_on_case_comment();

-- 4d. cases (public/anonymous) at a venue -> notify all venue followers
create or replace function public.notify_on_case_at_venue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_name text;
  v_owner_handle text;
begin
  -- Only when sealed transitions to true with a location_id + public/anonymous.
  if new.sealed is not true then return new; end if;
  if new.location_id is null then return new; end if;
  if new.visibility not in ('public', 'anonymous') then return new; end if;
  -- Avoid re-firing on updates that don't change sealing.
  if tg_op = 'UPDATE' and old.sealed is true then return new; end if;

  select name into v_location_name from public.locations where id = new.location_id;
  select handle into v_owner_handle from public.profiles where id = new.owner_id;

  -- Fan out to every venue follower (except the case owner themselves).
  insert into public.notifications (user_id, kind, actor_id, target_type, target_id, data)
  select
    vf.follower_id,
    'case_at_venue'::notification_kind_t,
    case when new.visibility = 'anonymous' then null else new.owner_id end,
    'case',
    new.id,
    jsonb_build_object(
      'location_id', new.location_id,
      'location_name', coalesce(v_location_name, ''),
      'case_title', new.title,
      'visibility', new.visibility,
      'owner_handle', case when new.visibility = 'anonymous' then null else coalesce(v_owner_handle, '') end
    )
  from public.venue_follows vf
  where vf.location_id = new.location_id
    and vf.follower_id <> new.owner_id;
  return new;
end;
$$;

drop trigger if exists tr_notify_on_case_at_venue on public.cases;
create trigger tr_notify_on_case_at_venue
  after insert or update of sealed on public.cases
  for each row execute function public.notify_on_case_at_venue();

-- 4e. claim submission -> notify all platform admins
-- (We wire this into the submit_location_claim RPC instead of a
-- trigger so we don't duplicate logic. See 22-claim-flow.sql.)

-- ------------------------------------------------------------
-- 5. Wire claim flow RPCs to emit notifications
-- ------------------------------------------------------------
-- submit_location_claim: notify all admins
create or replace function public.submit_location_claim(
  p_location_id text,
  p_claimed_role text,
  p_message text,
  p_proof_links text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim_id uuid;
  v_location_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_location_id is null or p_location_id = '' then
    raise exception 'location_id is required';
  end if;
  if p_message is null or length(trim(p_message)) < 20 then
    raise exception 'verification message must be at least 20 characters';
  end if;
  if not exists (select 1 from public.locations where id = p_location_id) then
    raise exception 'location not found';
  end if;

  insert into public.location_claims (
    location_id, claimant_id, status, claimed_role, message, proof_links
  ) values (
    p_location_id, v_uid, 'pending', p_claimed_role, trim(p_message), p_proof_links
  )
  returning id into v_claim_id;

  insert into public.admin_reviews (kind, target_id, status, submitted_by)
  values ('location_claim', v_claim_id::text, 'pending', v_uid);

  -- Notify every admin about the new claim.
  select name into v_location_name from public.locations where id = p_location_id;
  insert into public.notifications (user_id, kind, actor_id, target_type, target_id, data)
  select
    p.id,
    'claim_submitted'::notification_kind_t,
    v_uid,
    'claim',
    v_claim_id::text,
    jsonb_build_object(
      'location_id', p_location_id,
      'location_name', coalesce(v_location_name, ''),
      'claimed_role', p_claimed_role
    )
  from public.profiles p
  where p.is_admin = true
    and p.id <> v_uid;

  return v_claim_id;
end;
$$;

grant execute on function public.submit_location_claim(text, text, text, text[]) to authenticated;

-- approve_location_claim: notify the claimant
create or replace function public.approve_location_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location text;
  v_claimant uuid;
  v_location_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select location_id, claimant_id
    into v_location, v_claimant
    from public.location_claims
    where id = p_claim_id;

  if v_location is null then
    raise exception 'claim not found';
  end if;

  update public.location_claims
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where id = p_claim_id;

  update public.locations
    set claimed_by = v_claimant,
        verified = true,
        claim_status = 'verified',
        updated_at = now()
    where id = v_location;

  insert into public.location_managers (location_id, user_id, role)
  values (v_location, v_claimant, 'owner')
  on conflict (location_id, user_id) do update
    set role = 'owner';

  update public.admin_reviews
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where kind = 'location_claim'
      and target_id = p_claim_id::text;

  -- Notify the claimant.
  select name into v_location_name from public.locations where id = v_location;
  perform public.emit_notification(
    v_claimant,
    'claim_approved'::notification_kind_t,
    auth.uid(),
    'location',
    v_location,
    jsonb_build_object(
      'location_id', v_location,
      'location_name', coalesce(v_location_name, ''),
      'claim_id', p_claim_id::text
    )
  );
end;
$$;

grant execute on function public.approve_location_claim(uuid) to authenticated;

-- reject_location_claim: notify the claimant
create or replace function public.reject_location_claim(
  p_claim_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimant uuid;
  v_location text;
  v_location_name text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select claimant_id, location_id into v_claimant, v_location
  from public.location_claims where id = p_claim_id;
  if v_claimant is null then
    raise exception 'claim not found';
  end if;

  update public.location_claims
    set status = 'rejected',
        decided_at = now(),
        decided_by = auth.uid(),
        admin_note = coalesce(p_note, admin_note)
    where id = p_claim_id;

  update public.admin_reviews
    set status = 'rejected',
        decided_at = now(),
        decided_by = auth.uid()
    where kind = 'location_claim'
      and target_id = p_claim_id::text;

  select name into v_location_name from public.locations where id = v_location;
  perform public.emit_notification(
    v_claimant,
    'claim_rejected'::notification_kind_t,
    auth.uid(),
    'location',
    v_location,
    jsonb_build_object(
      'location_id', v_location,
      'location_name', coalesce(v_location_name, ''),
      'claim_id', p_claim_id::text,
      'note', p_note
    )
  );
end;
$$;

grant execute on function public.reject_location_claim(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Reader RPCs
-- ------------------------------------------------------------
create or replace function public.get_unread_notification_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.notifications
  where user_id = auth.uid()
    and read_at is null;
$$;

grant execute on function public.get_unread_notification_count() to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
    set read_at = now()
    where user_id = auth.uid()
      and read_at is null;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
