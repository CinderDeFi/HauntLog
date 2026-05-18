-- ============================================================
-- HauntLog — Step 40 migration
-- Field Mode preference on profiles
-- ============================================================
-- Field Mode = a low-light "you're in the field" theme. Drops the
-- bright haunt-red accent to a dim amber that preserves dark
-- adaptation, dampens whites, kills flashes/pulses. Toggleable per
-- user.
--
-- Stored on the profile so the preference follows the user across
-- devices, not localStorage.
-- ============================================================

alter table public.profiles
  add column if not exists field_mode boolean not null default false;

-- No RLS change needed: the existing profiles RLS already lets users
-- read/write their own profile row, and that covers this column.
