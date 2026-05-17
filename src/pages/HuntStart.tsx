import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useHauntStore,
  EQUIPMENT_CATALOG,
  type EquipmentId,
  type Visibility,
  withinTolerance,
  distanceMeters,
  GPS_TOLERANCE_METERS,
  DEFAULT_EXPECTED_HOURS,
  MAX_EXPECTED_HOURS,
} from '../store/useHauntStore';
import { useGeolocation } from '../lib/useGeolocation';
import {
  MapPin,
  Plus,
  X,
  Globe,
  Lock,
  EyeOff,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type Step = 'visibility' | 'location' | 'equipment' | 'review';

export default function HuntStart() {
  const navigate = useNavigate();
  const startHunt = useHauntStore((s) => s.startHunt);
  const venues = useHauntStore((s) => s.venues);

  const [step, setStep] = useState<Step>('visibility');

  // Visibility + duration
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [hours, setHours] = useState<number>(DEFAULT_EXPECTED_HOURS);

  // Location
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [zone, setZone] = useState('');
  const geo = useGeolocation();

  // Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<Set<EquipmentId>>(new Set());
  const [customLabel, setCustomLabel] = useState('');
  const [customMap, setCustomMap] = useState<Record<string, string>>({});

  // Visibility helpers
  const requiresGps = visibility !== 'private';

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId]
  );

  // GPS verification state derived from the geo hook + selected venue (or new).
  const gpsGood = useMemo(() => {
    if (!geo.coords) return false;
    if (selectedVenue) {
      return withinTolerance(
        { lat: geo.coords.lat, lng: geo.coords.lng },
        { lat: selectedVenue.lat, lng: selectedVenue.lng }
      );
    }
    // New venue: GPS is auto-good as long as we have a fix.
    return true;
  }, [geo.coords, selectedVenue]);

  const distanceFromVenue = useMemo(() => {
    if (!geo.coords || !selectedVenue) return null;
    return Math.round(
      distanceMeters(
        { lat: geo.coords.lat, lng: geo.coords.lng },
        { lat: selectedVenue.lat, lng: selectedVenue.lng }
      )
    );
  }, [geo.coords, selectedVenue]);

  // Equipment helpers
  const toggleEquipment = (id: EquipmentId) => {
    const next = new Set(selectedEquipment);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedEquipment(next);
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const id = 'custom-' + Math.random().toString(36).slice(2, 8);
    setCustomMap({ ...customMap, [id]: label });
    setSelectedEquipment(new Set([...selectedEquipment, id]));
    setCustomLabel('');
  };

  const removeCustom = (id: string) => {
    const { [id]: _omit, ...rest } = customMap;
    setCustomMap(rest);
    const next = new Set(selectedEquipment);
    next.delete(id);
    setSelectedEquipment(next);
  };

  // Validation per step
  const canAdvanceVisibility = true;

  const venueChosen = !!selectedVenueId || newVenueName.trim().length > 0;
  const canAdvanceLocation = requiresGps
    ? venueChosen && !!geo.coords && gpsGood
    : venueChosen;

  const canStart = canAdvanceLocation; // equipment is optional

  const handleStart = () => {
    if (!canStart) return;

    const location = selectedVenue ? selectedVenue.name : newVenueName.trim();
    const lat = selectedVenue?.lat ?? geo.coords?.lat;
    const lng = selectedVenue?.lng ?? geo.coords?.lng;

    startHunt({
      venueId: selectedVenue?.id,
      location,
      zone: zone.trim() || undefined,
      lat,
      lng,
      visibility,
      gpsVerified: requiresGps && gpsGood,
      expectedDurationHours: hours,
      equipmentUsed: Array.from(selectedEquipment),
      customEquipment: Object.keys(customMap).length ? customMap : undefined,
    });

    navigate('/app/live');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-5xl font-medium tracking-tighter mb-2">START A HUNT</h1>
      <p className="text-white/60 mb-8">
        A few quick choices. Equipment is optional — you can log pure observations too.
      </p>

      {/* STEP RAIL */}
      <div className="flex items-center gap-2 mb-8 text-xs font-mono tracking-widest">
        {(['visibility', 'location', 'equipment', 'review'] as Step[]).map((s, i) => {
          const on = step === s;
          const done =
            (s === 'visibility' && step !== 'visibility') ||
            (s === 'location' &&
              (step === 'equipment' || step === 'review')) ||
            (s === 'equipment' && step === 'review');
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`px-2.5 py-1 rounded-md border ${
                  on
                    ? 'border-haunt-red text-haunt-red bg-haunt-red/10'
                    : done
                    ? 'border-white/20 text-white/60'
                    : 'border-white/10 text-white/30'
                }`}
              >
                {String(i + 1).padStart(2, '0')} · {s.toUpperCase()}
              </div>
              {i < 3 && <div className="w-3 h-px bg-white/10" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1 — VISIBILITY */}
      {step === 'visibility' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-4">VISIBILITY</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setVisibility('public')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                visibility === 'public'
                  ? 'bg-haunt-red/10 border-haunt-red'
                  : 'bg-black border-white/10 hover:border-white/30'
              }`}
            >
              <Globe className="w-5 h-5 mb-2" />
              <div className="font-medium">Public</div>
              <div className="text-xs text-white/50 mt-1">
                Your handle and location show on the live atlas.
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-2 tracking-widest">
                GPS REQUIRED
              </div>
            </button>

            <button
              onClick={() => setVisibility('anonymous')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                visibility === 'anonymous'
                  ? 'bg-haunt-red/10 border-haunt-red'
                  : 'bg-black border-white/10 hover:border-white/30'
              }`}
            >
              <EyeOff className="w-5 h-5 mb-2" />
              <div className="font-medium">Anonymous</div>
              <div className="text-xs text-white/50 mt-1">
                Location shows on the atlas; your handle is hidden.
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-2 tracking-widest">
                GPS REQUIRED
              </div>
            </button>

            <button
              onClick={() => setVisibility('private')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                visibility === 'private'
                  ? 'bg-haunt-red/10 border-haunt-red'
                  : 'bg-black border-white/10 hover:border-white/30'
              }`}
            >
              <Lock className="w-5 h-5 mb-2" />
              <div className="font-medium">Private</div>
              <div className="text-xs text-white/50 mt-1">
                Hidden from everyone. Only you see this hunt.
              </div>
              <div className="text-[10px] font-mono text-white/40 mt-2 tracking-widest">
                GPS OPTIONAL
              </div>
            </button>
          </div>

          {/* Expected duration */}
          <div className="border-t border-white/10 pt-6">
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              EXPECTED DURATION
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {[2, 4, 6, 8, 12, 18, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`px-3 py-2 rounded-xl text-sm border transition-all ${
                    hours === h
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-white/10 text-white/70 hover:border-white/30'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Your check-in expires at this time. Max {MAX_EXPECTED_HOURS}h.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2 — LOCATION */}
      {step === 'location' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-4 flex items-center gap-x-2">
            <MapPin className="w-4 h-4" /> LOCATION
          </div>

          {/* Known venues */}
          {venues.length > 0 && (
            <div className="mb-5">
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                PICK A KNOWN LOCATION
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {venues.map((v) => {
                  const on = selectedVenueId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVenueId(v.id);
                        setNewVenueName('');
                      }}
                      className={`px-4 py-3 rounded-xl border text-left transition-all ${
                        on
                          ? 'bg-haunt-red/10 border-haunt-red'
                          : 'bg-black border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="font-medium text-sm">{v.name}</div>
                      <div className="font-mono text-[10px] text-white/40 mt-1">
                        {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Or new venue */}
          <div className="mb-5">
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              {venues.length > 0 ? 'OR ADD A NEW LOCATION' : 'NEW LOCATION NAME'}{' '}
              <span className="text-haunt-red">*</span>
            </label>
            <input
              value={newVenueName}
              onChange={(e) => {
                setNewVenueName(e.target.value);
                if (e.target.value) setSelectedVenueId(null);
              }}
              placeholder="Bellamy House"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
            />
            <p className="text-xs text-white/40 mt-2">
              The location gets created from your current GPS the moment you start the hunt.
            </p>
          </div>

          {/* Zone */}
          <div className="mb-5">
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              SPECIFIC ZONE / ROOM (OPTIONAL)
            </label>
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="3rd floor corridor"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
            />
          </div>

          {/* GPS section */}
          {requiresGps ? (
            <div className="border-t border-white/10 pt-5">
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-3">
                GPS CHECK
              </label>

              {geo.status === 'idle' && (
                <button
                  onClick={() => geo.request()}
                  className="bg-haunt-red hover:bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-mono tracking-widest flex items-center gap-x-2 active:scale-[0.98] transition-all"
                >
                  <Crosshair className="w-4 h-4" /> CONFIRM I'M HERE
                </button>
              )}

              {geo.status === 'requesting' && (
                <div className="text-sm text-white/60 flex items-center gap-x-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-haunt-red rounded-full animate-spin" />
                  Asking your browser for location…
                </div>
              )}

              {(geo.status === 'denied' ||
                geo.status === 'unavailable' ||
                geo.status === 'error') && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 text-sm">
                  <div className="flex items-start gap-2 text-red-300 mb-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="font-medium">Location unavailable.</span>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed">
                    {geo.errorMsg}
                    <br />
                    You can switch this hunt to <b>Private</b> in the previous step to skip GPS, or
                    try again.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => geo.request()}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-mono tracking-widest"
                    >
                      RETRY
                    </button>
                    <button
                      onClick={() => {
                        setVisibility('private');
                        geo.reset();
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-mono tracking-widest"
                    >
                      MAKE PRIVATE INSTEAD
                    </button>
                  </div>
                </div>
              )}

              {geo.status === 'granted' && geo.coords && (
                <div
                  className={`rounded-xl p-4 border ${
                    gpsGood
                      ? 'bg-green-950/30 border-green-500/30 text-green-200'
                      : 'bg-red-950/30 border-red-500/30 text-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    {gpsGood ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <div className="font-medium text-sm">
                      {gpsGood ? "You're at the location." : 'Too far from the selected location.'}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-white/70 font-mono">
                    {geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)} · ±
                    {Math.round(geo.coords.accuracy)}m
                    {selectedVenue && distanceFromVenue !== null && (
                      <>
                        <br />
                        {distanceFromVenue}m from {selectedVenue.name} · tolerance is{' '}
                        {GPS_TOLERANCE_METERS}m
                      </>
                    )}
                  </p>
                  {!gpsGood && selectedVenue && (
                    <button
                      onClick={() => geo.request()}
                      className="mt-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-mono tracking-widest"
                    >
                      RECHECK
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-white/10 pt-5 text-xs text-white/40 font-mono tracking-wide leading-relaxed">
              Private hunts skip GPS. Your check-in won't be created and the location won't be added to
              the public atlas.
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — EQUIPMENT (OPTIONAL) */}
      {step === 'equipment' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-haunt-red tracking-widest">
              EQUIPMENT <span className="text-white/30">· OPTIONAL</span>
            </div>
            <div className="text-xs text-white/40">
              {selectedEquipment.size} SELECTED
            </div>
          </div>
          <p className="text-sm text-white/50 mb-4">
            Pick the gear you brought tonight. You can also log pure observations during the hunt
            with no device attached.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {EQUIPMENT_CATALOG.map((e) => {
              const on = selectedEquipment.has(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEquipment(e.id)}
                  className={`px-4 py-4 rounded-2xl border text-left transition-all ${
                    on
                      ? 'bg-haunt-red/10 border-haunt-red text-white'
                      : 'bg-black border-white/10 text-white/70 hover:border-white/30'
                  }`}
                >
                  <div className="font-mono text-xs tracking-widest text-white/40 mb-1">
                    {e.abbr}
                  </div>
                  <div className="font-medium text-sm">{e.name}</div>
                </button>
              );
            })}

            {Object.entries(customMap).map(([id, label]) => (
              <div
                key={id}
                className="px-4 py-4 rounded-2xl border border-haunt-red bg-haunt-red/10 flex items-start justify-between"
              >
                <div>
                  <div className="font-mono text-xs tracking-widest text-white/40 mb-1">
                    CUSTOM
                  </div>
                  <div className="font-medium text-sm">{label}</div>
                </div>
                <button
                  onClick={() => removeCustom(id)}
                  className="text-white/40 hover:text-white"
                  aria-label="Remove custom equipment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="Add custom device (e.g. Ovilus, motion sensor…)"
              className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-haunt-red outline-none"
            />
            <button
              onClick={addCustom}
              disabled={!customLabel.trim()}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl flex items-center gap-x-2 text-sm"
            >
              <Plus className="w-4 h-4" /> ADD
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — REVIEW */}
      {step === 'review' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6 space-y-4">
          <div className="text-xs font-mono text-haunt-red tracking-widest">REVIEW</div>

          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
              VISIBILITY · DURATION
            </div>
            <div className="text-sm">
              {visibility === 'public' && (
                <span className="text-green-400 inline-flex items-center gap-x-1">
                  <Globe className="w-3.5 h-3.5" /> Public
                </span>
              )}
              {visibility === 'anonymous' && (
                <span className="text-amber-400 inline-flex items-center gap-x-1">
                  <EyeOff className="w-3.5 h-3.5" /> Anonymous
                </span>
              )}
              {visibility === 'private' && (
                <span className="text-white/60 inline-flex items-center gap-x-1">
                  <Lock className="w-3.5 h-3.5" /> Private
                </span>
              )}{' '}
              · ~{hours} hours
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
              LOCATION
            </div>
            <div className="text-sm">
              {(selectedVenue?.name ?? newVenueName.trim()) || '—'}
              {zone && <span className="text-white/60"> · {zone}</span>}
            </div>
            {requiresGps && geo.coords && gpsGood && (
              <div className="text-[10px] font-mono text-white/40 tracking-widest mt-1">
                GPS VERIFIED · ±{Math.round(geo.coords.accuracy)}m
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
              EQUIPMENT ({selectedEquipment.size})
            </div>
            {selectedEquipment.size === 0 ? (
              <div className="text-sm text-white/40 italic">No gear. Observation-only hunt.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedEquipment).map((id) => {
                  const known = EQUIPMENT_CATALOG.find((e) => e.id === id);
                  const label = known?.name ?? customMap[id] ?? id;
                  return (
                    <span
                      key={id}
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NAV */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step === 'visibility') navigate(-1);
            else if (step === 'location') setStep('visibility');
            else if (step === 'equipment') setStep('location');
            else setStep('equipment');
          }}
          className="px-6 py-4 text-white/60 hover:text-white font-mono tracking-widest text-sm"
        >
          {step === 'visibility' ? 'CANCEL' : '← BACK'}
        </button>

        {step !== 'review' ? (
          <button
            onClick={() => {
              if (step === 'visibility' && canAdvanceVisibility) setStep('location');
              else if (step === 'location' && canAdvanceLocation) setStep('equipment');
              else if (step === 'equipment') setStep('review');
            }}
            disabled={
              (step === 'visibility' && !canAdvanceVisibility) ||
              (step === 'location' && !canAdvanceLocation)
            }
            className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-mono tracking-widest text-lg active:scale-[0.98] transition-all"
          >
            CONTINUE →
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-mono tracking-widest text-lg active:scale-[0.98] transition-all"
          >
            START HUNT →
          </button>
        )}
      </div>

      {step === 'location' && !canAdvanceLocation && (
        <p className="text-xs text-white/40 mt-3">
          {!venueChosen
            ? 'Pick a location or enter a new name.'
            : requiresGps && !geo.coords
            ? 'Confirm your GPS to continue.'
            : requiresGps && !gpsGood
            ? "You're outside the location's tolerance radius."
            : ''}
        </p>
      )}
    </div>
  );
}
