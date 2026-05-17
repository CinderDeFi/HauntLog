import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export type CaseFile = {
  id: string;
  ownerHandle: string;
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
  logs: LogEntry[];
  sealed: boolean;
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
  }) => { hunt: ActiveHunt; venue?: Venue; checkIn?: CheckIn };

  addLog: (entry: Omit<LogEntry, 'id'>) => void;
  updateLog: (id: string, patch: Partial<LogEntry>) => void;
  deleteLog: (id: string) => void;

  sealCase: (meta: { title: string; summary?: string }) => CaseFile | null;
  cancelHunt: () => void;

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

      sealCase: (meta) => {
        const state = get();
        if (!state.activeHunt) return null;
        const h = state.activeHunt;
        const sealed: CaseFile = {
          id: shortId(),
          ownerHandle: state.user.handle,
          title: meta.title.trim(),
          summary: meta.summary?.trim() || undefined,
          venueId: h.venueId,
          location: h.location,
          zone: h.zone,
          lat: h.lat,
          lng: h.lng,
          startedAt: h.startedAt,
          endedAt: new Date().toISOString(),
          visibility: h.visibility,
          gpsVerified: h.gpsVerified,
          equipmentUsed: h.equipmentUsed,
          customEquipment: h.customEquipment,
          logs: h.logs,
          sealed: true,
        };

        set((s) => ({
          cases: [sealed, ...s.cases],
          activeHunt: null,
          checkIns: s.checkIns.map((ci) =>
            ci.huntId === h.id ? { ...ci, active: false } : ci
          ),
        }));

        return sealed;
      },

      cancelHunt: () => {
        const state = get();
        const h = state.activeHunt;
        set((s) => ({
          activeHunt: null,
          checkIns: h
            ? s.checkIns.map((ci) => (ci.huntId === h.id ? { ...ci, active: false } : ci))
            : s.checkIns,
        }));
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
