import { supabase } from './supabase';
import type {
  CaseRow,
  LogEntryRow,
  CheckInRow,
  ProfileRow,
  CaseCommentRow,
  Visibility,
  LocationClaimRow,
} from './database.types';
import type { CaseFile, CheckIn, LogEntry } from '../store/useHauntStore';

// ============================================================
// Mapping between client and DB shapes
// ============================================================
// The client store has camelCase + a few denormalized fields. The DB
// has snake_case. Map both ways here, in one place, so the rest of the
// app doesn't care about the difference.
//
// IMPORTANT: keep these conversions pure. No side effects.

type CaseRowWithOwner = CaseRow & {
  owner?: Pick<ProfileRow, 'handle' | 'display_name' | 'avatar_url'> | null;
};

export function caseRowToCaseFile(
  row: CaseRowWithOwner,
  logs: LogEntryRow[] = []
): CaseFile {
  return {
    id: row.id,
    ownerHandle: row.owner?.handle ?? '@unknown',
    ownerId: row.owner_id ?? undefined,
    teamId: row.team_id ?? undefined,
    title: row.title,
    summary: row.summary ?? undefined,
    venueId: row.location_id ?? undefined,
    location: row.location_name,
    zone: row.zone ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    visibility: row.visibility,
    gpsVerified: row.gps_verified,
    equipmentUsed: (row.equipment_used ?? []) as CaseFile['equipmentUsed'],
    customEquipment: row.custom_equipment ?? undefined,
    tags: row.tags ?? undefined,
    logs: logs.map(logRowToLogEntry),
    sealed: row.sealed,
    investigationId: (row as any).investigation_id ?? undefined,
    groupId: (row as any).group_id ?? undefined,
  };
}

export function logRowToLogEntry(row: LogEntryRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    equipmentId: row.equipment_id as LogEntry['equipmentId'],
    equipmentLabel: row.equipment_label ?? undefined,
    observation: row.observation,
    note: row.note ?? undefined,
    starred: row.starred,
    data: row.data ?? undefined,
  };
}

export function checkInRowToCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    huntId: row.hunt_id,
    venueId: row.location_id ?? undefined,
    venueName: row.location_name,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    visibility: row.visibility,
    ownerHandle: '@unknown',
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    active: row.active,
  };
}

// ============================================================
// CASES
// ============================================================

/**
 * All cases the current user can see, that they OWN. Used for the Vault.
 */
export async function fetchMyCases(userId: string): Promise<CaseFile[]> {
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!cases || cases.length === 0) return [];

  // Fetch the user's own handle once for ownerHandle attribution.
  const { data: profile } = await supabase
    .from('profiles')
    .select('handle, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  // Fetch logs for these cases in one query.
  const ids = cases.map((c) => c.id);
  const { data: logs, error: logsErr } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids)
    .order('timestamp', { ascending: true });
  if (logsErr) throw logsErr;

  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return cases.map((c) =>
    caseRowToCaseFile({ ...c, owner: profile ?? null }, logsByCase.get(c.id) ?? [])
  );
}

/**
 * A single case by id, with all its logs. Visibility-respecting via RLS:
 * returns null if the case exists but you can't see it.
 */
export async function fetchCaseById(id: string): Promise<CaseFile | null> {
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select('*, owner:profiles!owner_id(handle,display_name,avatar_url)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!caseRow) return null;

  const { data: logs, error: logsErr } = await supabase
    .from('log_entries')
    .select('*')
    .eq('case_id', id)
    .order('timestamp', { ascending: true });
  if (logsErr) throw logsErr;

  return caseRowToCaseFile(caseRow as unknown as CaseRowWithOwner, logs ?? []);
}

/**
 * Public cases for a profile's `/u/:handle` page.
 */
export async function fetchPublicCasesByHandle(handle: string): Promise<CaseFile[]> {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url')
    .eq('handle', handle)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) return [];

  const { data: cases, error } = await supabase
    .from('cases')
    .select('*')
    .eq('owner_id', profile.id)
    .is('deleted_at', null)
    .in('visibility', ['public', 'anonymous'])
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!cases || cases.length === 0) return [];

  const ids = cases.map((c) => c.id);
  const { data: logs } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids);
  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return cases.map((c) =>
    caseRowToCaseFile(
      {
        ...c,
        // Anonymous cases hide the author handle even on their own profile section
        // (we don't show anonymous cases on profile pages — only public).
        owner: c.visibility === 'anonymous' ? null : (profile as any),
      },
      logsByCase.get(c.id) ?? []
    )
  ).filter((c) => c.visibility !== 'anonymous'); // don't leak anon on a profile page
}

/**
 * Public cases for a team's `/t/:slug` page.
 */
export async function fetchPublicCasesByTeamId(teamId: string): Promise<CaseFile[]> {
  const { data: cases, error } = await supabase
    .from('cases')
    .select('*, owner:profiles!owner_id(handle,display_name,avatar_url)')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .in('visibility', ['public', 'anonymous'])
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!cases || cases.length === 0) return [];

  const ids = cases.map((c) => c.id);
  const { data: logs } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids);
  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return (cases as unknown as CaseRowWithOwner[]).map((c) =>
    caseRowToCaseFile(c, logsByCase.get(c.id) ?? [])
  );
}

/**
 * Seal a hunt: insert the case + all logs in a single transaction via RPC.
 */
