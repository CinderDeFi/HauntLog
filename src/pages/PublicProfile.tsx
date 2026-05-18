import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PublicNav from '../components/PublicNav';
import PhotoLightbox from '../components/PhotoLightbox';
import type { ProfileRow } from '../lib/database.types';
import {
  fetchPublicCasesByHandle,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowCounts,
  fetchInvestigatorStats,
  type InvestigatorListing,
} from '../lib/dataLayer';
import type { CaseFile } from '../store/useHauntStore';
import { useAuth } from '../lib/useAuth';
import SocialLinks from '../components/SocialLinks';
import StatStrip, { formatCount, formatHours } from '../components/StatStrip';
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Calendar,
  Loader2,
  MapPin,
  User as UserIcon,
  Star,
  Globe,
  UserPlus,
  UserCheck,
  Users,
  Clock,
  FileText,
  Activity,
} from 'lucide-react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>(
    'loading'
  );
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  // Follow state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number }>({
    followers: 0,
    following: 0,
  });

  // Investigator stats — pulled from the view that already powers Discover.
  const [stats, setStats] = useState<InvestigatorListing | null>(null);

  // Lightbox state for blowing up the avatar.
  const [avatarZoom, setAvatarZoom] = useState<string | null>(null);

  const isOwnProfile = !!authUser && !!profile && authUser.id === profile.id;

  useEffect(() => {
    if (!handle) {
      setStatus('not_found');
      return;
    }
    const normalized = handle.startsWith('@') ? handle : '@' + handle;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('profiles')
          .select('*')
          .eq('handle', normalized)
          .maybeSingle();
        if (err) throw err;
        if (!data) {
          setStatus('not_found');
          return;
        }
        setProfile(data);
        setStatus('found');

        // Fan out queries in parallel: cases, follow counts, stats,
        // and (if signed in and not viewing own profile) the viewer's
        // follow relationship to this user.
        setCasesLoading(true);
        const tasks: Promise<unknown>[] = [
          fetchPublicCasesByHandle(normalized)
            .then((list) => setCases(list))
            .catch(() => {
              /* best-effort */
            })
            .finally(() => setCasesLoading(false)),
          getFollowCounts(data.id)
            .then((counts) => setFollowCounts(counts))
            .catch(() => {
              /* best-effort */
            }),
          fetchInvestigatorStats(data.id)
            .then((s) => setStats(s))
            .catch(() => {
              /* best-effort */
            }),
        ];
        if (authUser && authUser.id !== data.id) {
          tasks.push(
            isFollowing(authUser.id, data.id)
              .then((v) => setFollowing(v))
              .catch(() => {
                /* best-effort */
              })
          );
        }
        await Promise.all(tasks);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, [handle, authUser]);

  const handleFollow = async () => {
    if (!authUser || !profile || followLoading) return;
    setFollowLoading(true);
    const prev = following;
    // Optimistic toggle for snappy feel.
    setFollowing(!prev);
    setFollowCounts((c) => ({
      ...c,
      followers: c.followers + (prev ? -1 : 1),
    }));
    const res = prev
      ? await unfollowUser(authUser.id, profile.id)
      : await followUser(authUser.id, profile.id);
    if (!res.ok) {
      // Rollback on failure.
      setFollowing(prev);
      setFollowCounts((c) => ({
        ...c,
        followers: c.followers + (prev ? 1 : -1),
      }));
    }
    setFollowLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <PublicNav />

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
        <Link
          to="/app/atlas"
          className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> BACK
        </Link>

        {status === 'loading' && (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/40" />
          </div>
        )}

        {status === 'not_found' && (
          <div className="text-center py-20">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // 404
            </div>
            <h1 className="text-3xl font-medium mb-3">Investigator not found</h1>
            <p className="text-white/60 mb-6">
              No one with the handle <span className="font-mono">{handle}</span>.
            </p>
            <Link
              to="/app/atlas"
              className="inline-block bg-white text-black px-6 py-3 rounded-xl font-mono tracking-widest text-sm hover:bg-haunt-red hover:text-white transition-colors"
            >
              ← BACK TO ATLAS
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 text-sm text-red-300">
            {error}
          </div>
        )}

        {status === 'found' && profile && (
          <>
            <div className="text-xs font-mono text-haunt-red tracking-widest mb-4 flex items-center gap-x-2">
              <UserIcon className="w-3.5 h-3.5" /> INVESTIGATOR
            </div>

            <div className="flex items-start gap-5 mb-6 flex-wrap">
              {/* Avatar — clickable to zoom if there's a real image */}
              <div className="shrink-0">
                {profile.avatar_url ? (
                  <button
                    type="button"
                    onClick={() => setAvatarZoom(profile.avatar_url)}
                    aria-label="View avatar full size"
                    className="block rounded-3xl overflow-hidden hover:ring-2 hover:ring-haunt-red/60 transition-all"
                  >
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-24 h-24 rounded-3xl object-cover border border-white/10"
                    />
                  </button>
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white text-2xl font-bold">
                    {profile.display_name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h1 className="text-3xl md:text-4xl font-medium tracking-tighter break-words">
                      {profile.display_name}
                    </h1>
                    <div className="flex items-center gap-x-2 text-white/60 font-mono text-sm mt-1">
                      <AtSign className="w-3.5 h-3.5" />
                      {profile.handle.replace(/^@/, '')}
                    </div>
                  </div>

                  {/* Follow button — only when signed in and not your own profile */}
                  {authUser && !isOwnProfile && (
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs flex items-center gap-x-2 transition-colors shrink-0 ${
                        following
                          ? 'bg-white/10 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-white/80'
                          : 'bg-haunt-red hover:bg-red-600 text-white border border-haunt-red'
                      } disabled:opacity-50`}
                    >
                      {followLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : following ? (
                        <UserCheck className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      {following ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-x-3 text-white/40 text-xs mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-x-1">
                    <Calendar className="w-3 h-3" />
                    Joined {formatJoinDate(profile.created_at)}
                  </span>
                  {profile.tier && profile.tier !== 'free' && (
                    <span className="inline-flex items-center gap-x-1 text-haunt-red">
                      <BadgeCheck className="w-3 h-3" />
                      {profile.tier.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Follow counts */}
            <div className="flex items-center gap-x-4 mb-5 text-sm">
              <Link
                to={`/u/${encodeURIComponent(profile.handle)}/followers`}
                className="hover:text-haunt-red transition-colors inline-flex items-center gap-x-1.5"
              >
                <Users className="w-3.5 h-3.5 text-white/40" />
                <span className="font-medium text-white">{followCounts.followers}</span>
                <span className="text-white/60">
                  {followCounts.followers === 1 ? 'follower' : 'followers'}
                </span>
              </Link>
              <span className="text-white/20">·</span>
              <Link
                to={`/u/${encodeURIComponent(profile.handle)}/following`}
                className="hover:text-haunt-red transition-colors inline-flex items-center gap-x-1.5"
              >
                <span className="font-medium text-white">{followCounts.following}</span>
                <span className="text-white/60">following</span>
              </Link>
            </div>

            {profile.bio && (
              <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            <div className="mb-8">
              <SocialLinks
                value={{
                  website: profile.website,
                  instagram: profile.instagram,
                  tiktok: profile.tiktok,
                  facebook: profile.facebook,
                  youtube: profile.youtube,
                }}
              />
            </div>

            {/* Stats strip */}
            {stats && (
              <div className="mb-8">
                <div className="text-xs font-mono text-white/40 tracking-widest mb-3 flex items-center gap-x-2">
                  <Activity className="w-3.5 h-3.5" />
                  // STATS
                </div>
                <StatStrip
                  stats={[
                    {
                      label: 'Cases',
                      value: formatCount(stats.public_case_count),
                      icon: <FileText className="w-3 h-3" />,
                      hint: stats.public_case_count === 0 ? 'No public cases yet' : 'sealed & public',
                    },
                    {
                      label: 'Log entries',
                      value: formatCount(stats.public_log_count),
                      icon: <Activity className="w-3 h-3" />,
                      hint: stats.public_starred_count > 0
                        ? `${formatCount(stats.public_starred_count)} starred`
                        : undefined,
                    },
                    {
                      label: 'Locations',
                      value: formatCount(stats.distinct_locations),
                      icon: <MapPin className="w-3 h-3" />,
                      hint: stats.distinct_locations === 1 ? 'site hunted' : 'sites hunted',
                    },
                    {
                      label: 'Hours hunted',
                      value: formatHours(stats.total_hours),
                      icon: <Clock className="w-3 h-3" />,
                      hint: 'across public cases',
                    },
                  ]}
                />
              </div>
            )}

            {/* Public cases */}
            <div className="border-t border-white/10 pt-8">
              <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
                <MapPin className="w-3.5 h-3.5" />
                // PUBLIC CASES · {cases.length}
              </div>

              {casesLoading ? (
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
                </div>
              ) : cases.length === 0 ? (
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center text-white/40 text-sm">
                  No public cases yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cases.map((c) => {
                    const starred = c.logs.filter((l) => l.starred).length;
                    return (
                      <Link
                        key={c.id}
                        to={`/case/${c.id}`}
                        className="block bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-haunt-red/50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="font-mono text-[10px] text-white/40 tracking-widest">
                            #{c.id}
                          </div>
                          <div className="text-[10px] font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1">
                            <Globe className="w-2.5 h-2.5" /> PUBLIC
                          </div>
                        </div>
                        <h3 className="text-base font-medium mb-1 line-clamp-2">{c.title}</h3>
                        <div className="flex items-start gap-x-1 text-white/60 text-xs mb-2">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">
                            {c.location}
                            {c.zone ? ` · ${c.zone}` : ''}
                          </span>
                        </div>
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
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
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-white/40">
                          <span>
                            <span className="text-white">{c.logs.length}</span> events
                            {starred > 0 && (
                              <span className="ml-2 inline-flex items-center gap-x-0.5">
                                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-white">{starred}</span>
                              </span>
                            )}
                          </span>
                          <span>{formatDate(c.endedAt ?? c.startedAt)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Avatar zoom lightbox */}
      {avatarZoom && (
        <PhotoLightbox
          urls={[avatarZoom]}
          index={0}
          onClose={() => setAvatarZoom(null)}
          onNavigate={() => {}}
        />
      )}
    </div>
  );
}
