import { useEffect, useState } from 'react';
import { Archive, X, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useHauntStore, type ActiveHunt } from '../store/useHauntStore';
import {
  fetchHuntDraft,
  deleteHuntDraft,
  type HuntDraftRow,
} from '../lib/dataLayer';
import { useToast } from './ui/Toast';

/**
 * Renders a small banner across the top of the app when a draft from
 * a previous session exists AND there's no local activeHunt to
 * conflict with. Lets the user restore or discard it.
 *
 * Mount once near the app root. Self-contained — fetches on mount,
 * decides whether to show itself, and dismisses on action.
 */
export default function HuntDraftRecoveryBanner() {
  const { user } = useAuth();
  const activeHunt = useHauntStore((s) => s.activeHunt);
  const toast = useToast();

  const [draft, setDraft] = useState<HuntDraftRow | null>(null);
  const [checked, setChecked] = useState(false);
  const [acting, setActing] = useState(false);

  // Fetch the draft once per sign-in. Bail if there's already a local
  // activeHunt — the user is mid-hunt and shouldn't see this.
  useEffect(() => {
    if (!user || checked || activeHunt) return;
    let cancelled = false;
    (async () => {
      const d = await fetchHuntDraft(user.id);
      if (cancelled) return;
      setDraft(d);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, activeHunt, checked]);

  // If a local hunt appears while we were considering recovery, the
  // user moved on — drop the prompt silently. (They started a new hunt
  // or the persisted localStorage hunt restored after this hook ran.)
  useEffect(() => {
    if (activeHunt) setDraft(null);
  }, [activeHunt]);

  if (!draft || acting) {
    // Show a brief acting spinner if we're restoring/discarding.
    if (acting) {
      return (
        <div className="bg-haunt-red/10 border-b border-haunt-red/30 px-4 py-2 text-xs font-mono text-haunt-red tracking-widest flex items-center gap-x-2 justify-center">
          <Loader2 className="w-3 h-3 animate-spin" /> RESTORING…
        </div>
      );
    }
    return null;
  }

  const payload = draft.payload as Partial<ActiveHunt> | null;
  if (!payload || !payload.id) return null;

  // Sanity check: if the draft's userId doesn't match the current
  // user, ignore it. This shouldn't happen (RLS prevents reading
  // others' drafts) but defensive.
  if (payload.userId && user && payload.userId !== user.id) return null;

  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(draft.updated_at).getTime()) / 60000)
  );
  const ago =
    minutesAgo < 1
      ? 'just now'
      : minutesAgo < 60
      ? `${minutesAgo} min ago`
      : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`;

  const logCount = Array.isArray(payload.logs) ? payload.logs.length : 0;
  const location = payload.location || 'an unknown location';

  const handleRestore = async () => {
    if (!user) return;
    setActing(true);
    try {
      // Rebuild the ActiveHunt from the payload. Trust the structure
      // because we wrote it ourselves, but null-coalesce the fields
      // we know about. Strip pendingPhotoFiles (they aren't recoverable).
      const restored: ActiveHunt = {
        id: payload.id as string,
        userId: payload.userId,
        startedAt: payload.startedAt as string,
        venueId: payload.venueId,
        location: payload.location as string,
        zone: payload.zone,
        lat: payload.lat,
        lng: payload.lng,
        visibility: (payload.visibility as ActiveHunt['visibility']) ?? 'public',
        gpsVerified: payload.gpsVerified ?? false,
        expectedDurationHours: payload.expectedDurationHours ?? 4,
        equipmentUsed: payload.equipmentUsed ?? [],
        customEquipment: payload.customEquipment,
        teamId: payload.teamId,
        teamName: payload.teamName,
        teamSlug: payload.teamSlug,
        investigationId: payload.investigationId,
        groupId: payload.groupId,
        logs: Array.isArray(payload.logs)
          ? payload.logs.map((l: any) => ({
              ...l,
              pendingPhotoFiles: undefined,
            }))
          : [],
      };
      useHauntStore.setState({ activeHunt: restored });
      setDraft(null);
      toast.success('Hunt restored', {
        description: `${logCount} log ${logCount === 1 ? 'entry' : 'entries'} recovered.`,
      });
    } catch (e) {
      toast.error('Could not restore', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setActing(false);
    }
  };

  const handleDiscard = async () => {
    if (!user) return;
    setActing(true);
    try {
      await deleteHuntDraft(user.id);
      setDraft(null);
    } catch (e) {
      console.warn('[draft-discard]', e);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-haunt-red/10 border-b border-haunt-red/30 px-4 py-2.5">
      <div className="max-w-3xl mx-auto flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-x-2 min-w-0 flex-1">
          <Archive className="w-4 h-4 text-haunt-red shrink-0" />
          <div className="text-xs md:text-sm text-white/90 min-w-0">
            <span className="font-medium">Unsealed hunt found:</span>{' '}
            <span className="text-white/70 truncate">
              {logCount} {logCount === 1 ? 'entry' : 'entries'} at{' '}
              <strong className="text-white">{location}</strong> · {ago}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={handleRestore}
            className="bg-haunt-red hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest"
          >
            RESTORE
          </button>
          <button
            onClick={handleDiscard}
            className="text-white/60 hover:text-white px-2 py-1.5 rounded-lg text-xs font-mono tracking-widest inline-flex items-center gap-x-1"
            title="Discard the saved draft"
          >
            <X className="w-3 h-3" /> DISCARD
          </button>
        </div>
      </div>
    </div>
  );
}
