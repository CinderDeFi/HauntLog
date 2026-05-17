import { useEffect, useRef, useState } from 'react';
import {
  validateAvatarFile,
  describeAvatarValidationError,
  cropSquareForAvatar,
  MAX_AVATAR_BYTES,
} from '../lib/imageProcess';
import { uploadAvatar } from '../lib/dataLayer';
import {
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
} from 'lucide-react';

type Props = {
  /** The user id (for profile) or team id (for team logo). */
  ownerId: string;
  /** Current avatar URL if any — used for display and cleanup on replace. */
  currentUrl: string | null;
  /** Two-letter initials shown when there's no avatar (e.g. "RH"). */
  fallbackInitials: string;
  /** Called with the new public URL after a successful upload. The
   *  parent is responsible for saving this URL to the profile / team
   *  row (avatar_url or logo_url). */
  onUploaded: (newUrl: string) => void | Promise<void>;
  /** Called when the user clears their avatar. The parent should set
   *  the URL to null in the relevant table. */
  onCleared?: () => void | Promise<void>;
  /** Whether the user can edit. False = display-only. */
  canEdit?: boolean;
  /** Size of the avatar circle in pixels. Default 96. */
  sizePx?: number;
};

export default function AvatarUpload({
  ownerId,
  currentUrl,
  fallbackInitials,
  onUploaded,
  onCleared,
  canEdit = true,
  sizePx = 96,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Preview state — set when the user picks a file before confirming.
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickFile = async (file: File) => {
    setError(null);
    const v = validateAvatarFile(file);
    if (!v.ok) {
      setError(describeAvatarValidationError(v));
      return;
    }
    try {
      const processed = await cropSquareForAvatar(file);
      // Revoke old preview if any
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(processed.blob);
      setPreviewUrl(URL.createObjectURL(processed.blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process image.');
    }
  };

  const onCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setError(null);
  };

  const onConfirmUpload = async () => {
    if (!previewBlob || uploading) return;
    setUploading(true);
    setError(null);
    const res = await uploadAvatar({
      ownerId,
      blob: previewBlob,
      oldUrl: currentUrl,
    });
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Hand the URL to the parent to persist.
    try {
      await onUploaded(res.publicUrl);
      onCancelPreview();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save avatar.');
    }
  };

  const onClickClear = async () => {
    if (!onCleared || clearing) return;
    if (!confirm('Remove your current avatar?')) return;
    setClearing(true);
    try {
      await onCleared();
    } finally {
      setClearing(false);
    }
  };

  // Display the active image: preview if user picked one, else current.
  const displayUrl = previewUrl ?? currentUrl;
  const showActions = canEdit && !uploading;

  return (
    <div>
      <div className="flex items-center gap-4 md:gap-5">
        {/* Avatar circle */}
        <div
          className="relative shrink-0"
          style={{ width: sizePx, height: sizePx }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt=""
              className="w-full h-full rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white font-bold text-xl">
              {fallbackInitials}
            </div>
          )}

          {/* Camera button overlay — only when not in preview state */}
          {showActions && !previewBlob && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Change avatar"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-haunt-red hover:bg-red-600 border-2 border-zinc-950 text-white flex items-center justify-center shadow-lg transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex-1 min-w-0">
          {previewBlob ? (
            <div>
              <div className="text-xs font-mono text-amber-400 tracking-widest mb-2">
                PREVIEW · USE THIS PHOTO?
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onConfirmUpload}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-haunt-red hover:bg-red-600 text-white text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  SAVE
                </button>
                <button
                  type="button"
                  onClick={onCancelPreview}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  CANCEL
                </button>
              </div>
            </div>
          ) : showActions ? (
            <div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-xs font-mono text-white/70 hover:text-white tracking-widest inline-flex items-center gap-x-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                {currentUrl ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
              </button>
              {currentUrl && onCleared && (
                <button
                  type="button"
                  onClick={onClickClear}
                  disabled={clearing}
                  className="block mt-2 text-[10px] font-mono text-white/40 hover:text-red-300 tracking-widest inline-flex items-center gap-x-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {clearing ? 'REMOVING…' : 'REMOVE PHOTO'}
                </button>
              )}
              {justSaved && (
                <div className="mt-2 text-[10px] font-mono text-green-400 tracking-widest inline-flex items-center gap-x-1.5">
                  <CheckCircle2 className="w-3 h-3" /> SAVED
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="mt-3 bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-300 flex items-start gap-x-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {showActions && (
        <p className="text-[10px] font-mono text-white/40 mt-2">
          JPEG, PNG, or WebP · Max {MAX_AVATAR_BYTES / (1024 * 1024)} MB · Center-cropped to square
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
