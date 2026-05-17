-- ============================================================
-- HauntLog — Step 21: User venue submissions
-- ============================================================
-- Anyone signed in can submit a venue for inclusion on the atlas.
-- Admin reviews. On approve, the submission becomes a real
-- locations row. If the submitter said they own/operate the
-- venue, they're also installed as a location_manager.
--
-- Spam control: max 1 PENDING submission per user at a time.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend admin_reviews.kind constraint to allow the new value
-- ------------------------------------------------------------
alter table public.admin_reviews
  drop constraint if exists admin_reviews_kind_check;
alter table public.admin_reviews
  add constraint admin_reviews_kind_check
  check (kind in ('location_claim', 'team_verification', 'location_submission'));

-- ------------------------------------------------------------
-- 1b. Extend notification_kind_t enum with venue submission kinds.
-- ALTER TYPE ... ADD VALUE can't run inside a transaction block, so
-- these run as top-level statements. The IF NOT EXISTS clause makes
-- them idempotent (Postgres 12+).
-- ------------------------------------------------------------
alter type notification_kind_t add value if not exists 'venue_submission_approved';
alter type notification_kind_t add value if not exists 'venue_submission_rejected';

-- ------------------------------------------------------------
-- 2. New table: location_submissions
-- ------------------------------------------------------------
create table if not exists public.location_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references public.profiles(id) on delete cascade,

  -- The full payload from the form. JSON so we can iterate UI without
  -- migrations. Expected shape (see types in dataLayer.ts):
  --   { name, tagline, description, street, city, state, zip, country,
  --     lat?, lng?, tags?, hero_image?,
  --     submitter_role: 'owner' | 'operator' | 'hunter' | 'other',
  --     submitter_role_other?, notes? }
  payload jsonb not null,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  decision_note text,
  -- If approved, the location id that was created.
  approved_location_id text references public.locations(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists location_submissions_status_idx
  on public.location_submissions (status, created_at desc);
create index if not exists location_submissions_submitter_idx
  on public.location_submissions (submitter_id);

alter table public.location_submissions enable row level security;

-- Submitter can see their own; admins can see all.
drop policy if exists submissions_read on public.location_submissions;
create policy submissions_read on public.location_submissions
  for select
  using (
    submitter_id = auth.uid()
    or public.is_admin()
  );

-- Inserts go through the RPC; no direct insert policy.

-- ------------------------------------------------------------
-- 3. RPC: submit_location
-- ------------------------------------------------------------
create or replace function public.submit_location(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_pending_count int;
  v_submission_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Validate the minimum required fields.
  v_name := trim(coalesce(p_payload->>'name', ''));
  if length(v_name) < 2 then
    raise exception 'name is required (at least 2 characters)';
  end if;
  if length(v_name) > 120 then
    raise exception 'name is too long (max 120 characters)';
  end if;

  -- Description is required and substantive (prevents spam).
  if length(trim(coalesce(p_payload->>'description', ''))) < 20 then
    raise exception 'description must be at least 20 characters';
  end if;

  -- City is required so the venue can be placed somewhere on the atlas.
  if length(trim(coalesce(p_payload->>'city', ''))) < 1 then
    raise exception 'city is required';
  end if;

  -- Validate the role.
  if (p_payload->>'submitter_role') not in ('owner', 'operator', 'hunter', 'other') then
    raise exception 'submitter_role must be one of: owner, operator, hunter, other';
  end if;

  -- Rate limit: max 1 pending submission at a time.
  select count(*)
    into v_pending_count
    from public.location_submissions
    where submitter_id = v_uid
      and status = 'pending';
  if v_pending_count >= 1 then
    raise exception 'you already have a pending submission. wait for review before submitting another.';
  end if;

  insert into public.location_submissions (submitter_id, payload, status)
    values (v_uid, p_payload, 'pending')
    returning id into v_submission_id;

  insert into public.admin_reviews (kind, target_id, status, submitted_by)
    values ('location_submission', v_submission_id::text, 'pending', v_uid);

  return v_submission_id;
end;
$$;

grant execute on function public.submit_location(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. RPC: approve_location_submission
-- ------------------------------------------------------------
-- Creates a locations row from the submission payload. If the
-- submitter said they were the owner or operator, installs them
-- as a location_manager so they can manage the venue.
-- ------------------------------------------------------------
create or replace function public.approve_location_submission(p_submission_id uuid)
returns text -- the new location id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_id text;
  v_base_slug text;
  v_slug text;
  v_n int := 1;
  v_role text;
  v_role_lc text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_sub
    from public.location_submissions
    where id = p_submission_id;

  if v_sub.id is null then
    raise exception 'submission not found';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'submission already decided';
  end if;

  -- Generate a slug from the name. Lowercase, hyphenate, strip non-alnum.
  v_base_slug := regexp_replace(
    lower(trim(v_sub.payload->>'name')),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  v_base_slug := trim(both '-' from v_base_slug);
  if length(v_base_slug) = 0 then
    v_base_slug := 'venue';
  end if;

  -- De-dupe — if `lizzie-borden-house` exists, try `lizzie-borden-house-2`, etc.
  v_slug := v_base_slug;
  while exists (select 1 from public.locations where id = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base_slug || '-' || v_n::text;
  end loop;

  v_id := v_slug;

  insert into public.locations (
    id, source, name, lat, lng,
    description, street, city, state, zip, country,
    website, booking_url, tags, photos,
    created_by_handle, verified, claim_status
  ) values (
    v_id,
    'user',
    trim(v_sub.payload->>'name'),
    coalesce((v_sub.payload->>'lat')::double precision, 0),
    coalesce((v_sub.payload->>'lng')::double precision, 0),
    nullif(trim(v_sub.payload->>'description'), ''),
    nullif(trim(v_sub.payload->>'street'), ''),
    nullif(trim(v_sub.payload->>'city'), ''),
    nullif(trim(v_sub.payload->>'state'), ''),
    nullif(trim(v_sub.payload->>'zip'), ''),
    nullif(trim(v_sub.payload->>'country'), ''),
    nullif(trim(v_sub.payload->>'website'), ''),
    nullif(trim(v_sub.payload->>'booking_url'), ''),
    case
      when v_sub.payload ? 'tags'
        then array(select jsonb_array_elements_text(v_sub.payload->'tags'))
      else null
    end,
    case
      when v_sub.payload ? 'hero_image' and length(trim(v_sub.payload->>'hero_image')) > 0
        then array[trim(v_sub.payload->>'hero_image')]
      else null
    end,
    coalesce(
      (select handle from public.profiles where id = v_sub.submitter_id),
      '@hauntlog'
    ),
    false,
    'unclaimed'
  );

  -- Install the submitter as a location_manager IF they claimed ownership.
  -- submitter_role values map onto location_manager_role_t as:
  --   'owner'    -> 'owner'
  --   'operator' -> 'manager'
  --   'hunter' / 'other' -> no manager row
  v_role := v_sub.payload->>'submitter_role';
  v_role_lc := lower(coalesce(v_role, ''));
  if v_role_lc = 'owner' then
    insert into public.location_managers (location_id, user_id, role)
      values (v_id, v_sub.submitter_id, 'owner'::location_manager_role_t)
      on conflict do nothing;
  elsif v_role_lc = 'operator' then
    insert into public.location_managers (location_id, user_id, role)
      values (v_id, v_sub.submitter_id, 'manager'::location_manager_role_t)
      on conflict do nothing;
  end if;

  -- Mark the submission approved.
  update public.location_submissions
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid(),
        approved_location_id = v_id
    where id = p_submission_id;

  -- Mark the admin_review row.
  update public.admin_reviews
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where kind = 'location_submission'
      and target_id = p_submission_id::text;

  -- Notify the submitter.
  insert into public.notifications (recipient_id, kind, payload)
    values (
      v_sub.submitter_id,
      'venue_submission_approved',
      jsonb_build_object(
        'submission_id', p_submission_id,
        'location_id', v_id,
        'location_name', trim(v_sub.payload->>'name')
      )
    );

  return v_id;
end;
$$;

grant execute on function public.approve_location_submission(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. RPC: reject_location_submission
-- ------------------------------------------------------------
create or replace function public.reject_location_submission(
  p_submission_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_sub
    from public.location_submissions
    where id = p_submission_id;

  if v_sub.id is null then
    raise exception 'submission not found';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'submission already decided';
  end if;

  update public.location_submissions
    set status = 'rejected',
        decided_at = now(),
        decided_by = auth.uid(),
        decision_note = p_note
    where id = p_submission_id;

  update public.admin_reviews
    set status = 'rejected',
        decided_at = now(),
        decided_by = auth.uid(),
        notes = p_note
    where kind = 'location_submission'
      and target_id = p_submission_id::text;

  -- Notify the submitter.
  insert into public.notifications (recipient_id, kind, payload)
    values (
      v_sub.submitter_id,
      'venue_submission_rejected',
      jsonb_build_object(
        'submission_id', p_submission_id,
        'location_name', trim(v_sub.payload->>'name'),
        'note', p_note
      )
    );
end;
$$;

grant execute on function public.reject_location_submission(uuid, text) to authenticated;
