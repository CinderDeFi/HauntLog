-- ============================================================
-- HauntLog — Step 16 migration
-- Claim flow — wired into the existing admin_reviews queue
-- ============================================================
-- The location_claims table from step 1 already has the core shape.
-- Step 6 created approve_location_claim / reject_location_claim RPCs
-- that work against admin_reviews. Step 16:
--
-- 1. Adds claimed_role + proof_links columns to location_claims
-- 2. Adds a unique-pending index to prevent claim spam
-- 3. Adds submit_location_claim RPC — inserts BOTH the claim row
--    AND an admin_reviews row atomically
-- 4. Updates approve_location_claim to ALSO insert a location_managers
--    row (step-15 ownership) so approval makes the claimant a full
--    venue OWNER under the new model
-- 5. Adds withdraw_location_claim RPC for users to cancel pending
--    claims
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. New columns
alter table public.location_claims
  add column if not exists claimed_role text,
  add column if not exists proof_links text[];

-- 2. Prevent duplicate pending claims per (user, venue)
create unique index if not exists claims_one_pending_per_user_venue
  on public.location_claims (claimant_id, location_id)
  where status = 'pending';

-- 3. submit_location_claim RPC
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

  return v_claim_id;
end;
$$;

grant execute on function public.submit_location_claim(text, text, text, text[]) to authenticated;

-- 4. Update approve_location_claim — install location_managers row
create or replace function public.approve_location_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location text;
  v_claimant uuid;
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

  -- NEW (step 16): install claimant as venue OWNER under new model.
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
end;
$$;

grant execute on function public.approve_location_claim(uuid) to authenticated;

-- 5. withdraw_location_claim RPC
create or replace function public.withdraw_location_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim public.location_claims;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_claim from public.location_claims
  where id = p_claim_id
  for update;

  if v_claim is null then
    raise exception 'claim not found';
  end if;
  if v_claim.claimant_id <> v_uid then
    raise exception 'only the claimant can withdraw';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'can only withdraw a pending claim';
  end if;

  delete from public.admin_reviews
    where kind = 'location_claim'
      and target_id = p_claim_id::text;
  delete from public.location_claims where id = p_claim_id;
end;
$$;

grant execute on function public.withdraw_location_claim(uuid) to authenticated;
