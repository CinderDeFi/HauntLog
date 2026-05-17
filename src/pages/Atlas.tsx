import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHauntStore, venueProfileUrl } from '../store/useHauntStore';
import {
  AtlasMap,
  type AtlasMapHandle,
} from '../components/AtlasMap';
import AtlasSheet, { SNAPS, type SnapIndex } from '../components/AtlasSheet';
import AtlasFilters, { type SourceFilter } from '../components/AtlasFilters';
import AtlasVenueRow from '../components/AtlasVenueRow';
import {
  Clock,
  EyeOff,
  Globe,
  MapPin,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';

function timeAgo(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function timeUntil(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'expired';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m left`;
  const h = Math.floor(min / 60);
  return `${h}h left`;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export default function Atlas() {
  const navigate = useNavigate();
  const venues = useHauntStore((s) => s.venues);
  const checkIns = useHauntStore((s) => s.checkIns);
  const cases = useHauntStore((s) => s.cases);
  const isDesktop = useIsDesktop();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Refresh active check-ins from Supabase on mount + every 60s while open.
  const loadActiveCheckIns = useHauntStore((s) => s.loadActiveCheckIns);
  useEffect(() => {
    loadActiveCheckIns();
    const t = setInterval(() => loadActiveCheckIns(), 60_000);
    return () => clearInterval(t);
  }, [loadActiveCheckIns]);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLiveSheet, setShowLiveSheet] = useState(false);
  // Track the sheet's snap position so we can size the map container to
  // sit ABOVE the sheet rather than behind it. Without this, touches in
  // the bottom half of the visible map area fall through to the sheet's
  // scrollable region instead of Leaflet.
  const [sheetSnap, setSheetSnap] = useState<SnapIndex>(1);
  const mapRef = useRef<AtlasMapHandle | null>(null);

  // Listen for "OPEN VENUE" link clicks inside Leaflet popups.
  useEffect(() => {
    const onOpenVenue = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const v = venues.find((x) => x.id === id);
      navigate(v ? venueProfileUrl(v) : `/app/atlas/venue/${encodeURIComponent(id)}`);
    };
    window.addEventListener('haunt:open-venue', onOpenVenue);
    return () => window.removeEventListener('haunt:open-venue', onOpenVenue);
  }, [navigate, venues]);

  // Lock document scroll while the Atlas is mounted. Prevents mobile
  // browsers from interpreting map pans/pinches as page scrolls or
  // pull-to-refresh gestures.
  useEffect(() => {
    document.body.classList.add('atlas-mode');
    return () => {
      document.body.classList.remove('atlas-mode');
    };
  }, []);

  const liveCheckIns = useMemo(
    () => checkIns.filter((ci) => ci.active && new Date(ci.expiresAt).getTime() > now),
    [checkIns, now]
  );

  const publicCaseCountByVenue = useMemo(() => {
    const map = new Map<string, number>();
    cases.forEach((c) => {
      if (c.visibility === 'private') return;
      if (!c.venueId) return;
      map.set(c.venueId, (map.get(c.venueId) ?? 0) + 1);
    });
    return map;
  }, [cases]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    venues.forEach((v) => v.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [venues]);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = venues;
    if (source !== 'all') list = list.filter((v) => v.source === source);
    if (tagFilter) list = list.filter((v) => v.tags?.includes(tagFilter));
    if (q) {
      list = list.filter((v) => {
        if (v.name.toLowerCase().includes(q)) return true;
        if (v.address?.city?.toLowerCase().includes(q)) return true;
        if (v.address?.state?.toLowerCase().includes(q)) return true;
        if (v.tags?.some((t) => t.includes(q))) return true;
        if (v.description?.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return [...list].sort((a, b) => {
      if (a.source !== b.source) return a.source === 'catalog' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [venues, source, tagFilter, search]);

  const activeFilterCount =
    (source !== 'all' ? 1 : 0) + (tagFilter ? 1 : 0) + (search ? 1 : 0);

  const onVenueSelect = (id: string) => {
    setSelectedVenueId(id);
    const v = venues.find((x) => x.id === id);
    if (v) mapRef.current?.flyTo(v.lat, v.lng, 13);
  };

  // ============================================================
  // Shared
  // ============================================================
  const LiveNowChip = (
    <button
      onClick={() => setShowLiveSheet(true)}
      disabled={liveCheckIns.length === 0}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-widest border transition-all ${
        liveCheckIns.length === 0
          ? 'bg-zinc-900/80 border-white/10 text-white/30 cursor-default'
          : 'bg-zinc-900/90 border-haunt-red/40 text-haunt-red hover:bg-haunt-red/10'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {liveCheckIns.length > 0 && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            liveCheckIns.length > 0 ? 'bg-haunt-red' : 'bg-white/20'
          }`}
        />
      </span>
      {liveCheckIns.length === 0 ? 'NOBODY ON SITE' : `${liveCheckIns.length} LIVE`}
    </button>
  );

  const FiltersButton = (
    <button
      onClick={() => setShowFilters(true)}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-widest border bg-zinc-900/90 border-white/10 text-white/80 hover:border-white/30"
    >
      <SlidersHorizontal className="w-3.5 h-3.5" />
      FILTERS
      {activeFilterCount > 0 && (
        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-haunt-red text-[9px] text-white">
          {activeFilterCount}
        </span>
      )}
    </button>
  );

  const VenueList = (
    <div className="space-y-2 p-3 md:p-4">
      <div className="text-[10px] font-mono tracking-widest text-white/40 flex items-center justify-between">
        <span>
          {filteredVenues.length} {filteredVenues.length === 1 ? 'LOCATION' : 'LOCATIONS'}
        </span>
        {selectedVenueId && (
          <button
            onClick={() => setSelectedVenueId(null)}
            className="text-white/40 hover:text-white"
          >
            CLEAR SELECTION
          </button>
        )}
      </div>
      {filteredVenues.length === 0 ? (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center text-white/40 text-sm">
          {venues.length === 0 ? 'No locations in the atlas yet.' : 'No locations match your filters.'}
        </div>
      ) : (
        filteredVenues.map((v) => (
          <AtlasVenueRow
            key={v.id}
            venue={v}
            caseCount={publicCaseCountByVenue.get(v.id) ?? 0}
            isSelected={selectedVenueId === v.id}
            onSelect={() => onVenueSelect(v.id)}
          />
        ))
      )}
    </div>
  );

  // ============================================================
  // DESKTOP
  // ============================================================
  if (isDesktop) {
    return (
      <div className="relative h-full grid grid-cols-2">
        <div className="relative border-r border-white/10">
          <AtlasMap
            ref={mapRef}
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            onVenueClick={onVenueSelect}
            className="absolute inset-0"
          />
          <div className="absolute top-4 left-4 flex gap-2 z-[1000]">
            {LiveNowChip}
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="p-6 border-b border-white/10 sticky top-0 bg-black/90 backdrop-blur z-10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h1 className="text-3xl font-medium tracking-tighter">THE ATLAS</h1>
              <Link
                to="/app/venues/submit"
                className="inline-flex items-center gap-x-1.5 px-3 py-2 rounded-xl bg-haunt-red hover:bg-red-600 text-white text-xs font-mono tracking-widest shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> ADD VENUE
              </Link>
            </div>
            <AtlasFilters
              search={search}
              onSearchChange={setSearch}
              source={source}
              onSourceChange={setSource}
              allTags={allTags}
              tagFilter={tagFilter}
              onTagChange={setTagFilter}
            />
          </div>
          {VenueList}
        </div>

        {showLiveSheet && (
          <LiveSheet
            checkIns={liveCheckIns}
            now={now}
            onClose={() => setShowLiveSheet(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================
  // MOBILE
  // ============================================================
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        // Prevent the page below from receiving scroll/pan when the
        // user pans the map. Without this, mobile browsers fall through
        // touch gestures to the underlying scrollable parent.
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
    >
      {/* Map container — explicit height that ends at the sheet's top
          edge. This is what fixes the "touch falls through to the sheet"
          bug: the map is now physically smaller, so touches in the lower
          half of the screen don't even hit the map element at all — they
          hit the sheet directly (which is what the user expects). */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `calc(100% - ${SNAPS[sheetSnap] * 100}vh)` }}
      >
        <AtlasMap
          ref={mapRef}
          venues={filteredVenues}
          selectedVenueId={selectedVenueId}
          onVenueClick={onVenueSelect}
          className="absolute inset-0"
        />
      </div>

      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 z-[400] pointer-events-none">
        <div className="pointer-events-auto">{LiveNowChip}</div>
        <div className="flex-1" />
        <div className="pointer-events-auto">{FiltersButton}</div>
      </div>

      <AtlasSheet initialSnap={1} onSnapChange={setSheetSnap}>
        <div className="border-b border-white/10 px-4 py-3 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xl font-medium tracking-tighter">THE ATLAS</h2>
              <p className="text-white/40 text-xs mt-0.5">
                Drag the handle. Tap a pin or row to fly the map.
              </p>
            </div>
            <Link
              to="/app/venues/submit"
              className="inline-flex items-center gap-x-1.5 px-3 py-2 rounded-xl bg-haunt-red hover:bg-red-600 text-white text-[10px] font-mono tracking-widest shrink-0"
            >
              <Plus className="w-3 h-3" /> ADD
            </Link>
          </div>
        </div>
        {VenueList}
      </AtlasSheet>

      {showFilters && (
        <FiltersOverlay onClose={() => setShowFilters(false)}>
          <AtlasFilters
            search={search}
            onSearchChange={setSearch}
            source={source}
            onSourceChange={setSource}
            allTags={allTags}
            tagFilter={tagFilter}
            onTagChange={setTagFilter}
          />
        </FiltersOverlay>
      )}

      {showLiveSheet && (
        <LiveSheet
          checkIns={liveCheckIns}
          now={now}
          onClose={() => setShowLiveSheet(false)}
        />
      )}
    </div>
  );
}

function LiveSheet({
  checkIns,
  now,
  onClose,
}: {
  checkIns: ReturnType<typeof useHauntStore.getState>['checkIns'];
  now: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-3xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-zinc-950">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-haunt-red"></span>
            </span>
            <div className="text-xs font-mono text-haunt-red tracking-widest">
              LIVE NOW · {checkIns.length}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {checkIns.length === 0 ? (
          <div className="p-6 text-center text-white/40 text-sm">
            Nobody is checked in right now.
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {checkIns.map((ci) => (
              <div
                key={ci.id}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-x-2 text-xs font-mono tracking-widest">
                    {ci.visibility === 'public' ? (
                      <span className="text-green-400 inline-flex items-center gap-x-1">
                        <Globe className="w-3 h-3" /> PUBLIC
                      </span>
                    ) : (
                      <span className="text-amber-400 inline-flex items-center gap-x-1">
                        <EyeOff className="w-3 h-3" /> ANONYMOUS
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-white/40 inline-flex items-center gap-x-1">
                    <Clock className="w-3 h-3" /> {timeUntil(ci.expiresAt, now)}
                  </div>
                </div>
                <div className="flex items-start gap-x-2 text-base font-medium">
                  <MapPin className="w-4 h-4 text-haunt-red mt-1 shrink-0" />
                  {ci.venueName}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Checked in {timeAgo(ci.startedAt, now)} ·{' '}
                  {ci.visibility === 'anonymous'
                    ? 'investigator on site'
                    : ci.ownerHandle}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FiltersOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full bg-zinc-950 border-t border-white/10 rounded-t-3xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-zinc-950">
          <div className="text-xs font-mono text-haunt-red tracking-widest">FILTERS</div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="p-5 pt-0">
          <button
            onClick={onClose}
            className="w-full bg-haunt-red hover:bg-red-600 text-white py-3 rounded-xl font-mono tracking-widest text-sm"
          >
            APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
