import { useEffect, useRef, useState } from 'react';
import {
  validateAudioFile,
  describeAudioValidationError,
  probeAudioDuration,
  MAX_AUDIO_PER_LOG,
} from '../lib/imageProcess';
import { uploadLogAudio, type LogEntryAudioRow } from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import { X, Upload, Loader2, AlertCircle, Mic2, FileAudio } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  caseId: string;
  logEntryId: string;
  existingAudioCount: number;
  onUploaded: (newAudio: LogEntryAudioRow) => void;
};

type Pending = {
  file: File;
  durationSeconds: number | null;
  caption: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AddAudioModal({
  open,
  onClose,
  caseId,
  logEntryId,
  existingAudioCount,
  onUploaded,
}: Props) {
  const { user: authUser } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPending(null);
      setUploading(false);
      setError(null);
    }
  }, [open, logEntryId]);

  if (!open) return null;

  const slotsLeft = MAX_AUDIO_PER_LOG - existingAudioCount;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const v = validateAudioFile(file);
    if ('ok' in v && v.ok === false) {
      setError(describeAudioValidationError(v));
      e.target.value = '';
      return;
    }
    // Best-effort: probe duration before upload so we can show it
    // pre-flight and store it in the row.
    const dur = await probeAudioDuration(file);
    setPending({ file, durationSeconds: dur, caption: '' });
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pending || !authUser) return;
    setUploading(true);
    setError(null);
    const res = await uploadLogAudio({
      userId: authUser.id,
      caseId,
      logEntryId,
      blob: pending.file,
      mimeType: pending.file.type,
      durationSeconds: pending.durationSeconds ?? undefined,
      caption: pending.caption.trim() || undefined,
    });
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onUploaded(res.row);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-lg my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Mic2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">Attach audio</div>
              <div className="text-[10px] font-mono text-white/40 tracking-widest">
                {slotsLeft} {slotsLeft === 1 ? 'SLOT' : 'SLOTS'} LEFT · 25 MB MAX
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {slotsLeft <= 0 ? (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-200">
              This log entry already has the maximum of {MAX_AUDIO_PER_LOG} audio clips. Delete one first to add a new clip.
            </div>
          ) : !pending ? (
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-white/20 hover:border-amber-500/60 rounded-2xl p-8 text-center transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-white/40" />
                <div className="text-sm font-medium mb-1">Tap to pick an audio file</div>
                <div className="text-xs text-white/40">
                  MP3, WAV, M4A, OGG, WebM · 25 MB max
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-black border border-white/10 rounded-2xl p-4">
                <div className="flex items-start gap-x-3 mb-3">
                  <FileAudio className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{pending.file.name}</div>
                    <div className="text-[10px] font-mono text-white/40 tracking-widest mt-0.5">
                      {pending.file.type || 'unknown'} · {formatBytes(pending.file.size)} ·{' '}
                      {formatDuration(pending.durationSeconds)}
                    </div>
                  </div>
                </div>
                <audio
                  controls
                  src={URL.createObjectURL(pending.file)}
                  className="w-full"
                  style={{ height: 32 }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1.5">
                  CAPTION (OPTIONAL)
                </label>
                <input
                  value={pending.caption}
                  onChange={(e) =>
                    setPending((p) => (p ? { ...p, caption: e.target.value } : p))
                  }
                  placeholder="e.g. EVP capture, sweep 3, channel 7"
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-white/30 focus:border-amber-500 outline-none"
                  maxLength={200}
                />
              </div>

              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-xs font-mono text-white/40 hover:text-white/70 tracking-widest"
              >
                ← PICK A DIFFERENT FILE
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono tracking-widest text-white/60 hover:text-white"
          >
            CANCEL
          </button>
          <button
            disabled={!pending || uploading || slotsLeft <= 0}
            onClick={handleUpload}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-black px-5 py-2 rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-2"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            UPLOAD
          </button>
        </div>
      </div>
    </div>
  );
}
