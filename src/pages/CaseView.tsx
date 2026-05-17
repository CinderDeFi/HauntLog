import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import {
  fetchCaseById,
  fetchPhotosForCase,
  getSignedPhotoUrls,
  deleteLogPhoto,
  updatePhotoCaption,
  type LogEntryPhotoRow,
} from '../lib/dataLayer';
import { MAX_PHOTOS_PER_LOG } from '../lib/imageProcess';
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
  const navigate = useNavigate();
  const cases = useHauntStore((s) => s.cases);
  const currentUser = useHauntStore((s) => s.user);
  const updateCaseVisibility = useHauntStore((s) => s.updateCaseVisibility);

  // Local cache first; fall back to Supabase fetch if missing.
  const localCase = cases.find((c) => c.id === id);
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
    if (!id) return;
    let cancelled = false;
    (async () => {
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
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      alert(res.error);
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
      alert(res.error);
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
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Could not change visibility.');
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
        {exportError && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="break-words">{exportError}</span>
          </div>
        )}
        <div className="mb-4 text-xs font-mono text-white/40 tracking-widest">
          CASE FILE · #{caseFile.id}
        </div>
        <h1 className="text-5xl md:text-6xl font-medium tracking-tighter leading-[1.05] mb-3">
          {caseFile.title}
        </h1>
        <div className="flex items-center gap-x-2 text-white/70 mb-1">
          <MapPin className="w-4 h-4 text-haunt-red" />
          <span>
            {caseFile.location}
            {caseFile.zone ? ` · ${caseFile.zone}` : ''}
          </span>
        </div>
        <div className="text-sm text-white/40 mb-8">
          Logged by <span className="text-white/70 font-medium">{ownerDisplay}</span> · Started{' '}
          {formatDateTime(caseFile.startedAt)}
          {caseFile.endedAt && ` · ${formatDuration(caseFile.startedAt, caseFile.endedAt)} long`}
        </div>

        {caseFile.summary && (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-8">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-3">// SUMMARY</div>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{caseFile.summary}</p>
          </div>
        )}

        {caseFile.tags && caseFile.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">{caseFile.logs.length}</div>
            <div className="text-xs text-white/40 mt-1">EVENTS</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">{caseFile.equipmentUsed.length}</div>
            <div className="text-xs text-white/40 mt-1">DEVICES</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">
              {formatDuration(caseFile.startedAt, caseFile.endedAt)}
            </div>
            <div className="text-xs text-white/40 mt-1">DURATION</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums flex items-center gap-x-2">
              {starredLogs.length}
              {starredLogs.length > 0 && (
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              )}
            </div>
            <div className="text-xs text-white/40 mt-1">STARRED</div>
          </div>
        </div>

        {/* Equipment manifest only if present */}
        {deviceCounts.length > 0 && (
          <div className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // EQUIPMENT MANIFEST
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
          <div className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // STARRED HIGHLIGHTS · {starredLogs.length}
            </div>
            <div className="space-y-3">
              {starredLogs.map((log) => (
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
                      <span className="px-2 py-0.5 bg-white/10 text-[10px] font-mono rounded-md tracking-widest">
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full log */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-white/40 tracking-widest">
              // FULL SESSION LOG
            </div>
            <div className="text-xs font-mono text-white/40">
              {sortedLogs.length} {sortedLogs.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-3xl divide-y divide-white/5">
            {sortedLogs.length === 0 && (
              <div className="p-6 text-center text-white/40 text-sm">No events were logged.</div>
            )}
            {sortedLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-4 md:px-6 py-3">
                <div className="font-mono text-xs text-white/40 w-20 pt-1 shrink-0 tabular-nums">
                  {formatTime(log.timestamp)}
                </div>
                <div className="shrink-0">
                  <span className="px-2 py-1 bg-white/10 text-[10px] font-mono rounded-md tracking-widest">
                    {equipmentAbbr(log.equipmentId, caseFile.customEquipment)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white break-words">{log.observation}</p>
                  {log.note && (
                    <p className="text-white/50 text-sm mt-0.5 break-words">{log.note}</p>
                  )}
                  {log.data && (
                    <div className="mt-1.5">
                      <EquipmentDataDisplay equipmentId={log.equipmentId} data={log.data} />
                    </div>
                  )}
                  {/* Step 18: photo grid */}
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
                </div>
                {log.starred && (
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-dashed border-white/10 rounded-3xl p-6 text-center text-white/40 text-sm">
          Video evidence attachments coming in a later release. <br />
          Once added, you'll be able to link footage from your camera review to specific log
          entries.
        </div>

        <div className="mt-8">
          <Comments
            caseId={caseFile.id}
            caseOwnerId={caseOwnerProfileId}
            visibility={caseFile.visibility}
          />
        </div>

        <div className="mt-12 text-center text-xs font-mono text-white/30 tracking-widest">
          SEALED · CASE FILE #{caseFile.id}
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
    </div>
  );
}

// ============================================================
// Helper: photo thumbnail grid rendered under each log entry.
// 4-column grid, square thumbs, owner sees trash button on hover.
// Optionally shows a "+" tile to add more photos (post-seal).
// ============================================================
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
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 max-w-md">
      {photos.map((p, idx) => {
        const url = signedUrls.get(p.storage_path);
        if (!url) {
          return (
            <div
              key={p.id}
              className="aspect-square rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          );
        }
        return (
          <div key={p.id} className="relative group">
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className="aspect-square w-full rounded-lg overflow-hidden border border-white/10 bg-zinc-900 hover:border-white/30 transition-colors"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
            {viewerCanDelete(p) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(p);
                }}
                aria-label="Delete photo"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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
          className="aspect-square rounded-lg border-2 border-dashed border-white/20 bg-zinc-900/30 hover:border-white/40 hover:text-white text-white/50 flex flex-col items-center justify-center gap-y-0.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[9px] font-mono tracking-widest">ADD</span>
        </button>
      )}
    </div>
  );
}
