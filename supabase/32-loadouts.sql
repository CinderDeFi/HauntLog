-- ============================================================
-- HauntLog — Step 23 migration
-- Equipment loadouts
-- ============================================================
-- A "loadout" is a named saved kit: a list of equipment ids the
-- user wants pre-selected when starting a new hunt. Optionally
-- includes a custom equipment map so users can save things like
-- {"thermal-laser-x1": "Klein IR-1"} as part of the preset.
-- ============================================================

create table if not exists public.equipment_loadouts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  -- Catalog equipment ids (k2, sb7, etc.) AND custom ids the user
  -- has defined in custom_equipment.
  equipment_ids text[] not null default '{}'::text[],
  -- Optional: human labels for custom-only ids. Mirrors the
  -- custom_equipment column on cases.
  custom_equipment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft cap on naming. Hard limit at app layer too.
  constraint equipment_loadouts_name_check check (
    char_length(name) between 1 and 60
  )
);

create index if not exists equipment_loadouts_owner_idx
  on public.equipment_loadouts (owner_id, created_at desc);

drop trigger if exists equipment_loadouts_updated_at on public.equipment_loadouts;
create trigger equipment_loadouts_updated_at
  before update on public.equipment_loadouts
  for each row execute function set_updated_at();

alter table public.equipment_loadouts enable row level security;

drop policy if exists loadouts_read_own on public.equipment_loadouts;
create policy loadouts_read_own on public.equipment_loadouts
  for select using (owner_id = auth.uid());

drop policy if exists loadouts_insert_own on public.equipment_loadouts;
create policy loadouts_insert_own on public.equipment_loadouts
  for insert with check (owner_id = auth.uid());

drop policy if exists loadouts_update_own on public.equipment_loadouts;
create policy loadouts_update_own on public.equipment_loadouts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists loadouts_delete_own on public.equipment_loadouts;
create policy loadouts_delete_own on public.equipment_loadouts
  for delete using (owner_id = auth.uid());

-- Soft cap on number of loadouts per user (enforced at app layer).
-- Could enforce via trigger here but keeping schema simple.
