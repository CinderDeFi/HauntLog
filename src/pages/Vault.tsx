import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useHauntStore,
  type Visibility,
  type CaseFile,
  EQUIPMENT_CATALOG,
} from '../store/useHauntStore';
import { equipmentChipColors } from '../lib/equipmentColors';
import { useAuth } from '../lib/useAuth';
import { fetchMyDeletedCases, restoreCase } from '../lib/dataLayer';
import {
  Globe,
  Lock,
  EyeOff,
  MapPin,
  Star,
  Search,
  X,
  Users,
  Trash2,
  Undo2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from 'lucide-react';

type Filter = 'all' | Visibility;
type Scope = 'all' | 'mine' | 'team';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function VisibilityBadge({ v }: { v: Visibility }) {
  if (v === 'public')
    return (
      <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-green-400">
        <Globe className="w-3 h-3" /> PUBLIC
      </div>
    );
  if (v === 'anonymous')
    return (
      <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-amber-400">
        <EyeOff className="w-3 h-3" /> ANON
      </div>
    );
  return (
    <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-white/40">
      <Lock className="w-3 h-3" /> PRIVATE
    </div>
  );
}

export default function Vault() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const cases = useHauntStore((s) => s.cases);
  const [filter, setFilter] = useState<Filter>('all');
  const [scope, setScope] = useState<Scope>('all');
  // Step 23: equipment filter — match cases that used a specific device.
  // Null means "any equipment". Multiple equipment ids can be selected
  // to OR them together.
  const [equipFilter, setEquipFilter] = useState<Set<string>>(new Set());
  // Step 23: starred-only filter. When true, only show cases with at
  // least one starred log entry.
  const [starredOnly, setStarredOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Recently Deleted state
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [deletedCases, setDeletedCases] = useState<CaseFile[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedError, setDeletedError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const loadMyCases = useHauntStore((s) => s.loadMyCases);

  // Lazy-load deleted cases the first time the user expands the section.
  useEffect(() => {
    if (!deletedOpen || !authUser) return;
    if (deletedCases.length > 0) return;
    setDeletedLoading(true);
    setDeletedError(null);
    fetchMyDeletedCases()
      .then((list) => setDeletedCases(list))
      .catch((e) =>
        setDeletedError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => setDeletedLoading(false));
  }, [deletedOpen, authUser, deletedCases.length]);

  const onRestore = async (caseId: string) => {
    if (restoringId) return;
    setRestoringId(caseId);
    const res = await restoreCase(caseId);
    if (!res.ok) {
      setDeletedError(res.error);
      setRestoringId(null);
      return;
    }
    // Drop from the deleted list, then refresh the main cache so the
    // restored case re-appears in the active grid.
    setDeletedCases((prev) => prev.filter((c) => c.id !== caseId));
    if (authUser) {
      try {
        await loadMyCases(authUser.id);
      } catch {
        /* best effort — RLS will reflect the change on next load */
      }
    }
    setRestoringId(null);
  };

  // Counts for the scope pills — informative without an extra query.
  const counts = useMemo(() => {
    const me = authUser?.id;
    let mine = 0;
    let team = 0;
    for (const c of cases) {
      if (me && c.ownerId === me) mine++;
      if (c.teamId) team++;
    }
    return { all: cases.length, mine, team };
  }, [cases, authUser]);

  // Build the set of all tags currently in use.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const me = authUser?.id;
    return cases.filter((c) => {
      // Scope filter
      if (scope === 'mine' && (!me || c.ownerId !== me)) return false;
      if (scope === 'team' && !c.teamId) return false;
      // Visibility filter
      if (filter !== 'all' && c.visibility !== filter) return false;
      if (tagFilter && !c.tags?.includes(tagFilter)) return false;
      // Equipment filter — match if the case used any of the chosen devices.
      if (equipFilter.size > 0) {
        const used = c.equipmentUsed ?? [];
        let hit = false;
        for (const e of equipFilter) {
          if (used.includes(e)) {
            hit = true;
            break;
          }
        }
        if (!hit) return false;
      }
      // Starred-only — case must have at least one starred log entry.
      if (starredOnly && !c.logs.some((l) => l.starred)) return false;
      if (q) {
        const hay =
          (c.title + ' ' + (c.summary ?? '') + ' ' + c.location + ' ' + (c.zone ?? '')).toLowerCase();
        if (!hay.includes(q) && !c.tags?.some((t) => t.includes(q))) return false;
      }
      return true;
    });
  }, [cases, filter, scope, tagFilter, search, authUser, equipFilter, starredOnly]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tighter">YOUR VAULT</h1>
          <p className="text-white/60 mt-1">
            {cases.length} sealed {cases.length === 1 ? 'case' : 'cases'}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/hunt/new')}
          className="bg-haunt-red hover:bg-red-600 text-white px-6 py-3 rounded-xl font-mono tracking-widest text-sm transition-colors active:scale-[0.98]"
        >
          + NEW HUNT
        </button>
      </div>

      {cases.length > 0 && (
        <div className="space-y-3 mb-8">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, location, tag…"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:border-haunt-red outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/40"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Scope filter — owner vs team */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { id: 'all' as Scope, label: 'ALL CASES', count: counts.all },
                { id: 'mine' as Scope, label: 'MINE', count: counts.mine },
                { id: 'team' as Scope, label: 'TEAM', count: counts.team, icon: true },
              ]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono tracking-widest border transition-all inline-flex items-center gap-x-1.5 ${
                  scope === s.id
                    ? 'bg-haunt-red text-white border-haunt-red'
                    : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
                }`}
              >
                {s.icon && <Users className="w-3 h-3" />}
                {s.label}
                <span
                  className={`text-[10px] ${
                    scope === s.id ? 'text-white/80' : 'text-white/40'
                  }`}
                >
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* Visibility filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'public', 'anonymous', 'private'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-mono tracking-widest border transition-all ${
                  filter === f
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setTagFilter(null)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all ${
                  tagFilter === null
                    ? 'bg-haunt-red/10 border-haunt-red text-haunt-red'
                    : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                }`}
              >
                ALL TAGS
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t === tagFilter ? null : t)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all ${
                    tagFilter === t
                      ? 'bg-haunt-red/10 border-haunt-red text-haunt-red'
                      : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Equipment + starred filter row */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] font-mono text-white/30 tracking-widest pr-1">
              EQUIPMENT
            </span>
            {EQUIPMENT_CATALOG.map((e) => {
              const on = equipFilter.has(e.id);
              const chip = equipmentChipColors(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() =>
                    setEquipFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(e.id)) next.delete(e.id);
                      else next.add(e.id);
                      return next;
                    })
                  }
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all ${
                    on
                      ? `${chip.bg} ${chip.text} ${chip.border}`
                      : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                  }`}
                >
                  {e.abbr}
                </button>
              );
            })}
            <span className="w-px h-4 bg-white/10 mx-2" />
            <button
              onClick={() => setStarredOnly((v) => !v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all inline-flex items-center gap-x-1 ${
                starredOnly
                  ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/40'
                  : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
              }`}
            >
              <Star
                className={`w-3 h-3 ${starredOnly ? 'fill-yellow-400' : ''}`}
              />
              STARRED ONLY
            </button>
          </div>
        </div>
      )}

      {cases.length === 0 && (
        <div>
          {/* Primary empty state: 3-step explainer */}
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 md:p-12 text-center mb-6">
            <div className="text-xs font-mono text-haunt-red tracking-widest mb-4">
              // YOUR VAULT IS EMPTY
            </div>
            <h2 className="text-2xl md:text-3xl font-medium mb-3 tracking-tighter">
              This is where your evidence lives.
            </h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto text-sm md:text-base">
              Every hunt you finish becomes a sealed case file with a timestamp, location, gear log, and verdict you can share or export.
            </p>

            {/* 3-step row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto mb-8 text-left">
              <div className="bg-black border border-white/10 rounded-2xl p-4">
                <div className="font-mono text-haunt-red text-xs mb-2">01 · HUNT</div>
                <div className="text-sm font-medium mb-1">Pick a place. Pick your gear.</div>
                <div className="text-xs text-white/50">Atlas has verified venues — or use a custom location.</div>
              </div>
              <div className="bg-black border border-white/10 rounded-2xl p-4">
                <div className="font-mono text-haunt-red text-xs mb-2">02 · LOG</div>
                <div className="text-sm font-medium mb-1">Tap when your gear reacts.</div>
                <div className="text-xs text-white/50">Each event is timestamped. Add photos and notes inline.</div>
              </div>
              <div className="bg-black border border-white/10 rounded-2xl p-4">
                <div className="font-mono text-haunt-red text-xs mb-2">03 · SEAL</div>
                <div className="text-sm font-medium mb-1">Lock the case. Share or export.</div>
                <div className="text-xs text-white/50">A sealed case can be sent as a link, PDF, or kept private.</div>
              </div>
            </div>

            <button
              onClick={() => navigate('/app/hunt/new')}
              className="bg-haunt-red hover:bg-red-600 text-white px-8 py-3 rounded-xl font-mono tracking-widest text-sm transition-colors inline-flex items-center gap-x-2"
            >
              START YOUR FIRST HUNT →
            </button>
          </div>

          {/* Sample case preview */}
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-3xl p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-amber-300 tracking-widest mb-1 inline-flex items-center gap-x-1.5">
                  <Sparkles className="w-3 h-3" /> SAMPLE
                </div>
                <h3 className="text-lg font-medium mb-1">See what a sealed case looks like</h3>
                <p className="text-sm text-white/60">
                  Five events across 78 minutes at a haunted theatre. Real format, not a real hunt.
                </p>
              </div>
              <Link
                to="/case/sample"
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-mono tracking-widest whitespace-nowrap inline-flex items-center gap-x-2"
              >
                VIEW SAMPLE →
              </Link>
            </div>
          </div>
        </div>
      )}

      {cases.length > 0 && filtered.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center text-white/50">
          No cases match your filters.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const starred = c.logs.filter((l) => l.starred).length;
          return (
            <Link
              key={c.id}
              to={`/case/${c.id}`}
              className="block bg-zinc-900 border border-white/10 rounded-3xl p-6 hover:border-haunt-red/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="font-mono text-xs text-white/40 tracking-widest">#{c.id}</div>
                <VisibilityBadge v={c.visibility} />
              </div>

              <h3 className="text-2xl font-medium leading-tight mb-2 line-clamp-2">{c.title}</h3>
              <div className="flex items-start gap-x-1.5 text-white/60 text-sm mb-3">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-1">
                  {c.location}
                  {c.zone ? ` · ${c.zone}` : ''}
                </span>
              </div>

              {c.tags && c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/60"
                    >
                      {t.toUpperCase()}
                    </span>
                  ))}
                  {c.tags.length > 3 && (
                    <span className="text-[9px] font-mono text-white/40">
                      +{c.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-x-4 font-mono text-white/60">
                  <span>
                    <span className="text-white font-medium">{c.logs.length}</span> events
                  </span>
                  {starred > 0 && (
                    <span className="flex items-center gap-x-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-white font-medium">{starred}</span>
                    </span>
                  )}
                </div>
                <div className="text-white/50 font-mono tabular-nums">
                  {formatDate(c.endedAt ?? c.startedAt)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recently Deleted */}
      {authUser && (
        <div className="mt-12 border-t border-white/10 pt-8">
          <button
            onClick={() => setDeletedOpen((s) => !s)}
            className="w-full flex items-center justify-between text-left group"
          >
            <div className="inline-flex items-center gap-x-2">
              <Trash2 className="w-4 h-4 text-white/40 group-hover:text-haunt-red transition-colors" />
              <span className="text-xs font-mono text-white/40 tracking-widest group-hover:text-white transition-colors">
                // RECENTLY DELETED
                {deletedCases.length > 0 && (
                  <span className="ml-2 text-white">{deletedCases.length}</span>
                )}
              </span>
            </div>
            {deletedOpen ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </button>

          {deletedOpen && (
            <div className="mt-4">
              {deletedError && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-3">
                  {deletedError}
                </div>
              )}

              {deletedLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
                </div>
              ) : deletedCases.length === 0 ? (
                <div className="bg-zinc-950 border border-white/5 rounded-2xl p-8 text-center text-sm text-white/40">
                  No recently deleted cases.
                </div>
              ) : (
                <div className="space-y-2">
                  {deletedCases.map((c) => (
                    <div
                      key={c.id}
                      className="bg-zinc-950 border border-white/5 rounded-2xl p-3 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] text-white/40 tracking-widest mb-0.5">
                          #{c.id}
                        </div>
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="text-xs text-white/50 inline-flex items-center gap-x-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{c.location}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRestore(c.id)}
                        disabled={restoringId === c.id}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest bg-white/10 hover:bg-haunt-red hover:text-white text-white/80 border border-white/10 inline-flex items-center gap-x-1.5 disabled:opacity-50"
                      >
                        {restoringId === c.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Undo2 className="w-3 h-3" />
                        )}
                        RESTORE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
