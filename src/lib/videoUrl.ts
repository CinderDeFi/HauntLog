/**
 * Parse a user-pasted video URL into an embed descriptor we can
 * render as an iframe. Supports the common YouTube variants and a
 * basic Vimeo case. Returns null when nothing matches — the caller
 * should hide the player and offer a plain link.
 *
 * Designed to be permissive: someone pasting any reasonable YouTube
 * URL should just work. We don't try to validate that the video
 * actually exists; if the embed 404s, YouTube shows its own error.
 */
export type EmbeddedVideo = {
  provider: 'youtube' | 'vimeo';
  /** Provider's video id. */
  id: string;
  /** Fully-formed embed URL the iframe should src. */
  embedUrl: string;
};

export function parseVideoUrl(raw: string): EmbeddedVideo | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // YouTube — many forms.
  // youtu.be/VIDEOID
  // youtube.com/watch?v=VIDEOID
  // youtube.com/embed/VIDEOID
  // youtube.com/shorts/VIDEOID
  const yt =
    url.match(/youtu\.be\/([\w-]{6,})/i) ||
    url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)([\w-]{6,})/i);
  if (yt && yt[1]) {
    const id = yt[1];
    return {
      provider: 'youtube',
      id,
      // youtube-nocookie keeps tracking lighter and is fully embeddable.
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  // Vimeo — vimeo.com/VIDEOID
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  if (vm && vm[1]) {
    const id = vm[1];
    return {
      provider: 'vimeo',
      id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
    };
  }

  return null;
}
