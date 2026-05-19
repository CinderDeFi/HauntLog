import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchVenueProfile,
  fetchZones,
  fetchMyVenueRole,
  createZone,
  updateZone,
  deleteZone,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import type { LocationRow, LocationZoneRow } from '../lib/database.types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Box,
  DoorOpen,
  Smile,
  Octagon,
  PanelsTopLeft,
  Sofa,
  ArrowDownFromLine,
  MonitorDot,
  Home,
  Camera,
} from 'lucide-react';

const ZONE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  box: Box,
  'door-open': DoorOpen,
  smile: Smile,
  octagon: Octagon,
  'panels-top-left': PanelsTopLeft,
  sofa: Sofa,
  'arrow-down-from-line': ArrowDownFromLine,
  'monitor-dot': MonitorDot,
  home: Home,
  camera: Camera,
};
const ZONE_ICON_KEYS = Object.keys(ZONE_ICONS);

function ZoneIcon({ name, className }: { name: string | null; className?: string }) {
  const Cmp = (name && ZONE_ICONS[name]) || Box;
  return <Cmp className={className} />;
}

const INPUT_CLS =
  'w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-haunt-red outline-none text-sm placeholder:text-white/30';

/**
 * Tracks one zone row's local edit state. We don't push to the server on
 * every keystroke — instead the user clicks SAVE on the row when done.
 * Unsaved rows are flagged so the save button doesn't lie.
 */
type Draft = {
  // Set when this draft was created in-browser and hasn't been saved.
  // After server save, `serverRow` is set and `id` is the real id.
  serverRow: LocationZoneRow | null;
  tempId: string;
  name: string;
  icon: string | null;
  tagsText: string;     // comma- or pipe-separated; stored as array
  sort_order: number;
  dirty: boolean;
  saving: boolean;
};

function rowToDraft(row: LocationZoneRow): Draft {
  return {
    serverRow: row,
    tempId: row.id,
    name: row.name,
    icon: row.icon,
    tagsText: row.tags.join(', '),
    sort_order: row.sort_order,
    dirty: false,
    saving: false,
  };
}

