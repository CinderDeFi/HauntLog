import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  useHauntStore,
  equipmentLabel,
  equipmentAbbr,
  type Visibility,
} from '../store/useHauntStore';
import { EquipmentDataDisplay } from '../components/EquipmentDataInput';
import Comments from '../components/Comments';
import PhotoLightbox from '../components/PhotoLightbox';
import AddPhotosModal from '../components/AddPhotosModal';
import AddAudioModal from '../components/AddAudioModal';
import { useToast } from '../components/ui/Toast';
import {
  fetchCaseById,
  fetchPhotosForCase,
  getSignedPhotoUrls,
  deleteLogPhoto,
  updatePhotoCaption,
  fetchAudioForCase,
  getSignedAudioUrls,
  deleteLogAudio,
  fetchInvestigation,
  listInvestigationGroups,
  type LogEntryPhotoRow,
  type LogEntryAudioRow,
  type InvestigationRow,
} from '../lib/dataLayer';
import { MAX_PHOTOS_PER_LOG, MAX_AUDIO_PER_LOG } from '../lib/imageProcess';
import { SAMPLE_CASE, isSampleCaseId } from '../lib/sampleCase';
import { equipmentChipColors } from '../lib/equipmentColors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import {
  ArrowLeft,
  Globe,
  Lock,
  EyeOff,
  MapPin,
  Star,
  Link as LinkIcon,
  ShieldCheck,
  ChevronDown,
  Check,
  Loader2,
  Download,
  MoreVertical,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Sparkles,
  Mic2,
  Share2,
  Pencil,
  Radio,
  UsersRound,
} from 'lucide-react';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startIso: string, endIso?: string) {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function visibilityBadge(v: Visibility): {
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  if (v === 'public')
    return { icon: <Globe className="w-3 h-3" />, label: 'PUBLIC', color: 'text-green-400' };
  if (v === 'anonymous')
    return { icon: <EyeOff className="w-3 h-3" />, label: 'ANONYMOUS', color: 'text-amber-400' };
  return { icon: <Lock className="w-3 h-3" />, label: 'PRIVATE', color: 'text-white/60' };
}

function visibilityDescription(v: Visibility): string {
  if (v === 'public') return 'Everyone can see this case with your handle.';
  if (v === 'anonymous') return 'Everyone can see this case but not your handle.';
  return 'Only you can see this case.';
}

export default function CaseView() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?fresh=1 is set by SealCase right after a successful seal. It tells
  // us to retry the photo + audio fetch once after a short delay,
  // since the upload happens just before the seal returns and the
  // server has a small replication lag before the metadata rows are
  // queryable. Without this retry, the user sees an empty photo grid
  // even though the upload succeeded.
  const freshFromSeal = searchParams.get('fresh') === '1';
  const navigate = useNavigate();
  const cases = useHauntStore((s) => s.cases);
  const currentUser = useHauntStore((s) => s.user);
  const updateCaseVisibility = useHauntStore((s) => s.updateCaseVisibility);
  const toggleLogStarAction = useHauntStore((s) => s.toggleLogStar);
  const updateLogEntryAction = useHauntStore((s) => s.updateLogEntry);

  // Sample case is a synthetic CaseFile that lives in JS only. When the
  // URL is /case/sample we serve it from a constant; the rest of the
  // page renders normally (read-only since the user isn't its owner).
  const isSample = isSampleCaseId(id);

  // Local cache first; fall back to Supabase fetch if missing.
  // For the sample case we substitute the hardcoded CaseFile.
  const localCase = isSample ? SAMPLE_CASE : cases.find((c) => c.id === id);
  const [remoteCase, setRemoteCase] = useState<typeof localCase | null>(null);
  const [remoteOwnerId, setRemoteOwnerId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(!localCase);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (localCase || !id) {
      setFetching(false);
      return;
    }
    let cancelled = false;
    setFetching(true);
    setFetchError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('owner_id')
          .eq('id', id)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data) setRemoteOwnerId(data.owner_id);
        const c = await fetchCaseById(id);
        if (cancelled) return;
        setRemoteCase(c ?? null);
      } catch (e) {
        if (cancelled) return;
        // Log the real error to the console so we can debug, and store a
        // user-facing message so the page isn't a silent 404.
        console.error('[CaseView] fetch failed:', e);
        setFetchError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, localCase]);

  const { user: authUser } = useAuth();
  const toast = useToast();

  // For locally-cached cases (i.e. yours), the owner_id is the current
  // signed-in user. For remotely-fetched ones, we grabbed it above.
  const caseFile = localCase ?? remoteCase;
  const caseOwnerProfileId = localCase
    ? authUser?.id ?? null
    : remoteOwnerId;

  const [visMenuOpen, setVisMenuOpen] = useState(false);
  const visMenuRef = useRef<HTMLDivElement | null>(null);

  // Step 18: photos. Map of log_entry_id -> photo rows + resolved
  // signed URLs (path -> url). Loaded once per case mount.
  const [photosByLog, setPhotosByLog] = useState<Map<string, LogEntryPhotoRow[]>>(
    new Map()
  );
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());

  // Lightbox state: array of {url, caption} the lightbox is showing,
  // and which index is open. Each log's photos open in its own context.
  const [lightboxUrls, setLightboxUrls] = useState<string[] | null>(null);
  const [lightboxCaptions, setLightboxCaptions] = useState<(string | null)[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Which log's photos the lightbox is currently displaying — needed to
  // update the right slice of photosByLog when captions get edited.
  const [lightboxLogId, setLightboxLogId] = useState<string | null>(null);
  // Step 18+: post-seal photo addition. Tracks which log entry is
  // currently showing the AddPhotosModal.
  const [addPhotosLogId, setAddPhotosLogId] = useState<string | null>(null);

  // Step 22: audio attachments. Same shape as photo state.
  const [audioByLog, setAudioByLog] = useState<Map<string, LogEntryAudioRow[]>>(
    new Map()
  );
  const [signedAudioUrls, setSignedAudioUrls] = useState<Map<string, string>>(
    new Map()
  );
  const [addAudioLogId, setAddAudioLogId] = useState<string | null>(null);

  // Step 22+: post-seal log entry editing. Only one log can be in
  // edit mode at a time. editingLogId === null means none is active.
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    observation: string;
    note: string;
  }>({ observation: '', note: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Step 24: if this case is part of a team investigation umbrella,
  // load the parent record so we can render a clickable badge.
  const [investigation, setInvestigation] = useState<InvestigationRow | null>(null);

  // Is the viewer the owner of this case? Used to gate "add photos"
  // and other owner-only affordances.
  const isCaseOwner = !!authUser && caseOwnerProfileId === authUser.id;

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const deleteCaseAction = useHauntStore((s) => s.deleteCase);

  // Step 18: load photos for this case.
  useEffect(() => {
    if (!id || isSample) return;
    let cancelled = false;
    let retryTimer: number | null = null;
    const load = async () => {
      try {
        const byLog = await fetchPhotosForCase(id);
        if (cancelled) return;
        setPhotosByLog(byLog);
        const allPaths: string[] = [];
        byLog.forEach((arr) => arr.forEach((p) => allPaths.push(p.storage_path)));
        if (allPaths.length > 0) {
          const urls = await getSignedPhotoUrls(allPaths);
          if (!cancelled) setSignedUrls(urls);
        }
      } catch (e) {
        console.warn('[CaseView] photo fetch failed:', e);
      }
    };
    (async () => {
      await load();
      // Step 42: when arriving fresh from a seal, the photo upload
      // may have JUST completed and the database row may not be
      // queryable for a moment. Retry once after 2s, then clear the
      // ?fresh=1 query param so a manual refresh doesn't double-fetch.
      if (freshFromSeal) {
        retryTimer = window.setTimeout(async () => {
          await load();
          if (!cancelled) {
            // Clean up the URL param.
            const sp = new URLSearchParams(searchParams);
            sp.delete('fresh');
            setSearchParams(sp, { replace: true });
          }
        }, 2000);
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Step 22: load audio clips for this case.
  useEffect(() => {
    if (!id || isSample) return;
    let cancelled = false;
    let retryTimer: number | null = null;
    const load = async () => {
      try {
        const byLog = await fetchAudioForCase(id);
        if (cancelled) return;
        setAudioByLog(byLog);
        const allPaths: string[] = [];
        byLog.forEach((arr) => arr.forEach((a) => allPaths.push(a.storage_path)));
        if (allPaths.length > 0) {
          const urls = await getSignedAudioUrls(allPaths);
          if (!cancelled) setSignedAudioUrls(urls);
        }
      } catch (e) {
        console.warn('[CaseView] audio fetch failed:', e);
      }
    };
    (async () => {
      await load();
      if (freshFromSeal) {
        retryTimer = window.setTimeout(() => {
          load();
        }, 2000);
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Step 24: hydrate investigation parent if this case is linked to one.
  // Sample case is excluded (it's hardcoded, no DB record).
  const [groupZone, setGroupZone] = useState<string | null>(null);
  useEffect(() => {
    if (!caseFile?.investigationId || isSample) {
      setInvestigation(null);
      setGroupZone(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const inv = await fetchInvestigation(caseFile.investigationId!);
      if (!cancelled) setInvestigation(inv);
      // Step 25: if the case is also tagged to a group, find its zone label.
      if (caseFile.groupId) {
        const groups = await listInvestigationGroups(caseFile.investigationId!);
        if (!cancelled) {
          const g = groups.find((x) => x.id === caseFile.groupId);
          setGroupZone(g?.zone ?? null);
        }
      } else {
        if (!cancelled) setGroupZone(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseFile?.investigationId, caseFile?.groupId, isSample]);

  /** Open the lightbox for a specific log entry, starting at the given photo index. */
  const openLightboxForLog = (logId: string, startIndex: number) => {
    const photos = photosByLog.get(logId) ?? [];
    const urls = photos
      .map((p) => signedUrls.get(p.storage_path))
      .filter((u): u is string => !!u);
    if (urls.length === 0) return;
    setLightboxLogId(logId);
    setLightboxUrls(urls);
    setLightboxCaptions(photos.map((p) => p.caption));
    setLightboxIndex(Math.min(startIndex, urls.length - 1));
  };

  /** Caption save handler — called from PhotoLightbox when the user edits. */
  const handleCaptionSave = async (idx: number, newCaption: string | null) => {
    if (!lightboxLogId) return;
    const photos = photosByLog.get(lightboxLogId) ?? [];
    const photo = photos[idx];
    if (!photo) return;
    const res = await updatePhotoCaption(photo.id, newCaption);
    if (!res.ok) {
      toast.error('Could not save caption', { description: res.error });
      return;
    }
    // Update both the photosByLog cache and the lightbox's caption array.
    setPhotosByLog((prev) => {
      const next = new Map(prev);
      const arr = next.get(lightboxLogId) ?? [];
      next.set(
        lightboxLogId,
        arr.map((p) => (p.id === photo.id ? { ...p, caption: newCaption } : p))
      );
      return next;
    });
    setLightboxCaptions((prev) => {
      const next = [...prev];
      next[idx] = newCaption;
      return next;
    });
  };

  /** Delete a photo and refresh state. Only the photo owner sees the trash button. */
  const handleDeletePhoto = async (photo: LogEntryPhotoRow) => {
    if (!confirm('Remove this photo?')) return;
    const res = await deleteLogPhoto(photo);
    if (!res.ok) {
      toast.error('Could not delete photo', { description: res.error });
      return;
    }
    setPhotosByLog((prev) => {
      const next = new Map(prev);
      const arr = next.get(photo.log_entry_id) ?? [];
      const filtered = arr.filter((p) => p.id !== photo.id);
      if (filtered.length > 0) next.set(photo.log_entry_id, filtered);
      else next.delete(photo.log_entry_id);
      return next;
    });
  };

  /** Copy the public case URL to clipboard. Falls back gracefully on
   * browsers without clipboard permission. On mobile, prefers the
   * native share sheet when available. */
  const handleShare = async () => {
    if (!caseFile) return;
    const url = `${window.location.origin}/case/${caseFile.id}`;
    // Try the native share sheet first on supporting browsers (mobile mostly).
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({
          title: caseFile.title || 'HauntLog case',
          text: caseFile.summary || `${caseFile.location} · case file on HauntLog`,
          url,
        });
        return;
      } catch {
        // User cancelled or share unavailable — fall through to clipboard.
      }
    }
    // Clipboard fallback.
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', { description: url });
    } catch {
      toast.error('Could not copy link', {
        description: 'Try selecting the URL from the address bar.',
      });
    }
  };

  /** Toggle the starred flag on a log entry. Owner-only — gated in
   * the UI but also enforced by RLS. */
  const handleToggleStar = async (logId: string, currentStarred: boolean) => {
    if (!caseFile) return;
    const next = !currentStarred;
    const res = await toggleLogStarAction(caseFile.id, logId, next);
    if (!res.ok) {
      toast.error('Could not update star', { description: res.error });
    }
  };

  /** Enter edit mode for a log entry. Stashes current values into the
   * draft so the user can cancel without losing the original. */
  const handleStartEdit = (log: { id: string; observation: string; note?: string }) => {
    setEditingLogId(log.id);
    setEditDraft({
      observation: log.observation ?? '',
      note: log.note ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setEditDraft({ observation: '', note: '' });
  };

  const handleSaveEdit = async () => {
    if (!caseFile || !editingLogId) return;
    const obs = editDraft.observation.trim();
    if (obs.length === 0) {
      toast.error('Observation cannot be empty');
      return;
    }
    setEditSaving(true);
    const res = await updateLogEntryAction(caseFile.id, editingLogId, {
      observation: obs,
      // null clears the note; empty string also normalised to null.
      note: editDraft.note.trim() ? editDraft.note.trim() : null,
    });
    setEditSaving(false);
    if (!res.ok) {
      toast.error('Could not save changes', { description: res.error });
      return;
    }
    toast.success('Log entry updated');
    setEditingLogId(null);
    setEditDraft({ observation: '', note: '' });
  };

  /** Called from AddPhotosModal when new photos have been uploaded. We
   * merge them into photosByLog and re-sign their URLs so they render. */
  const handlePhotosUploaded = async (newPhotos: LogEntryPhotoRow[]) => {
    if (newPhotos.length === 0) return;
    setPhotosByLog((prev) => {
      const next = new Map(prev);
      newPhotos.forEach((p) => {
        const arr = next.get(p.log_entry_id) ?? [];
        next.set(p.log_entry_id, [...arr, p]);
      });
      return next;
    });
    // Sign URLs for the new paths and merge into the signedUrls map.
    try {
      const newPaths = newPhotos.map((p) => p.storage_path);
      const urls = await getSignedPhotoUrls(newPaths);
      setSignedUrls((prev) => {
        const next = new Map(prev);
        urls.forEach((u, k) => next.set(k, u));
        return next;
      });
    } catch (e) {
      console.warn('[CaseView] re-sign after upload failed:', e);
    }
  };

  // ------- Audio handlers (step 22) -------
  const handleAudioUploaded = async (newAudio: LogEntryAudioRow) => {
    setAudioByLog((prev) => {
      const next = new Map(prev);
      const arr = next.get(newAudio.log_entry_id) ?? [];
      next.set(newAudio.log_entry_id, [...arr, newAudio]);
      return next;
    });
    try {
      const urls = await getSignedAudioUrls([newAudio.storage_path]);
      setSignedAudioUrls((prev) => {
        const next = new Map(prev);
        urls.forEach((u, k) => next.set(k, u));
        return next;
      });
    } catch (e) {
      console.warn('[CaseView] re-sign audio after upload failed:', e);
    }
  };

  const handleDeleteAudio = async (audio: LogEntryAudioRow) => {
    if (!confirm('Remove this audio clip?')) return;
    const res = await deleteLogAudio(audio);
    if (!res.ok) {
      toast.error('Could not delete audio', { description: res.error });
      return;
    }
    setAudioByLog((prev) => {
      const next = new Map(prev);
      const arr = next.get(audio.log_entry_id) ?? [];
      const filtered = arr.filter((a) => a.id !== audio.id);
      if (filtered.length > 0) next.set(audio.log_entry_id, filtered);
      else next.delete(audio.log_entry_id);
      return next;
    });
  };

  // Close the visibility menu when clicking outside.
  useEffect(() => {
    if (!visMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (visMenuRef.current && !visMenuRef.current.contains(e.target as Node)) {
        setVisMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [visMenuOpen]);

  // Same for the more-actions menu.
  useEffect(() => {
    if (!moreMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [moreMenuOpen]);

  if (fetching) {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  if (!caseFile) {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-20 text-center">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
          {fetchError ? '// ERROR' : '// 404'}
        </div>
        <h1 className="text-3xl font-medium mb-2">
          {fetchError ? 'Could not load case' : 'Case not found'}
        </h1>
        <p className="text-white/60 mb-4">
          {fetchError
            ? 'Something went wrong while fetching this case.'
            : 'This case may have been deleted, set to private, or never existed.'}
        </p>
        {fetchError && (
          <p className="text-xs font-mono text-red-400 mb-8 break-words max-w-md mx-auto">
            {fetchError}
          </p>
        )}
        <Link
          to="/app/vault"
          className="inline-block bg-white text-black px-6 py-3 rounded-xl font-mono tracking-widest text-sm hover:bg-haunt-red hover:text-white transition-colors"
        >
          ← BACK TO VAULT
        </Link>
      </div>
    );
  }

  const sortedLogs = [...caseFile.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const starredLogs = sortedLogs.filter((l) => l.starred);

  const deviceCounts = caseFile.equipmentUsed.map((id) => ({
    id,
    label: equipmentLabel(id, caseFile.customEquipment),
    abbr: equipmentAbbr(id, caseFile.customEquipment),
    count: caseFile.logs.filter((l) => l.equipmentId === id).length,
  }));

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/case/${caseFile.id}` : '';

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* best-effort */
    }
  };

  const ownerDisplay =
    caseFile.visibility === 'anonymous' ? 'Anonymous investigator' : caseFile.ownerHandle;

  const handleDeleteCase = async () => {
    if (deleteConfirmText !== caseFile.id) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteCaseAction(caseFile.id);
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }
    // Out of here.
    navigate('/app/vault', { replace: true });
  };

  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      // Lazy-load: the PDF library is ~250 KB gzipped. Only users who
      // actually export pay the cost.
      const { exportCasePDF } = await import('../lib/pdfExport');
      await exportCasePDF(
        caseFile,
        typeof window !== 'undefined' ? window.location.origin : undefined
      );
    } catch (e) {
      console.error('[pdf export] failed:', e);
      setExportError(e instanceof Error ? e.message : 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-500/30 rounded-3xl p-6 max-w-md w-full">
            <div className="text-xs font-mono text-red-400 tracking-widest mb-3 flex items-center gap-x-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              // DELETE CASE
            </div>
            <h2 className="text-2xl font-medium mb-2">Permanently delete?</h2>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              This deletes the case <span className="font-mono text-white">#{caseFile.id}</span>,
              its{' '}
              <span className="text-white">
                {caseFile.logs.length} log {caseFile.logs.length === 1 ? 'entry' : 'entries'}
              </span>
              , and any comments attached to it.
              <span className="block mt-2 text-red-300">This cannot be undone.</span>
            </p>
            {deleteError && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-3 flex items-start gap-x-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-words">{deleteError}</span>
              </div>
            )}
            <p className="text-sm text-white/70 mb-2">
              Type <span className="font-mono text-red-300">{caseFile.id}</span> to confirm:
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:border-red-500 outline-none mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="flex-1 px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl text-sm font-mono tracking-widest"
              >
                CANCEL
              </button>
              <button
                onClick={handleDeleteCase}
                disabled={deleteConfirmText !== caseFile.id || deleting}
                className="flex-1 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-red-300 rounded-xl text-sm font-mono tracking-widest flex items-center justify-center gap-x-2"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                CONFIRM DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> BACK
          </button>
          <div className="flex items-center gap-x-3">
            {/* Visibility — clickable dropdown for owner, static badge for others */}
            {(() => {
              const isOwner = caseFile.ownerHandle === currentUser.handle;
              const badge = visibilityBadge(caseFile.visibility);

              if (!isOwner) {
                return (
                  <div
                    className={`text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 ${badge.color}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </div>
                );
              }

              return (
                <div className="relative" ref={visMenuRef}>
                  <button
                    onClick={() => setVisMenuOpen((s) => !s)}
                    className={`text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 px-2 py-1 rounded-lg hover:bg-white/5 ${badge.color}`}
                  >
                    {badge.icon}
                    {badge.label}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        visMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {visMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-950 border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                      <div className="px-3 py-2 text-[10px] font-mono text-white/40 tracking-widest border-b border-white/5">
                        CHANGE VISIBILITY
                      </div>
                      {(['public', 'anonymous', 'private'] as Visibility[]).map((v) => {
                        const b = visibilityBadge(v);
                        const on = caseFile.visibility === v;
                        return (
                          <button
                            key={v}
                            onClick={async () => {
                              try {
                                await updateCaseVisibility(caseFile.id, v);
                                toast.success('Visibility updated');
                              } catch (e) {
                                toast.error('Could not change visibility', {
                                  description: e instanceof Error ? e.message : undefined,
                                });
                              }
                              setVisMenuOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-white/5 flex items-center gap-x-2.5"
                          >
                            <span className={b.color}>{b.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-mono tracking-widest ${b.color}`}>
                                {b.label}
                              </div>
                              <div className="text-[10px] text-white/40 mt-0.5">
                                {visibilityDescription(v)}
                              </div>
                            </div>
                            {on && <Check className="w-3.5 h-3.5 text-haunt-red shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {caseFile.gpsVerified && (
              <div className="text-xs font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1.5">
                <ShieldCheck className="w-3 h-3" /> GPS VERIFIED
              </div>
            )}

            {caseFile.visibility !== 'private' && (
              <button
                onClick={copyShareLink}
                className="text-xs font-mono tracking-widest text-white/60 hover:text-white flex items-center gap-x-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg"
              >
                <LinkIcon className="w-3 h-3" />
                COPY LINK
              </button>
            )}

            {caseFile.visibility !== 'private' && (
              <button
                onClick={handleShare}
                className="text-xs font-mono tracking-widest text-white/60 hover:text-white flex items-center gap-x-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg"
                title="Copy public link"
              >
                <Share2 className="w-3 h-3" />
                SHARE
              </button>
            )}

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="text-xs font-mono tracking-widest text-white/60 hover:text-white flex items-center gap-x-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg"
              title="Download as PDF"
            >
              {exporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {exporting ? 'PREPARING…' : 'EXPORT PDF'}
            </button>

            {/* Owner-only "..." menu */}
            {caseFile.ownerHandle === currentUser.handle && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen((s) => !s)}
                  className="text-white/60 hover:text-white p-1.5 bg-white/5 hover:bg-white/10 rounded-lg"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-950 border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs hover:bg-red-500/10 flex items-center gap-x-2 text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete case
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {isSample && (
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-amber-300 mb-1">
                Sample case
              </div>
              <p className="text-xs text-amber-200/80">
                This is an example of what a sealed hunt looks like in HauntLog. Your real cases will appear in your Vault after you finish your first hunt.
              </p>
            </div>
          </div>
        )}
        {exportError && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="break-words">{exportError}</span>
          </div>
        )}
        {/* CASE FILE header — visually distinctive sealed badge */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-x-2 flex-wrap">
            <div className="font-mono text-[10px] md:text-xs bg-white/10 border border-white/10 px-3 md:px-4 py-1.5 rounded-2xl tracking-widest inline-flex items-center gap-x-2">
              <ShieldCheck className="w-3 h-3 md:w-3.5 md:h-3.5 text-haunt-red" />
              CASE FILE · SEALED
            </div>
            {investigation && (
              <Link
                to={`/app/investigations/${investigation.id}`}
                className="font-mono text-[10px] md:text-xs bg-haunt-red/10 border border-haunt-red/30 hover:border-haunt-red px-3 md:px-4 py-1.5 rounded-2xl tracking-widest inline-flex items-center gap-x-2 text-haunt-red transition-colors"
                title="View the team investigation this case is part of"
              >
                <Radio className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span className="truncate max-w-[180px] md:max-w-[280px]">
                  PART OF {(investigation.name ?? investigation.location_name).toUpperCase()}
                </span>
              </Link>
            )}
            {groupZone && (
              <div
                className="font-mono text-[10px] md:text-xs bg-white/5 border border-white/10 px-3 md:px-4 py-1.5 rounded-2xl tracking-widest inline-flex items-center gap-x-2 text-white/70"
                title="Logged as part of this group"
              >
                <UsersRound className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span className="truncate max-w-[180px] md:max-w-[280px]">
                  GROUP · {groupZone.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="text-[10px] md:text-xs text-white/40 font-mono tracking-widest">
            #{caseFile.id}
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-medium tracking-tighter leading-[1.02] mb-4">
          {caseFile.title}
        </h1>
        <div className="flex items-center gap-x-2 text-white/70 mb-3">
          <MapPin className="w-4 h-4 text-haunt-red" />
          <span className="text-base md:text-lg">
            {caseFile.location}
            {caseFile.zone ? ` · ${caseFile.zone}` : ''}
          </span>
        </div>
        {/* Chain-of-custody strip — replaces the four big stat tiles.
            Compact, monospace, sits like a registry footer right under
            the hero. Encodes everything those tiles encoded but reads
            like a document instead of a dashboard. */}
        <div className="font-mono text-[10px] md:text-xs tracking-widest text-white/45 mb-10 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span>
            LOGGED BY <span className="text-white/80">{ownerDisplay}</span>
          </span>
          <span className="text-white/20">·</span>
          <span>{formatDateTime(caseFile.startedAt).toUpperCase()}</span>
          {caseFile.endedAt && (
            <>
              <span className="text-white/20">·</span>
              <span>
                {formatDuration(caseFile.startedAt, caseFile.endedAt).toUpperCase()} DURATION
              </span>
            </>
          )}
          <span className="text-white/20">·</span>
          <span>
            {caseFile.logs.length} {caseFile.logs.length === 1 ? 'EVENT' : 'EVENTS'}
          </span>
          {caseFile.equipmentUsed.length > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>
                {caseFile.equipmentUsed.length}{' '}
                {caseFile.equipmentUsed.length === 1 ? 'DEVICE' : 'DEVICES'}
              </span>
            </>
          )}
          {starredLogs.length > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span className="inline-flex items-center gap-x-1 text-yellow-400/80">
                <Star className="w-3 h-3 fill-yellow-400" /> {starredLogs.length} STARRED
              </span>
            </>
          )}
        </div>

        {caseFile.summary && (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-8 max-w-3xl">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-3">// SUMMARY</div>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{caseFile.summary}</p>
          </div>
        )}

        {caseFile.tags && caseFile.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {caseFile.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center text-[10px] font-mono tracking-widest px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-white/60"
              >
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Equipment manifest only if present */}
        {deviceCounts.length > 0 && (
          <div className="mb-10 max-w-3xl mx-auto">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // EQUIPMENT MANIFEST
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {deviceCounts.map((d) => (
                <div key={d.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
                  <div className="font-mono text-xs tracking-widest text-haunt-red mb-1">
                    {d.abbr}
                  </div>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-white/40 mt-2">
                    <span className="text-white">{d.count}</span>{' '}
                    {d.count === 1 ? 'log' : 'logs'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Starred highlights */}
        {starredLogs.length > 0 && (
          <div className="mb-10 max-w-3xl mx-auto">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // STARRED HIGHLIGHTS · {starredLogs.length}
            </div>
            <div className="space-y-3">
              {starredLogs.map((log) => {
                const chip = equipmentChipColors(log.equipmentId);
                return (
                <div
                  key={log.id}
                  className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-5 flex items-start gap-4"
                >
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-x-3 mb-1">
                      <span className="font-mono text-xs tracking-widest text-white/60">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className={`px-2 py-0.5 ${chip.bg} ${chip.text} border ${chip.border} text-[10px] font-mono rounded-md tracking-widest`}>
                        {equipmentAbbr(log.equipmentId, caseFile.customEquipment)}
                      </span>
                    </div>
                    <p className="text-white text-lg">{log.observation}</p>
                    {log.note && (
                      <p className="text-white/60 text-sm mt-2 italic">{log.note}</p>
                    )}
                    {log.data && (
                      <div className="mt-2">
                        <EquipmentDataDisplay equipmentId={log.equipmentId} data={log.data} />
                      </div>
                    )}
                    {/* Step 18: photo grid. Always rendered for the
                        owner so they can ADD photos to logs that have
                        none. Non-owners only see the grid if photos
                        exist. */}
                    {(isCaseOwner || (photosByLog.get(log.id) ?? []).length > 0) && (
                      <PhotoGrid
                        photos={photosByLog.get(log.id) ?? []}
                        signedUrls={signedUrls}
                        viewerCanDelete={(p) => authUser?.id === p.owner_id}
                        onOpen={(idx) => openLightboxForLog(log.id, idx)}
                        onDelete={handleDeletePhoto}
                        canAddMore={
                          isCaseOwner &&
                          (photosByLog.get(log.id) ?? []).length < MAX_PHOTOS_PER_LOG
                        }
                        onAddMore={() => setAddPhotosLogId(log.id)}
                      />
                    )}
                    {/* Step 22: audio attachments */}
                    <AudioList
                      audios={audioByLog.get(log.id) ?? []}
                      signedUrls={signedAudioUrls}
                      isOwner={isCaseOwner}
                      isSample={isSample}
                      onDelete={handleDeleteAudio}
                      canAddMore={
                        isCaseOwner &&
                        !isSample &&
                        (audioByLog.get(log.id) ?? []).length < MAX_AUDIO_PER_LOG
                      }
                      onAddMore={() => setAddAudioLogId(log.id)}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full log */}
        <div className="mb-10 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-mono text-white/40 tracking-widest">
              // FULL SESSION LOG
            </div>
            <div className="text-xs font-mono text-white/40">
              {sortedLogs.length} {sortedLogs.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          {sortedLogs.length === 0 ? (
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 text-center text-white/40 text-sm">
              No events were logged.
            </div>
          ) : (
            <div className="space-y-6">
              {sortedLogs.map((log, logIdx) => {
                const chip = equipmentChipColors(log.equipmentId);
                const entryNumber = String(logIdx + 1).padStart(3, '0');
                const logPhotos = photosByLog.get(log.id) ?? [];
                const logAudio = audioByLog.get(log.id) ?? [];
                return (
                <article
                  key={log.id}
                  className="relative overflow-hidden rounded-2xl border border-white/10 hl-evidence-card"
                  style={{
                    // Warm dark gradient — black with a whisper of red
                    // in the corner. Makes the card feel like a document
                    // under low light instead of a flat zinc rectangle.
                    background:
                      'radial-gradient(ellipse at top right, rgba(226,75,74,0.06), transparent 60%), linear-gradient(to bottom right, #18181b, #000000)',
                  }}
                >
                  {/* GHOST NUMBER — massive sequential entry number sitting
                      behind the content. Establishes this as a numbered
                      piece of evidence, not a database row. Hidden on the
                      smallest screens where it would interfere. */}
                  <div
                    aria-hidden
                    className="hidden sm:block absolute -top-4 md:-top-8 right-4 md:right-8 font-mono font-bold leading-none select-none pointer-events-none"
                    style={{
                      fontSize: 'clamp(120px, 22vw, 240px)',
                      color: 'rgba(255,255,255,0.025)',
                      letterSpacing: '-0.05em',
                    }}
                  >
                    {entryNumber}
                  </div>

                  {/* CORNER REGISTRATION MARKS — tiny crosshairs in each
                      corner. Free dossier-vocabulary, costs almost nothing
                      visually, instantly reads as "document". */}
                  <CornerMark className="absolute top-2 left-2" />
                  <CornerMark className="absolute top-2 right-2" />
                  <CornerMark className="absolute bottom-2 left-2" />
                  <CornerMark className="absolute bottom-2 right-2" />

                  {/* Equipment-colored left rule, runs full height */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${chip.bar}`} aria-hidden />

                  <div className="relative pl-6 md:pl-10 pr-5 md:pr-8 pt-6 md:pt-7 pb-0">
                    {/* META ROW: entry number + chip + star indicator left,
                        timestamp + actions right. Smaller, recedes. */}
                    <div className="flex items-center justify-between mb-4 gap-3">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="font-mono text-[10px] md:text-xs tracking-[0.2em] text-white/50 shrink-0">
                          // ENTRY {entryNumber}
                        </div>
                        <span
                          className={`px-2 py-0.5 ${chip.bg} ${chip.text} border ${chip.border} text-[10px] font-mono rounded tracking-widest shrink-0`}
                        >
                          {equipmentAbbr(log.equipmentId, caseFile.customEquipment)}
                        </span>
                        {log.starred && (
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="font-mono text-[10px] md:text-xs text-white/45 tabular-nums">
                          {formatTime(log.timestamp)}
                        </div>
                        {isCaseOwner && !isSample && editingLogId !== log.id && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(log)}
                            aria-label="Edit this log entry"
                            title="Edit"
                            className="ml-1 p-1 rounded-md text-white/25 hover:text-white/80 hover:bg-white/5 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isCaseOwner && !isSample && (
                          <button
                            type="button"
                            onClick={() => handleToggleStar(log.id, !!log.starred)}
                            aria-label={
                              log.starred ? 'Unstar this log entry' : 'Star this log entry'
                            }
                            title={log.starred ? 'Unstar' : 'Mark as highlight'}
                            className={`p-1 rounded-md transition-colors ${
                              log.starred
                                ? 'text-yellow-400 hover:bg-yellow-400/10'
                                : 'text-white/25 hover:text-yellow-400/70 hover:bg-white/5'
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${log.starred ? 'fill-yellow-400' : ''}`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* OBSERVATION — the testimony. Large serif italic,
                        capped at a comfortable reading width like a real
                        paragraph in a document. */}
                    {editingLogId === log.id ? (
                      <div className="space-y-2 max-w-2xl">
                        <div>
                          <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
                            OBSERVATION
                          </label>
                          <textarea
                            value={editDraft.observation}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, observation: e.target.value }))
                            }
                            rows={2}
                            className="w-full bg-black border border-white/20 focus:border-haunt-red rounded-lg px-3 py-2 text-sm text-white outline-none"
                            placeholder="What did the gear catch?"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
                            NOTE (OPTIONAL)
                          </label>
                          <textarea
                            value={editDraft.note}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, note: e.target.value }))
                            }
                            rows={2}
                            className="w-full bg-black border border-white/20 focus:border-haunt-red rounded-lg px-3 py-2 text-sm text-white/70 outline-none"
                            placeholder="Context, conditions, anything else"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={editSaving}
                            className="bg-haunt-red hover:bg-red-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
                          >
                            {editSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            SAVE
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={editSaving}
                            className="text-white/60 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-2xl">
                        <p
                          className="font-serif italic text-xl md:text-3xl leading-snug text-white break-words"
                          style={{
                            fontFamily:
                              '"Cormorant Garamond", "Iowan Old Style", "Apple Garamond", Georgia, serif',
                          }}
                        >
                          {log.observation}
                        </p>
                        {log.note && (
                          <p className="text-sm md:text-base text-white/55 mt-4 break-words flex gap-x-2">
                            <span className="text-haunt-red shrink-0 select-none">→</span>
                            <span>{log.note}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {log.data && (
                      <div className="mt-4 max-w-2xl">
                        <EquipmentDataDisplay equipmentId={log.equipmentId} data={log.data} />
                      </div>
                    )}

                    {/* PHOTOS — labeled EXHIBIT A, B, C... */}
                    {(isCaseOwner || logPhotos.length > 0) && (
                      <div className="mt-6">
                        {logPhotos.length > 0 && (
                          <div className="text-[10px] font-mono text-white/50 tracking-[0.2em] mb-3">
                            // EXHIBITS · {logPhotos.length}
                          </div>
                        )}
                        <PhotoGrid
                          photos={logPhotos}
                          signedUrls={signedUrls}
                          viewerCanDelete={(p) => authUser?.id === p.owner_id}
                          onOpen={(idx) => openLightboxForLog(log.id, idx)}
                          onDelete={handleDeletePhoto}
                          canAddMore={
                            isCaseOwner && logPhotos.length < MAX_PHOTOS_PER_LOG
                          }
                          onAddMore={() => setAddPhotosLogId(log.id)}
                        />
                      </div>
                    )}

                    {/* AUDIO — separate section with its own dignity */}
                    {(logAudio.length > 0 ||
                      (isCaseOwner && !isSample && logAudio.length < MAX_AUDIO_PER_LOG)) && (
                      <div className="mt-6">
                        {logAudio.length > 0 && (
                          <div className="text-[10px] font-mono text-white/50 tracking-[0.2em] mb-3">
                            // AUDIO CAPTURE · {logAudio.length}
                          </div>
                        )}
                        <AudioList
                          audios={logAudio}
                          signedUrls={signedAudioUrls}
                          isOwner={isCaseOwner}
                          isSample={isSample}
                          onDelete={handleDeleteAudio}
                          canAddMore={
                            isCaseOwner &&
                            !isSample &&
                            logAudio.length < MAX_AUDIO_PER_LOG
                          }
                          onAddMore={() => setAddAudioLogId(log.id)}
                        />
                      </div>
                    )}

                    {/* CHAIN-OF-CUSTODY FOOTER — registry-style strip at
                        the bottom of every entry. Repeats info that's
                        elsewhere on the page, but the repetition IS the
                        point: this is how documents reassure you. */}
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <div className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-white/30 flex flex-wrap items-center gap-x-2 gap-y-1 pb-4">
                        <span>RECORDED {formatTime(log.timestamp)}</span>
                        {caseFile.zone && (
                          <>
                            <span className="text-white/15">·</span>
                            <span className="uppercase">{caseFile.zone}</span>
                          </>
                        )}
                        <span className="text-white/15">·</span>
                        <span className="uppercase">#{caseFile.id}</span>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="max-w-3xl mx-auto bg-zinc-900/40 border border-dashed border-white/10 rounded-3xl p-6 text-center text-white/40 text-sm">
          Video evidence attachments coming in a later release.
        </div>

        {!isSample && (
          <div className="mt-8 max-w-3xl mx-auto">
            <Comments
              caseId={caseFile.id}
              caseOwnerId={caseOwnerProfileId}
              visibility={caseFile.visibility}
            />
          </div>
        )}

        {/* Cinematic sealed signature block — mirrors the landing page sample card */}
        <div className="mt-12 max-w-3xl mx-auto bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-x-3 min-w-0 flex-1">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-xs md:text-sm font-bold shrink-0">
                {(caseFile.visibility === 'anonymous'
                  ? '?'
                  : (caseFile.ownerHandle ?? '?').replace(/^@/, '').slice(0, 2).toUpperCase())}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs font-mono tracking-widest text-white/40">
                  SEALED · SIGNED BY
                </div>
                <div className="font-mono text-sm md:text-base text-white truncate">
                  {caseFile.visibility === 'anonymous'
                    ? 'ANONYMOUS INVESTIGATOR'
                    : (caseFile.ownerHandle ?? '').toUpperCase()}
                </div>
                <div className="text-[10px] md:text-xs font-mono text-white/40 break-all mt-0.5">
                  HAUNTLOG.APP/CASE/{caseFile.id}
                </div>
              </div>
            </div>
            <Star className="w-6 h-6 md:w-7 md:h-7 text-yellow-400 fill-yellow-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Step 18: lightbox for fullscreen photo viewing */}
      {lightboxUrls && (
        <PhotoLightbox
          urls={lightboxUrls}
          index={lightboxIndex}
          captions={lightboxCaptions}
          onClose={() => {
            setLightboxUrls(null);
            setLightboxLogId(null);
          }}
          onNavigate={setLightboxIndex}
          canEdit={(idx) => {
            if (!lightboxLogId || !authUser) return false;
            const photo = (photosByLog.get(lightboxLogId) ?? [])[idx];
            return !!photo && photo.owner_id === authUser.id;
          }}
          onCaptionSave={handleCaptionSave}
        />
      )}

      {/* Step 18+: add-photos modal for post-seal photo addition */}
      {addPhotosLogId && id && (
        <AddPhotosModal
          open={true}
          onClose={() => setAddPhotosLogId(null)}
          caseId={id}
          logEntryId={addPhotosLogId}
          existingPhotoCount={(photosByLog.get(addPhotosLogId) ?? []).length}
          onUploaded={handlePhotosUploaded}
        />
      )}

      {/* Step 22: add-audio modal */}
      {addAudioLogId && id && (
        <AddAudioModal
          open={true}
          onClose={() => setAddAudioLogId(null)}
          caseId={id}
          logEntryId={addAudioLogId}
          existingAudioCount={(audioByLog.get(addAudioLogId) ?? []).length}
          onUploaded={handleAudioUploaded}
        />
      )}
    </div>
  );
}

// ============================================================
// Helper: photo thumbnail grid rendered under each log entry.
// 4-column grid, square thumbs, owner sees trash button on hover.
// Optionally shows a "+" tile to add more photos (post-seal).
// ============================================================
/** Tiny crosshair drawn at each corner of an evidence card. Pure
 * decoration — establishes dossier-page vocabulary at near-zero
 * visual cost. Subtle by default; scales naturally with the page. */
function CornerMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`text-white/15 ${className}`}
      style={{ pointerEvents: 'none' }}
    >
      <line x1="5" y1="0" x2="5" y2="10" stroke="currentColor" strokeWidth="0.75" />
      <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

function PhotoGrid({
  photos,
  signedUrls,
  viewerCanDelete,
  onOpen,
  onDelete,
  canAddMore,
  onAddMore,
}: {
  photos: LogEntryPhotoRow[];
  signedUrls: Map<string, string>;
  viewerCanDelete: (p: LogEntryPhotoRow) => boolean;
  onOpen: (index: number) => void;
  onDelete: (p: LogEntryPhotoRow) => void;
  canAddMore?: boolean;
  onAddMore?: () => void;
}) {
  if (photos.length === 0 && !canAddMore) return null;
  // EXHIBIT A, B, C... for the first 26. Beyond that fall through to
  // EXHIBIT AA, AB... but in practice MAX_PHOTOS_PER_LOG caps at ~6.
  const exhibitLabel = (idx: number) => {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return `${String.fromCharCode(65 + Math.floor(idx / 26) - 1)}${String.fromCharCode(
      65 + (idx % 26)
    )}`;
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((p, idx) => {
        const url = signedUrls.get(p.storage_path);
        const label = `EXHIBIT ${exhibitLabel(idx)}`;
        if (!url) {
          return (
            <div
              key={p.id}
              className="aspect-square rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-y-1"
            >
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
              <span className="text-[9px] font-mono tracking-widest text-white/40">
                LOADING
              </span>
            </div>
          );
        }
        return (
          <div key={p.id} className="relative group">
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className="block aspect-square w-full rounded-xl overflow-hidden border border-white/10 bg-zinc-900 hover:border-haunt-red/50 transition-colors relative"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {/* Caption strip at the bottom of each exhibit — gives
                  the photo dossier weight without dominating it. */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                <div className="text-[9px] font-mono tracking-widest text-white/80">
                  {label}
                </div>
              </div>
            </button>
            {viewerCanDelete(p) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(p);
                }}
                aria-label="Delete photo"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      {canAddMore && onAddMore && (
        <button
          type="button"
          onClick={onAddMore}
          aria-label="Add more photos"
          className="aspect-square rounded-xl border-2 border-dashed border-white/15 bg-zinc-900/40 hover:border-haunt-red/50 hover:text-haunt-red text-white/40 flex flex-col items-center justify-center gap-y-1 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-mono tracking-widest">ADD EXHIBIT</span>
        </button>
      )}
    </div>
  );
}

function formatDur(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AudioList({
  audios,
  signedUrls,
  isOwner,
  isSample,
  onDelete,
  canAddMore,
  onAddMore,
}: {
  audios: LogEntryAudioRow[];
  signedUrls: Map<string, string>;
  isOwner: boolean;
  isSample: boolean;
  onDelete: (a: LogEntryAudioRow) => void;
  canAddMore: boolean;
  onAddMore: () => void;
}) {
  if (audios.length === 0 && !canAddMore) return null;
  return (
    <div className="mt-3 space-y-2 max-w-xl">
      {audios.map((a) => {
        const url = signedUrls.get(a.storage_path);
        return (
          <div
            key={a.id}
            className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3"
          >
            <div className="flex items-center gap-x-2 mb-2">
              <Mic2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="text-[10px] font-mono text-amber-300/80 tracking-widest truncate flex-1">
                AUDIO {formatDur(a.duration_seconds) && `· ${formatDur(a.duration_seconds)}`}
              </div>
              {isOwner && !isSample && (
                <button
                  type="button"
                  onClick={() => onDelete(a)}
                  className="text-white/40 hover:text-red-400 p-1 rounded-md hover:bg-white/5"
                  aria-label="Delete audio clip"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {url ? (
              <audio controls src={url} className="w-full" style={{ height: 36 }} />
            ) : (
              <div className="text-xs text-white/40 inline-flex items-center gap-x-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading audio…
              </div>
            )}
            {a.caption && (
              <div className="text-xs text-white/60 italic mt-1.5 break-words">
                {a.caption}
              </div>
            )}
          </div>
        );
      })}
      {canAddMore && (
        <button
          type="button"
          onClick={onAddMore}
          className="w-full rounded-xl border-2 border-dashed border-white/20 bg-zinc-900/30 hover:border-amber-500/60 hover:text-white text-white/50 py-2.5 flex items-center justify-center gap-x-2 text-xs font-mono tracking-widest transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          ADD AUDIO
        </button>
      )}
    </div>
  );
}
