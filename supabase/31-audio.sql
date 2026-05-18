-- ============================================================
-- HauntLog — Step 22 migration
-- Audio attachments on log entries
-- ============================================================
-- Mirrors the photo system (step 18 / file 24) but for audio clips.
-- Stored in a separate `log-audio` bucket so policies stay clean.
-- Same visibility-inheritance model: a clip is readable iff the
-- parent case is readable to the viewer (public, owner, or team).
--
-- *** ONE MANUAL STEP REQUIRED BEFORE RUNNING THIS SQL ***
-- Create a Storage bucket named `log-audio` in the Supabase dashboard:
--   1. Project → Storage → New bucket
--   2. Name: `log-audio`
--   3. Public bucket: OFF  (we use signed URLs, like photos)
--   4. File size limit: 25 MB
--   5. Allowed MIME types: audio/mpeg, audio/mp3, audio/wav,
--                          audio/x-wav, audio/mp4, audio/m4a,
--                          audio/x-m4a, audio/ogg, audio/webm
--   6. Create
-- ============================================================

-- ------------------------------------------------------------
-- 1. log_entry_audio table
-- ------------------------------------------------------------
create table if not exists public.log_entry_audio (
  id uuid primary key default uuid_generate_v4(),
  log_entry_id uuid not null references public.log_entries(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  bytes integer not null,
  -- Duration in seconds if the client could probe it pre-upload. Optional.
  duration_seconds numeric,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists log_entry_audio_log_idx
  on public.log_entry_audio (log_entry_id, created_at asc);
create index if not exists log_entry_audio_case_idx
  on public.log_entry_audio (case_id, created_at asc);
create index if not exists log_entry_audio_owner_idx
  on public.log_entry_audio (owner_id);

alter table public.log_entry_audio enable row level security;

-- ------------------------------------------------------------
-- 2. RLS on log_entry_audio (mirrors log_entry_photos)
-- ------------------------------------------------------------
drop policy if exists log_audio_read on public.log_entry_audio;
create policy log_audio_read on public.log_entry_audio
  for select using (
    exists (
      select 1 from public.cases c
      where c.id = log_entry_audio.case_id
        and c.deleted_at is null
        and (
          c.visibility in ('public', 'anonymous')
          or c.owner_id = auth.uid()
          or (
            c.team_id is not null
            and exists (
              select 1 from public.team_members tm
              where tm.team_id = c.team_id and tm.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists log_audio_insert on public.log_entry_audio;
create policy log_audio_insert on public.log_entry_audio
  for insert with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = log_entry_audio.case_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists log_audio_delete on public.log_entry_audio;
create policy log_audio_delete on public.log_entry_audio
  for delete using (
    owner_id = auth.uid() or public.is_admin()
  );

drop policy if exists log_audio_update on public.log_entry_audio;
create policy log_audio_update on public.log_entry_audio
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Storage policies on `log-audio` bucket
-- ------------------------------------------------------------
-- Reuse the photo readability function — the path layout is the same
-- ({owner_id}/{case_id}/{audio_id}.ext), so case_id is at index 2.
-- For clarity we still create a dedicated function.
create or replace function public.can_read_log_audio(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id text;
  v_owner uuid;
  v_visibility text;
  v_team_id uuid;
  v_uid uuid := auth.uid();
begin
  v_case_id := split_part(p_path, '/', 2);
  if v_case_id is null or v_case_id = '' then
    return false;
  end if;

  select owner_id, visibility, team_id
    into v_owner, v_visibility, v_team_id
  from public.cases
  where id = v_case_id and deleted_at is null;
  if v_owner is null then
    return false;
  end if;

  if v_visibility in ('public', 'anonymous') then return true; end if;
  if v_owner = v_uid then return true; end if;
  if v_team_id is not null and exists (
    select 1 from public.team_members where team_id = v_team_id and user_id = v_uid
  ) then return true; end if;
  return false;
end;
$$;

grant execute on function public.can_read_log_audio(text) to authenticated, anon;

drop policy if exists log_audio_storage_read on storage.objects;
create policy log_audio_storage_read on storage.objects
  for select using (
    bucket_id = 'log-audio'
    and public.can_read_log_audio(name)
  );

drop policy if exists log_audio_storage_insert on storage.objects;
create policy log_audio_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'log-audio'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists log_audio_storage_delete on storage.objects;
create policy log_audio_storage_delete on storage.objects
  for delete using (
    bucket_id = 'log-audio'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  );

-- ------------------------------------------------------------
-- 4. RPC: list_case_audio
-- ------------------------------------------------------------
create or replace function public.list_case_audio(p_case_id text)
returns setof public.log_entry_audio
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.log_entry_audio
  where case_id = p_case_id
    and exists (
      select 1 from public.cases c
      where c.id = p_case_id and c.deleted_at is null
    )
  order by created_at asc;
$$;

grant execute on function public.list_case_audio(text) to authenticated, anon;