function emptyDraft(sortOrder: number): Draft {
  return {
    serverRow: null,
    tempId: `tmp_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    icon: 'box',
    tagsText: '',
    sort_order: sortOrder,
    dirty: true,
    saving: false,
  };
}

function parseTags(text: string): string[] {
  return text
    .split(/[,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function VenueZoneEditor() {
  const { locationId } = useParams<{ locationId: string }>();
  const { user: authUser } = useAuth();

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'not_permitted' | 'not_found' | 'error'
  >('loading');
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<LocationRow | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId || !authUser) return;
    setStatus('loading');
    setError(null);
    (async () => {
      try {
        const profile = await fetchVenueProfile(locationId);
        if (!profile) {
          setStatus('not_found');
          return;
        }
        const role = await fetchMyVenueRole(authUser.id, locationId);
        if (role !== 'owner' && role !== 'manager') {
          setStatus('not_permitted');
          return;
        }
        setVenue(profile.location);
        const zones = await fetchZones(locationId);
        setDrafts(zones.map(rowToDraft));
        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, [locationId, authUser]);

  const patchDraft = (tempId: string, patch: Partial<Draft>) => {
    setDrafts((arr) =>
      arr.map((d) => (d.tempId === tempId ? { ...d, ...patch, dirty: true } : d))
    );
  };

  const addRow = () => {
    const maxOrder = drafts.reduce((m, d) => Math.max(m, d.sort_order), 0);
    setDrafts((arr) => [...arr, emptyDraft(maxOrder + 1)]);
  };

  const moveRow = (tempId: string, dir: -1 | 1) => {
    setDrafts((arr) => {
      const idx = arr.findIndex((d) => d.tempId === tempId);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= arr.length) return arr;
      const copy = arr.slice();
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      // Re-flow sort_order numerically so they're consistent. Mark both as dirty.
      return copy.map((d, i) => ({
        ...d,
        sort_order: i + 1,
        dirty: d.dirty || d.sort_order !== i + 1,
      }));
    });
  };

  const saveRow = async (tempId: string) => {
    if (!venue) return;
    const d = drafts.find((x) => x.tempId === tempId);
    if (!d) return;
    if (!d.name.trim()) {
      setError('Zone name is required.');
      return;
    }
    setError(null);
    patchDraft(tempId, { saving: true });
    const tags = parseTags(d.tagsText);
    if (d.serverRow) {
      // Update existing row.
      const res = await updateZone(d.serverRow.id, {
        name: d.name.trim(),
        icon: d.icon ?? null,
        tags,
        sort_order: d.sort_order,
      });
      if (!res.ok) {
        setError(res.error);
        patchDraft(tempId, { saving: false });
        return;
      }
      setDrafts((arr) =>
        arr.map((x) =>
          x.tempId === tempId ? rowToDraft(res.row) : x
        )
      );
    } else {
      // Create new row.
      const res = await createZone({
        location_id: venue.id,
        name: d.name.trim(),
        icon: d.icon ?? null,
        tags,
        sort_order: d.sort_order,
      });
      if (!res.ok) {
        setError(res.error);
        patchDraft(tempId, { saving: false });
        return;
      }
      setDrafts((arr) =>
        arr.map((x) =>
          x.tempId === tempId ? rowToDraft(res.row) : x
        )
      );
    }
  };

  const confirmDelete = async (tempId: string) => {
    const d = drafts.find((x) => x.tempId === tempId);
    if (!d) return;
    setConfirmDeleteId(null);
    if (!d.serverRow) {
      // Just remove the local draft.
      setDrafts((arr) => arr.filter((x) => x.tempId !== tempId));
      return;
    }
    const res = await deleteZone(d.serverRow.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDrafts((arr) => arr.filter((x) => x.tempId !== tempId));
  };

  const saveAllDirty = async () => {
    for (const d of drafts) {
      if (d.dirty && d.name.trim()) {
        // eslint-disable-next-line no-await-in-loop
        await saveRow(d.tempId);
      }
    }
  };

  // ----- Render -----

  if (!authUser) {
    return <NoAccess message="Sign in to manage zones." linkTo="/auth/signin" linkLabel="Sign in →" />;
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (status === 'not_found') {
    return <NoAccess message="Venue not found." linkTo="/app/my-venues" linkLabel="← MY VENUES" />;
  }

  if (status === 'not_permitted') {
    return (
      <NoAccess
        message="You don't manage this venue."
        linkTo={locationId ? `/v/${locationId}` : '/app/my-venues'}
        linkLabel="← BACK TO VENUE"
      />
    );
  }

  if (status === 'error') {
    return (
      <NoAccess
        message={error ?? 'Unknown error'}
        linkTo={locationId ? `/app/venues/${locationId}/edit` : '/app/my-venues'}
        linkLabel="← BACK"
      />
    );
  }

  if (!venue) return null;

  const anyDirty = drafts.some((d) => d.dirty && d.name.trim());

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <Link
        to={`/app/venues/${encodeURIComponent(venue.id)}/edit`}
        className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO VENUE EDITOR
      </Link>

      <div className="text-xs font-mono text-amber-400 tracking-widest mb-2">
        ZONES · {venue.name}
      </div>
      <h1 className="text-3xl md:text-4xl font-medium tracking-tighter mb-1">
        Documented zones
      </h1>
      <p className="text-white/60 mb-6">
        Each zone is a room or area inside the venue. Add icons and short
        activity tags to help investigators understand what's been reported
        where.
      </p>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {drafts.length === 0 && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center text-sm text-white/40">
            No zones yet. Add the first one below.
          </div>
        )}
        {drafts.map((d, i) => (
          <div
            key={d.tempId}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-3 md:p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => moveRow(d.tempId, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 disabled:opacity-30"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveRow(d.tempId, 1)}
                  disabled={i === drafts.length - 1}
                  aria-label="Move down"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 disabled:opacity-30"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <ZoneIcon name={d.icon} className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <input
                  value={d.name}
                  onChange={(e) => patchDraft(d.tempId, { name: e.target.value })}
                  placeholder="Zone name (e.g. The Baker Room)"
                  className={INPUT_CLS}
                />
              </div>

              <button
                onClick={() => setConfirmDeleteId(d.tempId)}
                aria-label="Delete zone"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-white/60 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
              <select
                value={d.icon ?? ''}
                onChange={(e) => patchDraft(d.tempId, { icon: e.target.value || null })}
                className="bg-black border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:border-haunt-red outline-none"
              >
                {ZONE_ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                value={d.tagsText}
                onChange={(e) => patchDraft(d.tempId, { tagsText: e.target.value })}
                placeholder="Tags — comma separated (e.g. EVP REPORTS, COLD SPOTS)"
                className={INPUT_CLS}
              />
              <button
                onClick={() => saveRow(d.tempId)}
                disabled={d.saving || !d.dirty || !d.name.trim()}
                className="px-3 py-2 rounded-xl bg-haunt-red text-white text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 hover:bg-red-600 disabled:opacity-40"
              >
                {d.saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                {d.dirty ? 'SAVE' : 'SAVED'}
              </button>
            </div>

            {/* Confirm-delete inline panel */}
            {confirmDeleteId === d.tempId && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="text-sm text-red-200">
                  Delete this zone? Cannot be undone.
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-mono tracking-widest text-white/80"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => confirmDelete(d.tempId)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-mono tracking-widest text-white"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="w-full px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-white/70 text-xs font-mono tracking-widest inline-flex items-center justify-center gap-x-2"
      >
        <Plus className="w-3.5 h-3.5" /> ADD ZONE
      </button>

      {/* Sticky save-all bar (only when there are dirty rows).
          z-[1250] so it sits ABOVE the mobile bottom nav (z-[1200]). */}
      {anyDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-[1250] bg-black/95 backdrop-blur border-t border-white/10 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
          <div className="max-w-3xl mx-auto px-6 md:px-8 flex items-center justify-between gap-3">
            <div className="text-xs font-mono text-amber-300 tracking-widest">
              UNSAVED CHANGES
            </div>
            <button
              onClick={saveAllDirty}
              className="px-6 py-3 rounded-xl bg-haunt-red text-white font-mono tracking-widest text-sm inline-flex items-center gap-x-2 hover:bg-red-600"
            >
              <Save className="w-4 h-4" /> SAVE ALL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoAccess({
  message,
  linkTo,
  linkLabel,
}: {
  message: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-medium mb-3">{message}</h1>
      <Link
        to={linkTo}
        className="inline-block bg-white text-black px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs hover:bg-haunt-red hover:text-white transition-colors"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
