import { useEffect, useState } from 'react';
import PhotoUploadField, { type PendingPhoto } from './PhotoUploadField';
import {
  resizeForUpload,
  validatePhotoFile,
  describeValidationError,
  MAX_PHOTOS_PER_LOG,
} from '../lib/imageProcess';
import { uploadLogPhoto, type LogEntryPhotoRow } from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  caseId: string;
  logEntryId: string;
  existingPhotoCount: number;
  onUploaded: (newPhotos: LogEntryPhotoRow[]) => void;
};

export default function AddPhotosModal({
  open,
  onClose,
  caseId,
  logEntryId,
  existingPhotoCount,
  onUploaded,
}: Props) {
  const { user: authUser } = useAuth();
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setPending([]);
      setUploading(false);
      setProgress({ done: 0, total: 0 });
      setError(null);
    }
  }, [open, logEntryId]);

  if (!open) return null;

  const remainingSlots = MAX_PHOTOS_PER_LOG - existingPhotoCount;

  const handleUpload = async () => {
    if (!authUser || pending.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: pending.length });

    const uploaded: LogEntryPhotoRow[] = [];
    const failures: string[] = [];

    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      try {
        const v = validatePhotoFile(p.file);
        if (!v.ok) {
          failures.push(`${p.file.name}: ${describeValidationError(v)}`);
          continue;
        }
        const processed = await resizeForUpload(p.file);
        const res = await uploadLogPhoto({
          userId: authUser.id,
          caseId,
          logEntryId,
          blob: processed.blob,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
        });
        if (res.ok) {
          uploaded.push(res.row);
        } else {
          failures.push(`${p.file.name}: ${res.error}`);
        }
      } catch (e: any) {
        failures.push(`${p.file.name}: ${e?.message ?? String(e)}`);
      }
      setProgress({ done: i + 1, total: pending.length });
    }

    setUploading(false);

    if (uploaded.length > 0) {
      onUploaded(uploaded);
    }

    if (failures.length > 0) {
      setError(
        `${failures.length} photo${failures.length === 1 ? '' : 's'} failed:\n${failures.join('\n')}`
      );
      // Don't auto-close on partial failure — let the user see what went wrong.
    } else {
      // All succeeded — close after a brief success blink.
      setTimeout(() => onClose(), 600);
    }
  };

  const canSubmit = !uploading && pending.length > 0 && !!authUser;

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={() => {
        if (uploading) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-white/10 px-5 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] md:text-xs font-mono text-haunt-red tracking-widest">
              ADD PHOTOS
            </div>
            <div className="text-sm md:text-base text-white/60 mt-0.5">
              To this log entry · {existingPhotoCount}/{MAX_PHOTOS_PER_LOG} used
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 md:px-6 py-5">
          {remainingSlots <= 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h3 className="text-base font-medium mb-1">No room for more</h3>
              <p className="text-sm text-white/60">
                This log entry already has the maximum {MAX_PHOTOS_PER_LOG} photos.
                Delete one first to make room.
              </p>
            </div>
          ) : (
            <>
              <PhotoUploadField photos={pending} onChange={setPending} />

              {error && (
                <div className="mt-4 bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 whitespace-pre-wrap break-words flex items-start gap-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {uploading && (
                <div className="mt-4 bg-blue-500/5 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300 inline-flex items-center gap-x-2 w-full">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>
                    Uploading {progress.done}/{progress.total}…
                  </span>
                </div>
              )}

              {!uploading && progress.done > 0 && error === null && (
                <div className="mt-4 bg-green-500/5 border border-green-500/30 rounded-xl p-3 text-xs text-green-300 inline-flex items-center gap-x-2 w-full">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Uploaded {progress.done} photo{progress.done === 1 ? '' : 's'}.</span>
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono tracking-widest text-white/70 disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-xl bg-haunt-red hover:bg-red-600 text-xs font-mono tracking-widest text-white inline-flex items-center gap-x-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  UPLOAD {pending.length > 0 ? `· ${pending.length}` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