export async function sealCase(input: {
  id: string;
  title: string;
  summary?: string;
  venueId?: string;
  locationName: string;
  zone?: string;
  lat?: number;
  lng?: number;
  startedAt: string;
  endedAt: string;
  visibility: Visibility;
  gpsVerified: boolean;
  equipmentUsed: string[];
  customEquipment?: Record<string, string>;
  tags?: string[];
  teamId?: string;
  logs: LogEntry[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const logsPayload = input.logs.map((l) => ({
    id: l.id,                                  // step 18: pass through so we can attach photos
    timestamp: l.timestamp,
    equipment_id: l.equipmentId,
    equipment_label: l.equipmentLabel ?? null,
    observation: l.observation,
    note: l.note ?? null,
    starred: l.starred ?? false,
    data: l.data ?? null,
  }));

  const { data, error } = await supabase.rpc('seal_case_with_logs', {
    p_id: input.id,
    p_title: input.title,
    p_summary: input.summary ?? '',
    p_location_id: input.venueId ?? null,
    p_location_name: input.locationName,
    p_zone: input.zone ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_started_at: input.startedAt,
    p_ended_at: input.endedAt,
    p_visibility: input.visibility,
    p_gps_verified: input.gpsVerified,
    p_equipment_used: input.equipmentUsed,
    p_custom_equipment: input.customEquipment ?? null,
    p_tags: input.tags ?? null,
    p_team_id: input.teamId ?? null,
    p_logs: logsPayload,
  } as any);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'A case with this id already exists.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data as string };
}

/**
 * Change a case's visibility post-seal.
 */
export async function updateCaseVisibility(
  caseId: string,
  visibility: Visibility
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cases')
    .update({ visibility })
    .eq('id', caseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// CHECK-INS (Atlas live feed)
// ============================================================

export async function fetchActiveCheckIns(): Promise<CheckIn[]> {
  const nowIso = new Date().toISOString();
  // Exclude private visibility — those check-ins exist only so
  // teammates can see live activity inside an investigation; they
  // are NOT meant for the public Atlas.
  const { data, error } = await supabase
    .from('check_ins')
    .select('*, owner:profiles!owner_id(handle)')
    .eq('active', true)
    .gt('expires_at', nowIso)
    .neq('visibility', 'private')
    .order('started_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...checkInRowToCheckIn(r),
    ownerHandle:
      r.visibility === 'anonymous' ? '@anonymous' : r.owner?.handle ?? '@unknown',
  }));
}

export async function createCheckIn(input: {
  huntId: string;
  venueId?: string;
  venueName: string;
  lat?: number;
  lng?: number;
  visibility: Visibility;
  ownerId: string;
  expectedDurationHours?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const hrs = Math.max(0.5, Math.min(input.expectedDurationHours ?? 4, 12));
  const expires = new Date(Date.now() + hrs * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      hunt_id: input.huntId,
      location_id: input.venueId ?? null,
      location_name: input.venueName,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      visibility: input.visibility,
      owner_id: input.ownerId,
      expires_at: expires,
      active: true,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function deactivateCheckIn(checkInId: string): Promise<void> {
  await supabase.from('check_ins').update({ active: false }).eq('id', checkInId);
}

// ============================================================
// COMMENTS
// ============================================================

export type CommentWithAuthor = CaseCommentRow & {
  author: Pick<ProfileRow, 'id' | 'handle' | 'display_name' | 'avatar_url'> | null;
};

export async function fetchComments(caseId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('case_comments')
    .select(
      '*, author:profiles!author_id(id,handle,display_name,avatar_url)'
    )
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function postComment(
  caseId: string,
  authorId: string,
  body: string
): Promise<{ ok: true; comment: CaseCommentRow } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Comment cannot be empty.' };
  if (trimmed.length > 4000)
    return { ok: false, error: 'Comment exceeds 4000 characters.' };

  const { data, error } = await supabase
    .from('case_comments')
    .insert({
      case_id: caseId,
      author_id: authorId,
      body: trimmed,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, comment: data as CaseCommentRow };
}

export async function deleteComment(
  commentId: string,
  byUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Soft-delete: set deleted_at and deleted_by. RLS lets author / case
  // owner / admin do this.
  const { error } = await supabase
    .from('case_comments')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: byUserId,
    })
    .eq('id', commentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function togglePinComment(
  commentId: string,
  pinned: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('case_comments')
    .update({ pinned })
    .eq('id', commentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// ACTIVITY FEED
// ============================================================

export type FeedCase = CaseFile & {
  // Owner display info (handle hidden for anonymous cases)
  ownerDisplayName: string | null;
  ownerAvatar: string | null;
  // Team info when team-owned
  teamSlug: string | null;
  teamName: string | null;
  teamLogo: string | null;
  teamVerified: boolean;
  createdAt: string;
};

/**
 * Fetch the global recent feed: public/anonymous cases, newest first.
 *
 * Anonymous cases still appear in the feed (that's their point — visible
 * but un-attributed) — we just hide the author handle/avatar in render.
 */
export async function fetchRecentFeed(limit = 50): Promise<FeedCase[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(
      `*,
       owner:profiles!owner_id(handle, display_name, avatar_url),
       team:teams!team_id(slug, name, logo_url, verified)`
    )
    .in('visibility', ['public', 'anonymous'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Pull logs in one batch.
  const ids = data.map((c: any) => c.id);
  const { data: logs } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids);
  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return data.map((row: any): FeedCase => {
    const isAnon = row.visibility === 'anonymous';
    const base = caseRowToCaseFile(
      {
        ...row,
        // Hide the author handle on anonymous cases (the case is visible
        // but un-attributed). For public, surface the real handle.
        owner: isAnon ? null : row.owner ?? null,
      } as CaseRowWithOwner,
      logsByCase.get(row.id) ?? []
    );
    return {
      ...base,
      ownerDisplayName: isAnon ? null : row.owner?.display_name ?? null,
      ownerAvatar: isAnon ? null : row.owner?.avatar_url ?? null,
      teamSlug: row.team?.slug ?? null,
      teamName: row.team?.name ?? null,
      teamLogo: row.team?.logo_url ?? null,
      teamVerified: Boolean(row.team?.verified),
      createdAt: row.created_at,
    };
  });
}

// ============================================================
// DELETE
// ============================================================

/**
 * Soft-delete a case. Only the owner can do this; RLS + the RPC both
 * enforce. Returns ok or an error string.
 */
export async function deleteCase(
  caseId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('delete_case', { p_case_id: caseId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// FOLLOWS
// ============================================================

/**
 * Follow another user. RLS enforces follower_id = auth.uid(); we just
 * pass the followee. Idempotent: re-following an existing follow is
 * treated as success.
 */
export async function followUser(
  followerId: string,
  followeeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (followerId === followeeId) {
    return { ok: false, error: 'You cannot follow yourself.' };
  }
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, followee_id: followeeId });
  if (error) {
    // Duplicate (23505) → treat as success; already following.
    if (error.code === '23505') return { ok: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unfollowUser(
  followerId: string,
  followeeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Whether `viewerId` follows `subjectId`. Returns false if either is
 * missing (e.g. viewer not signed in).
 */
export async function isFollowing(
  viewerId: string | null,
  subjectId: string
): Promise<boolean> {
  if (!viewerId) return false;
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('followee_id', subjectId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/**
 * Count of followers + following for a profile. Two count queries in
 * parallel.
 */
export async function getFollowCounts(
  subjectId: string
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followee_id', subjectId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', subjectId),
  ]);
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export type FollowProfile = Pick<
  ProfileRow,
  'id' | 'handle' | 'display_name' | 'avatar_url' | 'bio'
>;

/**
 * Fetch the list of profiles who follow `subjectId`.
 */
export async function fetchFollowers(subjectId: string): Promise<FollowProfile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!follower_id(id, handle, display_name, avatar_url, bio)')
    .eq('followee_id', subjectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.profile)
    .filter(Boolean) as FollowProfile[];
}

/**
 * Fetch the list of profiles `subjectId` is following.
 */
export async function fetchFollowing(subjectId: string): Promise<FollowProfile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!followee_id(id, handle, display_name, avatar_url, bio)')
    .eq('follower_id', subjectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.profile)
    .filter(Boolean) as FollowProfile[];
}

/**
 * The activity feed scoped to the people you follow. Returns at most
 * `limit` recent public/anonymous cases authored by those people.
 *
 * Implementation: fetch the user's following list ids first, then
 * filter the feed query by owner_id IN (...). Two round trips, but
 * cleaner than nested joins.
 */
export async function fetchFollowingFeed(
  viewerId: string,
  limit = 50
): Promise<FeedCase[]> {
  // Step 1: who do I follow?
  const { data: followRows, error: followErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', viewerId);
  if (followErr) throw followErr;
  const followingIds = (followRows ?? []).map((r) => r.followee_id);
  if (followingIds.length === 0) return [];

  // Step 2: their recent public cases.
  const { data, error } = await supabase
    .from('cases')
    .select(
      `*,
       owner:profiles!owner_id(handle, display_name, avatar_url),
       team:teams!team_id(slug, name, logo_url, verified)`
    )
    .in('owner_id', followingIds)
    .in('visibility', ['public', 'anonymous'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const ids = data.map((c: any) => c.id);
  const { data: logs } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids);
  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return data.map((row: any): FeedCase => {
    const isAnon = row.visibility === 'anonymous';
    const base = caseRowToCaseFile(
      {
        ...row,
        owner: isAnon ? null : row.owner ?? null,
      } as CaseRowWithOwner,
      logsByCase.get(row.id) ?? []
    );
    return {
      ...base,
      ownerDisplayName: isAnon ? null : row.owner?.display_name ?? null,
      ownerAvatar: isAnon ? null : row.owner?.avatar_url ?? null,
      teamSlug: row.team?.slug ?? null,
      teamName: row.team?.name ?? null,
      teamLogo: row.team?.logo_url ?? null,
      teamVerified: Boolean(row.team?.verified),
      createdAt: row.created_at,
    };
  });
}

// ============================================================
// SEARCH
// ============================================================

export type SearchProfileHit = Pick<
  ProfileRow,
  'id' | 'handle' | 'display_name' | 'avatar_url' | 'bio' | 'tier'
>;

export type SearchTeamHit = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  verified: boolean;
};

export type SearchResults = {
  profiles: SearchProfileHit[];
  teams: SearchTeamHit[];
};

/**
 * Substring search across profiles and teams. Case-insensitive.
 *
 * Profiles: matches handle, display_name, OR bio.
 * Teams:    matches slug, name, OR description.
 *
 * Each side capped at `perTypeLimit` results (default 5).
 *
 * Returns empty results if the query is shorter than 2 chars — saves
 * a round trip and avoids returning "everyone" for a single-letter
 * query.
 */
export async function searchPeopleAndTeams(
  query: string,
  perTypeLimit = 5
): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { profiles: [], teams: [] };

  // PostgREST `.or()` accepts a comma-separated filter list; escape
  // commas/parens in the user input by stripping them. The pattern is
  // wrapped in % on each side for substring match.
  const safe = q.replace(/[%,()*]/g, ' ').trim();
  if (safe.length < 2) return { profiles: [], teams: [] };
  const like = `%${safe}%`;

  const [profilesRes, teamsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, handle, display_name, avatar_url, bio, tier')
      .or(`handle.ilike.${like},display_name.ilike.${like},bio.ilike.${like}`)
      .limit(perTypeLimit),
    supabase
      .from('teams')
      .select('id, slug, name, description, logo_url, verified')
      .or(`slug.ilike.${like},name.ilike.${like},description.ilike.${like}`)
      .limit(perTypeLimit),
  ]);

  return {
    profiles: (profilesRes.data ?? []) as SearchProfileHit[],
    teams: (teamsRes.data ?? []) as SearchTeamHit[],
  };
}

// ============================================================
// DISCOVER
// ============================================================

export type InvestigatorListing = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  tier: string;
  created_at: string;
  public_case_count: number;
  last_case_at: string | null;
  public_log_count: number;
  public_starred_count: number;
  distinct_locations: number;
  total_hours: number;
};

export type TeamListing = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
  member_count: number;
  public_case_count: number;
};

/**
 * Recently joined investigators.
 */
export async function fetchRecentInvestigators(
  limit = 12
): Promise<InvestigatorListing[]> {
  const { data, error } = await supabase
    .from('investigator_public_case_counts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InvestigatorListing[];
}

/**
 * Investigators with the most public/anonymous cases.
 *
 * Ties are broken by recent case activity. Profiles with zero public
 * cases are excluded — they belong in "recently joined."
 */
export async function fetchActiveInvestigators(
  limit = 12
): Promise<InvestigatorListing[]> {
  const { data, error } = await supabase
    .from('investigator_public_case_counts')
    .select('*')
    .gt('public_case_count', 0)
    .order('public_case_count', { ascending: false })
    .order('last_case_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InvestigatorListing[];
}

/**
 * Featured teams — verified first, then by public case count.
 *
 * If there are no verified teams or no teams with cases yet, falls back
 * to most-recent teams.
 */
export async function fetchFeaturedTeams(limit = 12): Promise<TeamListing[]> {
  const { data, error } = await supabase
    .from('team_public_case_counts')
    .select('*')
    // Postgres treats `false < true`, so descending puts verified first.
    .order('verified', { ascending: false })
    .order('public_case_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TeamListing[];
}

export type DiscoverSearch = {
  profiles: InvestigatorListing[];
  teams: TeamListing[];
};

/**
 * Wider search for the Discover page. Uses the same substring match
 * as the navbar dropdown but returns the richer view rows (with case
 * counts etc.) and allows higher limits.
 */
export async function searchDiscover(
  query: string,
  type: 'all' | 'investigators' | 'teams',
  limit = 30
): Promise<DiscoverSearch> {
  const q = query.trim();
  if (q.length < 2) return { profiles: [], teams: [] };

  const safe = q.replace(/[%,()*]/g, ' ').trim();
  if (safe.length < 2) return { profiles: [], teams: [] };
  const like = `%${safe}%`;

  const wantProfiles = type === 'all' || type === 'investigators';
  const wantTeams = type === 'all' || type === 'teams';

  const [profilesRes, teamsRes] = await Promise.all([
    wantProfiles
      ? supabase
          .from('investigator_public_case_counts')
          .select('*')
          .or(`handle.ilike.${like},display_name.ilike.${like},bio.ilike.${like}`)
          .order('public_case_count', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    wantTeams
      ? supabase
          .from('team_public_case_counts')
          .select('*')
          .or(`slug.ilike.${like},name.ilike.${like},description.ilike.${like}`)
          .order('verified', { ascending: false })
          .order('public_case_count', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    profiles: (profilesRes.data ?? []) as InvestigatorListing[],
    teams: (teamsRes.data ?? []) as TeamListing[],
  };
}

/**
 * Fetch the full stats row for one investigator. Returns null if the
 * profile doesn't exist or has been deleted.
 */
export async function fetchInvestigatorStats(
  profileId: string
): Promise<InvestigatorListing | null> {
  const { data, error } = await supabase
    .from('investigator_public_case_counts')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as InvestigatorListing | null;
}

/**
 * Fetch the stats row for one team. Returns null if not found.
 */
export async function fetchTeamStats(teamId: string): Promise<TeamListing | null> {
  const { data, error } = await supabase
    .from('team_public_case_counts')
    .select('*')
    .eq('id', teamId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TeamListing | null;
}

// ============================================================
// VENUE PROFILES (rich)
// ============================================================

import type {
  LocationRow,
  LocationZoneRow,
} from './database.types';

/** A venue + its zones + (if verified) the team that operates it. */
export type VenueProfile = {
  location: LocationRow;
  zones: LocationZoneRow[];
  claimedByTeam: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    verified: boolean;
  } | null;
};

/**
 * Fetch a single venue with everything needed to render its rich
 * profile page. Returns null if the location doesn't exist.
 */
export async function fetchVenueProfile(
  locationId: string
): Promise<VenueProfile | null> {
  const { data: loc, error } = await supabase
    .from('locations')
    .select('*, claimed_by_team:teams!claimed_by_team_id(id, slug, name, logo_url, verified)')
    .eq('id', locationId)
    .maybeSingle();
  if (error) throw error;
  if (!loc) return null;

  const { data: zones, error: zErr } = await supabase
    .from('location_zones')
    .select('*')
    .eq('location_id', locationId)
    .order('sort_order', { ascending: true });
  if (zErr) throw zErr;

  // The joined alias `claimed_by_team` lands as a property on `loc`.
  const team = (loc as any).claimed_by_team ?? null;
  // Strip it from the location object so the typed LocationRow stays clean.
  const { claimed_by_team: _drop, ...rest } = loc as any;

  return {
    location: rest as LocationRow,
    zones: (zones ?? []) as LocationZoneRow[],
    claimedByTeam: team
      ? {
          id: team.id,
          slug: team.slug,
          name: team.name,
          logo_url: team.logo_url ?? null,
          verified: !!team.verified,
        }
      : null,
  };
}

/**
 * Cases for the Vault: owned by the user OR attributed to a team the
 * user belongs to. RLS allows both reads. We union the two queries
 * client-side so we get one deduped list with logs.
 *
 * Excludes soft-deleted cases automatically (RLS hides them).
 */
export async function fetchMyVaultCases(userId: string): Promise<CaseFile[]> {
  // Step 1: discover which teams the user belongs to.
  const { data: memberRows, error: memErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);
  if (memErr) throw memErr;
  const teamIds = (memberRows ?? []).map((r) => r.team_id);

  // Step 2: cases owned by me OR attributed to one of my teams.
  // PostgREST's `.or()` accepts a comma-separated list of filters.
  const ownerFilter = `owner_id.eq.${userId}`;
  const teamFilter = teamIds.length > 0
    ? `team_id.in.(${teamIds.join(',')})`
    : null;
  const orClause = teamFilter ? `${ownerFilter},${teamFilter}` : ownerFilter;

  const { data: cases, error } = await supabase
    .from('cases')
    .select('*, owner:profiles!owner_id(handle, display_name, avatar_url)')
    .or(orClause)
    .is('deleted_at', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!cases || cases.length === 0) return [];

  // Logs for all cases in one query.
  const ids = cases.map((c) => c.id);
  const { data: logs, error: logsErr } = await supabase
    .from('log_entries')
    .select('*')
    .in('case_id', ids)
    .order('timestamp', { ascending: true });
  if (logsErr) throw logsErr;

  const logsByCase = new Map<string, LogEntryRow[]>();
  (logs ?? []).forEach((l) => {
    const arr = logsByCase.get(l.case_id) ?? [];
    arr.push(l);
    logsByCase.set(l.case_id, arr);
  });

  return cases.map((c: any) =>
    caseRowToCaseFile(
      { ...c, owner: c.owner ?? null } as CaseRowWithOwner,
      logsByCase.get(c.id) ?? []
    )
  );
}

/**
 * Fetch the current user's soft-deleted cases. Used by the "Recently
 * Deleted" section in the Vault. Returns shallow case objects without
 * log entries — we don't need them for the list view, and the case
 * detail page already lazy-loads logs on demand.
 */
export async function fetchMyDeletedCases(): Promise<CaseFile[]> {
  const { data, error } = await supabase.rpc('list_my_deleted_cases');
  if (error) throw error;
  const rows = (data ?? []) as CaseRow[];
  if (rows.length === 0) return [];
  return rows.map((r) =>
    caseRowToCaseFile(
      { ...r, owner: null } as CaseRowWithOwner,
      []
    )
  );
}

/**
 * Restore a soft-deleted case. Only the owner can do this. Returns
 * the restored case (without logs) on success.
 */
export async function restoreCase(
  caseId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('undelete_case', { p_case_id: caseId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// VENUE FOLLOWS
// ============================================================

export async function followVenue(
  followerId: string,
  locationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('venue_follows')
    .insert({ follower_id: followerId, location_id: locationId });
  if (error) {
    if (error.code === '23505') return { ok: true }; // already following
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unfollowVenue(
  followerId: string,
  locationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('venue_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('location_id', locationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function isFollowingVenue(
  viewerId: string | null,
  locationId: string
): Promise<boolean> {
  if (!viewerId) return false;
  const { data, error } = await supabase
    .from('venue_follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('location_id', locationId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getVenueFollowerCount(locationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('venue_follows')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Recent public + anonymous cases logged at this location. Limited to
 * the most recent N; the venue page caps this at a small strip.
 * Anonymous cases preserve their anonymity (owner stripped).
 */
export type VenueCaseRow = {
  id: string;
  title: string;
  summary: string | null;
  visibility: Visibility;
  startedAt: string;
  endedAt: string | null;
  ownerHandle: string | null;
  ownerDisplayName: string | null;
  ownerAvatar: string | null;
  teamSlug: string | null;
  teamName: string | null;
  logCount: number;
};

export async function fetchRecentCasesAtVenue(
  locationId: string,
  limit = 6
): Promise<VenueCaseRow[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(
      `id, title, summary, visibility, started_at, ended_at,
       owner:profiles!owner_id(handle, display_name, avatar_url),
       team:teams!team_id(slug, name)`
    )
    .eq('location_id', locationId)
    .in('visibility', ['public', 'anonymous'])
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get per-case log counts in one query.
  const ids = data.map((c) => c.id);
  const { data: logRows } = await supabase
    .from('log_entries')
    .select('case_id')
    .in('case_id', ids);
  const logCounts = new Map<string, number>();
  (logRows ?? []).forEach((l) => {
    logCounts.set(l.case_id, (logCounts.get(l.case_id) ?? 0) + 1);
  });

  return data.map((row: any) => {
    const isAnon = row.visibility === 'anonymous';
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      visibility: row.visibility,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      ownerHandle: isAnon ? null : row.owner?.handle ?? null,
      ownerDisplayName: isAnon ? null : row.owner?.display_name ?? null,
      ownerAvatar: isAnon ? null : row.owner?.avatar_url ?? null,
      teamSlug: row.team?.slug ?? null,
      teamName: row.team?.name ?? null,
      logCount: logCounts.get(row.id) ?? 0,
    };
  });
}

// ============================================================
// VENUE EDITING (verified-team only — RLS enforced)
// ============================================================

/**
 * Patch fields on a location. RLS allows this for admins OR a member
 * of the team claiming this location (when verified). Returns the
 * updated row or an error string.
 */
export type VenueUpdatePatch = Partial<
  Pick<
    LocationRow,
    | 'tagline'
    | 'description'
    | 'built_year'
    | 'operating_window'
    | 'features'
    | 'website'
    | 'youtube_url'
    | 'instagram_url'
    | 'facebook_url'
    | 'tiktok_url'
    | 'booking_url'
    | 'street'
    | 'city'
    | 'state'
    | 'zip'
    | 'country'
    | 'hero_image'
    | 'pricing'
  >
>;

export async function updateVenue(
  locationId: string,
  patch: VenueUpdatePatch
): Promise<{ ok: true; row: LocationRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'venue not found or not permitted' };
  return { ok: true, row: data as LocationRow };
}

// ----- Zones -----

export async function fetchZones(locationId: string): Promise<LocationZoneRow[]> {
  const { data, error } = await supabase
    .from('location_zones')
    .select('*')
    .eq('location_id', locationId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LocationZoneRow[];
}

export type ZoneInsertInput = {
  location_id: string;
  name: string;
  icon?: string | null;
  tags?: string[];
  description?: string | null;
  sort_order?: number;
};

export async function createZone(
  input: ZoneInsertInput
): Promise<{ ok: true; row: LocationZoneRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('location_zones')
    .insert({
      location_id: input.location_id,
      name: input.name,
      icon: input.icon ?? null,
      tags: input.tags ?? [],
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'failed to create zone' };
  return { ok: true, row: data as LocationZoneRow };
}

export type ZoneUpdatePatch = Partial<
  Pick<LocationZoneRow, 'name' | 'icon' | 'tags' | 'description' | 'sort_order'>
>;

export async function updateZone(
  zoneId: string,
  patch: ZoneUpdatePatch
): Promise<{ ok: true; row: LocationZoneRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('location_zones')
    .update(patch)
    .eq('id', zoneId)
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'zone not found or not permitted' };
  return { ok: true, row: data as LocationZoneRow };
}

export async function deleteZone(
  zoneId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('location_zones').delete().eq('id', zoneId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * The team's role for `userId`, or null if the user isn't a member.
 * Used to gate the venue editor and the MANAGE VENUE CTA.
 */
export async function fetchMyTeamRole(
  teamId: string,
  userId: string | null
): Promise<'owner' | 'admin' | 'member' | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return ((data?.role as 'owner' | 'admin' | 'member') ?? null);
}

/**
 * Fetch the team's claimed venue (if any). Used by the editor to land
 * on the right location_id without a separate URL parameter.
 */
export async function fetchVenueForTeam(teamId: string): Promise<LocationRow | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('claimed_by_team_id', teamId)
    .eq('claim_status', 'verified')
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LocationRow | null;
}

// ============================================================
// LOCATION MANAGERS (venue ownership refactor — step 15)
// ============================================================
import type { LocationManagerRole, LocationManagerRow } from './database.types';

/**
 * A venue I manage, with my role and the venue's basic shape. Used
 * by the "/app/my-venues" dashboard and by the navbar dropdown to
 * decide whether to show "MANAGED VENUES".
 */
export type ManagedVenue = {
  location: LocationRow;
  role: LocationManagerRole;
};

/**
 * All venues this user manages (either as owner or manager). Empty
 * array if they don't manage any.
 */
export async function fetchVenuesIManage(userId: string): Promise<ManagedVenue[]> {
  // Two queries: the manager rows, then the locations. Doing them
  // separately avoids relying on PostgREST embedded-FK hints, which
  // require named foreign keys and can be brittle.
  const { data: managerRows, error } = await supabase
    .from('location_managers')
    .select('location_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!managerRows || managerRows.length === 0) return [];

  const locationIds = managerRows.map((r) => r.location_id);
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('*')
    .in('id', locationIds);
  if (locErr) throw locErr;
  if (!locations) return [];

  const locById = new Map<string, LocationRow>();
  for (const l of locations) locById.set(l.id, l as LocationRow);

  return managerRows
    .map((r) => {
      const location = locById.get(r.location_id);
      if (!location) return null;
      return {
        location,
        role: r.role as LocationManagerRole,
      };
    })
    .filter((x): x is ManagedVenue => x !== null);
}

/**
 * My role for one venue, or null if I don't manage it. Used to gate
 * the editor and the inline "manage" CTAs.
 */
export async function fetchMyVenueRole(
  userId: string | null,
  locationId: string
): Promise<LocationManagerRole | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('location_managers')
    .select('role')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .maybeSingle();
  if (error) return null;
  return (data?.role as LocationManagerRole | null) ?? null;
}

/**
 * Every manager of a venue, with their profile. Used by the public
 * venue page's MANAGED BY card (shows the primary owner) and by an
 * eventual manager-management UI.
 */
export type VenueManagerWithProfile = {
  user_id: string;
  role: LocationManagerRole;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export async function fetchVenueManagers(
  locationId: string
): Promise<VenueManagerWithProfile[]> {
  // Two queries: manager rows, then profiles. See fetchVenuesIManage
  // for why we avoid embedded-FK hints.
  const { data: managerRows, error } = await supabase
    .from('location_managers')
    .select('user_id, role, created_at')
    .eq('location_id', locationId)
    .order('role', { ascending: true }) // owners first alphabetically ('manager' > 'owner')
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!managerRows || managerRows.length === 0) return [];

  const userIds = managerRows.map((r) => r.user_id);
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url')
    .in('id', userIds);
  if (profErr) throw profErr;
  if (!profiles) return [];

  const profById = new Map<string, { handle: string; display_name: string; avatar_url: string | null }>();
  for (const p of profiles) {
    profById.set(p.id, {
      handle: p.handle,
      display_name: p.display_name,
      avatar_url: p.avatar_url ?? null,
    });
  }

  return managerRows
    .map((r) => {
      const prof = profById.get(r.user_id);
      if (!prof) return null;
      return {
        user_id: r.user_id,
        role: r.role as LocationManagerRole,
        handle: prof.handle,
        display_name: prof.display_name,
        avatar_url: prof.avatar_url,
      };
    })
    .filter((x): x is VenueManagerWithProfile => x !== null);
}

/**
 * Add a manager to a venue. RLS allows this for platform admins or
 * existing venue owners. Use 'owner' role sparingly — owners can
 * promote/demote each other.
 */
export async function addVenueManager(
  locationId: string,
  userId: string,
  role: LocationManagerRole = 'manager'
): Promise<{ ok: true; row: LocationManagerRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('location_managers')
    .insert({ location_id: locationId, user_id: userId, role })
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'failed to add manager' };
  return { ok: true, row: data as LocationManagerRow };
}

export async function removeVenueManager(
  locationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('location_managers')
    .delete()
    .eq('location_id', locationId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// LOCATION CLAIMS (step 16)
// ============================================================

export type ClaimStatusType = 'pending' | 'approved' | 'rejected';

export type ClaimedRole = 'owner' | 'operator' | 'general_manager' | 'other';

export const CLAIMED_ROLE_LABELS: Record<ClaimedRole, string> = {
  owner: 'Owner',
  operator: 'Operator',
  general_manager: 'General Manager',
  other: 'Other',
};

export type SubmitClaimInput = {
  locationId: string;
  claimedRole: ClaimedRole;
  message: string;
  proofLinks: string[];
};

/**
 * Submit a new claim. The DB enforces the one-pending-per-user-venue
 * constraint, so this will return an error if the same user already
 * has an open claim on the same venue.
 */
export async function submitClaim(
  _claimantId: string, // unused — RPC reads auth.uid()
  input: SubmitClaimInput
): Promise<{ ok: true; claimId: string } | { ok: false; error: string }> {
  const proofLinks = input.proofLinks
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const { data, error } = await supabase.rpc('submit_location_claim', {
    p_location_id: input.locationId,
    p_claimed_role: input.claimedRole,
    p_message: input.message.trim(),
    p_proof_links: proofLinks,
  });

  if (error) {
    // PostgREST surfaces unique-violation messages as the raw text;
    // give a friendlier version.
    if (error.message?.includes('claims_one_pending_per_user_venue')) {
      return { ok: false, error: 'You already have a pending claim for this venue.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, claimId: data as string };
}

/**
 * Has the current user already submitted a claim for this venue?
 * Returns the most recent claim (regardless of status) or null.
 */
export async function fetchMyClaimForVenue(
  userId: string,
  locationId: string
): Promise<LocationClaimRow | null> {
  const { data, error } = await supabase
    .from('location_claims')
    .select('*')
    .eq('claimant_id', userId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as LocationClaimRow | null;
}

/**
 * Withdraw a pending claim. RLS + RPC checks that the user owns the
 * claim and that it's still pending.
 */
export async function withdrawClaim(
  claimId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('withdraw_location_claim', {
    p_claim_id: claimId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ============================================================
// NOTIFICATIONS (step 17)
// ============================================================
import type { NotificationRow } from './database.types';

export type NotificationWithActor = NotificationRow & {
  actor: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

/**
 * Recent notifications for the signed-in user, newest first. Joins
 * actor profile inline via two-query pattern.
 */
export async function fetchMyNotifications(limit = 30): Promise<NotificationWithActor[]> {
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const actorIds = Array.from(
    new Set(rows.filter((r) => r.actor_id).map((r) => r.actor_id as string))
  );
  let profById = new Map<string, any>();
  if (actorIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, handle, display_name, avatar_url')
      .in('id', actorIds);
    (profs ?? []).forEach((p: any) => profById.set(p.id, p));
  }

  return rows.map((r: any) => {
    const actor = r.actor_id ? profById.get(r.actor_id) : null;
    return {
      ...(r as NotificationRow),
      actor: actor
        ? {
            handle: actor.handle,
            display_name: actor.display_name,
            avatar_url: actor.avatar_url ?? null,
          }
        : null,
    };
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function markNotificationRead(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Resolve the right destination URL for a given notification. The
 * bell dropdown + full page both use this to render each item as a
 * Link.
 */
export function notificationLink(n: NotificationRow & { actor?: { handle: string } | null }): string {
  const actorHandle = (n.actor?.handle ?? '').replace(/^@/, '');
  switch (n.kind) {
    case 'follow':
      return actorHandle ? `/u/${encodeURIComponent(actorHandle)}` : '/app';
    case 'venue_follow':
      return n.target_id ? `/v/${encodeURIComponent(n.target_id)}` : '/app';
    case 'case_at_venue':
      return n.target_id ? `/case/${encodeURIComponent(n.target_id)}` : '/app';
    case 'claim_approved':
    case 'claim_rejected':
      return n.target_id ? `/v/${encodeURIComponent(n.target_id)}` : '/app';
    case 'claim_submitted':
      return '/app/admin';
    case 'case_comment':
      return n.target_id ? `/case/${encodeURIComponent(n.target_id)}` : '/app';
    default:
      return '/app';
  }
}

/**
 * Render-ready label for a notification. Returns plain text — the
 * caller wraps with appropriate styling. Actor display name is
 * pre-resolved (or "Someone" if missing/anonymous).
 */
export function notificationText(n: NotificationWithActor): string {
  const who = n.actor?.display_name ?? 'Someone';
  const venue = (n.data?.location_name as string) ?? 'a venue';
  const caseTitle = (n.data?.case_title as string) ?? 'a case';
  switch (n.kind) {
    case 'follow':
      return `${who} followed you`;
    case 'venue_follow':
      return `${who} followed ${venue}`;
    case 'case_at_venue': {
      const isAnon = n.data?.visibility === 'anonymous';
      const subject = isAnon ? 'Someone' : who;
      return `${subject} sealed a public case at ${venue}: "${caseTitle}"`;
    }
    case 'claim_approved':
      return `Your claim for ${venue} was approved. You can now manage it.`;
    case 'claim_rejected':
      return `Your claim for ${venue} was not approved${n.data?.note ? `: "${n.data.note}"` : '.'}`;
    case 'claim_submitted':
      return `${who} submitted a claim for ${venue}.`;
    case 'case_comment':
      return `${who} commented on "${caseTitle}"`;
    default:
      return 'New notification';
  }
}

// ============================================================
// LOG ENTRY PHOTOS (step 18)
// ============================================================

const PHOTO_BUCKET = 'log-photos';

export type LogEntryPhotoRow = {
  id: string;
  log_entry_id: string;
  case_id: string;
  owner_id: string;
  storage_path: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
};

/**
 * Resolve a list of storage paths to short-lived signed URLs. Used by
 * the case view to render photos.
 */
export async function getSignedPhotoUrls(
  storagePaths: string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (storagePaths.length === 0) return result;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(storagePaths, expiresInSeconds);
  if (error) return result;
  (data ?? []).forEach((r: any) => {
    if (r.path && r.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

/**
 * Upload a single processed photo blob to storage and insert the
 * matching log_entry_photos row. The caller passes already-resized
 * blob + dimensions.
 *
 * Path: `{user_id}/{case_id}/{log_entry_id}/{photo_id}.jpg`
 */
export async function uploadLogPhoto(input: {
  userId: string;
  caseId: string;
  logEntryId: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  caption?: string;
}): Promise<{ ok: true; row: LogEntryPhotoRow } | { ok: false; error: string }> {
  // We let the database assign a uuid for the photo id by inserting
  // with the row first and using its id. But we need the storage path
  // up front. Strategy: generate a uuid client-side for the photo,
  // upload to {user}/{case}/{log}/{uuid}.jpg, then insert with that id.
  const photoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const ext =
    input.mimeType === 'image/jpeg'
      ? 'jpg'
      : input.mimeType === 'image/png'
      ? 'png'
      : input.mimeType === 'image/webp'
      ? 'webp'
      : 'bin';

  const storagePath = `${input.userId}/${input.caseId}/${input.logEntryId}/${photoId}.${ext}`;

  // 1. Upload to storage
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  // 2. Insert metadata row
  const { data, error } = await supabase
    .from('log_entry_photos')
    .insert({
      id: photoId,
      log_entry_id: input.logEntryId,
      case_id: input.caseId,
      owner_id: input.userId,
      storage_path: storagePath,
      mime_type: input.mimeType,
      bytes: input.blob.size,
      width: input.width,
      height: input.height,
      caption: input.caption ?? null,
    })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    // Try to clean up the orphaned storage object.
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => {});
    return { ok: false, error: error?.message ?? 'Failed to record photo' };
  }
  return { ok: true, row: data as LogEntryPhotoRow };
}

/**
 * Delete a photo: storage object first, then the metadata row. RLS
 * ensures only the owner (or admin) can do this.
 */
export async function deleteLogPhoto(
  photo: LogEntryPhotoRow
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Delete storage object first; if this fails we don't want to lose
  // the DB pointer.
  const { error: storErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photo.storage_path]);
  if (storErr) {
    // Continue anyway — storage may already be missing.
    console.warn('[deleteLogPhoto] storage delete warning:', storErr.message);
  }
  const { error } = await supabase
    .from('log_entry_photos')
    .delete()
    .eq('id', photo.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Fetch all photos for a case, in created_at order, grouped by log
 * entry id. Uses the list_case_photos RPC which checks case
 * visibility server-side.
 */
export async function fetchPhotosForCase(
  caseId: string
): Promise<Map<string, LogEntryPhotoRow[]>> {
  const result = new Map<string, LogEntryPhotoRow[]>();
  const { data, error } = await supabase.rpc('list_case_photos', { p_case_id: caseId });
  if (error || !data) return result;
  for (const r of data as LogEntryPhotoRow[]) {
    const arr = result.get(r.log_entry_id) ?? [];
    arr.push(r);
    result.set(r.log_entry_id, arr);
  }
  return result;
}

/**
 * Get the authenticated user's id, or null if signed out. Used by
 * background tasks like photo upload that need to know who they are.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Update a single photo's caption. Only the photo owner can do this
 * (enforced by RLS on log_entry_photos.update).
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = caption?.trim() || null;
  const { error } = await supabase
    .from('log_entry_photos')
    .update({ caption: trimmed })
    .eq('id', photoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// AVATAR UPLOAD (step 19)
// ============================================================

export const AVATAR_BUCKET = 'avatars';

/**
 * Upload an avatar blob to storage and return its public URL.
 *
 * @param ownerId - The user uuid (for profile avatars) or team uuid (for team logos)
 * @param blob - The processed image blob (use cropSquareForAvatar)
 * @param oldUrl - If provided, the old avatar will be removed from storage
 *                 after the new one is uploaded successfully
 */
export async function uploadAvatar(input: {
  ownerId: string;
  blob: Blob;
  oldUrl?: string | null;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const photoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${input.ownerId}/${photoId}.jpg`;

  // 1. Upload the new file.
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  // 2. Get the public URL.
  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(storagePath);

  // 3. Best-effort cleanup of the old avatar. Only attempt if the URL
  //    looks like one of ours (same bucket + ownerId prefix). Don't
  //    surface failures — orphaned files are a minor housekeeping
  //    issue, not a user-facing one.
  if (input.oldUrl) {
    try {
      const oldPath = extractStoragePathFromPublicUrl(input.oldUrl, AVATAR_BUCKET);
      if (oldPath && oldPath.startsWith(`${input.ownerId}/`)) {
        await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }
    } catch {
      /* best-effort */
    }
  }

  return { ok: true, publicUrl: urlData.publicUrl };
}

/**
 * Extract the storage path from a public URL of one of our buckets.
 * Returns null if the URL doesn't match the expected shape.
 *
 * Example public URL:
 *   https://nclxepcilszzzquvbrrf.supabase.co/storage/v1/object/public/avatars/{owner}/{uuid}.jpg
 */
function extractStoragePathFromPublicUrl(
  publicUrl: string,
  bucket: string
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.slice(idx + marker.length);
}

// ============================================================
// VENUE PHOTO UPLOAD (step 20)
// ============================================================

export const VENUE_PHOTO_BUCKET = 'venue-photos';

/**
 * Upload a venue hero image and return its public URL.
 *
 * @param locationId - The location id (e.g. 'my-haunted-manor-...')
 * @param blob - The processed image blob (use cropWideForBanner)
 * @param oldUrl - If provided and stored in our bucket under this venue,
 *                 the old file is best-effort removed after the new one
 *                 is uploaded.
 */
export async function uploadVenuePhoto(input: {
  locationId: string;
  blob: Blob;
  oldUrl?: string | null;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const photoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${input.locationId}/hero-${photoId}.jpg`;

  // 1. Upload.
  const { error: upErr } = await supabase.storage
    .from(VENUE_PHOTO_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  // 2. Public URL.
  const { data: urlData } = supabase.storage
    .from(VENUE_PHOTO_BUCKET)
    .getPublicUrl(storagePath);

  // 3. Best-effort cleanup of the old file (if it's one of ours).
  if (input.oldUrl) {
    try {
      const marker = `/storage/v1/object/public/${VENUE_PHOTO_BUCKET}/`;
      const idx = input.oldUrl.indexOf(marker);
      if (idx >= 0) {
        const oldPath = input.oldUrl.slice(idx + marker.length);
        if (oldPath.startsWith(`${input.locationId}/`)) {
          await supabase.storage.from(VENUE_PHOTO_BUCKET).remove([oldPath]);
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return { ok: true, publicUrl: urlData.publicUrl };
}

// ============================================================
// VENUE SUBMISSIONS (step 21)
// ============================================================

export type VenueSubmitterRole = 'owner' | 'operator' | 'hunter' | 'other';

export type VenueSubmissionPayload = {
  name: string;
  tagline?: string;
  description: string;
  street?: string;
  city: string;
  state?: string;
  zip?: string;
  country?: string;
  /** Optional GPS coords. If absent, the venue lands at (0,0) until admin sets it. */
  lat?: number;
  lng?: number;
  /** Public website. */
  website?: string;
  /** Booking URL. */
  booking_url?: string;
  /** Hero image public URL (already uploaded to venue-photos bucket). */
  hero_image?: string;
  /** Short tags shown on venue cards. */
  tags?: string[];
  /** Submitter's relationship to the venue. */
  submitter_role: VenueSubmitterRole;
  submitter_role_other?: string;
  /** Anything else they want the admin to know. */
  notes?: string;
};

export type VenueSubmissionRow = {
  id: string;
  submitter_id: string;
  payload: VenueSubmissionPayload;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  approved_location_id: string | null;
  created_at: string;
};

/**
 * Submit a venue for admin review. Server enforces:
 * - signed in
 * - name >= 2 chars, <= 120 chars
 * - description >= 20 chars
 * - city required
 * - max 1 pending submission at a time per submitter
 */
export async function submitVenue(
  payload: VenueSubmissionPayload
): Promise<{ ok: true; submissionId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('submit_location', {
    p_payload: payload as any,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, submissionId: data as string };
}

/** Fetch a single submission (admin or owner only — enforced by RLS). */
export async function fetchVenueSubmission(
  submissionId: string
): Promise<VenueSubmissionRow | null> {
  const { data, error } = await supabase
    .from('location_submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();
  if (error) {
    console.warn('[fetchVenueSubmission] failed:', error.message);
    return null;
  }
  return data as VenueSubmissionRow | null;
}

/** List the current user's own submissions (most recent first). */
export async function fetchMyVenueSubmissions(
  userId: string
): Promise<VenueSubmissionRow[]> {
  const { data, error } = await supabase
    .from('location_submissions')
    .select('*')
    .eq('submitter_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[fetchMyVenueSubmissions] failed:', error.message);
    return [];
  }
  return (data ?? []) as VenueSubmissionRow[];
}

/**
 * Toggle the starred flag on a single log entry. Owner-only via RLS
 * on log_entries.update. Idempotent at the value level: passing the
 * current value just makes it stick.
 */
export async function setLogStarred(
  logId: string,
  starred: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('log_entries')
    .update({ starred })
    .eq('id', logId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// AUDIO ATTACHMENTS (step 22)
// ============================================================

const AUDIO_BUCKET = 'log-audio';

export type LogEntryAudioRow = {
  id: string;
  log_entry_id: string;
  case_id: string;
  owner_id: string;
  storage_path: string;
  mime_type: string;
  bytes: number;
  duration_seconds: number | null;
  caption: string | null;
  created_at: string;
};

/**
 * Resolve a list of audio storage paths to short-lived signed URLs.
 * Mirrors getSignedPhotoUrls; the bucket is private so we can't
 * just construct a public URL.
 */
export async function getSignedAudioUrls(
  storagePaths: string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (storagePaths.length === 0) return result;
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrls(storagePaths, expiresInSeconds);
  if (error) return result;
  (data ?? []).forEach((r: any) => {
    if (r.path && r.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

/**
 * Upload a single audio file to storage and insert the matching
 * log_entry_audio row.
 *
 * Path: `{user_id}/{case_id}/{log_entry_id}/{audio_id}.{ext}`
 */
export async function uploadLogAudio(input: {
  userId: string;
  caseId: string;
  logEntryId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds?: number;
  caption?: string;
}): Promise<{ ok: true; row: LogEntryAudioRow } | { ok: false; error: string }> {
  const audioId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Map common audio MIME types to a safe file extension. Anything we
  // can't recognise falls back to .audio so the upload still succeeds.
  const ext = (() => {
    const m = input.mimeType.toLowerCase();
    if (m === 'audio/mpeg' || m === 'audio/mp3') return 'mp3';
    if (m === 'audio/wav' || m === 'audio/x-wav') return 'wav';
    if (m === 'audio/mp4' || m === 'audio/m4a' || m === 'audio/x-m4a') return 'm4a';
    if (m === 'audio/ogg') return 'ogg';
    if (m === 'audio/webm') return 'webm';
    return 'audio';
  })();

  const storagePath = `${input.userId}/${input.caseId}/${input.logEntryId}/${audioId}.${ext}`;

  // 1. Upload to storage
  const { error: upErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(storagePath, input.blob, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  // 2. Insert metadata row
  const { data, error } = await supabase
    .from('log_entry_audio')
    .insert({
      id: audioId,
      log_entry_id: input.logEntryId,
      case_id: input.caseId,
      owner_id: input.userId,
      storage_path: storagePath,
      mime_type: input.mimeType,
      bytes: input.blob.size,
      duration_seconds: input.durationSeconds ?? null,
      caption: input.caption ?? null,
    })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    // Try to clean up the orphaned storage object.
    await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]).catch(() => {});
    return { ok: false, error: error?.message ?? 'Failed to record audio clip' };
  }
  return { ok: true, row: data as LogEntryAudioRow };
}

/**
 * Delete an audio clip: storage object first, then the metadata row.
 * RLS ensures only the owner (or admin) can do this.
 */
export async function deleteLogAudio(
  audio: LogEntryAudioRow
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: storErr } = await supabase.storage
    .from(AUDIO_BUCKET)
    .remove([audio.storage_path]);
  if (storErr) {
    console.warn('[deleteLogAudio] storage delete warning:', storErr.message);
  }
  const { error } = await supabase
    .from('log_entry_audio')
    .delete()
    .eq('id', audio.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Fetch all audio clips for a case, grouped by log entry id. Uses
 * the list_case_audio RPC which checks case visibility server-side.
 */
export async function fetchAudioForCase(
  caseId: string
): Promise<Map<string, LogEntryAudioRow[]>> {
  const result = new Map<string, LogEntryAudioRow[]>();
  const { data, error } = await supabase.rpc('list_case_audio', { p_case_id: caseId });
  if (error || !data) return result;
  for (const r of data as LogEntryAudioRow[]) {
    const arr = result.get(r.log_entry_id) ?? [];
    arr.push(r);
    result.set(r.log_entry_id, arr);
  }
  return result;
}

/**
 * Edit the textual fields (and optionally the timestamp) of a sealed
 * log entry. Owner-only, enforced by RLS. Returns ok or an error
 * message.
 *
 * Pass undefined for any field you don't want to change. To clear a
 * note, pass null.
 */
export async function updateLogEntry(
  logId: string,
  fields: {
    observation?: string;
    note?: string | null;
    timestamp?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: {
    observation?: string;
    note?: string | null;
    timestamp?: string;
  } = {};
  if (fields.observation !== undefined) patch.observation = fields.observation;
  if (fields.note !== undefined) patch.note = fields.note;
  if (fields.timestamp !== undefined) patch.timestamp = fields.timestamp;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase
    .from('log_entries')
    .update(patch)
    .eq('id', logId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// EQUIPMENT LOADOUTS (step 23)
// ============================================================

export type EquipmentLoadoutRow = {
  id: string;
  owner_id: string;
  name: string;
  equipment_ids: string[];
  custom_equipment: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

/** Max number of saved loadouts per user. Enforced client-side. */
export const MAX_LOADOUTS_PER_USER = 8;

export async function fetchLoadouts(
  userId: string
): Promise<EquipmentLoadoutRow[]> {
  const { data, error } = await supabase
    .from('equipment_loadouts')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[fetchLoadouts] failed:', error.message);
    return [];
  }
  return (data ?? []) as EquipmentLoadoutRow[];
}

export async function createLoadout(input: {
  userId: string;
  name: string;
  equipmentIds: string[];
  customEquipment?: Record<string, string>;
}): Promise<
  { ok: true; row: EquipmentLoadoutRow } | { ok: false; error: string }
> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, error: 'Name is required.' };
  if (name.length > 60) return { ok: false, error: 'Name is too long (60 max).' };
  if (input.equipmentIds.length === 0)
    return { ok: false, error: 'Pick at least one piece of equipment first.' };

  const { data, error } = await supabase
    .from('equipment_loadouts')
    .insert({
      owner_id: input.userId,
      name,
      equipment_ids: input.equipmentIds,
      custom_equipment:
        input.customEquipment && Object.keys(input.customEquipment).length > 0
          ? input.customEquipment
          : null,
    })
    .select('*')
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Failed to save loadout' };
  }
  return { ok: true, row: data as EquipmentLoadoutRow };
}

export async function deleteLoadout(
  loadoutId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('equipment_loadouts')
    .delete()
    .eq('id', loadoutId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function renameLoadout(
  loadoutId: string,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Name is required.' };
  if (trimmed.length > 60) return { ok: false, error: 'Name is too long (60 max).' };
  const { error } = await supabase
    .from('equipment_loadouts')
    .update({ name: trimmed })
    .eq('id', loadoutId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// INVESTIGATIONS (step 24)
// ============================================================
// Team-scoped umbrella that groups multiple individual hunts at the
// same venue on the same night. Owner/admin starts. Members join
// via the auto-list or via a 6-char code. Each member still seals
// their own case; their case auto-links to the parent investigation.

export type InvestigationRow = {
  id: string;
  team_id: string;
  host_id: string;
  name: string | null;
  venue_id: string | null;
  location_name: string;
  join_code: string;
  status: 'open' | 'closed';
  started_at: string;
  closed_at: string | null;
  last_activity_at: string;
};

export type InvestigationMemberRow = {
  investigation_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  group_id: string | null;
};

/** Output of list_active_investigations_for_user RPC. */
export type ActiveInvestigationSummary = {
  id: string;
  team_id: string;
  team_name: string;
  team_slug: string;
  host_id: string;
  host_handle: string;
  name: string | null;
  location_name: string;
  venue_id: string | null;
  join_code: string;
  started_at: string;
  last_activity_at: string;
  member_count: number;
  i_am_member: boolean;
};

/** Start a new investigation. Caller must be owner/admin of the team.
 * Returns the new investigation id, or an error. */
export async function createInvestigation(input: {
  teamId: string;
  locationName: string;
  venueId?: string | null;
  name?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('create_investigation', {
    p_team_id: input.teamId,
    p_location_name: input.locationName,
    p_venue_id: input.venueId ?? null,
    p_name: input.name ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No id returned' };
  return { ok: true, id: data as string };
}

/** Join an investigation by its 6-char code. Returns the joined id. */
export async function joinInvestigationByCode(
  code: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('join_investigation_by_code', {
    p_code: code,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No id returned' };
  return { ok: true, id: data as string };
}

/** Join an investigation directly by id (used from the auto-list). */
export async function joinInvestigationById(
  investigationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Upsert so re-joining clears any prior left_at.
  const { error } = await supabase
    .from('investigation_members')
    .upsert(
      {
        investigation_id: investigationId,
        user_id: userId,
        left_at: null,
      },
      { onConflict: 'investigation_id,user_id' }
    );
  if (error) return { ok: false, error: error.message };
  // Bump heartbeat manually since we didn't go through the RPC.
  await supabase
    .from('investigations')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', investigationId);
  return { ok: true };
}

/** Leave an investigation (mark left_at). */
export async function leaveInvestigation(
  investigationId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('investigation_members')
    .update({ left_at: new Date().toISOString() })
    .eq('investigation_id', investigationId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Close an investigation. Host or team owner only. */
export async function closeInvestigation(
  investigationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('close_investigation', {
    p_investigation_id: investigationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Active investigations across all teams the user belongs to.
 * Backed by the security-definer RPC for clean joins + counts. */
export async function listActiveInvestigationsForUser(): Promise<
  ActiveInvestigationSummary[]
> {
  const { data, error } = await supabase.rpc('list_active_investigations_for_user');
  if (error) {
    console.warn('[listActiveInvestigationsForUser]', error.message);
    return [];
  }
  return (data ?? []) as ActiveInvestigationSummary[];
}

/** Fetch a single investigation by id. RLS gates team membership. */
export async function fetchInvestigation(
  investigationId: string
): Promise<InvestigationRow | null> {
  const { data, error } = await supabase
    .from('investigations')
    .select('*')
    .eq('id', investigationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as InvestigationRow;
}

/** Members of an investigation, with profile info for display. */
export async function fetchInvestigationMembers(
  investigationId: string
): Promise<
  Array<{
    user_id: string;
    joined_at: string;
    left_at: string | null;
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('investigation_members')
    .select('user_id, joined_at, left_at, profiles!inner(handle, display_name, avatar_url)')
    .eq('investigation_id', investigationId)
    .order('joined_at', { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    user_id: r.user_id,
    joined_at: r.joined_at,
    left_at: r.left_at,
    handle: r.profiles?.handle ?? null,
    display_name: r.profiles?.display_name ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
  }));
}

/** All cases linked to this investigation. */
/** Row shape returned by list_investigation_cases. Looks like a
 * normal case row but adds a `redacted` boolean so the UI can render
 * a stub card for other people's private cases (the title is replaced
 * with "[Private case]" and most fields are nulled). */
export type InvestigationCaseRow = {
  id: string;
  owner_id: string;
  team_id: string | null;
  title: string;
  summary: string | null;
  location_id: string | null;
  location_name: string;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  ended_at: string | null;
  visibility: 'public' | 'private' | 'anonymous';
  gps_verified: boolean;
  equipment_used: string[] | null;
  custom_equipment: Record<string, string> | null;
  tags: string[] | null;
  sealed: boolean;
  investigation_id: string | null;
  group_id: string | null;
  redacted: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchInvestigationCases(
  investigationId: string
): Promise<InvestigationCaseRow[]> {
  const { data, error } = await supabase.rpc('list_investigation_cases', {
    p_investigation_id: investigationId,
  });
  if (error || !data) return [];
  return data as InvestigationCaseRow[];
}

/** Link an existing case to an investigation (or unlink with null). */
export async function setCaseInvestigation(
  caseId: string,
  investigationId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cases')
    .update({ investigation_id: investigationId })
    .eq('id', caseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// INVESTIGATION GROUPS (step 25 / Path II)
// ============================================================
// Smaller parties within an investigation. Leader announces a group
// with a zone name; team members self-select to join. Each member
// still seals their own case; the case auto-links to whichever
// group they're in at seal time (or to no group if "going solo").

export type InvestigationGroupRow = {
  id: string;
  investigation_id: string;
  leader_id: string;
  leader_handle: string | null;
  leader_display_name: string | null;
  leader_avatar_url: string | null;
  zone: string;
  created_at: string;
  ended_at: string | null;
  member_count: number;
};

/** Create a new group inside an investigation. Caller is the leader. */
export async function createInvestigationGroup(
  investigationId: string,
  zone: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmedZone = zone.trim();
  if (!trimmedZone) return { ok: false, error: 'Group name is required.' };
  if (trimmedZone.length > 80) return { ok: false, error: 'Group name is too long (80 max).' };
  const { data, error } = await supabase.rpc('create_investigation_group', {
    p_investigation_id: investigationId,
    p_zone: trimmedZone,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No id returned' };
  return { ok: true, id: data as string };
}

/** Join an existing group as the caller. Moves them out of any prior group. */
export async function joinInvestigationGroup(
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('join_investigation_group', {
    p_group_id: groupId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Leave whichever group the caller is in, for this investigation.
 * They become "solo" again within the umbrella. */
export async function leaveInvestigationGroup(
  investigationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('leave_investigation_group', {
    p_investigation_id: investigationId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Leader (or team owner) ends a group. Member group_ids stay attached
 * for historical attribution; they just can't join the group anymore. */
export async function endInvestigationGroup(
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('end_investigation_group', {
    p_group_id: groupId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** List all groups for an investigation, with leader info and member counts. */
export async function listInvestigationGroups(
  investigationId: string
): Promise<InvestigationGroupRow[]> {
  const { data, error } = await supabase.rpc('list_investigation_groups', {
    p_investigation_id: investigationId,
  });
  if (error) {
    console.warn('[listInvestigationGroups]', error.message);
    return [];
  }
  return (data ?? []) as InvestigationGroupRow[];
}

/** Get the caller's current group for an investigation, or null. */
export async function fetchMyInvestigationGroup(
  investigationId: string,
  userId: string
): Promise<{ group_id: string | null }> {
  const { data, error } = await supabase
    .from('investigation_members')
    .select('group_id')
    .eq('investigation_id', investigationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { group_id: null };
  return { group_id: (data as any).group_id ?? null };
}

/** Link an existing case to a group (or unlink with null). */
export async function setCaseGroup(
  caseId: string,
  groupId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cases')
    .update({ group_id: groupId })
    .eq('id', caseId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// MULTI-GROUP MEMBERSHIP + LEADER TAGGING (step 26)
// ============================================================

export type InvestigationGroupMemberRow = {
  user_id: string;
  added_at: string;
  added_by: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Create a group within an investigation AND tag members in one
 * transaction. Used by the HuntStart group step. The caller becomes
 * the leader and is auto-tagged.
 */
export async function createInvestigationGroupWithMembers(
  investigationId: string,
  zone: string,
  memberIds: string[]
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmedZone = zone.trim();
  if (!trimmedZone) return { ok: false, error: 'Group name is required.' };
  if (trimmedZone.length > 80) return { ok: false, error: 'Group name is too long (80 max).' };
  const { data, error } = await supabase.rpc(
    'create_investigation_group_with_members',
    {
      p_investigation_id: investigationId,
      p_zone: trimmedZone,
      p_member_ids: memberIds,
    }
  );
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No id returned' };
  return { ok: true, id: data as string };
}

/** Tag a single member into an existing group. */
export async function tagMemberIntoGroup(
  groupId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('tag_member_into_group', {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove a member from a group. Leader or self. */
export async function untagMemberFromGroup(
  groupId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('untag_member_from_group', {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** All open groups the caller is in, for a specific investigation. */
export async function listMyGroupsInInvestigation(
  investigationId: string
): Promise<Array<{ group_id: string }>> {
  const { data, error } = await supabase.rpc('list_my_groups_in_investigation', {
    p_investigation_id: investigationId,
  });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({ group_id: r.group_id }));
}

/** Members of a single group with profile info. */
export async function listGroupMembers(
  groupId: string
): Promise<InvestigationGroupMemberRow[]> {
  const { data, error } = await supabase.rpc('list_group_members', {
    p_group_id: groupId,
  });
  if (error || !data) return [];
  return data as InvestigationGroupMemberRow[];
}

// ============================================================
// LIVE HUNTS IN AN INVESTIGATION (step 28)
// ============================================================

export type ActiveHuntInInvestigation = {
  check_in_id: string;
  hunt_id: string;
  owner_id: string;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  is_anonymous: boolean;
  location_name: string;
  started_at: string;
  expires_at: string;
  group_id: string | null;
  group_zone: string | null;
};

/** Returns currently-live hunts (active + non-expired check-ins) from
 * the investigation's members, with profile + group context attached
 * for display. RLS-gated server-side; non-team-members get nothing. */
export async function listActiveHuntsInInvestigation(
  investigationId: string
): Promise<ActiveHuntInInvestigation[]> {
  const { data, error } = await supabase.rpc(
    'list_active_hunts_in_investigation',
    { p_investigation_id: investigationId }
  );
  if (error) {
    console.warn('[listActiveHuntsInInvestigation]', error.message);
    return [];
  }
  return (data ?? []) as ActiveHuntInInvestigation[];
}
