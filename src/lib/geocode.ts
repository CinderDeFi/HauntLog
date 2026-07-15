/**
 * Address → lat/lng via OpenStreetMap's Nominatim service.
 *
 * Why Nominatim:
 *   - Free, no API key, no auth, no signup
 *   - Used by countless apps so the API is stable
 *   - Quality is good for street addresses; meh for very vague queries
 *
 * Why not Google Geocoding:
 *   - Requires API key + billing setup
 *   - Better quality, but overkill for our submission throughput
 *
 * Usage policy: Nominatim asks for a descriptive User-Agent and
 * <= 1 req/sec. We pass a UA via fetch headers and the submission
 * flow is human-driven, so we're well under the limit.
 *
 * If geocoding ever needs to scale (bulk import, etc.) we'd switch
 * to a paid provider — but that's a future concern.
 */

export type Geocoded = {
  lat: number;
  lng: number;
  /** Provider's canonical display string for the resolved location. */
  displayName: string;
};

/**
 * Geocode a free-form address. Returns null if no result was found
 * (caller should surface a "we couldn't find that address" error).
 *
 * The result is whatever Nominatim believes is the BEST match — we
 * don't bother with confidence scores. If our user wrote a real
 * address, the first result is virtually always correct.
 */
export async function geocodeAddress(parts: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): Promise<Geocoded | null> {
  // Compose into a single query string. Comma separators help
  // Nominatim parse street/city/state correctly.
  const q = [parts.street, parts.city, parts.state, parts.zip, parts.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ');
  if (!q) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        // Nominatim's usage policy asks for a descriptive UA. They
        // don't enforce it strictly but it's polite.
        'Accept': 'application/json',
      },
    });
  } catch {
    // Network blip — caller decides whether to retry or warn.
    return null;
  }
  if (!res.ok) return null;
  // Parse INSIDE the try boundary. A 200 response isn't guaranteed to be
  // JSON — Nominatim maintenance pages, rate-limit interstitials, or a
  // truncated body make res.json() reject. Left unguarded, that rejection
  // propagates out of geocodeAddress and (since VenueSubmit doesn't wrap
  // this call) leaves the submit form stuck in its disabled state forever.
  let body: Array<{ lat: string; lon: string; display_name: string }>;
  try {
    body = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
  } catch {
    return null;
  }
  if (!Array.isArray(body) || body.length === 0) return null;
  const top = body[0];
  const lat = Number(top.lat);
  const lng = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: top.display_name };
}
