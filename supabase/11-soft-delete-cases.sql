-- ============================================================
-- HauntLog — Step 6 migration
-- Soft-delete for cases
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add soft-delete columns to cases
-- ------------------------------------------------------------
alter table public.cases
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists cases_active_idx
  on public.cases (owner_id, started_at desc)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 2. Extend the cases read policy: deleted cases are invisible
-- ------------------------------------------------------------
-- A deleted case is invisible to everyone EXCEPT the owner who deleted it
-- (so they can recover via support if needed). For now we just hide
-- entirely; we can build "restore" UX later.
-- ------------------------------------------------------------
drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases
  for select using (
    deleted_at is null
    and (
      visibility in ('public', 'anonymous')
      or (owner_id is not null and owner_id = auth.uid())
      or (
        team_id is not null and exists (
          select 1 from public.team_members
          where team_members.team_id = cases.team_id
            and team_members.user_id = auth.uid()
        )
      )
    )
  );

-- ------------------------------------------------------------
-- 3. Update the feed index to filter out deleted rows
-- ------------------------------------------------------------
drop index if exists cases_feed_idx;
create index if not exists cases_feed_idx
  on public.cases (created_at desc)
  where visibility in ('public', 'anonymous') and deleted_at is null;

-- ------------------------------------------------------------
-- 4. RPC: soft-delete a case
-- ------------------------------------------------------------
-- Only the case owner can delete. Marks the row as deleted but doesn't
-- physically remove it — future scheduled job can hard-delete after 30
-- days. RLS will hide it from all reads immediately.
-- ------------------------------------------------------------
create or replace function public.delete_case(p_case_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select owner_id into v_owner from public.cases where id = p_case_id;

  if v_owner is null then
    raise exception 'case not found';
  end if;

  if v_owner <> v_uid then
    raise exception 'only the case owner can delete';
  end if;

  update public.cases
    set deleted_at = now(),
        deleted_by = v_uid
    where id = p_case_id;
end;
$$;

grant execute on function public.delete_case(text) to authenticated;
