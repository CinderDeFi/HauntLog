-- ============================================================
-- HauntLog — Hotfix: cases_read must filter deleted_at
-- ============================================================
-- Symptom: deleted cases still appear in the Vault.
--
-- Cause: a later migration (most likely step 10 if its execution
-- order got swapped) replaced the cases_read RLS policy without
-- the `deleted_at is null` clause that step 11 introduced.
--
-- Fix: re-create the policy with both the visibility checks AND
-- the deleted_at filter. Idempotent — safe to re-run.
-- ============================================================

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
