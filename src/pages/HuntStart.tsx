import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../lib/useAuth';
import {
  fetchMyTeams,
  type TeamMembershipWithTeam,
} from '../lib/teamActions';
import {
  fetchLoadouts,
  createLoadout,
  deleteLoadout,
  MAX_LOADOUTS_PER_USER,
  type EquipmentLoadoutRow,
  listInvestigationGroups,
  fetchInvestigationMembers,
  createInvestigationGroupWithMembers,
  joinInvestigationGroup,
} from '../lib/dataLayer';
import { useToast } from '../components/ui/Toast';
import LocationPicker from '../components/LocationPicker';
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
  User as UserIcon,
  Users as UsersIcon,
  Users,
  UsersRound,
  BadgeCheck,
  Sparkles,
  Radio,
  Layers,
  Check,
  Loader2,
} from 'lucide-react';

type Step = 'visibility' | 'location' | 'group' | 'equipment' | 'review';

export default function HuntStart() {
  const navigate = useNavigate();
  const startHunt = useHauntStore((s) => s.startHunt);
  const venues = useHauntStore((s) => s.venues);
  const { user: authUser } = useAuth();

  const [step, setStep] = useState<Step>('visibility');

  // Visibility + duration
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [hours, setHours] = useState<number>(DEFAULT_EXPECTED_HOURS);

  // Team identity — "personal" by default; can switch to one of the user's teams.
  // Null = hunt as yourself. Non-null = hunt on behalf of this team id.
  const [teamId, setTeamId] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<TeamMembershipWithTeam[]>([]);

  // Load the user's teams once at mount so the picker has options ready.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchMyTeams(authUser.id);
        if (!cancelled) setMyTeams(list);
      } catch {
        /* best-effort; team picker just won't show */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Location
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [zone, setZone] = useState('');
  const geo = useGeolocation();

  // Eagerly request GPS the moment the user lands on the location step.
  // We want a fix in hand by the time the LocationPicker opens, so
  // "DETECTED NEARBY" lights up without an extra click.
  useEffect(() => {
    if (step === 'location' && geo.status === 'idle') {
      geo.request();
    }
  }, [step, geo]);

  // Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<Set<EquipmentId>>(new Set());
  const [customLabel, setCustomLabel] = useState('');
  const [customMap, setCustomMap] = useState<Record<string, string>>({});

  // Loadouts: saved presets the user can apply with one tap.
  const [loadouts, setLoadouts] = useState<EquipmentLoadoutRow[]>([]);
  const [loadoutsLoading, setLoadoutsLoading] = useState(true);
  const [savingLoadout, setSavingLoadout] = useState(false);
  const [showSaveLoadout, setShowSaveLoadout] = useState(false);
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const toast = useToast();

  // Fetch loadouts once on mount.
  useEffect(() => {
    if (!authUser) {
      setLoadoutsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await fetchLoadouts(authUser.id);
      if (!cancelled) {
        setLoadouts(list);
        setLoadoutsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Step 26: load this investigation's groups + members so the
  // GROUP step can show options + tag candidates.
  useEffect(() => {
    const investigationId = searchParams.get('investigation');
    if (!investigationId) return;
    let cancelled = false;
    setGroupsLoading(true);
    (async () => {
      try {
        const [g, m] = await Promise.all([
          listInvestigationGroups(investigationId),
          fetchInvestigationMembers(investigationId),
        ]);
        if (cancelled) return;
        setInvestigationGroups(
          g.map((x) => ({
            id: x.id,
            zone: x.zone,
            leader_handle: x.leader_handle,
            member_count: x.member_count,
            ended_at: x.ended_at,
          }))
        );
        setInvestigationMembers(
          m.map((x) => ({
            user_id: x.user_id,
            handle: x.handle,
            display_name: x.display_name,
            avatar_url: x.avatar_url,
          }))
        );
      } catch {
        // Non-fatal — group step still works, just empty.
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Starter setup: when arriving via ?starter=1 (from the LiveHunt empty
  // state), prefill some reasonable defaults so a first-time user can
  // get a feel for the flow without picking everything from scratch.
  // Runs once on mount only.
  const [searchParams] = useSearchParams();

  // Step 24: investigation umbrella. If the user came from the
  // investigation view via "START MY HUNT", prefill the location and
  // remember the investigation id so we can auto-link on seal.
  const investigationParam = searchParams.get('investigation');
  const investigationLocationParam = searchParams.get('location');
  const investigationVenueParam = searchParams.get('venue');
  // Step 25: group umbrella. When set, hunt auto-links to a group too.
  const groupParam = searchParams.get('group');
  const groupZoneParam = searchParams.get('zone');

  // Step 26: the GROUP step only appears when starting under an
  // investigation. Solo hunts don't see it.
  const STEPS: Step[] = investigationParam
    ? ['visibility', 'location', 'group', 'equipment', 'review']
    : ['visibility', 'location', 'equipment', 'review'];

  // GOING SOLO override: when set, the hunt is part of the investigation
  // but NOT a specific group. Toggleable in-page so the user can flip
  // their mind without going back.
  const [goingSolo, setGoingSolo] = useState(false);

  // Step 26: in-flow group selection. Only relevant when starting
  // under an active investigation.
  // groupMode = 'create' | 'join' | 'solo'
  type GroupMode = 'create' | 'join' | 'solo';
  const [groupMode, setGroupMode] = useState<GroupMode>(
    // If the URL provided a group param, default to join mode preselected.
    searchParams.get('group') ? 'join' : 'solo'
  );
  const [groupZoneInput, setGroupZoneInput] = useState('');
  const [selectedJoinGroupId, setSelectedJoinGroupId] = useState<string | null>(
    searchParams.get('group')
  );
  const [tagSelections, setTagSelections] = useState<Set<string>>(new Set());
  const [investigationGroups, setInvestigationGroups] = useState<
    Array<{
      id: string;
      zone: string;
      leader_handle: string | null;
      member_count: number;
      ended_at: string | null;
    }>
  >([]);
  const [investigationMembers, setInvestigationMembers] = useState<
    Array<{
      user_id: string;
      handle: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>
  >([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('starter') === '1') {
      setNewVenueName('Old Lyon Theatre (sample)');
      setZone('Stage left');
      setSelectedEquipment(new Set<EquipmentId>(['k2', 'rempod', 'sb7', 'thermal']));
    }
    if (investigationParam) {
      if (investigationLocationParam) {
        // Prefill the new-venue field with the investigation's location.
        setNewVenueName(investigationLocationParam);
      }
      if (investigationVenueParam) {
        // If the investigation references a real venue id, select it.
        setSelectedVenueId(investigationVenueParam);
      }
      // Step 25: if the user is in a group, prefill the zone so it
      // appears on their case file too.
      if (groupZoneParam) {
        setZone(groupZoneParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ------- Loadout handlers -------
  const applyLoadout = (lo: EquipmentLoadoutRow) => {
    const next = new Set<EquipmentId>(lo.equipment_ids);
    setSelectedEquipment(next);
    if (lo.custom_equipment && Object.keys(lo.custom_equipment).length > 0) {
      // Merge custom labels in for any custom ids included.
      setCustomMap((prev) => ({ ...prev, ...lo.custom_equipment }));
    }
    toast.success(`Loaded "${lo.name}"`);
  };

  const handleSaveLoadout = async () => {
    if (!authUser) return;
    const name = newLoadoutName.trim();
    if (!name) {
      toast.error('Give the loadout a name');
      return;
    }
    if (selectedEquipment.size === 0) {
      toast.error('Pick at least one piece of equipment first');
      return;
    }
    if (loadouts.length >= MAX_LOADOUTS_PER_USER) {
      toast.error(`You can save up to ${MAX_LOADOUTS_PER_USER} loadouts`, {
        description: 'Delete an old one to make room.',
      });
      return;
    }
    setSavingLoadout(true);
    const res = await createLoadout({
      userId: authUser.id,
      name,
      equipmentIds: Array.from(selectedEquipment).map(String),
      customEquipment: Object.keys(customMap).length > 0 ? customMap : undefined,
    });
    setSavingLoadout(false);
    if (!res.ok) {
      toast.error('Could not save loadout', { description: res.error });
      return;
    }
    setLoadouts((prev) => [res.row, ...prev]);
    setNewLoadoutName('');
    setShowSaveLoadout(false);
    toast.success(`Saved "${res.row.name}"`);
  };

  const handleDeleteLoadout = async (lo: EquipmentLoadoutRow) => {
    if (!confirm(`Delete the "${lo.name}" loadout?`)) return;
    const res = await deleteLoadout(lo.id);
    if (!res.ok) {
      toast.error('Could not delete', { description: res.error });
      return;
    }
    setLoadouts((prev) => prev.filter((l) => l.id !== lo.id));
    toast.success('Loadout deleted');
  };

  // Validation per step
  const canAdvanceVisibility = true;

  const venueChosen = !!selectedVenueId || newVenueName.trim().length > 0;
  const canAdvanceLocation = requiresGps
    ? venueChosen && !!geo.coords && gpsGood
    : venueChosen;

  // Step 26: group-step validation.
  // - 'solo': always OK (no commitment)
  // - 'join': must have picked a group
  // - 'create': must have typed a zone name
  const canAdvanceGroup =
    !investigationParam ||
    groupMode === 'solo' ||
    (groupMode === 'join' && !!selectedJoinGroupId) ||
    (groupMode === 'create' && groupZoneInput.trim().length > 0);

  const canStart = canAdvanceLocation; // equipment is optional

  const [starting, setStarting] = useState(false);
  const handleStart = async () => {
    if (!canStart || starting) return;

    const location = selectedVenue ? selectedVenue.name : newVenueName.trim();
    const lat = selectedVenue?.lat ?? geo.coords?.lat;
    const lng = selectedVenue?.lng ?? geo.coords?.lng;

    const selectedTeam = teamId ? myTeams.find((m) => m.team_id === teamId) : null;

    // Step 26: resolve the group choice before launching.
    let finalGroupId: string | undefined;
    let finalZone: string | undefined = zone.trim() || undefined;

    if (investigationParam) {
      setStarting(true);
      try {
        if (groupMode === 'create' && groupZoneInput.trim()) {
          const res = await createInvestigationGroupWithMembers(
            investigationParam,
            groupZoneInput.trim(),
            Array.from(tagSelections)
          );
          if (!res.ok) {
            setStarting(false);
            toast.error('Could not create group', { description: res.error });
            return;
          }
          finalGroupId = res.id;
          // Use the new group's zone as the case's zone if user hasn't set one.
          if (!finalZone) finalZone = groupZoneInput.trim();
        } else if (groupMode === 'join' && selectedJoinGroupId) {
          const res = await joinInvestigationGroup(selectedJoinGroupId);
          if (!res.ok) {
            setStarting(false);
            toast.error('Could not join group', { description: res.error });
            return;
          }
          finalGroupId = selectedJoinGroupId;
          // Use the joined group's zone if user hasn't set one.
          if (!finalZone) {
            const joined = investigationGroups.find((g) => g.id === selectedJoinGroupId);
            if (joined) finalZone = joined.zone;
          }
        }
        // groupMode === 'solo' leaves finalGroupId undefined.
      } catch (e) {
        setStarting(false);
        toast.error('Could not set up group', {
          description: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      setStarting(false);
    }

    // Backwards-compat: if the page was opened with ?group=... and the
    // user didn't change the GROUP step away from the default, honor it.
    if (!finalGroupId && groupParam && !goingSolo) {
      finalGroupId = groupParam;
    }

    startHunt({
      userId: authUser?.id,
      venueId: selectedVenue?.id,
      location,
      zone: finalZone,
      lat,
      lng,
      visibility,
      gpsVerified: requiresGps && gpsGood,
      expectedDurationHours: hours,
      equipmentUsed: Array.from(selectedEquipment),
      customEquipment: Object.keys(customMap).length ? customMap : undefined,
      teamId: teamId ?? undefined,
      teamName: selectedTeam?.team.name,
      teamSlug: selectedTeam?.team.slug,
      investigationId: investigationParam ?? undefined,
      groupId: finalGroupId,
    });

    navigate('/app/live');
  };

  const isStarter = searchParams.get('starter') === '1';

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-3xl md:text-5xl font-medium tracking-tighter mb-2">START A HUNT</h1>
      <p className="text-white/60 mb-6 md:mb-8 text-sm md:text-base">
        A few quick choices. Equipment is optional — you can log pure observations too.
      </p>

      {isStarter && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-amber-300 mb-1">
              Sample setup loaded
            </div>
            <p className="text-xs text-amber-200/80">
              Location, zone, and gear are pre-filled so you can walk through the flow. Change anything you want — your first hunt will save as a real case in your Vault.
            </p>
          </div>
        </div>
      )}

      {/* Investigation umbrella banner */}
      {investigationParam && (
        <div className="bg-haunt-red/5 border border-haunt-red/30 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Radio className="w-5 h-5 text-haunt-red shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-haunt-red mb-1">
                Hunting under a team investigation
              </div>
              <p className="text-xs text-white/70">
                Your sealed case will auto-link to{' '}
                {investigationLocationParam ? (
                  <strong>{investigationLocationParam}</strong>
                ) : (
                  'this investigation'
                )}{' '}
                so your team can see everyone's findings together.
              </p>
              {groupParam && groupZoneParam && (
                <p className="text-xs text-white/70 mt-1">
                  Group:{' '}
                  <strong className="text-white">
                    {goingSolo ? <s>{groupZoneParam}</s> : groupZoneParam}
                  </strong>
                  {goingSolo && (
                    <span className="text-white/40"> (going solo)</span>
                  )}
                </p>
              )}
            </div>
            {groupParam && (
              <label className="shrink-0 inline-flex items-center gap-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={goingSolo}
                  onChange={(e) => setGoingSolo(e.target.checked)}
                  className="w-3.5 h-3.5 accent-haunt-red"
                />
                <span className="text-[10px] font-mono tracking-widest text-white/70">
                  GOING SOLO
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* STEP RAIL — compact on mobile (numbered dots + current label),
          full pills on desktop. */}
      <div className="mb-6 md:mb-8">
        {/* Mobile: dots + active label */}
        <div className="md:hidden">
          <div className="flex items-center gap-1.5 mb-2">
            {STEPS.map((s, i) => {
              const stepIdx = STEPS.indexOf(step);
              const myIdx = STEPS.indexOf(s);
              const on = step === s;
              const done = myIdx < stepIdx;
              return (
                <div key={s} className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`flex-1 h-1 rounded-full transition-colors ${
                      on ? 'bg-haunt-red' : done ? 'bg-white/40' : 'bg-white/10'
                    }`}
                  />
                  {i === STEPS.length - 1 && (
                    <span className="font-mono text-[10px] tracking-widest text-white/40 shrink-0">
                      {String(STEPS.indexOf(step) + 1)}/{STEPS.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="font-mono text-xs tracking-widest text-haunt-red">
            STEP{' '}
            {String(STEPS.indexOf(step) + 1).padStart(2, '0')} ·{' '}
            {step === 'visibility'
              ? 'IDENTITY'
              : step === 'location'
              ? 'LOCATION'
              : step === 'group'
              ? 'GROUP'
              : step === 'equipment'
              ? 'EQUIPMENT'
              : 'REVIEW'}
          </div>
        </div>

        {/* Desktop: full pill row */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono tracking-widest">
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.indexOf(step);
            const myIdx = STEPS.indexOf(s);
            const on = step === s;
            const done = myIdx < stepIdx;
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
                {i < STEPS.length - 1 && <div className="w-3 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1 — VISIBILITY */}
      {step === 'visibility' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 md:p-6 mb-6">
          {/* Team picker — only shows if user is on at least one team */}
          {myTeams.length > 0 && (
            <div className="mb-6 pb-6 border-b border-white/10">
              <div className="text-xs font-mono text-haunt-red tracking-widest mb-3">
                HUNTING AS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setTeamId(null)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                    teamId === null
                      ? 'bg-haunt-red/10 border-haunt-red'
                      : 'bg-black border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">Just me</div>
                    <div className="text-[10px] text-white/50">Personal case</div>
                  </div>
                </button>

                {myTeams.map((m) => {
                  const on = teamId === m.team_id;
                  return (
                    <button
                      key={m.team_id}
                      onClick={() => setTeamId(m.team_id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        on
                          ? 'bg-haunt-red/10 border-haunt-red'
                          : 'bg-black border-white/10 hover:border-white/30'
                      }`}
                    >
                      {m.team.logo_url ? (
                        <img
                          src={m.team.logo_url}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.team.name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm inline-flex items-center gap-x-1">
                          <span className="truncate">{m.team.name}</span>
                          {m.team.verified && (
                            <BadgeCheck className="w-3 h-3 text-haunt-red shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-white/40 truncate">
                          @{m.team.slug}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-white/40 mt-2 inline-flex items-center gap-x-1.5">
                <UsersIcon className="w-3 h-3" />
                {teamId
                  ? 'This case will appear on the team profile.'
                  : 'Sealed case stays on your personal profile.'}
              </p>
            </div>
          )}

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
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 md:p-6 mb-6">
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-4 flex items-center gap-x-2">
            <MapPin className="w-4 h-4" /> LOCATION
          </div>

          <LocationPicker
            selectedVenueId={selectedVenueId}
            newVenueName={newVenueName}
            here={geo.coords ?? null}
            onPickVenue={(id) => {
              setSelectedVenueId(id);
              setNewVenueName('');
            }}
            onClearVenue={() => setSelectedVenueId(null)}
            onTypeNewVenue={(name) => {
              setNewVenueName(name);
              if (name) setSelectedVenueId(null);
            }}
          />

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

      {/* STEP — GROUP (only when starting under an investigation) */}
      {step === 'group' && investigationParam && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-haunt-red tracking-widest">
              GROUP
            </div>
            {groupsLoading && <Loader2 className="w-3 h-3 animate-spin text-white/40" />}
          </div>
          <p className="text-sm text-white/50 mb-4">
            You're hunting under a team investigation. Pick a group, create your own, or go solo.
          </p>

          {/* Mode picker */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setGroupMode('create')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                groupMode === 'create'
                  ? 'bg-haunt-red/10 border-haunt-red text-white'
                  : 'bg-black border-white/10 text-white/70 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-x-2 mb-0.5">
                <UsersRound className="w-3.5 h-3.5 text-haunt-red" />
                <div className="text-xs font-mono tracking-widest">NEW GROUP</div>
              </div>
              <div className="text-[11px] text-white/50">
                Lead a sweep. Tag who's with you.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGroupMode('join')}
              disabled={
                investigationGroups.filter((g) => !g.ended_at).length === 0
              }
              className={`p-3 rounded-2xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                groupMode === 'join'
                  ? 'bg-haunt-red/10 border-haunt-red text-white'
                  : 'bg-black border-white/10 text-white/70 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-x-2 mb-0.5">
                <Users className="w-3.5 h-3.5 text-haunt-red" />
                <div className="text-xs font-mono tracking-widest">JOIN EXISTING</div>
              </div>
              <div className="text-[11px] text-white/50">
                {investigationGroups.filter((g) => !g.ended_at).length === 0
                  ? 'No groups yet.'
                  : `${investigationGroups.filter((g) => !g.ended_at).length} active`}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGroupMode('solo')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                groupMode === 'solo'
                  ? 'bg-haunt-red/10 border-haunt-red text-white'
                  : 'bg-black border-white/10 text-white/70 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-x-2 mb-0.5">
                <UserIcon className="w-3.5 h-3.5 text-haunt-red" />
                <div className="text-xs font-mono tracking-widest">GOING SOLO</div>
              </div>
              <div className="text-[11px] text-white/50">
                Under the umbrella but on your own.
              </div>
            </button>
          </div>

          {/* CREATE: zone input + tag members */}
          {groupMode === 'create' && (
            <div className="space-y-4 bg-black/40 border border-white/10 rounded-2xl p-3">
              <div>
                <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
                  GROUP NAME / ZONE
                </label>
                <input
                  value={groupZoneInput}
                  onChange={(e) => setGroupZoneInput(e.target.value)}
                  placeholder='e.g. "Basement" or "Third floor"'
                  maxLength={80}
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-haunt-red outline-none"
                />
              </div>

              {investigationMembers.filter(
                (m) => m.user_id !== authUser?.id
              ).length > 0 && (
                <div>
                  <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-2">
                    TAG WHO'S WITH YOU (OPTIONAL)
                  </label>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {investigationMembers
                      .filter((m) => m.user_id !== authUser?.id)
                      .map((m) => {
                        const checked = tagSelections.has(m.user_id);
                        return (
                          <label
                            key={m.user_id}
                            className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border transition-colors ${
                              checked
                                ? 'bg-haunt-red/10 border-haunt-red/40'
                                : 'border-white/5 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setTagSelections((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(m.user_id);
                                  else next.delete(m.user_id);
                                  return next;
                                });
                              }}
                              className="accent-haunt-red"
                            />
                            {m.avatar_url ? (
                              <img
                                src={m.avatar_url}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-haunt-red/20 flex items-center justify-center text-haunt-red text-xs font-mono">
                                {(m.handle ?? '?')[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">
                                {m.display_name ?? `@${m.handle}`}
                              </div>
                              {m.display_name && m.handle && (
                                <div className="text-[10px] font-mono text-white/40">
                                  @{m.handle}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                  </div>
                  <div className="text-[10px] text-white/40 mt-2">
                    Tagged members will be added to your group automatically. They can leave anytime.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* JOIN: pick existing */}
          {groupMode === 'join' && (
            <div className="space-y-2">
              {investigationGroups.filter((g) => !g.ended_at).length === 0 ? (
                <div className="text-sm text-white/40 text-center py-4">
                  No active groups yet. Switch to NEW GROUP to start one.
                </div>
              ) : (
                investigationGroups
                  .filter((g) => !g.ended_at)
                  .map((g) => {
                    const on = selectedJoinGroupId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedJoinGroupId(g.id)}
                        className={`w-full text-left rounded-2xl p-3 border transition-colors ${
                          on
                            ? 'bg-haunt-red/10 border-haunt-red'
                            : 'bg-black border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="text-sm font-medium">{g.zone}</div>
                        <div className="text-[10px] font-mono text-white/40 tracking-widest mt-0.5">
                          LED BY @{g.leader_handle ?? '?'} · {g.member_count}{' '}
                          {g.member_count === 1 ? 'MEMBER' : 'MEMBERS'}
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          )}

          {/* SOLO: just info */}
          {groupMode === 'solo' && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white/60">
              Your case will link to the investigation umbrella but not any group. Good for a free-roam sweep.
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — EQUIPMENT (OPTIONAL) */}
      {step === 'equipment' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-haunt-red tracking-widest">
              EQUIPMENT <span className="text-white/30">· OPTIONAL</span>
            </div>
            <div className="text-xs text-white/40">
              {selectedEquipment.size} SELECTED
            </div>
          </div>

          {/* Saved loadouts row */}
          {!loadoutsLoading && loadouts.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-2">
                LOAD A PRESET
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {loadouts.map((lo) => (
                  <div
                    key={lo.id}
                    className="group inline-flex items-center bg-black border border-white/10 hover:border-white/30 rounded-lg overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => applyLoadout(lo)}
                      className="px-3 py-1.5 text-xs font-mono tracking-widest text-white/70 hover:text-white inline-flex items-center gap-x-1.5"
                      title={`${lo.equipment_ids.length} item${lo.equipment_ids.length === 1 ? '' : 's'}`}
                    >
                      <Layers className="w-3 h-3 text-haunt-red" />
                      {lo.name.toUpperCase()}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoadout(lo)}
                      aria-label={`Delete ${lo.name}`}
                      title="Delete loadout"
                      className="px-2 py-1.5 text-white/30 hover:text-red-400 border-l border-white/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Save-as-loadout */}
          {selectedEquipment.size > 0 && authUser && (
            <div className="mt-5 pt-4 border-t border-white/5">
              {showSaveLoadout ? (
                <div className="flex gap-2">
                  <input
                    value={newLoadoutName}
                    onChange={(e) => setNewLoadoutName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveLoadout()}
                    placeholder={'Name this loadout (e.g. "Stanley Hotel kit")'}
                    maxLength={60}
                    className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-haunt-red outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveLoadout}
                    disabled={savingLoadout || !newLoadoutName.trim()}
                    className="px-4 py-2.5 bg-haunt-red hover:bg-red-600 disabled:opacity-30 text-white rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
                  >
                    {savingLoadout ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    SAVE
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveLoadout(false);
                      setNewLoadoutName('');
                    }}
                    className="px-3 py-2.5 text-white/50 hover:text-white text-xs font-mono tracking-widest"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveLoadout(true)}
                  disabled={loadouts.length >= MAX_LOADOUTS_PER_USER}
                  className="inline-flex items-center gap-x-1.5 text-xs font-mono tracking-widest text-white/50 hover:text-white disabled:opacity-30"
                  title={
                    loadouts.length >= MAX_LOADOUTS_PER_USER
                      ? `You have ${MAX_LOADOUTS_PER_USER} loadouts — delete one to add another`
                      : 'Save this kit as a preset'
                  }
                >
                  <Plus className="w-3 h-3" />
                  SAVE AS LOADOUT
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — REVIEW */}
      {step === 'review' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 md:p-6 mb-6 space-y-4">
          <div className="text-xs font-mono text-haunt-red tracking-widest">REVIEW</div>

          {myTeams.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
                HUNTING AS
              </div>
              <div className="text-sm inline-flex items-center gap-x-1.5">
                {teamId === null ? (
                  <>
                    <UserIcon className="w-3.5 h-3.5" /> Just me{' '}
                    <span className="text-white/40">· personal case</span>
                  </>
                ) : (
                  <>
                    <UsersIcon className="w-3.5 h-3.5 text-haunt-red" />
                    <span>
                      {myTeams.find((m) => m.team_id === teamId)?.team.name ?? 'Team'}
                    </span>
                    <span className="text-white/40">· team case</span>
                  </>
                )}
              </div>
            </div>
          )}

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
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => {
            const idx = STEPS.indexOf(step);
            if (idx <= 0) navigate(-1);
            else setStep(STEPS[idx - 1]);
          }}
          className="px-4 md:px-6 py-3 md:py-4 text-white/60 hover:text-white font-mono tracking-widest text-xs md:text-sm whitespace-nowrap"
        >
          {step === 'visibility' ? 'CANCEL' : '← BACK'}
        </button>

        {step !== 'review' ? (
          <button
            onClick={() => {
              const idx = STEPS.indexOf(step);
              if (idx < 0) return;
              // Gate forward navigation per current step.
              if (step === 'visibility' && !canAdvanceVisibility) return;
              if (step === 'location' && !canAdvanceLocation) return;
              if (step === 'group' && !canAdvanceGroup) return;
              setStep(STEPS[idx + 1]);
            }}
            disabled={
              (step === 'visibility' && !canAdvanceVisibility) ||
              (step === 'location' && !canAdvanceLocation) ||
              (step === 'group' && !canAdvanceGroup)
            }
            className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-3 md:py-4 rounded-2xl font-mono tracking-widest text-sm md:text-lg active:scale-[0.98] transition-all"
          >
            CONTINUE →
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-3 md:py-4 rounded-2xl font-mono tracking-widest text-sm md:text-lg active:scale-[0.98] transition-all"
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

      {step === 'group' && !canAdvanceGroup && (
        <p className="text-xs text-white/40 mt-3">
          {groupMode === 'create'
            ? 'Give the group a name (e.g. "Basement") to continue.'
            : groupMode === 'join'
            ? 'Pick a group to join, or switch to NEW GROUP / GOING SOLO.'
            : ''}
        </p>
      )}
    </div>
  );
}
