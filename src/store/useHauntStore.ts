import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as dataLayer from '../lib/dataLayer';
import * as imageProcess from '../lib/imageProcess';
import { supabase } from '../lib/supabase';

// Helper: get the current authenticated user's id from the session.
// Cached briefly to avoid hammering getSession() in tight loops.
let cachedAuthId: string | null = null;
let cachedAuthAt = 0;
async function getProfileIdFromSession(): Promise<string | null> {
  if (cachedAuthId && Date.now() - cachedAuthAt < 5000) return cachedAuthId;
  const { data } = await supabase.auth.getSession();
  cachedAuthId = data.session?.user.id ?? null;
  cachedAuthAt = Date.now();
  return cachedAuthId;
}

// ============================================================
// Equipment catalog — curated list + free-form custom.
// Equipment is optional everywhere.
// ============================================================
export const EQUIPMENT_CATALOG = [
  { id: 'k2',       name: 'K-II EMF Meter',         abbr: 'K-II' },
  { id: 'rempod',   name: 'REM Pod',                abbr: 'REM' },
  { id: 'thermal',  name: 'Thermal',                abbr: 'TEMP' },
  { id: 'sb7',      name: 'SB7 Spirit Box',         abbr: 'SB7' },
  { id: 'voice',    name: 'Digital Voice Recorder', abbr: 'VOICE' },
  { id: 'geophone', name: 'Geophone',               abbr: 'GEO' },
] as const;

export type CatalogEquipmentId = typeof EQUIPMENT_CATALOG[number]['id'];
export type EquipmentId = CatalogEquipmentId | string;

export const PERSONAL_EXPERIENCE_ID = '__personal__';
export const PERSONAL_EXPERIENCE_LABEL = 'Personal experience';
export const PERSONAL_EXPERIENCE_ABBR = 'EXP';

// ============================================================
// Types
// ============================================================
export type Visibility = 'public' | 'private' | 'anonymous';

export type MediaAttachment = {
  id: string;
  kind: 'video' | 'audio' | 'image';
  url: string;
  caption?: string;
  addedAt: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID;
  equipmentLabel?: string;
  observation: string;
  note?: string;
  starred?: boolean;
  media?: MediaAttachment[];
  data?: Record<string, unknown>;       // equipment-specific structured data
  /**
   * Photo files attached during the active hunt. NOT persisted to
   * storage (Zustand persist will drop them since File isn't JSON
   * serializable). Uploaded to Supabase Storage at seal time.
   * Don't reference this anywhere on a sealed CaseFile — by then the
   * photos live in log_entry_photos and are fetched separately.
   */
  pendingPhotoFiles?: File[];
};

export type Coords = { lat: number; lng: number };

// Two sources for venues: 'user' (created by a hunter's check-in) or 'catalog'
// (seeded by HauntLog from the curated list).
export type VenueSource = 'user' | 'catalog';

export type VenueAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

export type VenueContact = {
  email?: string;
  phone?: string;
};

export type VenueRevision = {
  at: string;
  byHandle: string;
  // Old values, so the revision row shows "name was X" in the UI.
  changes: Partial<{
    name: string;
    lat: number;
    lng: number;
    notes: string;
    description: string;
    website: string;
    hours: string;
    address: VenueAddress;
    contact: VenueContact;
    rules: string[];
    bookingUrl: string;
    tags: string[];
  }>;
};

export type Venue = {
  id: string;
  source: VenueSource;
  name: string;
  lat: number;
  lng: number;

  // Optional rich fields, mostly used by catalog/claimed venues.
  description?: string;
  address?: VenueAddress;
  website?: string;
  hours?: string;
  contact?: VenueContact;
  rules?: string[];
  bookingUrl?: string;
  tags?: string[];
  photos?: string[];           // URLs — deferred until Supabase Storage

  // Internal-only convenience field (the older `notes` field, kept for
  // backwards-compat with user-created venues from step 1.5).
  notes?: string;

  // Claim status. Real claim flow ships in step 1.8 / Supabase.
  claimedByHandle?: string;    // venue-owner handle if claimed
  verified?: boolean;

  createdAt: string;
  createdByHandle: string;     // "@hauntlog" for catalog seeds
  revisions: VenueRevision[];
};

