import { useEffect, useRef, useState } from 'react';
import {
  validatePhotoFile,
  describeValidationError,
  makeThumbnailUrl,
  MAX_PHOTOS_PER_LOG,
} from '../lib/imageProcess';
import { Camera, X, AlertCircle } from 'lucide-react';

/**
 * Pending photo: a File that hasn't been uploaded yet. Holds an
 * object-URL thumbnail for preview. The parent component uploads
 * these AFTER the log entry row is created.
 */
export type PendingPhoto = {
  /** Stable id for React keys; not used in storage. */
  localId: string;
  file: File;
  thumbnailUrl: string;
};

type Props = {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
};

export default function PhotoUploadField({ photos, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Revoke thumbnail URLs on unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.thumbnailUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    const remaining = MAX_PHOTOS_PER_LOG - photos.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_PHOTOS_PER_LOG} photos per log entry.`);
      return;
    }

    const toAdd: PendingPhoto[] = [];
    for (const file of list.slice(0, remaining)) {
      const v = validatePhotoFile(file);
      if (!v.ok) {
        setError(describeValidationError(v));
        continue;
      }
      toAdd.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        thumbnailUrl: makeThumbnailUrl(file),
      });
    }
    if (toAdd.length > 0) {
      onChange([...photos, ...toAdd]);
    }
    if (list.length > remaining) {
      setError(
        `Only added the first ${remaining} of ${list.length} (max ${MAX_PHOTOS_PER_LOG} per log).`
      );
    }
  };

  const removePhoto = (localId: string) => {
    const ph = photos.find((p) => p.localId === localId);
    if (ph) URL.revokeObjectURL(ph.thumbnailUrl);
    onChange(photos.filter((p) => p.localId !== localId));
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const remaining = MAX_PHOTOS_PER_LOG - photos.length;

  return (
    <div>
      <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
        PHOTOS <span className="text-white/30">— optional, max {MAX_PHOTOS_PER_LOG}</span>
      </label>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-300 mb-2 flex items-start gap-x-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div
            key={p.localId}
            className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-zinc-900"
          >
            <img
              src={p.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(p.localId)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-y-1 transition-colors ${
              dragOver
                ? 'border-haunt-red bg-haunt-red/10 text-haunt-red'
                : 'border-white/20 bg-zinc-900/50 text-white/50 hover:border-white/40 hover:text-white/70'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span className="text-[9px] font-mono tracking-widest">ADD</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />

      <p className="text-[10px] font-mono text-white/40 mt-1">
        JPEG, PNG, or WebP · Resized to 2000px on upload · Drops EXIF / GPS metadata
      </p>
    </div>
  );
}
