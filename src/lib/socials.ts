// ============================================================
// Social URL helpers
// ============================================================
// Each social field stores a full URL. Users can paste either a handle
// (we auto-prefix the canonical URL) or a full URL.

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'website';

const PLATFORM_BASES: Record<Exclude<SocialPlatform, 'website'>, string> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  facebook: 'https://facebook.com/',
  youtube: 'https://youtube.com/@',
};

/**
 * Normalize what the user typed into a usable URL.
 *
 * - Bare handle "@me" or "me" → platform base + handle
 * - Already-a-URL → returned as-is, with https:// added if missing
 * - Empty input → null (so we can store NULL in the DB)
 */
export function normalizeSocial(
  platform: SocialPlatform,
  raw: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Looks like a URL
  if (trimmed.match(/^https?:\/\//i)) return trimmed;
  if (trimmed.includes('.') && trimmed.includes('/')) return 'https://' + trimmed;

  // Bare domain like "example.com" → assume website
  if (platform === 'website') {
    if (trimmed.includes('.')) return 'https://' + trimmed;
    return null;
  }

  // Bare handle for a known platform
  const cleanHandle = trimmed.replace(/^@/, '');
  return PLATFORM_BASES[platform] + cleanHandle;
}

/**
 * Get a short display label for a URL, e.g. "@riley_hunts" or
 * "rileyhunts.com".
 */
export function socialLabel(platform: SocialPlatform, url: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    // For known platforms, surface the handle.
    if (platform !== 'website') {
      // Last non-empty path segment.
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length > 0) {
        const last = segs[segs.length - 1];
        return last.startsWith('@') ? last : '@' + last;
      }
    }
    // Website: show the host without "www."
    return u.host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
