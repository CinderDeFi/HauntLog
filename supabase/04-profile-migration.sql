-- ============================================================
-- HauntLog — Step 3.5 migration
-- Adds handle change tracking and account-deletion-with-anonymization.
-- ============================================================

-- Add handle_changed_at to profiles for cooldown enforcement
alter table public.profiles
  add column if not exists handle_changed_at timestamptz;

-- Backfill existing rows: treat their initial creation as their last
-- handle change so the cooldown applies uniformly.
update public.profiles
  set handle_changed_at = created_at
  where handle_changed_at is null;

-- ============================================================
-- Anonymize-on-delete behavior
-- When a profile is deleted, instead of cascading and dropping all
-- their cases, set the owner reference to null. The app renders
-- null owners as "Deleted investigator."
-- ============================================================

-- cases.owner_id — change CASCADE to SET NULL and allow null
alter table public.cases
  alter column owner_id drop not null;

alter table public.cases
  drop constraint if exists cases_owner_id_fkey;
alter table public.cases
  add constraint cases_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

-- log_entries.logged_by — same treatment so log entries survive
alter table public.log_entries
  alter column logged_by drop not null;

alter table public.log_entries
  drop constraint if exists log_entries_logged_by_fkey;
alter table public.log_entries
  add constraint log_entries_logged_by_fkey
  foreign key (logged_by) references public.profiles(id) on delete set null;

-- check_ins.owner_id — when user deletes, drop their old check-ins entirely
-- (they're ephemeral; no value to preserving them anonymously)
-- Already on delete cascade in original schema. Leave alone.

-- location_revisions.edited_by — keep history of edits but anonymize
alter table public.location_revisions
  alter column edited_by drop not null;

alter table public.location_revisions
  drop constraint if exists location_revisions_edited_by_fkey;
alter table public.location_revisions
  add constraint location_revisions_edited_by_fkey
  foreign key (edited_by) references public.profiles(id) on delete set null;

-- locations.claimed_by — release the claim on deletion
-- Already set null in original. Leave alone.

-- ============================================================
-- Update the cases RLS read policy to handle null owners.
-- Public/anonymous cases stay readable. Private cases owned by a
-- deleted user become unreadable (which is fine — owner is gone).
-- ============================================================
drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases
  for select using (
    visibility in ('public', 'anonymous')
    or (owner_id is not null and owner_id = auth.uid())
  );

-- ============================================================
-- Helper RPC: delete the calling user.
-- Lets a signed-in user delete their own auth account, which
-- cascades through to profiles, which our SET NULL FKs anonymize.
-- security definer so it can call into auth schema.
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Cascade delete: auth.users -> public.profiles (on cascade) -> SET NULL
  -- on cases / logs / revisions. Check-ins cascade away.
  delete from auth.users where id = uid;
end;
$$;

-- Allow signed-in callers to invoke it.
grant execute on function public.delete_my_account() to authenticated;
