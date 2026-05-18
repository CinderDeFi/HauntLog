import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchActiveInvestigators,
  fetchFeaturedTeams,
  fetchRecentInvestigators,
  followUser,
  isFollowing,
  searchDiscover,
  unfollowUser,
  type InvestigatorListing,
  type TeamListing,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import {
  Compass,
  Search,
  X,
  Loader2,
  AlertCircle,
  AtSign,
  Users as UsersIcon,
  BadgeCheck,
  User as UserIcon,
  UserPlus,
  UserCheck,
  Sparkles,
  TrendingUp,
  Award,
  ChevronRight,
} from 'lucide-react';

type Tab = 'all' | 'investigators' | 'teams';

const TAB_LABELS: Record<Tab, string> = {
  all: 'ALL',
  investigators: 'INVESTIGATORS',
  teams: 'TEAMS',
};

export default function Discover() {
  const { user: authUser } = useAuth();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [committedQuery, setCommittedQuery] = useState('');

  // Default sections (no query)
  const [recent, setRecent] = useState<InvestigatorListing[]>([]);
  const [active, setActive] = useState<InvestigatorListing[]>([]);
  const [featuredTeams, setFeaturedTeams] = useState<TeamListing[]>([]);
  const [defaultLoading, setDefaultLoading] = useState(true);

  // Search results
  const [searchProfiles, setSearchProfiles] = useState<InvestigatorListing[]>([]);
  const [searchTeams, setSearchTeams] = useState<TeamListing[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Follow state shared between default + search renders
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followingBusy, setFollowingBusy] = useState<string | null>(null);

  // Debounce
  const debounceRef = useRef<number | null>(null);

  // ---------- Default content fetch on mount ----------
  useEffect(() => {
    let cancelled = false;
    setDefaultLoading(true);
    (async () => {
      try {
        const [r, a, t] = await Promise.all([
          fetchRecentInvestigators(8),
          fetchActiveInvestigators(8),
          fetchFeaturedTeams(8),
        ]);
        if (cancelled) return;
        setRecent(r);
        setActive(a);
        setFeaturedTeams(t);
      } catch {
        /* best-effort; empty states will render */
      } finally {
        if (!cancelled) setDefaultLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Determine viewer's follow state for visible profiles ----------
  // Whenever the set of visible profiles changes (default sections OR search),
  // fetch the viewer's follow status for any we don't already know.
  useEffect(() => {
    if (!authUser) return;
    const allProfiles = new Set<string>();
    [...recent, ...active, ...searchProfiles].forEach((p) => {
      if (p.id !== authUser.id) allProfiles.add(p.id);
    });
    const unknown = [...allProfiles].filter((id) => !followingSet.has(id) && !nonFollows.has(id));
    if (unknown.length === 0) return;
    let cancelled = false;
    (async () => {
      const checks = await Promise.all(
        unknown.map((id) => isFollowing(authUser.id, id).then((v) => ({ id, v })))
      );
      if (cancelled) return;
      setFollowingSet((prev) => {
        const next = new Set(prev);
        checks.forEach(({ id, v }) => {
          if (v) next.add(id);
        });
        return next;
      });
      setNonFollows((prev) => {
        const next = new Set(prev);
        checks.forEach(({ id, v }) => {
          if (!v) next.add(id);
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // followingSet is intentionally omitted from deps; we want to fan-out only
    // when the visible PROFILES change. Otherwise we'd loop on our own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent, active, searchProfiles, authUser]);

  const [nonFollows, setNonFollows] = useState<Set<string>>(new Set());

  // ---------- Debounced search ----------
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setCommittedQuery('');
      setSearchProfiles([]);
      setSearchTeams([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await searchDiscover(query, tab);
        setSearchProfiles(r.profiles);
        setSearchTeams(r.teams);
        setCommittedQuery(query.trim());
        setSearchError(null);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : String(e));
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, tab]);

  const onFollow = useCallback(
    async (targetId: string) => {
      if (!authUser || followingBusy === targetId) return;
      const isOn = followingSet.has(targetId);
      setFollowingBusy(targetId);
      // Optimistic
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (isOn) next.delete(targetId);
        else next.add(targetId);
        return next;
      });
      const res = isOn
        ? await unfollowUser(authUser.id, targetId)
        : await followUser(authUser.id, targetId);
      if (!res.ok) {
        // Rollback
        setFollowingSet((prev) => {
          const next = new Set(prev);
          if (isOn) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
      }
      setFollowingBusy(null);
    },
    [authUser, followingSet, followingBusy]
  );

  const searching = committedQuery.length >= 2;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
          <Compass className="w-3.5 h-3.5" /> DISCOVER
        </div>
        <h1 className="text-4xl font-medium tracking-tighter">Find your people.</h1>
        <p className="text-white/60 text-sm mt-1">
          Browse investigators and teams. Search by name, handle, or bio.
        </p>
      </div>

      {/* Search */}
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-2 mb-4 flex items-center gap-2">
        <Search className="w-4 h-4 text-white/40 ml-2 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, handle, or bio…"
          className="flex-1 bg-transparent outline-none text-sm py-2 placeholder:text-white/40"
        />
        {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
        {query.length > 0 && !searchLoading && (
          <button
            onClick={() => setQuery('')}
            className="text-white/40 hover:text-white px-2"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'investigators', 'teams'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-mono tracking-widest border transition-all ${
              tab === t
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {searchError && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{searchError}</span>
        </div>
      )}

      {searching ? (
        <SearchResults
          tab={tab}
          query={committedQuery}
          profiles={searchProfiles}
          teams={searchTeams}
          authUserId={authUser?.id ?? null}
          followingSet={followingSet}
          followingBusy={followingBusy}
          onFollow={onFollow}
        />
      ) : (
        <DefaultSections
          tab={tab}
          loading={defaultLoading}
          recent={recent}
          active={active}
          featuredTeams={featuredTeams}
          authUserId={authUser?.id ?? null}
          followingSet={followingSet}
          followingBusy={followingBusy}
          onFollow={onFollow}
        />
      )}
    </div>
  );
}

// ============================================================
// Default content (no query)
// ============================================================

function DefaultSections({
  tab,
  loading,
  recent,
  active,
  featuredTeams,
  authUserId,
  followingSet,
  followingBusy,
  onFollow,
}: {
  tab: Tab;
  loading: boolean;
  recent: InvestigatorListing[];
  active: InvestigatorListing[];
  featuredTeams: TeamListing[];
  authUserId: string | null;
  followingSet: Set<string>;
  followingBusy: string | null;
  onFollow: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  const showInvestigators = tab === 'all' || tab === 'investigators';
  const showTeams = tab === 'all' || tab === 'teams';

  return (
    <div className="space-y-10">
      {showInvestigators && active.length > 0 && (
        <Section
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          title="Most active investigators"
          subtitle="Sealed the most public cases."
        >
          <ProfileGrid
            profiles={active}
            authUserId={authUserId}
            followingSet={followingSet}
            followingBusy={followingBusy}
            onFollow={onFollow}
          />
        </Section>
      )}

      {showInvestigators && recent.length > 0 && (
        <Section
          icon={<Sparkles className="w-3.5 h-3.5" />}
          title="Recently joined"
          subtitle="Say hi to the newest investigators."
        >
          <ProfileGrid
            profiles={recent}
            authUserId={authUserId}
            followingSet={followingSet}
            followingBusy={followingBusy}
            onFollow={onFollow}
          />
        </Section>
      )}

      {showTeams && featuredTeams.length > 0 && (
        <Section
          icon={<Award className="w-3.5 h-3.5" />}
          title="Featured teams"
          subtitle="Verified teams and the most-active crews."
        >
          <TeamGrid teams={featuredTeams} />
        </Section>
      )}

      {!loading &&
        ((showInvestigators && active.length === 0 && recent.length === 0) ||
          (tab === 'teams' && featuredTeams.length === 0)) && (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center text-white/60 text-sm">
            Nothing to discover yet. Try inviting people to HauntLog.
          </div>
        )}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[10px] font-mono text-haunt-red tracking-widest mb-1 flex items-center gap-x-2">
          {icon}
          {title.toUpperCase()}
        </div>
        <h2 className="text-xl font-medium tracking-tight">{subtitle}</h2>
      </div>
      {children}
    </section>
  );
}

// ============================================================
// Search results (with query)
// ============================================================

function SearchResults({
  tab,
  query,
  profiles,
  teams,
  authUserId,
  followingSet,
  followingBusy,
  onFollow,
}: {
  tab: Tab;
  query: string;
  profiles: InvestigatorListing[];
  teams: TeamListing[];
  authUserId: string | null;
  followingSet: Set<string>;
  followingBusy: string | null;
  onFollow: (id: string) => void;
}) {
  const showInvestigators = tab === 'all' || tab === 'investigators';
  const showTeams = tab === 'all' || tab === 'teams';
  const total =
    (showInvestigators ? profiles.length : 0) + (showTeams ? teams.length : 0);

  if (total === 0) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
        <Search className="w-10 h-10 text-white/30 mx-auto mb-3" />
        <h2 className="text-xl font-medium mb-2">
          No matches for <span className="font-mono">"{query}"</span>
        </h2>
        <p className="text-white/60 text-sm">
          Try a different spelling, or switch tabs to look in another category.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showInvestigators && profiles.length > 0 && (
        <Section
          icon={<UserIcon className="w-3.5 h-3.5" />}
          title="Investigators"
          subtitle={`${profiles.length} ${profiles.length === 1 ? 'match' : 'matches'}`}
        >
          <ProfileGrid
            profiles={profiles}
            authUserId={authUserId}
            followingSet={followingSet}
            followingBusy={followingBusy}
            onFollow={onFollow}
          />
        </Section>
      )}

      {showTeams && teams.length > 0 && (
        <Section
          icon={<UsersIcon className="w-3.5 h-3.5" />}
          title="Teams"
          subtitle={`${teams.length} ${teams.length === 1 ? 'match' : 'matches'}`}
        >
          <TeamGrid teams={teams} />
        </Section>
      )}
    </div>
  );
}

// ============================================================
// Cards / grids
// ============================================================

function ProfileGrid({
  profiles,
  authUserId,
  followingSet,
  followingBusy,
  onFollow,
}: {
  profiles: InvestigatorListing[];
  authUserId: string | null;
  followingSet: Set<string>;
  followingBusy: string | null;
  onFollow: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {profiles.map((p) => (
        <ProfileCard
          key={p.id}
          p={p}
          isMe={authUserId === p.id}
          isFollowing={followingSet.has(p.id)}
          busy={followingBusy === p.id}
          showFollow={!!authUserId}
          onFollow={() => onFollow(p.id)}
        />
      ))}
    </div>
  );
}

function ProfileCard({
  p,
  isMe,
  isFollowing,
  busy,
  showFollow,
  onFollow,
}: {
  p: InvestigatorListing;
  isMe: boolean;
  isFollowing: boolean;
  busy: boolean;
  showFollow: boolean;
  onFollow: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors flex flex-col">
      <Link
        to={`/u/${encodeURIComponent(p.handle)}`}
        className="flex items-start gap-3 group min-w-0"
      >
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt=""
            className="w-12 h-12 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
            {p.display_name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5">
            <div className="font-medium truncate group-hover:text-haunt-red transition-colors">
              {p.display_name}
            </div>
            {p.tier && p.tier !== 'free' && (
              <BadgeCheck className="w-3.5 h-3.5 text-haunt-red shrink-0" />
            )}
          </div>
          <div className="text-xs font-mono text-white/40 truncate inline-flex items-center gap-x-1">
            <AtSign className="w-2.5 h-2.5" />
            {p.handle.replace(/^@/, '')}
          </div>
        </div>
      </Link>

      {p.bio && (
        <p className="text-xs text-white/60 mt-2 line-clamp-2">{p.bio}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className="text-[10px] font-mono text-white/40 tracking-widest">
          {p.public_case_count > 0 ? (
            <span>
              <span className="text-white">{p.public_case_count}</span> public{' '}
              {p.public_case_count === 1 ? 'case' : 'cases'}
            </span>
          ) : (
            <span>New investigator</span>
          )}
        </div>

        {showFollow && !isMe && (
          <button
            onClick={onFollow}
            disabled={busy}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-widest flex items-center gap-x-1.5 transition-colors disabled:opacity-50 ${
              isFollowing
                ? 'bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-white/80 border border-white/10'
                : 'bg-haunt-red hover:bg-red-600 text-white'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isFollowing ? (
              <UserCheck className="w-3 h-3" />
            ) : (
              <UserPlus className="w-3 h-3" />
            )}
            {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
          </button>
        )}
        {isMe && (
          <span className="text-[10px] font-mono text-white/40 tracking-widest">
            YOU
          </span>
        )}
      </div>
    </div>
  );
}

function TeamGrid({ teams }: { teams: TeamListing[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {teams.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(`/t/${t.slug}`)}
          className="text-left bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors"
        >
          <div className="flex items-start gap-3">
            {t.logo_url ? (
              <img
                src={t.logo_url}
                alt=""
                className="w-12 h-12 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                {t.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-x-1.5">
                <div className="font-medium truncate">{t.name}</div>
                {t.verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-haunt-red shrink-0" />
                )}
              </div>
              <div className="text-xs font-mono text-white/40 truncate inline-flex items-center gap-x-1">
                <UsersIcon className="w-2.5 h-2.5" />@{t.slug}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </div>

          {t.description && (
            <p className="text-xs text-white/60 mt-2 line-clamp-2">
              {t.description}
            </p>
          )}

          <div className="flex items-center gap-x-3 mt-3 pt-3 border-t border-white/5 text-[10px] font-mono text-white/40 tracking-widest">
            <span>
              <span className="text-white">{t.member_count}</span>{' '}
              {t.member_count === 1 ? 'MEMBER' : 'MEMBERS'}
            </span>
            <span className="text-white/20">·</span>
            <span>
              <span className="text-white">{t.public_case_count}</span> PUBLIC{' '}
              {t.public_case_count === 1 ? 'CASE' : 'CASES'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
