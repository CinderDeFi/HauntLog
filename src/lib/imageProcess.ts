/**
 * Client-side image processing for log entry photos.
 *
 * Resizes images via the Canvas API before upload to keep storage
 * costs reasonable (typical 5MB phone shots become ~600KB at 2000px
 * long edge). Also normalizes everything to JPEG for consistent
 * playback across browsers.
 *
 * Notes:
 * - Canvas drawing inherently drops most EXIF metadata. GPS
 *   coordinates and other metadata are NOT preserved.
 * - HEIC files (Safari) are rejected at the validation step; users
 *   need to convert before upload. Server-side HEIC conversion is
 *   future work.
 */

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_LONG_EDGE = 2000; // px
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTOS_PER_LOG = 6;

export type ProcessedImage = {
  blob: Blob;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
};

export type ProcessError =
  | { ok: false; kind: 'too_big'; bytes: number }
  | { ok: false; kind: 'bad_type'; type: string }
  | { ok: false; kind: 'decode_failed' }
  | { ok: false; kind: 'unknown'; message: string };

export function validatePhotoFile(file: File): ProcessError | { ok: true } {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, kind: 'bad_type', type: file.type || 'unknown' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, kind: 'too_big', bytes: file.size };
  }
  return { ok: true };
}

export function describeValidationError(e: ProcessError): string {
  switch (e.kind) {
    case 'too_big':
      return `Image is too large (${(e.bytes / (1024 * 1024)).toFixed(1)} MB). Max is 4 MB.`;
    case 'bad_type':
      return `Unsupported format: ${e.type}. Use JPEG, PNG, or WebP.`;
    case 'decode_failed':
      return `Couldn't read this image. Try a different one.`;
    case 'unknown':
      return e.message;
  }
}

/**
 * Decode an image File via the Image element. Returns an HTMLImageElement
 * sized to the source dimensions. Rejects on decode failure.
 */
function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode_failed'));
    };
    img.src = url;
  });
}

/**
 * Resize an image File to fit within MAX_LONG_EDGE on its longest side,
 * preserving aspect ratio. Encodes to JPEG with quality 0.85.
 *
 * Returns the resized blob plus dimensions. If the source is already
 * small enough, we still re-encode for consistency (drops EXIF, normalizes
 * to JPEG).
 */
export async function resizeForUpload(file: File): Promise<ProcessedImage> {
  const img = await decodeImage(file);

  let { naturalWidth: w, naturalHeight: h } = img;
  const long = Math.max(w, h);
  if (long > MAX_LONG_EDGE) {
    const ratio = MAX_LONG_EDGE / long;
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(img, 0, 0, w, h);

  // Encode to JPEG at q=0.85 — sweet spot for visual quality vs size.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  if (!blob) throw new Error('Encoding failed');

  return {
    blob,
    mimeType: 'image/jpeg',
    bytes: blob.size,
    width: w,
    height: h,
  };
}

/**
 * Generate a small thumbnail blob URL for the LogSheet preview row.
 * Returns an object URL that the caller must revoke when done.
 */
export function makeThumbnailUrl(file: File): string {
  return URL.createObjectURL(file);
}

// ============================================================
// AVATAR PROCESSING (step 19)
// ============================================================
// Avatars are smaller, square, and used as profile/team logos. We
// center-crop to a square then resize to 512px and encode at JPEG q=0.9.
// ============================================================

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_SIZE = 512; // px (square)

export function validateAvatarFile(file: File): ProcessError | { ok: true } {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, kind: 'bad_type', type: file.type || 'unknown' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, kind: 'too_big', bytes: file.size };
  }
  return { ok: true };
}

export function describeAvatarValidationError(e: ProcessError): string {
  // Same as describeValidationError but with 2MB messaging.
  switch (e.kind) {
    case 'too_big':
      return `Image is too large (${(e.bytes / (1024 * 1024)).toFixed(1)} MB). Max is 2 MB.`;
    case 'bad_type':
      return `Unsupported format: ${e.type}. Use JPEG, PNG, or WebP.`;
    case 'decode_failed':
      return `Couldn't read this image. Try a different one.`;
    case 'unknown':
      return e.message;
  }
}

/**
 * Center-crop an image to a square then resize to AVATAR_SIZE.
 * Encodes to JPEG q=0.9.
 */
