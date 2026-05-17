import { useEffect } from 'react';
import {
  useHauntStore,
  type CatalogVenueInput,
  type VenueAddress,
  type VenueContact,
} from '../store/useHauntStore';
import { csvToRecords, splitPipes, type SeedCsvRow } from './csv';

const CSV_URL = '/seed-venues.csv';

function rowToCatalogVenue(row: SeedCsvRow): CatalogVenueInput | null {
  if (!row.id || !row.name) return null;

  const lat = row.lat ? parseFloat(row.lat) : NaN;
  const lng = row.lng ? parseFloat(row.lng) : NaN;

  const address: VenueAddress | undefined =
    row.street || row.city || row.state || row.zip || row.country
      ? {
          street: row.street || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          zip: row.zip || undefined,
          country: row.country || undefined,
        }
      : undefined;

  const contact: VenueContact | undefined =
    row.contact_email || row.contact_phone
      ? {
          email: row.contact_email || undefined,
          phone: row.contact_phone || undefined,
        }
      : undefined;

  return {
    id: row.id,
    name: row.name,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    description: row.description || undefined,
    address,
    website: row.website || undefined,
    hours: row.hours || undefined,
    contact,
    rules: splitPipes(row.rules),
    bookingUrl: row.booking_url || undefined,
    tags: splitPipes(row.tags),
    // CSV column "verified" (string "true" or empty). Accepts a few truthy
    // spellings to be forgiving.
    verified: /^(true|1|yes|y)$/i.test((row.verified ?? '').trim()),
  };
}

// Module-level Promise dedupes concurrent calls (e.g. React 18 StrictMode
// double-invoking effects in dev). The first caller starts the fetch; later
// callers await the same promise. Once it resolves, future callers get an
// already-resolved promise — but `importCatalogVenues` is idempotent on
// matching ids, so re-running is safe anyway.
let inFlight: Promise<void> | null = null;

async function runSeedImport(
  importCatalogVenues: ReturnType<typeof useHauntStore.getState>['importCatalogVenues']
): Promise<void> {
  try {
    const res = await fetch(CSV_URL, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn(`[seed-venues] ${CSV_URL} returned ${res.status}, skipping`);
      return;
    }
    const text = await res.text();

    const records = csvToRecords(text);
    const incoming = records
      .map(rowToCatalogVenue)
      .filter((v): v is CatalogVenueInput => v !== null)
      .filter((v) => v.lat !== undefined && v.lng !== undefined);

    if (incoming.length === 0) {
      console.info('[seed-venues] no usable rows; skipping');
      return;
    }

    const result = importCatalogVenues(incoming);
    console.info(
      `[seed-venues] added ${result.added}, updated ${result.updated}, skipped ${result.skipped}`
    );
  } catch (err) {
    console.warn('[seed-venues] failed to load:', err);
  }
}

export function useSeedVenues() {
  const importCatalogVenues = useHauntStore((s) => s.importCatalogVenues);

  useEffect(() => {
    if (!inFlight) {
      inFlight = runSeedImport(importCatalogVenues);
    }
    // No cleanup that cancels the fetch — the import is safe to complete
    // even if the component unmounts (StrictMode double-mount in dev).
  }, [importCatalogVenues]);
}
