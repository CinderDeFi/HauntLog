import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import L from 'leaflet';
import type { Venue } from '../store/useHauntStore';

export type AtlasMapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  venues: Venue[];
  selectedVenueId: string | null;
  onVenueClick: (venueId: string) => void;
  className?: string;
};

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const PIN_SIZE = 28;
const PIN_HALF = PIN_SIZE / 2;

function pinColor(v: Venue): string {
  if (v.verified) return '#4ade80';
  if (v.source === 'catalog') return '#E24B4A';
  return '#9ca3af';
}

function pinSvg(color: string, isSelected: boolean): string {
  // 28x28 viewBox, full-bleed, with a halo for selected state.
  const halo = isSelected
    ? `<circle cx="14" cy="14" r="13" fill="${color}" opacity="0.25" />`
    : '';
  return `
    <svg viewBox="0 0 28 28" width="${PIN_SIZE}" height="${PIN_SIZE}" xmlns="http://www.w3.org/2000/svg" style="display:block;cursor:pointer">
      ${halo}
      <circle cx="14" cy="14" r="7" fill="${color}" stroke="#0a0a0a" stroke-width="2.5"/>
      <circle cx="14" cy="14" r="2.5" fill="#0a0a0a" />
    </svg>
  `;
}

function makeIcon(v: Venue, selected: boolean): L.DivIcon {
  return L.divIcon({
    html: pinSvg(pinColor(v), selected),
    // Empty className strips Leaflet's default `.leaflet-div-icon` white box.
    className: '',
    iconSize: [PIN_SIZE, PIN_SIZE],
    // Anchor at the center of the icon — the visible dot is centered in the SVG.
    iconAnchor: [PIN_HALF, PIN_HALF],
    popupAnchor: [0, -PIN_HALF + 2],
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function popupHtml(v: Venue): string {
  const subtitle = [v.address?.city, v.address?.state].filter(Boolean).join(', ');
  const badge =
    v.verified
      ? '<span style="color:#4ade80">VERIFIED</span>'
      : v.source === 'catalog'
      ? '<span style="color:#E24B4A">OFFICIAL</span>'
      : '<span style="color:#9ca3af">COMMUNITY</span>';

  return `
    <div style="min-width:180px;font-family:Inter,system-ui,sans-serif">
      <div style="font-size:10px;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;margin-bottom:6px">${badge}</div>
      <div style="font-size:14px;font-weight:500;line-height:1.2;margin-bottom:2px">${escapeHtml(v.name)}</div>
      ${subtitle ? `<div style="font-size:11px;color:rgba(255,255,255,0.5)">${escapeHtml(subtitle)}</div>` : ''}
      <a href="/app/atlas/venue/${encodeURIComponent(v.id)}"
         data-haunt-venue-link="${escapeHtml(v.id)}"
         style="display:inline-block;margin-top:10px;font-size:10px;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;color:#E24B4A;text-decoration:none">
        OPEN LOCATION →
      </a>
    </div>
  `;
}

export const AtlasMap = forwardRef<AtlasMapHandle, Props>(function AtlasMap(
  { venues, selectedVenueId, onVenueClick, className = '' },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onVenueClickRef = useRef(onVenueClick);
  onVenueClickRef.current = onVenueClick;
  const didFitOnceRef = useRef(false);

  // Initialise the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [39.5, -98.5],
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Aggressive initial sizing: Leaflet can render tiles at 0x0 if the
    // container is briefly zero-height during mount. Repeatedly invalidate
    // for the first ~1s, then settle into the ResizeObserver pattern.
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      if (performance.now() - start < 1000) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      didFitOnceRef.current = false;
    };
  }, []);

  // Sync markers + popups to venue list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    const nextIds = new Set(venues.map((v) => v.id));

    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    for (const v of venues) {
      const selected = selectedVenueId === v.id;
      let marker = existing.get(v.id);

      if (!marker) {
        marker = L.marker([v.lat, v.lng], { icon: makeIcon(v, selected) });

        marker.on('click', () => {
          onVenueClickRef.current(v.id);
        });

        // Bind popup. We replace innerHTML each open so subtitle reflects edits.
        marker.bindPopup(popupHtml(v), {
          closeButton: true,
          autoPan: true,
          autoPanPadding: [40, 40],
        });

        marker.addTo(map);
        existing.set(v.id, marker);
      } else {
        marker.setLatLng([v.lat, v.lng]);
        marker.setIcon(makeIcon(v, selected));
        marker.setPopupContent(popupHtml(v));
      }
    }

    // Auto-fit ONCE when the first non-empty venue list lands.
    if (!didFitOnceRef.current && venues.length > 0) {
      const bounds = L.latLngBounds(venues.map((v) => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
      didFitOnceRef.current = true;
    }
  }, [venues, selectedVenueId]);

  // Open popup on selection change (e.g. when the user taps a card in the list).
  useEffect(() => {
    if (!selectedVenueId) return;
    const marker = markersRef.current.get(selectedVenueId);
    if (!marker) return;
    marker.openPopup();
  }, [selectedVenueId]);

  // Delegate the "OPEN VENUE" popup link to React Router-friendly navigation.
  // Without this, clicking the link inside a popup does a full page reload.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('[data-haunt-venue-link]') as HTMLElement | null;
      if (!anchor) return;
      // Let the browser navigate via history.pushState path if possible. To
      // avoid pulling in useNavigate (which can't be used outside React tree
      // for popup contents), we dispatch a custom event the page listens for.
      e.preventDefault();
      const id = anchor.getAttribute('data-haunt-venue-link');
      if (id) {
        window.dispatchEvent(new CustomEvent('haunt:open-venue', { detail: id }));
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat, lng, zoom = 13) => {
        mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
      },
    }),
    []
  );

  return <div ref={containerRef} className={className} />;
});