/**
 * The right URL to open this venue at.
 *
 * Verified catalog venues route to the rich `/v/:id` profile page
 * (step 11). Everything else stays on the legacy editor-friendly
 * `/app/atlas/venue/:id` view.
 *
 * Takes anything with `id` and `verified` so it works with both the
 * local Venue store type and any narrower shape (e.g. an Atlas marker).
 */
export function venueProfileUrl(v: { id: string; verified?: boolean | null }): string {
  return v.verified
    ? `/v/${encodeURIComponent(v.id)}`
    : `/app/atlas/venue/${encodeURIComponent(v.id)}`;
}

export type CaseFile = {
  id: string;
  ownerHandle: string;
  /** Supabase user id of the case owner. Used by Vault scope filter. */
  ownerId?: string;
  /** When set, the case is attributed to this team. Used by Vault scope filter. */
  teamId?: string;
  title: string;
  summary?: string;
  venueId?: string;
  location: string;
  zone?: string;
  lat?: number;
  lng?: number;
  startedAt: string;
  endedAt?: string;
  visibility: Visibility;
  gpsVerified: boolean;
  equipmentUsed: EquipmentId[];
  customEquipment?: Record<string, string>;
  tags?: string[];
  logs: LogEntry[];
  sealed: boolean;
  /** Step 24: when set, this case is part of a team investigation umbrella. */
  investigationId?: string;
};

export type ActiveHunt = {
  id: string;
  startedAt: string;
  venueId?: string;
  location: string;
  zone?: string;
  lat?: number;
  lng?: number;
  visibility: Visibility;
  gpsVerified: boolean;
  expectedDurationHours?: number;
  equipmentUsed: EquipmentId[];
  customEquipment?: Record<string, string>;
  teamId?: string;       // when set, hunt is on behalf of this team
  teamName?: string;     // snapshot for UI display in LiveHunt etc.
  teamSlug?: string;     // snapshot — links to public team page
  // Step 24: when set, this hunt was launched from an investigation
  // umbrella. On seal the resulting case auto-links to it.
  investigationId?: string;
  logs: LogEntry[];
};

export type CheckIn = {
  id: string;
  huntId: string;
  venueId?: string;
  venueName: string;
  lat?: number;
  lng?: number;
  startedAt: string;
  expiresAt: string;
  visibility: Visibility;
  ownerHandle: string;
  active: boolean;
};

export type User = {
  name: string;
  handle: string;
  tier: string;
};

// ============================================================
// Constants
// ============================================================
export const GPS_TOLERANCE_METERS = 150;
export const DEFAULT_EXPECTED_HOURS = 6;
export const MAX_EXPECTED_HOURS = 24;
export const CATALOG_OWNER_HANDLE = '@hauntlog';

