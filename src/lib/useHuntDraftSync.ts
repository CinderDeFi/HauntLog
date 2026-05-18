import { useEffect, useRef } from 'react';
import { useHauntStore, type ActiveHunt } from '../store/useHauntStore';
import { useAuth } from './useAuth';
import { saveHuntDraft, deleteHuntDraft } from './dataLayer';

/**
 * Mount once at the app root. Watches the activeHunt and pushes a
 * server-side snapshot whenever it changes (debounced 1s). When the
 * hunt clears (seal/cancel), deletes the server draft.
 *
 * This is a safety net only — it does NOT prevent local state loss,
 * just makes it recoverable. The full activeHunt JSON is saved minus
 * the `pendingPhotoFiles` field (File objects aren't serializable and
 * are already dropped by Zustand persist).
 *
 * Photos/audio attached during a live hunt are NOT recoverable from
 * the draft — that's a known limitation of the current photo flow
 * (uploads happen at seal time, not at attach time).
 */
export function useHuntDraftSync() {
  const { user } = useAuth();
  const activeHunt = useHauntStore((s) => s.activeHunt);
  const timer = useRef<number | null>(null);
  const lastSerialized = useRef<string | null>(null);
  const lastHuntId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    // Hunt cleared (seal or cancel). Drop the server draft.
    if (!activeHunt) {
      if (lastHuntId.current) {
        const prev = lastHuntId.current;
        lastHuntId.current = null;
        lastSerialized.current = null;
        deleteHuntDraft(userId).catch((e) =>
          console.warn('[draft-sync] delete failed', prev, e)
        );
      }
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      return;
    }

    // Guard against re-saving identical state. The store's logs array
    // is rebuilt on every action, so reference equality isn't useful —
    // we compare a serialized snapshot instead.
    const snapshot = serializeForDraft(activeHunt);
    const next = JSON.stringify(snapshot);
    if (next === lastSerialized.current) return;
    lastSerialized.current = next;
    lastHuntId.current = activeHunt.id;

    // Debounce: 1s after last change.
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveHuntDraft({
        ownerId: userId,
        huntId: activeHunt.id,
        startedAt: activeHunt.startedAt,
        payload: snapshot,
      }).then((res) => {
        if (!res.ok) {
          console.warn('[draft-sync] save failed', res.error);
        }
      });
    }, 1000);

    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [user, activeHunt]);
}

/** Build the JSON-safe payload. Strip File objects and other
 * non-serializable bits the recovery flow can't restore anyway. */
function serializeForDraft(h: ActiveHunt): Record<string, unknown> {
  const safeLogs = h.logs.map((l) => {
    // Drop the File array — these are non-serializable AND would be
    // huge in JSON (megabytes per photo). The draft is text-only.
    const { pendingPhotoFiles, ...rest } = l;
    return rest;
  });
  return {
    ...h,
    logs: safeLogs,
  };
}
