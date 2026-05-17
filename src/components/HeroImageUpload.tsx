import { useEffect, useRef, useState } from 'react';
import {
  validateBannerFile,
  describeBannerValidationError,
  cropWideForBanner,
  MAX_BANNER_BYTES,
} from '../lib/imageProcess';
import { uploadVenuePhoto } from '../lib/dataLayer';
import {
  ImagePlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
} from 'lucide-react';

type Props = {
  /** The location id whose folder the photo will land in. */
  locationId: string;
  /** Current hero image URL if any — for display + cleanup on replace. */
  currentUrl: string | null;
  /** Called after a successful upload. The parent persists this URL to
   *  locations.hero_image. */
  onUploaded: (newUrl: string) => void | Promise<void>;
  /** Called when the user clears the hero image. */
  onCleared?: () => void | Promise<void>;
  /** Disable interaction. */
  canEdit?: boolean;
};

export default function HeroImageUpload({
  locationId,
  currentUrl,
  onUploaded,
  onCleared,
  canEdit = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickFile = async (file: File) => {
    setError(null);
    const v = validateBannerFile(file);
    if (!v.ok) {
      setError(describeBannerValidationError(v));
      return;
    }
    try {
      const processed = await cropWideForBanner(file);
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
    const res = await uploadVenuePhoto({
      locationId,
      blob: previewBlob,
      oldUrl: currentUrl,
    });
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      await onUploaded(res.publicUrl);
      onCancelPreview();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save hero image.');
    }
  };

  const onClickClear = async () => {
    if (!onCleared || clearing) return;
    if (!confirm('Remove the hero image?')) return;
    setClearing(true);
    try {
      await onCleared();
    } finally {
      setClearing(false);
    }
  };

  const displayUrl = previewUrl ?? currentUrl;
  const showActions = canEdit && !uploading;

  return (
    <div>
      {/* Banner area — 16:9 aspect ratio */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-900" style={{ aspectRatio: '16 / 9' }}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <div className="text-center">
              <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-xs font-mono tracking-widest">NO HERO IMAGE</div>
            </div>
          </div>
        )}

        {/* Hover/tap overlay button when not in preview */}
        {showActions && !previewBlob && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-3 right-3 px-3 py-2 rounded-xl bg-black/80 hover:bg-black border border-white/20 text-white text-xs font-mono tracking-widest backdrop-blur inline-flex items-center gap-x-1.5 transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {currentUrl ? 'CHANGE' : 'UPLOAD'}
          </button>
        )}

        {/* Preview indicator overlay */}
        {previewBlob && (
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-amber-400/90 text-black text-[10px] font-mono tracking-widest">
            PREVIEW · NOT SAVED YET
          </div>
        )}
      </div>

      {/* Action bar below banner */}
      {previewBlob ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
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
            SAVE HERO IMAGE
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
      ) : showActions ? (
        <div className="mt-3 flex items-center gap-3 flex-wrap text-[10px] font-mono text-white/40">
          <span>JPEG, PNG, or WebP · Max {MAX_BANNER_BYTES / (1024 * 1024)} MB · Cropped to 16:9</span>
          {currentUrl && onCleared && (
            <button
              type="button"
              onClick={onClickClear}
              disabled={clearing}
              className="text-white/40 hover:text-red-300 tracking-widest inline-flex items-center gap-x-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              {clearing ? 'REMOVING…' : 'REMOVE'}
            </button>
          )}
          {justSaved && (
            <span className="text-green-400 inline-flex items-center gap-x-1.5">
              <CheckCircle2 className="w-3 h-3" /> SAVED
            </span>
          )}
        </div>
      ) : null}

      {error && (
        <div className="mt-3 bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-300 flex items-start gap-x-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