// ============================================================
// State
// ============================================================
type HauntState = {
  user: User;
  cases: CaseFile[];
  venues: Venue[];
  checkIns: CheckIn[];
  activeHunt: ActiveHunt | null;

  startHunt: (init: {
    venueId?: string;
    location: string;
    zone?: string;
    lat?: number;
    lng?: number;
    visibility: Visibility;
    gpsVerified: boolean;
    expectedDurationHours?: number;
    equipmentUsed?: EquipmentId[];
    customEquipment?: Record<string, string>;
    teamId?: string;
    teamName?: string;
    teamSlug?: string;
    investigationId?: string;
  }) => { hunt: ActiveHunt; venue?: Venue; checkIn?: CheckIn };

  addLog: (entry: Omit<LogEntry, 'id'>) => void;
  updateLog: (id: string, patch: Partial<LogEntry>) => void;
  deleteLog: (id: string) => void;

  sealCase: (meta: {
    title: string;
    summary?: string;
    tags?: string[];
    teamId?: string;
  }) => Promise<{ ok: true; sealed: CaseFile } | { ok: false; error: string }>;
  cancelHunt: () => void;

  // Post-seal: case owner can change visibility at any time.
  updateCaseVisibility: (caseId: string, visibility: Visibility) => Promise<void>;

  // Post-seal: case owner can toggle the starred flag on individual log
  // entries. Useful for marking highlights after reviewing the session.
  toggleLogStar: (
    caseId: string,
    logId: string,
    starred: boolean
  ) => Promise<{ ok: true } | { ok: false; error: string }>;

  // Post-seal: case owner can edit the textual content of a log entry.
  // Pass undefined for fields you don't want to change. Pass null to
  // clear `note`.
  updateLogEntry: (
    caseId: string,
    logId: string,
    fields: {
      observation?: string;
      note?: string | null;
      timestamp?: string;
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;

  // Soft-delete a case. Owner only. Returns error string on failure.
  deleteCase: (caseId: string) => Promise<{ ok: true } | { ok: false; error: string }>;

  // Refresh the in-memory `cases` cache from Supabase. Called on app load
  // and after any case mutation.
  loadMyCases: (userId: string) => Promise<void>;

  // Refresh the active check-ins list from Supabase. Atlas calls this
  // periodically.
  loadActiveCheckIns: () => Promise<void>;

  // One-shot migration: push any local-only cases (those that don't exist
  // server-side yet) up to Supabase. Idempotent — safe to call repeatedly.
  syncLocalCasesToServer: (userId: string) => Promise<{
    migrated: number;
    skipped: number;
    failed: number;
  }>;

  upsertVenue: (input: {
    name: string;
    lat: number;
    lng: number;
    notes?: string;
  }) => Venue;

  editVenue: (
    venueId: string,
    changes: Partial<
      Pick<
        Venue,
        | 'name'
        | 'lat'
        | 'lng'
        | 'notes'
        | 'description'
        | 'website'
        | 'hours'
        | 'address'
        | 'contact'
        | 'rules'
        | 'bookingUrl'
        | 'tags'
      >
    >
  ) => Venue | null;

  endCheckIn: (huntId: string) => void;

  // Seed-venue management (called once at app load).
  importCatalogVenues: (incoming: CatalogVenueInput[]) => {
    added: number;
    updated: number;
    skipped: number;
  };
};

// What a catalog import expects (one row from the CSV, post-parse).
export type CatalogVenueInput = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  description?: string;
  address?: VenueAddress;
  website?: string;
  hours?: string;
  contact?: VenueContact;
  rules?: string[];
  bookingUrl?: string;
  tags?: string[];
  /**
   * Optional verified flag from the CSV seed. When true, the venue is
   * routed to the rich `/v/:id` profile page; when false/absent, it
   * stays on the legacy editor page. Keep in sync with Supabase's
   * `locations.verified` for catalog rows that have rich profiles.
   */
  verified?: boolean;
};

// ============================================================
// Helpers
// ============================================================
function shortId(): string {
  const chunk = () =>
    Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return `${chunk()}-${chunk()}`;
}

function userVenueId(): string {
  return 'v_' + Math.random().toString(36).slice(2, 10);
}

export function distanceMeters(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ============================================================
// Store
// ============================================================
export const useHauntStore = create<HauntState>()(
  persist(
    (set, get) => ({
      user: { name: 'Riley Hunts', handle: '@riley.hunts', tier: 'Pro' },
      venues: [],
      cases: [],
      checkIns: [],
      activeHunt: null,

      // -------------- Hunts --------------
      startHunt: (init) => {
        const hours = Math.min(
          MAX_EXPECTED_HOURS,
          Math.max(1, init.expectedDurationHours ?? DEFAULT_EXPECTED_HOURS)
        );
        const startedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

        const hunt: ActiveHunt = {
          id: 'live-' + Date.now(),
          startedAt,
          venueId: init.venueId,
          location: init.location,
          zone: init.zone,
          lat: init.lat,
          lng: init.lng,
          visibility: init.visibility,
          gpsVerified: init.gpsVerified,
          expectedDurationHours: hours,
          equipmentUsed: init.equipmentUsed ?? [],
          customEquipment: init.customEquipment,
          teamId: init.teamId,
          teamName: init.teamName,
          teamSlug: init.teamSlug,
          investigationId: init.investigationId,
          logs: [],
        };

        let createdVenue: Venue | undefined;
        if (
          init.gpsVerified &&
          !init.venueId &&
          init.lat !== undefined &&
          init.lng !== undefined
        ) {
          createdVenue = {
            id: userVenueId(),
            source: 'user',
            name: init.location,
            lat: init.lat,
            lng: init.lng,
            createdAt: startedAt,
            createdByHandle: get().user.handle,
            revisions: [],
          };
          hunt.venueId = createdVenue.id;
        }

        let checkIn: CheckIn | undefined;
        if (init.visibility !== 'private') {
          checkIn = {
            id: 'ci_' + Date.now(),
            huntId: hunt.id,
            venueId: hunt.venueId,
            venueName: hunt.location,
            lat: hunt.lat,
            lng: hunt.lng,
            startedAt,
            expiresAt,
            visibility: init.visibility,
            ownerHandle: get().user.handle,
            active: true,
          };

          // Fire-and-forget: push the check-in to Supabase so other users
          // see it on the Atlas. Replace local id with server id when the
          // insert returns. If it fails, the local check-in still shows in
          // your own LiveHunt view; you just won't appear on others' Atlas.
          //
          // Same caveat as sealCase: user-created venues don't exist in the
          // server `locations` table, so we omit the venue_id reference. The
          // check-in still has the name + GPS to plot on the map.
          const localCheckIn = checkIn;
          const isCatalogVenue =
            hunt.venueId &&
            get().venues.find((v) => v.id === hunt.venueId)?.source === 'catalog';
          const serverVenueIdForCheckIn = isCatalogVenue ? hunt.venueId : undefined;
          (async () => {
            try {
              const profile = await getProfileIdFromSession();
              if (!profile) return;
              const res = await dataLayer.createCheckIn({
                huntId: hunt.id,
                venueId: serverVenueIdForCheckIn,
                venueName: hunt.location,
                lat: hunt.lat,
                lng: hunt.lng,
                visibility: init.visibility,
                ownerId: profile,
                expectedDurationHours: hours,
              });
              if (res.ok) {
                set((s) => ({
                  checkIns: s.checkIns.map((ci) =>
                    ci.id === localCheckIn.id ? { ...ci, id: res.id } : ci
                  ),
                }));
              }
            } catch {
              /* silent; local state still has the check-in */
            }
          })();
        }

        set((state) => ({
          activeHunt: hunt,
          venues: createdVenue ? [...state.venues, createdVenue] : state.venues,
          checkIns: checkIn ? [checkIn, ...state.checkIns] : state.checkIns,
        }));

        return { hunt, venue: createdVenue, checkIn };
      },

      addLog: (entry) => {
        const log: LogEntry = { ...entry, id: crypto.randomUUID() };
        set((state) => {
          if (!state.activeHunt) return state;
          return {
            activeHunt: { ...state.activeHunt, logs: [...state.activeHunt.logs, log] },
          };
        });
      },

      updateLog: (id, patch) => {
        set((state) => {
          if (!state.activeHunt) return state;
          return {
            activeHunt: {
              ...state.activeHunt,
              logs: state.activeHunt.logs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
            },
          };
        });
      },

      deleteLog: (id) => {
        set((state) => {
          if (!state.activeHunt) return state;
          return {
            activeHunt: {
              ...state.activeHunt,
              logs: state.activeHunt.logs.filter((l) => l.id !== id),
            },
          };
        });
      },

      sealCase: async (meta) => {
        const state = get();
        if (!state.activeHunt) return { ok: false, error: 'No active hunt to seal.' };
        const h = state.activeHunt;
        const id = shortId();
        const endedAt = new Date().toISOString();

        // Only reference the venue in the DB if it's a catalog venue.
        // User-created venues live in localStorage and don't have a
        // matching `locations` row. The case still records the venue
        // name + GPS as denormalized fields, so the data isn't lost.
        const venue = state.venues.find((v) => v.id === h.venueId);
        const serverVenueId =
          venue && venue.source === 'catalog' ? venue.id : undefined;

        // Server-side insert as one transaction.
        const result = await dataLayer.sealCase({
          id,
          title: meta.title.trim(),
          summary: meta.summary?.trim(),
          venueId: serverVenueId,
          locationName: h.location,
          zone: h.zone,
          lat: h.lat,
          lng: h.lng,
          startedAt: h.startedAt,
          endedAt,
          visibility: h.visibility,
          gpsVerified: h.gpsVerified,
          equipmentUsed: h.equipmentUsed,
          customEquipment: h.customEquipment,
          tags: meta.tags && meta.tags.length > 0 ? meta.tags : undefined,
          teamId: meta.teamId ?? h.teamId,
          logs: h.logs,
        });

        if (!result.ok) {
          return { ok: false, error: result.error };
        }

        // Step 24: if the hunt was launched from an investigation
        // umbrella, link the new case to it. Non-fatal on failure —
        // the case still exists; the owner can retroactively link
        // from the CaseView page if needed.
        if (h.investigationId) {
          try {
            const linkRes = await dataLayer.setCaseInvestigation(id, h.investigationId);
            if (!linkRes.ok) {
              console.warn('[sealCase investigation link]', linkRes.error);
            }
          } catch (e) {
            console.warn('[sealCase investigation link error]', e);
          }
        }

        // Step 18: upload any pending photos. Done as a background
        // task — the case is already sealed and visible without them.
        // Per-photo failures are non-fatal.
        const userId = await dataLayer.getCurrentUserId();
        if (userId) {
          for (const log of h.logs) {
            if (!log.pendingPhotoFiles || log.pendingPhotoFiles.length === 0) continue;
            for (const file of log.pendingPhotoFiles) {
              // Validate + resize in the browser, then upload.
              const v = imageProcess.validatePhotoFile(file);
              if (!v.ok) {
                console.warn('[sealCase photo skip] validation:', v);
                continue;
              }
              try {
                const resized = await imageProcess.resizeForUpload(file);
                const up = await dataLayer.uploadLogPhoto({
                  userId,
                  caseId: id,
                  logEntryId: log.id,
                  blob: resized.blob,
                  mimeType: resized.mimeType,
                  width: resized.width,
                  height: resized.height,
                });
                if (!up.ok) {
                  console.warn('[sealCase photo upload failed]', up.error);
                }
              } catch (e) {
                console.warn('[sealCase photo process error]', e);
              }
            }
          }
        }

        // Build local cached version for instant UI feedback. The next
        // loadMyCases() will replace this with the canonical server copy.
        const sealed: CaseFile = {
          id,
          ownerHandle: state.user.handle,
          title: meta.title.trim(),
          summary: meta.summary?.trim() || undefined,
          venueId: h.venueId,
          location: h.location,
          zone: h.zone,
          lat: h.lat,
          lng: h.lng,
          startedAt: h.startedAt,
          endedAt,
          visibility: h.visibility,
          gpsVerified: h.gpsVerified,
          equipmentUsed: h.equipmentUsed,
          customEquipment: h.customEquipment,
          tags: meta.tags && meta.tags.length > 0 ? meta.tags : undefined,
          logs: h.logs,
          sealed: true,
        };

        // Also deactivate the check-in for this hunt on the server.
        // Find the check-in id by huntId from local state.
        const localCheckIn = state.checkIns.find((ci) => ci.huntId === h.id);
        if (localCheckIn) {
          dataLayer.deactivateCheckIn(localCheckIn.id).catch(() => {
            /* best-effort: stale check-ins auto-expire anyway */
          });
        }

        set((s) => ({
          cases: [sealed, ...s.cases.filter((c) => c.id !== id)],
          activeHunt: null,
          checkIns: s.checkIns.map((ci) =>
            ci.huntId === h.id ? { ...ci, active: false } : ci
          ),
        }));

        return { ok: true, sealed };
      },

      cancelHunt: () => {
        const state = get();
        const h = state.activeHunt;
        // Best-effort: deactivate the server check-in too.
        if (h) {
          const localCheckIn = state.checkIns.find((ci) => ci.huntId === h.id);
          if (localCheckIn) {
            dataLayer.deactivateCheckIn(localCheckIn.id).catch(() => {
              /* ignore */
            });
          }
        }
        set((s) => ({
          activeHunt: null,
          checkIns: h
            ? s.checkIns.map((ci) => (ci.huntId === h.id ? { ...ci, active: false } : ci))
            : s.checkIns,
        }));
      },

      updateCaseVisibility: async (caseId, visibility) => {
        // Optimistic local update; rollback if server rejects.
        const before = get().cases;
        set((s) => ({
          cases: s.cases.map((c) => (c.id === caseId ? { ...c, visibility } : c)),
        }));
        const result = await dataLayer.updateCaseVisibility(caseId, visibility);
        if (!result.ok) {
          set({ cases: before });
          throw new Error(result.error);
        }
      },

      toggleLogStar: async (caseId, logId, starred) => {
        // Optimistic local update — flip the matching log entry's
        // starred field on the cached case. Rollback if server rejects.
        const before = get().cases;
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id !== caseId
              ? c
              : {
                  ...c,
                  logs: c.logs.map((l) =>
                    l.id === logId ? { ...l, starred } : l
                  ),
                }
          ),
        }));
        const result = await dataLayer.setLogStarred(logId, starred);
        if (!result.ok) {
          set({ cases: before });
          return result;
        }
        return { ok: true };
      },

      updateLogEntry: async (caseId, logId, fields) => {
        // Optimistic local update — apply the patch to the matching log
        // entry on the cached case. Rollback if server rejects.
        const before = get().cases;
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id !== caseId
              ? c
              : {
                  ...c,
                  logs: c.logs.map((l) => {
                    if (l.id !== logId) return l;
                    const next = { ...l };
                    if (fields.observation !== undefined)
                      next.observation = fields.observation;
                    if (fields.note !== undefined)
                      next.note = fields.note ?? undefined;
                    if (fields.timestamp !== undefined)
                      next.timestamp = fields.timestamp;
                    return next;
                  }),
                }
          ),
        }));
        const result = await dataLayer.updateLogEntry(logId, fields);
        if (!result.ok) {
          set({ cases: before });
          return result;
        }
        return { ok: true };
      },

      deleteCase: async (caseId) => {
        const result = await dataLayer.deleteCase(caseId);
        if (!result.ok) return result;
        // Remove from local cache.
        set((s) => ({ cases: s.cases.filter((c) => c.id !== caseId) }));
        return { ok: true };
      },

      loadMyCases: async (userId) => {
        try {
          const cases = await dataLayer.fetchMyVaultCases(userId);
          set({ cases });
        } catch (e) {
          // Network error or RLS issue — keep the existing local cache.
          console.warn('[loadMyCases] failed:', e);
        }
      },

      loadActiveCheckIns: async () => {
        try {
          const remote = await dataLayer.fetchActiveCheckIns();
          // Merge logic: keep the user's own un-synced local check-ins
          // (those with id starting "ci_"), plus the remote rows. Remote
          // wins on id collision.
          set((s) => {
            const remoteIds = new Set(remote.map((r) => r.id));
            const localUnsynced = s.checkIns.filter(
              (ci) => ci.id.startsWith('ci_') && !remoteIds.has(ci.id)
            );
            return { checkIns: [...remote, ...localUnsynced] };
          });
        } catch (e) {
          console.warn('[loadActiveCheckIns] failed:', e);
        }
      },

      syncLocalCasesToServer: async (userId) => {
        const local = get().cases;
        if (local.length === 0) return { migrated: 0, skipped: 0, failed: 0 };

        // Fetch existing server ids so we don't double-insert.
        const serverCases = await dataLayer.fetchMyCases(userId).catch(() => []);
        const serverIds = new Set(serverCases.map((c) => c.id));

        let migrated = 0;
        let skipped = 0;
        let failed = 0;

        for (const c of local) {
          if (serverIds.has(c.id)) {
            skipped++;
            continue;
          }
          // Same caveat as live seal: only reference catalog venues.
          const venue = get().venues.find((v) => v.id === c.venueId);
          const serverVenueId =
            venue && venue.source === 'catalog' ? venue.id : undefined;
          // Push it up.
          const res = await dataLayer.sealCase({
            id: c.id,
            title: c.title,
            summary: c.summary,
            venueId: serverVenueId,
            locationName: c.location,
            zone: c.zone,
            lat: c.lat,
            lng: c.lng,
            startedAt: c.startedAt,
            endedAt: c.endedAt ?? new Date().toISOString(),
            visibility: c.visibility,
            gpsVerified: c.gpsVerified,
            equipmentUsed: c.equipmentUsed,
            customEquipment: c.customEquipment,
            tags: c.tags,
            logs: c.logs,
          });
          if (res.ok) {
            migrated++;
          } else {
            console.warn('[sync] failed to migrate case', c.id, res.error);
            failed++;
          }
        }

        // After sync, refresh from server.
        if (migrated > 0) {
          await get().loadMyCases(userId);
        }
        return { migrated, skipped, failed };
      },

      // -------------- Venues --------------
      upsertVenue: (input) => {
        const newV: Venue = {
          id: userVenueId(),
          source: 'user',
          name: input.name,
          lat: input.lat,
          lng: input.lng,
          notes: input.notes,
          createdAt: new Date().toISOString(),
          createdByHandle: get().user.handle,
          revisions: [],
        };
        set((s) => ({ venues: [...s.venues, newV] }));
        return newV;
      },

      editVenue: (id, changes) => {
        const state = get();
        const target = state.venues.find((v) => v.id === id);
        if (!target) return null;

        // Build a revision capturing OLD values for any field that's actually changing.
        const revChanges: VenueRevision['changes'] = {};
        for (const key of Object.keys(changes) as Array<keyof typeof changes>) {
          const incoming = changes[key];
          if (incoming === undefined) continue;
          const current = (target as any)[key];
          if (JSON.stringify(incoming) !== JSON.stringify(current)) {
            (revChanges as any)[key] = current;
          }
        }

        const hasChange = Object.keys(revChanges).length > 0;
        const revision: VenueRevision = {
          at: new Date().toISOString(),
          byHandle: state.user.handle,
          changes: revChanges,
        };

        const updated: Venue = {
          ...target,
          ...changes,
          revisions: hasChange ? [revision, ...target.revisions] : target.revisions,
        };

        set((s) => ({ venues: s.venues.map((v) => (v.id === id ? updated : v)) }));
        return updated;
      },

      endCheckIn: (huntId) => {
        set((s) => ({
          checkIns: s.checkIns.map((ci) => (ci.huntId === huntId ? { ...ci, active: false } : ci)),
        }));
      },

      // -------------- Catalog import --------------
      // Merges seed venues into the store. Uses the stable string `id` (slug)
      // so this is idempotent: catalog updates won't create duplicates.
      // - If a catalog venue with that id doesn't exist, add it.
      // - If it exists AND hasn't been edited by anyone (no revisions), refresh fields.
      // - If it exists AND has revisions (someone edited it), skip to preserve human edits.
      importCatalogVenues: (incoming) => {
        let added = 0;
        let updated = 0;
        let skipped = 0;

        set((state) => {
          const byId = new Map(state.venues.map((v) => [v.id, v]));
          const now = new Date().toISOString();

          for (const row of incoming) {
            if (!row.id || !row.name || row.lat == null || row.lng == null) {
              skipped++;
              continue;
            }

            const existing = byId.get(row.id);
            if (!existing) {
              const v: Venue = {
                id: row.id,
                source: 'catalog',
                name: row.name,
                lat: row.lat,
                lng: row.lng,
                description: row.description,
                address: row.address,
                website: row.website,
                hours: row.hours,
                contact: row.contact,
                rules: row.rules,
                bookingUrl: row.bookingUrl,
                tags: row.tags,
                verified: row.verified ?? false,
                createdAt: now,
                createdByHandle: CATALOG_OWNER_HANDLE,
                revisions: [],
              };
              byId.set(row.id, v);
              added++;
            } else if (existing.source === 'catalog' && existing.revisions.length === 0) {
              const refreshed: Venue = {
                ...existing,
                name: row.name,
                lat: row.lat,
                lng: row.lng,
                description: row.description,
                address: row.address,
                website: row.website,
                hours: row.hours,
                contact: row.contact,
                rules: row.rules,
                bookingUrl: row.bookingUrl,
                tags: row.tags,
                verified: row.verified ?? existing.verified ?? false,
              };
              byId.set(row.id, refreshed);
              updated++;
            } else {
              skipped++;
            }
          }

          return { venues: Array.from(byId.values()) };
        });

        return { added, updated, skipped };
      },
    }),
    { name: 'hauntlog-storage' }
  )
);

