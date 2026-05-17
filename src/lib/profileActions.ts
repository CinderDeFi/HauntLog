import { supabase } from './supabase';
import type { ProfileRow } from './database.types';

// 60 days in milliseconds.
export const HANDLE_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

export type HandleCooldown = {
  canChange: boolean;
  unlocksAt: Date | null;
  daysRemaining: number;
};

export function getHandleCooldown(profile: ProfileRow | null): HandleCooldown {
  if (!profile?.handle_changed_at) {
    return { canChange: true, unlocksAt: null, daysRemaining: 0 };
  }
  const last = new Date(profile.handle_changed_at).getTime();
  const unlock = last + HANDLE_COOLDOWN_MS;
  const now = Date.now();
  if (now >= unlock) {
    return { canChange: true, unlocksAt: null, daysRemaining: 0 };
  }
  return {
    canChange: false,
    unlocksAt: new Date(unlock),
    daysRemaining: Math.ceil((unlock - now) / (24 * 60 * 60 * 1000)),
  };
}

// Validate a candidate handle against the same constraint as the DB:
// '^@[a-z0-9._]{2,30}$'
export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Handle is required.' };
  const withAt = trimmed.startsWith('@') ? trimmed : '@' + trimmed;
  if (!/^@[a-z0-9._]{2,30}$/.test(withAt)) {
    return {
      ok: false,
      error:
        'Handles must be 2-30 characters of lowercase letters, numbers, dots, or underscores.',
    };
  }
  return { ok: true, handle: withAt };
}

export type UpdateProfileInput = {
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  youtube?: string | null;
};

export async function updateProfile(
  userId: string,
  patch: UpdateProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function changeHandle(
  userId: string,
  newHandle: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = validateHandle(newHandle);
  if (!validation.ok) return validation;

  // Server still enforces uniqueness via UNIQUE constraint and cooldown via
  // RLS-or-trigger (we'd add a trigger if abuse appeared; for now we trust
  // the UI gate + the unique index for collisions).
  const { error } = await supabase
    .from('profiles')
    .update({
      handle: validation.handle,
      handle_changed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'That handle is already taken.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function changePassword(
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function changeEmail(
  newEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Supabase sends a confirmation link to BOTH the old and new addresses
  // when an email change is requested. The user clicks the link in the
  // new mailbox to confirm.
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMyAccount(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { ok: false, error: error.message };
  // Sign out locally to clear cached session.
  await supabase.auth.signOut();
  return { ok: true };
}
