-- ============================================================
-- HauntLog — Step 3.6 migration: Admin dashboard support
-- ============================================================
-- - approve_location_claim(claim_id) — sets locations.claimed_by, marks
--   the claim approved, closes the admin_reviews row.
-- - reject_location_claim(claim_id, note) — closes the claim, no side effect.
-- - approve_team_verification(team_id) — marks teams.verified, closes review.
-- - reject_team_verification(team_id, note) — closes review only.
-- All gated on is_admin() so non-admins can't call them.
-- ============================================================

-- Approve a location claim
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

  -- Mark claim approved
  update public.location_claims
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where id = p_claim_id;

  -- Set the location's claimed_by AND mark verified
  update public.locations
    set claimed_by = v_claimant,
        verified = true
    where id = v_location;

  -- Close the admin_reviews entry
  update public.admin_reviews
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where kind = 'location_claim'
      and target_id = p_claim_id::text;
end;
$$;

create or replace function public.reject_location_claim(
  p_claim_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
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
        decided_by = auth.uid(),
        notes = coalesce(p_note, notes)
    where kind = 'location_claim'
      and target_id = p_claim_id::text;
end;
$$;

create or replace function public.approve_team_verification(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.teams
    set verified = true
    where id = p_team_id;

  update public.admin_reviews
    set status = 'approved',
        decided_at = now(),
        decided_by = auth.uid()
    where kind = 'team_verification'
      and target_id = p_team_id::text;
end;
$$;

create or replace function public.reject_team_verification(
  p_team_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.admin_reviews
    set status = 'rejected',
        decided_at = now(),
        decided_by = auth.uid(),
        notes = coalesce(p_note, notes)
    where kind = 'team_verification'
      and target_id = p_team_id::text;
end;
$$;

grant execute on function public.approve_location_claim(uuid) to authenticated;
grant execute on function public.reject_location_claim(uuid, text) to authenticated;
grant execute on function public.approve_team_verification(uuid) to authenticated;
grant execute on function public.reject_team_verification(uuid, text) to authenticated;

-- ============================================================
-- IMPORTANT: Make yourself an admin
-- ============================================================
-- After running this migration, mark your own profile as admin so the
-- /app/admin route shows up for you. Replace the email below with the
-- email you signed up with.
--
-- Run this separately after confirming the email match:
--
--   update public.profiles
--     set is_admin = true
--     where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
--
-- Verify:
--   select handle, is_admin from public.profiles where is_admin = true;
-- ============================================================