export async function cropSquareForAvatar(file: File): Promise<ProcessedImage> {
  const img = await decodeImage(file);

  const { naturalWidth: w, naturalHeight: h } = img;
  const side = Math.min(w, h);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  // Draw the cropped source rectangle scaled to fill the canvas.
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );
  if (!blob) throw new Error('Encoding failed');

  return {
    blob,
    mimeType: 'image/jpeg',
    bytes: blob.size,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  };
}

// ============================================================
// BANNER / HERO IMAGE PROCESSING
// ============================================================
// Hero images are wide banners (16:9) used on venue profile pages.
// Center-cropped to 16:9 then resized to 1600x900 JPEG q=0.85.
// ============================================================

export const MAX_BANNER_BYTES = 6 * 1024 * 1024; // 6 MB
export const BANNER_WIDTH = 1600;
export const BANNER_HEIGHT = 900;

export function validateBannerFile(file: File): ProcessError | { ok: true } {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, kind: 'bad_type', type: file.type || 'unknown' };
  }
  if (file.size > MAX_BANNER_BYTES) {
    return { ok: false, kind: 'too_big', bytes: file.size };
  }
  return { ok: true };
}

export function describeBannerValidationError(e: ProcessError): string {
  switch (e.kind) {
    case 'too_big':
      return `Image is too large (${(e.bytes / (1024 * 1024)).toFixed(1)} MB). Max is 6 MB.`;
    case 'bad_type':
      return `Unsupported format: ${e.type}. Use JPEG, PNG, or WebP.`;
    case 'decode_failed':
      return `Couldn't read this image. Try a different one.`;
    case 'unknown':
      return e.message;
  }
}

/**
 * Center-crop an image to 16:9 then resize to BANNER_WIDTH x BANNER_HEIGHT.
 * If the source image is narrower than 16:9 it'll be cropped vertically;
 * if wider, horizontally. Either way the result fills the banner without
 * letterboxing.
 */
export async function cropWideForBanner(file: File): Promise<ProcessedImage> {
  const img = await decodeImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;

  // Target aspect ratio
  const targetAspect = BANNER_WIDTH / BANNER_HEIGHT; // ≈ 1.778
  const sourceAspect = w / h;

  let sx = 0, sy = 0, sw = w, sh = h;
  if (sourceAspect > targetAspect) {
    // Source wider than target — crop horizontally.
    sw = Math.round(h * targetAspect);
    sx = Math.floor((w - sw) / 2);
  } else if (sourceAspect < targetAspect) {
    // Source taller than target — crop vertically.
    sh = Math.round(w / targetAspect);
    sy = Math.floor((h - sh) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );
  if (!blob) throw new Error('Encoding failed');

  return {
    blob,
    mimeType: 'image/jpeg',
    bytes: blob.size,
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
  };
}

// ============================================================
// AUDIO VALIDATION (step 22)
// ============================================================
// Co-located with image validators since they share the
// ProcessError shape and similar shape of error reporting.

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
] as const;

export const MAX_AUDIO_PER_LOG = 4;

export function validateAudioFile(file: File): ProcessError | { ok: true } {
  if (!(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, kind: 'bad_type', type: file.type || 'unknown' };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, kind: 'too_big', bytes: file.size };
  }
  return { ok: true };
}

export function describeAudioValidationError(e: ProcessError): string {
  switch (e.kind) {
    case 'too_big':
      return `Audio file is too large (${(e.bytes / (1024 * 1024)).toFixed(1)} MB). Max is 25 MB.`;
    case 'bad_type':
      return `Unsupported audio format: ${e.type}. Use MP3, WAV, M4A, OGG, or WebM.`;
    case 'decode_failed':
      return `Couldn't read this audio file. Try a different one.`;
    case 'unknown':
      return e.message;
  }
}

/**
 * Best-effort audio duration probe. Loads the file into an <audio>
 * element and reads .duration once metadata is ready. Returns null
 * on any failure so the caller can still upload without duration.
 */
export function probeAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };
    a.onloadedmetadata = () => {
      const d = a.duration;
      cleanup();
      resolve(Number.isFinite(d) && d > 0 ? d : null);
    };
    a.onerror = () => {
      cleanup();
      resolve(null);
    };
    // Safety timeout — give up after 5s if metadata never fires.
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);
    a.src = url;
  });
}
