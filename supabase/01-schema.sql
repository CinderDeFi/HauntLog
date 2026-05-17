-- ============================================================
-- HauntLog Schema — Step 2
-- ============================================================
-- Paste this into Supabase SQL Editor and Run.
-- Idempotent: safe to re-run; uses IF NOT EXISTS / drops before
-- recreating policies.
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$ begin
  create type visibility_t as enum ('public', 'private', 'anonymous');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_source_t as enum ('user', 'catalog');
exception when duplicate_object then null; end $$;

do $$ begin
  create type team_role_t as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status_t as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- updated_at trigger function
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PROFILES (the app-level "Investigator")
-- Extends auth.users with public-facing info.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (handle ~ '^@[a-z0-9._]{2,30}$'),
  display_name text not null,
  bio text,
  avatar_url text,
  tier text not null default 'free',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

drop policy if exists profiles_read_all on profiles;
create policy profiles_read_all on profiles
  for select using (true);

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (auth.uid() = id);

-- Helper: get the current user's handle (used by other policies)
create or replace function current_handle() returns text as $$
  select handle from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Helper: is the current user admin?
create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- ============================================================
-- TEAMS
-- ============================================================
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null,
  description text,
  logo_url text,
  website text,
  verified boolean not null default false,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists teams_updated_at on teams;
create trigger teams_updated_at
  before update on teams
  for each row execute function set_updated_at();

alter table teams enable row level security;

drop policy if exists teams_read_all on teams;
create policy teams_read_all on teams for select using (true);

drop policy if exists teams_insert_authenticated on teams;
create policy teams_insert_authenticated on teams
  for insert with check (auth.uid() is not null and created_by = auth.uid());

-- teams_update_admins policy is created AFTER team_members table below,
-- since it references it.

-- ============================================================
-- TEAM_MEMBERS
-- ============================================================
create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role team_role_t not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table team_members enable row level security;

drop policy if exists team_members_read_all on team_members;
create policy team_members_read_all on team_members for select using (true);

-- Insertion: a user joins themselves OR a team owner/admin adds someone.
drop policy if exists team_members_insert on team_members;
create policy team_members_insert on team_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

drop policy if exists team_members_delete on team_members;
create policy team_members_delete on team_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-- Now that team_members exists, attach the teams update policy that
-- depends on it.
drop policy if exists teams_update_admins on teams;
create policy teams_update_admins on teams
  for update using (
    exists (
      select 1 from team_members
      where team_members.team_id = teams.id
        and team_members.user_id = auth.uid()
        and team_members.role in ('owner', 'admin')
    )
  );

-- ============================================================
-- LOCATIONS (a.k.a. "venues" in code)
-- ============================================================
create table if not exists locations (
  id text primary key,                   -- slug like 'lizzie-borden-house'
  source location_source_t not null default 'user',
  name text not null,
  lat double precision not null,
  lng double precision not null,
  description text,
  street text,
  city text,
  state text,
  zip text,
  country text,
  website text,
  hours text,
  contact_email text,
  contact_phone text,
  rules text[],
  booking_url text,
  tags text[],
  photos text[],
  notes text,                            -- legacy "notes" field for user-created
  claimed_by uuid references profiles(id) on delete set null,
  verified boolean not null default false,
  created_by_handle text not null default '@hauntlog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_source_idx on locations (source);
create index if not exists locations_verified_idx on locations (verified);
create index if not exists locations_geo_idx on locations (lat, lng);

drop trigger if exists locations_updated_at on locations;
create trigger locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

alter table locations enable row level security;

drop policy if exists locations_read_all on locations;
create policy locations_read_all on locations for select using (true);

drop policy if exists locations_insert_authenticated on locations;
create policy locations_insert_authenticated on locations
  for insert with check (auth.uid() is not null);

-- Community edit: any authenticated user can update.
-- Future: lock down verified-claimed locations to claimed_by only.
drop policy if exists locations_update_authenticated on locations;
create policy locations_update_authenticated on locations
  for update using (auth.uid() is not null);

-- ============================================================
-- LOCATION REVISIONS
-- Append-only history of community edits.
-- ============================================================
create table if not exists location_revisions (
  id uuid primary key default uuid_generate_v4(),
  location_id text not null references locations(id) on delete cascade,
  edited_by uuid not null references profiles(id) on delete restrict,
  edited_at timestamptz not null default now(),
  -- JSON blob of {fieldName: previousValue}, mirrors the in-memory shape.
  changes jsonb not null
);

create index if not exists revisions_location_idx on location_revisions (location_id, edited_at desc);

alter table location_revisions enable row level security;

drop policy if exists revisions_read_all on location_revisions;
create policy revisions_read_all on location_revisions for select using (true);

drop policy if exists revisions_insert_authenticated on location_revisions;
create policy revisions_insert_authenticated on location_revisions
  for insert with check (auth.uid() = edited_by);

-- ============================================================
-- LOCATION CLAIMS
-- A user requests ownership of a location. You (admin) approve.
-- ============================================================
create table if not exists location_claims (
  id uuid primary key default uuid_generate_v4(),
  location_id text not null references locations(id) on delete cascade,
  claimant_id uuid not null references profiles(id) on delete cascade,
  status claim_status_t not null default 'pending',
  proof_url text,           -- link they provide as evidence of ownership
  message text,             -- explanation
  admin_note text,          -- private note for the admin
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id)
);

