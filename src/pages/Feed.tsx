import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchRecentFeed,
  fetchFollowingFeed,
  type FeedCase,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import { usePullToRefresh } from '../lib/usePullToRefresh';
import { FeedSkeleton } from '../components/ui/Skeleton';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  MapPin,
  Star,
  EyeOff,
  Users as UsersIcon,
  BadgeCheck,
  Globe,
  Sparkles,
  Snowflake,
  Eye,
  Search,
  HelpCircle,
} from 'lucide-react';

type Filter = 'all' | 'following';

function timeAgo(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Feed() {
  const { user: authUser } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [allCases, setAllCases] = useState<FeedCase[]>([]);
  const [followingCases, setFollowingCases] = useState<FeedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        if (filter === 'following') {
          if (!authUser) {
            setFollowingCases([]);
          } else {
            const list = await fetchFollowingFeed(authUser.id, 50);
            setFollowingCases(list);
          }
        } else {
          const list = await fetchRecentFeed(50);
          setAllCases(list);
        }
        setNow(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, authUser]
  );

  // Reload whenever the filter changes (or on mount).
  useEffect(() => {
    load(true);
  }, [load]);

  // Keep "X minutes ago" labels fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const visible = useMemo(() => {
    return filter === 'following' ? followingCases : allCases;
  }, [filter, allCases, followingCases]);

  // Pull-to-refresh on touch devices. Triggers the same load() call
  // the manual refresh button uses.
  const { pulling, pullDistance, threshold } = usePullToRefresh(() => load(false));

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Pull-to-refresh indicator — only visible while pulling */}
      {(pulling || refreshing) && (
        <div
          className="md:hidden absolute left-0 right-0 -top-4 flex items-center justify-center pointer-events-none z-10 transition-transform"
          style={{
            transform: refreshing
              ? `translateY(${threshold}px)`
              : `translateY(${Math.min(pullDistance, threshold + 20)}px)`,
          }}
        >
          <div
            className={`rounded-full bg-zinc-900/95 border border-white/10 p-2 shadow-lg ${
              refreshing ? '' : 'transition-opacity'
            }`}
            style={{
              opacity: refreshing ? 1 : Math.min(pullDistance / threshold, 1),
            }}
          >
            <RefreshCw
              className={`w-4 h-4 text-haunt-red ${
                refreshing ? 'animate-spin' : pullDistance >= threshold ? 'rotate-180' : ''
              } transition-transform`}
            />
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
            <Activity className="w-3.5 h-3.5" /> FEED
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tighter">Recent on HauntLog</h1>
          <p className="text-white/60 text-sm mt-1">
            Public cases from every investigator. Newest first.
          </p>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing || loading}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {(['all', 'following'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-mono tracking-widest border transition-all ${
              filter === f
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
            }`}
          >
            {f === 'all' ? 'ALL' : 'FOLLOWING'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {loading && <FeedSkeleton />}

      {!loading && filter === 'following' && visible.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <UsersIcon className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <h2 className="text-xl font-medium mb-2">
            {authUser
              ? 'No recent cases from investigators you follow.'
              : 'Sign in to see cases from people you follow.'}
          </h2>
          <p className="text-white/60 text-sm mb-4">
            {authUser
              ? "Try following a few investigators — or browse the full feed."
              : 'The FOLLOWING view shows cases from people you follow.'}
          </p>
          <button
            onClick={() => setFilter('all')}
            className="text-xs font-mono tracking-widest text-haunt-red hover:underline"
          >
            ← SHOW ALL CASES
          </button>
        </div>
      )}

      {!loading && filter === 'all' && visible.length === 0 && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 md:p-12 text-center">
            <Activity className="w-10 h-10 text-white/30 mx-auto mb-3" />
            <h2 className="text-xl md:text-2xl font-medium mb-2">It's quiet out there.</h2>
            <p className="text-white/60 text-sm mb-5 max-w-md mx-auto">
              No public cases on the feed yet. Seal one of your own to start it — or follow a few investigators on the Discover page.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link
                to="/app/hunt/new"
                className="bg-haunt-red hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs"
              >
                START A HUNT
              </Link>
              <Link
                to="/app/discover"
                className="bg-white/5 hover:bg-white/10 text-white/70 px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs"
              >
                FIND INVESTIGATORS
              </Link>
            </div>
          </div>

          {/* Sample case link */}
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-amber-300 tracking-widest mb-1 inline-flex items-center gap-x-1.5">
                  <Sparkles className="w-3 h-3" /> SAMPLE
                </div>
                <div className="text-sm font-medium mb-0.5">
                  Curious what a real case looks like?
                </div>
                <div className="text-xs text-white/60">
                  Five events at a haunted theatre. Real format, not a real hunt.
                </div>
              </div>
              <Link
                to="/case/sample"
                className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-mono tracking-widest whitespace-nowrap"
              >
                VIEW SAMPLE →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* The feed itself */}
      <div className="space-y-3">
        {visible.map((c) => (
          <FeedCard key={c.id} c={c} now={now} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ c, now }: { c: FeedCase; now: number }) {
  const starred = c.logs.filter((l) => l.starred).length;
  const isAnon = c.visibility === 'anonymous';
  const isTeam = !!c.teamSlug;

  // Pick the most prominent attribution: team if team-owned, otherwise the author handle.
  // Anonymous cases drop both.
  const authorBlock = isAnon ? (
    <div className="inline-flex items-center gap-x-2 text-white/40 text-xs">
      <div className="w-7 h-7 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <span className="font-mono tracking-widest">ANONYMOUS</span>
    </div>
  ) : isTeam ? (
    <Link
      to={`/t/${c.teamSlug}`}
      className="inline-flex items-center gap-x-2 hover:text-haunt-red transition-colors"
    >
      {c.teamLogo ? (
        <img src={c.teamLogo} alt="" className="w-7 h-7 rounded-xl object-cover" />
      ) : (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          {(c.teamName ?? '?')
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}
      <div className="text-xs">
        <div className="font-medium inline-flex items-center gap-x-1">
          {c.teamName}
          {c.teamVerified && <BadgeCheck className="w-3 h-3 text-haunt-red" />}
        </div>
        <div className="font-mono text-white/40">@{c.teamSlug}</div>
      </div>
    </Link>
  ) : (
    <Link
      to={`/u/${encodeURIComponent(c.ownerHandle)}`}
      className="inline-flex items-center gap-x-2 hover:text-haunt-red transition-colors"
    >
      {c.ownerAvatar ? (
        <img src={c.ownerAvatar} alt="" className="w-7 h-7 rounded-xl object-cover" />
      ) : (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">
          {(c.ownerDisplayName ?? c.ownerHandle)
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}
      <div className="text-xs">
        <div className="font-medium">{c.ownerDisplayName ?? c.ownerHandle}</div>
        <div className="font-mono text-white/40">{c.ownerHandle}</div>
      </div>
    </Link>
  );

  return (
    <Link
      to={`/case/${c.id}`}
      className="hl-lift block bg-zinc-900 border border-white/10 rounded-3xl p-5 hover:border-haunt-red/50"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {authorBlock}
        <div className="flex items-center gap-x-2 shrink-0 text-[10px] font-mono tracking-widest">
          {isAnon ? (
            <span className="text-amber-400 inline-flex items-center gap-x-1">
              <EyeOff className="w-3 h-3" /> ANON
            </span>
          ) : (
            <span className="text-green-400 inline-flex items-center gap-x-1">
              <Globe className="w-3 h-3" /> PUBLIC
            </span>
          )}
          <span className="text-white/40">·</span>
          <span className="text-white/40">{timeAgo(c.createdAt, now)}</span>
        </div>
      </div>

      <h3 className="text-xl font-medium mb-1 line-clamp-2">{c.title}</h3>
      {c.summary && (
        <p className="text-sm text-white/60 line-clamp-2 mb-2">{c.summary}</p>
      )}

      <div className="flex items-start gap-x-1.5 text-white/60 text-sm mb-3">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span className="line-clamp-1">
          {c.location}
          {c.zone ? ` · ${c.zone}` : ''}
        </span>
      </div>

      {c.tags && c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {c.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/60"
            >
              {t.toUpperCase()}
            </span>
          ))}
          {c.tags.length > 5 && (
            <span className="text-[9px] font-mono text-white/40 px-1">
              +{c.tags.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-x-4 pt-3 border-t border-white/5 text-[11px] font-mono text-white/60 flex-wrap gap-y-1.5">
        <span>
          <span className="text-white font-medium">{c.logs.length}</span>{' '}
          {c.logs.length === 1 ? 'event' : 'events'}
        </span>
        {starred > 0 && (
          <span className="inline-flex items-center gap-x-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white">{starred}</span> starred
          </span>
        )}
        {/* Step 42: reaction signal — only the reactions that have at
            least one count, shown as compact icon+number chips. */}
        {c.reactionCounts.chilled ? (
          <span className="inline-flex items-center gap-x-1 text-haunt-red/90">
            <Snowflake className="w-3 h-3" />
            <span>{c.reactionCounts.chilled}</span>
          </span>
        ) : null}
        {c.reactionCounts.witnessed ? (
          <span className="inline-flex items-center gap-x-1 text-cyan-300/90">
            <Eye className="w-3 h-3" />
            <span>{c.reactionCounts.witnessed}</span>
          </span>
        ) : null}
        {c.reactionCounts.examine ? (
          <span className="inline-flex items-center gap-x-1 text-white/70">
            <Search className="w-3 h-3" />
            <span>{c.reactionCounts.examine}</span>
          </span>
        ) : null}
        {c.reactionCounts.skeptical ? (
          <span className="inline-flex items-center gap-x-1 text-amber-300/90">
            <HelpCircle className="w-3 h-3" />
            <span>{c.reactionCounts.skeptical}</span>
          </span>
        ) : null}
        <span className="ml-auto text-white/40">#{c.id}</span>
      </div>
    </Link>
  );
}
