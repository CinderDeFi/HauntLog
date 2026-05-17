import { supabase } from './supabase';
import type {
  TeamRole,
  TeamRow,
  TeamMemberRow,
  TeamInviteRow,
  ProfileRow,
} from './database.types';

// Slug constraint mirror of the DB check: 3-40 chars, lowercase, digits, hyphens.
const SLUG_RE = /^[a-z0-9-]{3,40}$/;

export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (!trimmed) return { ok: false, error: 'Slug is required.' };
  if (!SLUG_RE.test(trimmed)) {
    return {
      ok: false,
      error: 'Slug must be 3–40 characters of lowercase letters, numbers, or hyphens.',
    };
  }
  return { ok: true, slug: trimmed };
}

// ============================================================
// Create
// ============================================================
export type CreateTeamInput = {
  slug: string;
  name: string;
  description?: string;
  website?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
};

export async function createTeam(
  input: CreateTeamInput
): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const slugCheck = validateSlug(input.slug);
  if (!slugCheck.ok) return slugCheck;

  if (!input.name.trim()) {
    return { ok: false, error: 'Team name is required.' };
  }

  const { data, error } = await supabase.rpc('create_team_with_owner', {
    p_slug: slugCheck.slug,
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_website: input.website?.trim() || null,
    p_instagram: input.instagram?.trim() || null,
    p_tiktok: input.tiktok?.trim() || null,
    p_facebook: input.facebook?.trim() || null,
    p_youtube: input.youtube?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'That slug is already taken.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, teamId: data as string };
}

// ============================================================
// Update team info
// ============================================================
export async function updateTeam(
  teamId: string,
  patch: Partial<TeamRow>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('teams').update(patch).eq('id', teamId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Delete
// ============================================================
export async function deleteTeam(
  teamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('delete_team', { p_team_id: teamId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Membership
// ============================================================
export async function leaveTeam(
  teamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('leave_team', { p_team_id: teamId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function changeRole(
  teamId: string,
  userId: string,
  newRole: TeamRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('change_team_member_role', {
    p_team_id: teamId,
    p_user_id: userId,
    p_new_role: newRole,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeMember(
  teamId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // RLS on team_members lets owners/admins delete other members' rows.
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Invites
// ============================================================
export async function createInvite(
  teamId: string,
  inviteeHandle: string,
  role: TeamRole = 'member',
  message?: string
): Promise<{ ok: true; inviteId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('create_team_invite', {
    p_team_id: teamId,
    p_invitee_handle: inviteeHandle,
    p_role: role,
    p_message: message ?? null,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'That investigator already has a pending invite.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, inviteId: data as string };
}

export async function acceptInvite(
  inviteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('accept_team_invite', { p_invite_id: inviteId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function declineInvite(
  inviteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('decline_team_invite', { p_invite_id: inviteId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rescindInvite(
  inviteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('rescind_team_invite', { p_invite_id: inviteId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Fetches
// ============================================================
export type TeamMembershipWithTeam = TeamMemberRow & {
  team: TeamRow;
};

export async function fetchMyTeams(userId: string): Promise<TeamMembershipWithTeam[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*, team:teams(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as unknown as TeamMembershipWithTeam[];
}

export async function fetchTeamBySlug(slug: string): Promise<TeamRow | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type MemberWithProfile = TeamMemberRow & {
  profile: Pick<ProfileRow, 'id' | 'handle' | 'display_name' | 'avatar_url'>;
};

export async function fetchTeamMembers(teamId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*, profile:profiles(id,handle,display_name,avatar_url)')
    .eq('team_id', teamId);
  if (error) throw error;
  return (data ?? []) as unknown as MemberWithProfile[];
}

export type InviteWithTeamAndInviter = TeamInviteRow & {
  team: Pick<TeamRow, 'id' | 'slug' | 'name' | 'logo_url'>;
  inviter: Pick<ProfileRow, 'id' | 'handle' | 'display_name'> | null;
};

export async function fetchMyPendingInvites(
  userId: string
): Promise<InviteWithTeamAndInviter[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select(
      '*, team:teams(id,slug,name,logo_url), inviter:profiles!invited_by(id,handle,display_name)'
    )
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InviteWithTeamAndInviter[];
}

export type InviteWithInvitee = TeamInviteRow & {
  invitee: Pick<ProfileRow, 'id' | 'handle' | 'display_name' | 'avatar_url'>;
};

export async function fetchTeamInvites(teamId: string): Promise<InviteWithInvitee[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*, invitee:profiles!invitee_id(id,handle,display_name,avatar_url)')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InviteWithInvitee[];
}
