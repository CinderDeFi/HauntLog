-- ============================================================
-- HauntLog — Step 44: profiles privilege-escalation guard
-- ============================================================
-- profiles_update_self allows a user to update their own row, but
-- is_admin and tier live on that row. RLS can't restrict columns, and
-- column-level REVOKE is a no-op here because anon/authenticated hold
-- TABLE-level grants. So: pin both columns for the browser-facing roles.
--
-- service_role (Stripe webhook, admin dashboard) and SECURITY DEFINER
-- admin functions are unaffected — their current_user isn't anon/authenticated.
-- ============================================================

create or replace function public.profiles_block_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.tier := 'free';
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
      new.tier := old.tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_block_privilege_escalation();