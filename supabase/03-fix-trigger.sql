-- ============================================================
-- HauntLog — Step 3 hotfix v2: handle_new_user trigger
-- ============================================================
-- The previous trigger couldn't see public.profiles because the
-- function runs with auth schema's search_path. Fix: qualify the
-- table explicitly AND set search_path on the function.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  candidate text;
  i int := 0;
begin
  base_handle := lower(
    regexp_replace(
      coalesce(split_part(coalesce(new.email, ''), '@', 1), ''),
      '[^a-z0-9._]', '', 'g'
    )
  );

  if length(base_handle) > 28 then
    base_handle := substr(base_handle, 1, 28);
  end if;

  if base_handle is null or length(base_handle) < 2 then
    base_handle := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  candidate := '@' || base_handle;

  while exists (select 1 from public.profiles where handle = candidate) and i < 50 loop
    i := i + 1;
    candidate := '@' || base_handle || i::text;
  end loop;

  if i >= 50 then
    candidate := '@user' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Investigator'
    )
  );

  return new;
exception
  when others then
    raise warning '[handle_new_user] failed for user %: % (%)', new.id, sqlerrm, sqlstate;
    raise;
end;
$$;

-- Same for the helper functions used by RLS policies; they have the
-- same search_path problem.
create or replace function public.current_handle()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select handle from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Re-bind the trigger.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
