import { useEffect, useRef, useState } from 'react';
import {
  validatePhotoFile,
  describeValidationError,
  resizeForUpload,
} from '../lib/imageProcess';
import {
  uploadVenueGalleryPhoto,
  removeVenueGalleryPhoto,
} from '../lib/dataLayer';
import { useToast } from './ui/Toast';
import {
  ImagePlus,
  Loader2,
  AlertCircle,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

/**
 * Multi-photo gallery uploader for venues. Distinct from
 * HeroImageUpload (which manages a single banner). This is the
 * room-by-room / supplemental photo set.
 *
 * Behaviour:
 *   - User picks a file → validated → resized → uploaded → URL
 *     appended to the venue's photos array.
 *   - Each photo gets reorder arrows and a delete button.
 *   - Reordering is via arrows (drag-and-drop is a bigger lift; the
 *     count here will be 6–12 photos, arrows are fine).
 *   - On delete the file is removed from storage AND the array.
 *
 * The parent persists the new array to locations.photos via the
 * onChange callback. We never mutate the array client-side until the
 * server update succeeds — so a failed upload doesn't leave a
 * dangling thumbnail.
 */

const MAX_GALLERY_PHOTOS = 12;

type Props = {
  locationId: string;
  photos: string[];
  /** Called whenever the gallery changes. Caller persists to DB and
   *  returns ok/err — we surface failures via toast. */
  onChange: (nextPhotos: string[]) => Promise<{ ok: boolean; error?: string }>;
  canEdit?: boolean;
};

export default function VenueGalleryUpload({
  locationId,
  photos,
  onChange,
  canEdit = true,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which URL is currently being deleted/moved so we can show a
  // per-item spinner instead of locking the whole UI.
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    setError(null);
  }, [photos.length]);

  const slotsLeft = MAX_GALLERY_PHOTOS - photos.length;

  const onPick = async (file: File) => {
    setError(null);
    if (!canEdit) return;
    const v = validatePhotoFile(file);
    if (!v.ok) {
      setError(describeValidationError(v));
      return;
    }
    setUploading(true);
    try {
      const processed = await resizeForUpload(file);
      const res = await uploadVenueGalleryPhoto({
        locationId,
        blob: processed.blob,
        mimeType: processed.mimeType,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next = [...photos, res.publicUrl];
      const saved = await onChange(next);
      if (!saved.ok) {
        // Roll back the storage upload — best-effort cleanup.
        await removeVenueGalleryPhoto({ locationId, url: res.publicUrl });
        setError(saved.error ?? 'Could not save photo.');
      } else {
        toast.success('Photo added');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process image.');
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async (url: string) => {
    if (!canEdit || busyUrl) return;
    setBusyUrl(url);
    try {
      const next = photos.filter((p) => p !== url);
      const saved = await onChange(next);
      if (!saved.ok) {
        toast.error('Could not remove', { description: saved.error });
        return;
      }
      // Once the row is updated, drop the storage object too.
      await removeVenueGalleryPhoto({ locationId, url });
    } finally {
      setBusyUrl(null);
    }
  };

  const move = async (url: string, dir: -1 | 1) => {
    if (!canEdit || busyUrl) return;
    const idx = photos.indexOf(url);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= photos.length) return;
    setBusyUrl(url);
    try {
      const next = [...photos];
      [next[idx], next[j]] = [next[j], next[idx]];
      const saved = await onChange(next);
      if (!saved.ok) {
        toast.error('Could not reorder', { description: saved.error });
      }
    } finally {
      setBusyUrl(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-white/40 tracking-widest">
          GALLERY · {photos.length}/{MAX_GALLERY_PHOTOS}
        </div>
        {slotsLeft > 0 && canEdit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-x-1.5 px-3 py-1.5 rounded-lg bg-haunt-red/10 border border-haunt-red/30 text-haunt-red text-xs font-mono tracking-widest hover:bg-haunt-red/20 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ImagePlus className="w-3 h-3" />
            )}
            ADD PHOTO
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-300 mb-3 flex items-start gap-x-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-zinc-900 border border-dashed border-white/15 rounded-2xl p-8 text-center text-sm text-white/40">
          No gallery photos yet. {canEdit ? 'Add rooms, exterior shots, or anything you want investigators to see.' : ''}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((url, i) => {
            const busy = busyUrl === url;
            return (
              <div
                key={url}
                className="relative group rounded-xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[4/3]"
              >
                <img
                  src={url}
                  alt={`Venue photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {busy && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  </div>
                )}
                {canEdit && !busy && (
                  <>
                    {/* Reorder controls — bottom-left */}
                    <div className="absolute bottom-1.5 left-1.5 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => move(url, -1)}
                        disabled={i === 0}
                        aria-label="Move left"
                        className="w-7 h-7 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center disabled:opacity-30"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(url, 1)}
                        disabled={i === photos.length - 1}
                        aria-label="Move right"
                        className="w-7 h-7 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center disabled:opacity-30"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Delete — top-right */}
                    <button
                      type="button"
                      onClick={() => onRemove(url)}
                      aria-label="Remove photo"
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {/* Position label */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-mono tracking-widest rounded">
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
