-- ============================================================
-- HauntLog — Step 12 migration
-- Restore deleted case support
-- ============================================================
-- Step 6 added soft-delete (sets deleted_at). The cases_read RLS hides
-- deleted rows from everyone, which is correct for the public side —
-- but the OWNER should still be able to see their own deleted cases
-- in a "Recently Deleted" section so they can restore them.
--
-- Approach: two security-definer RPCs, both owner-only.
--   - list_my_deleted_cases() returns the owner's soft-deleted rows
--   - undelete_case(id) clears deleted_at on a case the user owns
--
-- We use RPCs instead of widening cases_read so deleted rows stay
-- invisible to any non-owner code path (including any future
-- screens that might join on cases).
-- ============================================================

-- ------------------------------------------------------------
-- RPC: list_my_deleted_cases
-- ------------------------------------------------------------
create or replace function public.list_my_deleted_cases()
returns setof public.cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
    select * from public.cases
    where owner_id = v_uid
      and deleted_at is not null
    order by deleted_at desc;
end;
$$;

grant execute on function public.list_my_deleted_cases() to authenticated;

-- ------------------------------------------------------------
-- RPC: undelete_case
-- ------------------------------------------------------------
create or replace function public.undelete_case(p_case_id text)
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
    raise exception 'only the case owner can restore';
  end if;

  update public.cases
    set deleted_at = null,
        deleted_by = null
    where id = p_case_id;
end;
$$;

grant execute on function public.undelete_case(text) to authenticated;