create index if not exists claims_status_idx on location_claims (status, created_at desc);

alter table location_claims enable row level security;

-- Claimants see their own claims; admins see everything.
drop policy if exists claims_read on location_claims;
create policy claims_read on location_claims
  for select using (claimant_id = auth.uid() or is_admin());

drop policy if exists claims_insert_self on location_claims;
create policy claims_insert_self on location_claims
  for insert with check (claimant_id = auth.uid());

drop policy if exists claims_update_admin on location_claims;
create policy claims_update_admin on location_claims
  for update using (is_admin());

-- ============================================================
-- CHECK-INS
-- Active and historical. Public + anonymous are visible to all;
-- private check-ins are never created.
-- ============================================================
create table if not exists check_ins (
  id uuid primary key default uuid_generate_v4(),
  hunt_id text not null,                 -- client-generated 'live-...' id, ties to cases later
  location_id text references locations(id) on delete set null,
  location_name text not null,           -- snapshot for display if location renamed
  lat double precision,
  lng double precision,
  visibility visibility_t not null,      -- only 'public' or 'anonymous' will appear here
  owner_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists checkins_active_idx on check_ins (active, expires_at);
create index if not exists checkins_owner_idx on check_ins (owner_id, started_at desc);

alter table check_ins enable row level security;

-- Everyone reads. Anonymous check-ins still appear; the app hides the owner handle.
drop policy if exists checkins_read_all on check_ins;
create policy checkins_read_all on check_ins for select using (true);

drop policy if exists checkins_insert_self on check_ins;
create policy checkins_insert_self on check_ins
  for insert with check (owner_id = auth.uid());

drop policy if exists checkins_update_self on check_ins;
create policy checkins_update_self on check_ins
  for update using (owner_id = auth.uid());

-- ============================================================
-- CASES (sealed case files)
-- ============================================================
create table if not exists cases (
  id text primary key,                   -- short shareable id like 'X4M-PT9'
  owner_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  title text not null,
  summary text,
  location_id text references locations(id) on delete set null,
  location_name text not null,           -- snapshot
  zone text,
  lat double precision,
  lng double precision,
  started_at timestamptz not null,
  ended_at timestamptz,
  visibility visibility_t not null,
  gps_verified boolean not null default false,
  equipment_used text[],
  custom_equipment jsonb,                -- {customId: label}
  sealed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_owner_idx on cases (owner_id, created_at desc);
create index if not exists cases_team_idx on cases (team_id, created_at desc);
create index if not exists cases_location_idx on cases (location_id, created_at desc);
create index if not exists cases_visibility_idx on cases (visibility);

drop trigger if exists cases_updated_at on cases;
create trigger cases_updated_at
  before update on cases
  for each row execute function set_updated_at();

alter table cases enable row level security;

-- Anyone reads public/anonymous; only the owner reads private.
drop policy if exists cases_read on cases;
create policy cases_read on cases
  for select using (
    visibility in ('public', 'anonymous')
    or owner_id = auth.uid()
  );

drop policy if exists cases_insert_self on cases;
create policy cases_insert_self on cases
  for insert with check (owner_id = auth.uid());

drop policy if exists cases_update_self on cases;
create policy cases_update_self on cases
  for update using (owner_id = auth.uid());

drop policy if exists cases_delete_self on cases;
create policy cases_delete_self on cases
  for delete using (owner_id = auth.uid());

-- ============================================================
-- LOG ENTRIES
-- Each entry belongs to a case (after sealing).
-- ============================================================
create table if not exists log_entries (
  id uuid primary key default uuid_generate_v4(),
  case_id text not null references cases(id) on delete cascade,
  logged_by uuid not null references profiles(id) on delete restrict,
  timestamp timestamptz not null,
  equipment_id text not null,            -- 'k2' | 'sb7' | '__personal__' | custom id
  equipment_label text,                  -- for custom devices
  observation text not null,
  note text,
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists logs_case_idx on log_entries (case_id, timestamp);
create index if not exists logs_starred_idx on log_entries (case_id, starred) where starred;

alter table log_entries enable row level security;

-- Read access follows the parent case's visibility.
drop policy if exists logs_read on log_entries;
create policy logs_read on log_entries
  for select using (
    exists (
      select 1 from cases
      where cases.id = log_entries.case_id
        and (cases.visibility in ('public', 'anonymous') or cases.owner_id = auth.uid())
    )
  );

drop policy if exists logs_insert_case_owner on log_entries;
create policy logs_insert_case_owner on log_entries
  for insert with check (
    logged_by = auth.uid()
    and exists (
      select 1 from cases
      where cases.id = log_entries.case_id
        and cases.owner_id = auth.uid()
    )
  );

drop policy if exists logs_update_case_owner on log_entries;
create policy logs_update_case_owner on log_entries
  for update using (
    exists (
      select 1 from cases
      where cases.id = log_entries.case_id
        and cases.owner_id = auth.uid()
    )
  );

drop policy if exists logs_delete_case_owner on log_entries;
create policy logs_delete_case_owner on log_entries
  for delete using (
    exists (
      select 1 from cases
      where cases.id = log_entries.case_id
        and cases.owner_id = auth.uid()
    )
  );

-- ============================================================
-- MEDIA ATTACHMENTS (future video evidence)
-- Schema exists now so we don't have to migrate later.
-- ============================================================
create table if not exists media_attachments (
  id uuid primary key default uuid_generate_v4(),
  log_entry_id uuid references log_entries(id) on delete cascade,
  case_id text references cases(id) on delete cascade,
  kind text not null check (kind in ('video', 'audio', 'image')),
  url text not null,
  caption text,
  added_by uuid not null references profiles(id) on delete restrict,
  added_at timestamptz not null default now(),
  -- Must belong to either a log entry or a case (or both).
  check (log_entry_id is not null or case_id is not null)
);

create index if not exists media_log_idx on media_attachments (log_entry_id);
create index if not exists media_case_idx on media_attachments (case_id);

alter table media_attachments enable row level security;

drop policy if exists media_read on media_attachments;
create policy media_read on media_attachments
  for select using (
    case_id is not null and exists (
      select 1 from cases
      where cases.id = media_attachments.case_id
        and (cases.visibility in ('public', 'anonymous') or cases.owner_id = auth.uid())
    )
  );

drop policy if exists media_insert on media_attachments;
create policy media_insert on media_attachments
  for insert with check (
    added_by = auth.uid()
    and case_id is not null
    and exists (
      select 1 from cases
      where cases.id = media_attachments.case_id
        and cases.owner_id = auth.uid()
    )
  );

-- ============================================================
-- ADMIN REVIEWS QUEUE (option B)
-- A unified queue for any pending decision: location claims,
-- team verification requests, etc. Lets the admin dashboard show
-- one combined list.
-- ============================================================
create table if not exists admin_reviews (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('location_claim', 'team_verification')),
  target_id text not null,                -- claim id or team id (text since claim ids are uuids cast)
  status claim_status_t not null default 'pending',
  submitted_by uuid not null references profiles(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id)
);

create index if not exists reviews_status_idx on admin_reviews (status, created_at desc);

alter table admin_reviews enable row level security;

drop policy if exists reviews_read_admin on admin_reviews;
create policy reviews_read_admin on admin_reviews
  for select using (is_admin() or submitted_by = auth.uid());

drop policy if exists reviews_insert_self on admin_reviews;
create policy reviews_insert_self on admin_reviews
  for insert with check (submitted_by = auth.uid());

drop policy if exists reviews_update_admin on admin_reviews;
create policy reviews_update_admin on admin_reviews
  for update using (is_admin());

-- ============================================================
-- Auto-create profile on auth.users insert.
-- When someone signs up, give them a starter profile.
-- The handle is derived from the email local-part; user can change it later.
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  base_handle text;
  candidate text;
  i int := 0;
begin
  base_handle := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9._]', '', 'g'));
  if base_handle = '' or length(base_handle) < 2 then
    base_handle := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  candidate := '@' || base_handle;

  while exists (select 1 from profiles where handle = candidate) and i < 50 loop
    i := i + 1;
    candidate := '@' || base_handle || i::text;
  end loop;

  insert into profiles (id, handle, display_name)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Done.
-- Next: run seed-locations.sql to import your 26 catalog locations.
-- ============================================================
