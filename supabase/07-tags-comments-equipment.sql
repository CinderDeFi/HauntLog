-- ============================================================
-- HauntLog — Step 3.7 migration
-- Case tags + case comments + equipment data fields
-- ============================================================

-- ------------------------------------------------------------
-- 1. Case tags
-- ------------------------------------------------------------
alter table public.cases
  add column if not exists tags text[];

create index if not exists cases_tags_gin on public.cases using gin (tags);

-- ------------------------------------------------------------
-- 2. Case comments
-- ------------------------------------------------------------
create table if not exists public.case_comments (
  id uuid primary key default uuid_generate_v4(),
  case_id text not null references public.cases(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  pinned boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_case_idx on public.case_comments (case_id, created_at);
create index if not exists comments_pinned_idx on public.case_comments (case_id, pinned) where pinned;

drop trigger if exists case_comments_updated_at on public.case_comments;
create trigger case_comments_updated_at
  before update on public.case_comments
  for each row execute function set_updated_at();

alter table public.case_comments enable row level security;

-- Read: same visibility rule as the parent case.
drop policy if exists comments_read on public.case_comments;
create policy comments_read on public.case_comments
  for select using (
    exists (
      select 1 from public.cases
      where cases.id = case_comments.case_id
        and (cases.visibility in ('public', 'anonymous') or cases.owner_id = auth.uid())
    )
  );

-- Insert: any signed-in user can comment on a public-or-anonymous case.
-- Owners can comment on their own private cases.
drop policy if exists comments_insert on public.case_comments;
create policy comments_insert on public.case_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.cases
      where cases.id = case_comments.case_id
        and (cases.visibility in ('public', 'anonymous') or cases.owner_id = auth.uid())
    )
  );

-- Update: comment authors can edit their own. Case owners can pin/unpin
-- and soft-delete any comment on their case. Admins can do anything.
drop policy if exists comments_update on public.case_comments;
create policy comments_update on public.case_comments
  for update using (
    author_id = auth.uid()
    or exists (
      select 1 from public.cases
      where cases.id = case_comments.case_id
        and cases.owner_id = auth.uid()
    )
    or public.is_admin()
  );

-- Delete: author OR case owner OR admin.
drop policy if exists comments_delete on public.case_comments;
create policy comments_delete on public.case_comments
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from public.cases
      where cases.id = case_comments.case_id
        and cases.owner_id = auth.uid()
    )
    or public.is_admin()
  );

-- ------------------------------------------------------------
-- 3. Equipment-specific structured data
-- ------------------------------------------------------------
-- A free-form JSONB column on log_entries. Different equipment write
-- different shapes; the client knows how to interpret each.
--
-- Examples:
--   K-II:        { lights: 3 }
--   Thermal:     { baseTempF: 68, observedTempF: 62 }   (delta inferred)
--   SB7:         { word: "Mary" }
--   Geophone:    { magnitude: 7, durationSec: 4 }
--   REM Pod:     { proximity: 'far' | 'near' | 'touch' }
--   Voice:       { transcription: "..." }
--
-- "observation" text field stays the primary description; this is the
-- structured supplement.
alter table public.log_entries
  add column if not exists data jsonb;
