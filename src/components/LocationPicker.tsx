import { useEffect, useMemo, useRef, useState } from 'react';
import { useHauntStore, distanceMeters, type Venue, type Coords } from '../store/useHauntStore';
import {
  MapPin,
  Search,
  X,
  ChevronDown,
  Plus,
  Crosshair,
  CheckCircle2,
} from 'lucide-react';

type Props = {
  selectedVenueId: string | null;
  newVenueName: string;
  here: Coords | null;
  onPickVenue: (id: string) => void;
  onClearVenue: () => void;
  onTypeNewVenue: (name: string) => void;
};

const AUTO_DETECT_RADIUS_METERS = 500;

function formatVenueLocation(v: Venue): string {
  const parts: string[] = [];
  if (v.address?.city) parts.push(v.address.city);
  if (v.address?.state) parts.push(v.address.state);
  if (v.address?.country && v.address.country !== 'USA') parts.push(v.address.country);
  return parts.join(', ');
}

export default function LocationPicker({
  selectedVenueId,
  newVenueName,
  here,
  onPickVenue,
  onClearVenue,
  onTypeNewVenue,
}: Props) {
  const venues = useHauntStore((s) => s.venues);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Find the selected venue (if any).
  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId]
  );

  // GPS-detected nearby venue: anything within 500m. Picks the closest.
  // Used to auto-suggest a selection when the user opens the picker.
  const autoDetected = useMemo<Venue | null>(() => {
    if (!here) return null;
    let best: { v: Venue; d: number } | null = null;
    for (const v of venues) {
      const d = distanceMeters(here, { lat: v.lat, lng: v.lng });
      if (d <= AUTO_DETECT_RADIUS_METERS && (!best || d < best.d)) {
        best = { v, d };
      }
    }
    return best?.v ?? null;
  }, [here, venues]);

  // One-time auto-select: if GPS picks up a nearby venue and the user
  // hasn't chosen anything yet, pre-fill it.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current) return;
    if (selectedVenueId || newVenueName) return;
    if (autoDetected) {
      didAutoSelect.current = true;
      onPickVenue(autoDetected.id);
    }
  }, [autoDetected, selectedVenueId, newVenueName, onPickVenue]);

  // Filter venues by case-insensitive substring against name, city, state.
  // Cheap, predictable, fast enough for thousands of rows.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? venues.filter((v) => {
          const hay =
            v.name.toLowerCase() +
            ' ' +
            (v.address?.city ?? '').toLowerCase() +
            ' ' +
            (v.address?.state ?? '').toLowerCase() +
            ' ' +
            (v.address?.country ?? '').toLowerCase();
          return hay.includes(q);
        })
      : venues;
    // Sort: exact-match-on-name first, then alphabetical.
    return [...list].sort((a, b) => {
      if (q) {
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [venues, query]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreateMode(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Focus the search input when the dropdown opens.
  useEffect(() => {
    if (open && !createMode) inputRef.current?.focus();
  }, [open, createMode]);

  const handlePick = (id: string) => {
    onPickVenue(id);
    setOpen(false);
    setQuery('');
    setCreateMode(false);
  };

  const handleSwitchToCreate = () => {
    setCreateMode(true);
    // Pre-fill the new name with the current search query.
    if (query.trim()) onTypeNewVenue(query.trim());
  };

  const isCreatingNew = newVenueName.trim().length > 0 && !selectedVenueId;

  return (
    <div className="mb-5" ref={wrapperRef}>
      <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
        LOCATION <span className="text-haunt-red">*</span>
      </label>

      {/* TRIGGER BUTTON / "input" — shows selected venue or new venue name */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className={`w-full text-left bg-black border rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
            open ? 'border-haunt-red' : 'border-white/10 hover:border-white/30'
          }`}
        >
          <div className="flex items-center gap-x-2 min-w-0">
            <MapPin className="w-4 h-4 text-white/40 shrink-0" />
            <div className="min-w-0 flex-1">
              {selectedVenue ? (
                <>
                  <div className="text-sm truncate">{selectedVenue.name}</div>
                  {formatVenueLocation(selectedVenue) && (
                    <div className="text-[10px] font-mono text-white/40 truncate">
                      {formatVenueLocation(selectedVenue)}
                    </div>
                  )}
                </>
              ) : isCreatingNew ? (
                <>
                  <div className="text-sm truncate">{newVenueName}</div>
                  <div className="text-[10px] font-mono text-haunt-red">NEW LOCATION</div>
                </>
              ) : (
                <span className="text-sm text-white/40">Pick a location or add a new one…</span>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* DROPDOWN */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-950 border border-white/10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden">
            {!createMode && (
              <>
                {/* Search box */}
                <div className="p-3 border-b border-white/5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, city, state…"
                      className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:border-haunt-red outline-none"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/40"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto-detected callout */}
                {autoDetected && !query && (
                  <button
                    onClick={() => handlePick(autoDetected.id)}
                    className="w-full px-4 py-3 text-left bg-haunt-red/10 hover:bg-haunt-red/20 border-b border-white/5 flex items-center gap-x-3"
                  >
                    <Crosshair className="w-4 h-4 text-haunt-red shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-haunt-red tracking-widest">
                        DETECTED NEARBY
                      </div>
                      <div className="text-sm truncate">{autoDetected.name}</div>
                    </div>
                    {autoDetected.id === selectedVenueId && (
                      <CheckCircle2 className="w-4 h-4 text-haunt-red shrink-0" />
                    )}
                  </button>
                )}

                {/* Results list */}
                <div className="max-h-80 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-white/40">
                      No locations match "{query}".
                    </div>
                  ) : (
                    filtered.map((v) => {
                      const on = v.id === selectedVenueId;
                      const sub = formatVenueLocation(v);
                      return (
                        <button
                          key={v.id}
                          onClick={() => handlePick(v.id)}
                          className={`w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center justify-between gap-3 ${
                            on ? 'bg-haunt-red/5' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{v.name}</div>
                            {sub && (
                              <div className="text-[10px] font-mono text-white/40 truncate">
                                {sub}
                              </div>
                            )}
                          </div>
                          {on && (
                            <CheckCircle2 className="w-4 h-4 text-haunt-red shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer — "Can't find it?" */}
                <button
                  onClick={handleSwitchToCreate}
                  className="w-full px-4 py-3 border-t border-white/10 bg-zinc-900 hover:bg-zinc-800 flex items-center gap-x-2 text-sm"
                >
                  <Plus className="w-4 h-4 text-haunt-red" />
                  <span>
                    Can't find it? <span className="text-haunt-red">Add a new location</span>
                  </span>
                </button>
              </>
            )}

            {/* CREATE-NEW MODE */}
            {createMode && (
              <div className="p-4">
                <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
                  <Plus className="w-3.5 h-3.5" /> ADD A NEW LOCATION
                </div>
                <input
                  autoFocus
                  type="text"
                  value={newVenueName}
                  onChange={(e) => {
                    onTypeNewVenue(e.target.value);
                    if (e.target.value && selectedVenueId) onClearVenue();
                  }}
                  placeholder="Bellamy House"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none mb-2"
                />
                <p className="text-xs text-white/40 mb-3">
                  Created from your current GPS the moment you start the hunt.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreateMode(false);
                      onTypeNewVenue('');
                    }}
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest"
                  >
                    BACK TO SEARCH
                  </button>
                  <button
                    onClick={() => {
                      if (newVenueName.trim()) setOpen(false);
                    }}
                    disabled={!newVenueName.trim()}
                    className="flex-1 px-3 py-2 bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 rounded-xl text-xs font-mono tracking-widest"
                  >
                    USE THIS NAME
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear-selected helper (small text link below the picker) */}
      {(selectedVenue || isCreatingNew) && !open && (
        <button
          onClick={() => {
            onClearVenue();
            onTypeNewVenue('');
            didAutoSelect.current = false;
          }}
          className="text-xs text-white/40 hover:text-white mt-1.5"
        >
          Change location
        </button>
      )}
    </div>
  );
}