// ============================================================
// Display helpers
// ============================================================
export function equipmentLabel(
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID,
  customMap?: Record<string, string>
): string {
  if (equipmentId === PERSONAL_EXPERIENCE_ID) return PERSONAL_EXPERIENCE_LABEL;
  const known = EQUIPMENT_CATALOG.find((e) => e.id === equipmentId);
  if (known) return known.name;
  if (customMap?.[equipmentId]) return customMap[equipmentId];
  return equipmentId;
}

export function equipmentAbbr(
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID,
  customMap?: Record<string, string>
): string {
  if (equipmentId === PERSONAL_EXPERIENCE_ID) return PERSONAL_EXPERIENCE_ABBR;
  const known = EQUIPMENT_CATALOG.find((e) => e.id === equipmentId);
  if (known) return known.abbr;
  const label = customMap?.[equipmentId] || equipmentId;
  return label.slice(0, 4).toUpperCase();
}

export function withinTolerance(here: Coords, there: Coords): boolean {
  return distanceMeters(here, there) <= GPS_TOLERANCE_METERS;
}

// Render a postal-style address line.
export function formatAddress(a?: VenueAddress): string {
  if (!a) return '';
  const parts: string[] = [];
  if (a.street) parts.push(a.street);
  const cityLine = [a.city, a.state].filter(Boolean).join(', ');
  if (cityLine) parts.push(a.zip ? `${cityLine} ${a.zip}` : cityLine);
  else if (a.zip) parts.push(a.zip);
  if (a.country) parts.push(a.country);
  return parts.join(' · ');
}
