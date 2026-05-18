import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchTeamBySlug,
  fetchTeamMembers,
  type MemberWithProfile,
} from '../lib/teamActions';
import {
  fetchPublicCasesByTeamId,
  fetchTeamStats,
  type TeamListing,
} from '../lib/dataLayer';
import type { TeamRow } from '../lib/database.types';
import type { CaseFile } from '../store/useHauntStore';
import SocialLinks from '../components/SocialLinks';
import StatStrip, { formatCount } from '../components/StatStrip';
import PublicNav from '../components/PublicNav';
import PhotoLightbox from '../components/PhotoLightbox';
import {
  ArrowLeft,
  Users,
  Loader2,
  BadgeCheck,
  Calendar,
  Crown,
  Shield,
  User as UserIcon,
  MapPin,
  Globe,
  Star,
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

function roleBadge(role: string) {
  if (role === 'owner')
    return { icon: <Crown className="w-3 h-3" />, label: 'OWNER', color: 'text-haunt-red' };
  if (role === 'admin')
    return { icon: <Shield className="w-3 h-3" />, label: 'ADMIN', color: 'text-amber-400' };
  return { icon: <UserIcon className="w-3 h-3" />, label: 'MEMBER', color: 'text-white/60' };
}

export default function TeamProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamListing | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>(
    'loading'
  );
  const [error, setError] = useState<string | null>(null);

  // Lightbox state for blowing up the team logo.
  const [logoZoom, setLogoZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setStatus('not_found');
      return;
    }
    (async () => {
      try {
        const t = await fetchTeamBySlug(slug);
        if (!t) {
          setStatus('not_found');
          return;
        }
        setTeam(t);
        const m = await fetchTeamMembers(t.id);
        m.sort((a, b) => {
          const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
          if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
          return a.profile.display_name.localeCompare(b.profile.display_name);
        });
        setMembers(m);
        setStatus('found');

        // Fetch public team cases + team stats in parallel.
        setCasesLoading(true);
        await Promise.all([
          fetchPublicCasesByTeamId(t.id)
            .then((list) => setCases(list))
            .catch(() => {
              /* best-effort */
            })
            .finally(() => setCasesLoading(false)),
          fetchTeamStats(t.id)
            .then((s) => setTeamStats(s))
            .catch(() => {
              /* best-effort */
            }),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, [slug]);

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
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">// 404</div>
            <h1 className="text-3xl font-medium mb-3">Team not found</h1>
            <p className="text-white/60 mb-6">
              No team with the slug <span className="font-mono">@{slug}</span>.
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

        {status === 'found' && team && (
          <>
            <div className="text-xs font-mono text-haunt-red tracking-widest mb-4 flex items-center gap-x-2">
              <Users className="w-3.5 h-3.5" /> TEAM
            </div>

            <div className="flex items-start gap-5 mb-6 flex-wrap">
              <div className="shrink-0">
                {team.logo_url ? (
                  <button
                    type="button"
                    onClick={() => setLogoZoom(team.logo_url)}
                    aria-label="View team logo full size"
                    className="block rounded-3xl overflow-hidden hover:ring-2 hover:ring-haunt-red/60 transition-all"
                  >
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-24 h-24 rounded-3xl object-cover border border-white/10"
                    />
                  </button>
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {team.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-x-2 flex-wrap">
                  <h1 className="text-3xl md:text-4xl font-medium tracking-tighter break-words">
                    {team.name}
                  </h1>
                  {team.verified && (
                    <BadgeCheck className="w-6 h-6 text-haunt-red shrink-0" />
                  )}
                </div>
                <div className="text-white/60 font-mono text-sm mt-1">@{team.slug}</div>
                <div className="flex items-center gap-x-3 text-white/40 text-xs mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-x-1">
                    <Calendar className="w-3 h-3" />
                    Founded {formatJoinDate(team.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-x-1">
                    <Users className="w-3 h-3" />
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            </div>

            {team.description && (
              <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">
                {team.description}
              </p>
            )}

            <div className="mb-8">
              <SocialLinks
                value={{
                  website: team.website,
                  instagram: team.instagram,
                  tiktok: team.tiktok,
                  facebook: team.facebook,
                  youtube: team.youtube,
                }}
              />
            </div>

            {/* Team stats strip */}
            {teamStats && (
              <div className="mb-8">
                <div className="text-xs font-mono text-white/40 tracking-widest mb-3 flex items-center gap-x-2">
                  <Activity className="w-3.5 h-3.5" />
                  // STATS
                </div>
                <StatStrip
                  stats={[
                    {
                      label: 'Members',
                      value: formatCount(teamStats.member_count),
                      icon: <Users className="w-3 h-3" />,
                      hint: teamStats.member_count === 1 ? 'investigator' : 'investigators',
                    },
                    {
                      label: 'Public cases',
                      value: formatCount(teamStats.public_case_count),
                      icon: <FileText className="w-3 h-3" />,
                      hint: teamStats.public_case_count === 0 ? 'No public team cases yet' : 'team-attributed',
                    },
                    {
                      label: 'Founded',
                      value: new Date(team.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                      }),
                      icon: <Calendar className="w-3 h-3" />,
                    },
                    {
                      label: 'Status',
                      value: team.verified ? 'Verified' : 'Active',
                      icon: <BadgeCheck className="w-3 h-3" />,
                      hint: team.verified ? 'verified by admin' : 'standard team',
                    },
                  ]}
                />
              </div>
            )}

            {/* Members */}
            <div className="border-t border-white/10 pt-8 mb-10">
              <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
                <Users className="w-3.5 h-3.5" /> MEMBERS · {members.length}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {members.map((m) => {
                  const r = roleBadge(m.role);
                  return (
                    <Link
                      key={m.user_id}
                      to={`/u/${encodeURIComponent(m.profile.handle)}`}
                      className="bg-zinc-900 border border-white/10 rounded-2xl p-3 flex items-center gap-3 hover:border-haunt-red/40 transition-colors"
                    >
                      {m.profile.avatar_url ? (
                        <img
                          src={m.profile.avatar_url}
                          alt={m.profile.display_name}
                          className="w-10 h-10 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {m.profile.display_name
                            .split(' ')
                            .map((p) => p[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {m.profile.display_name}
                        </div>
                        <div className="text-xs font-mono text-white/40 truncate">
                          {m.profile.handle}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest shrink-0 ${r.color}`}
                      >
                        {r.icon}
                        {r.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Public cases */}
            <div className="border-t border-white/10 pt-8">
              <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
                <MapPin className="w-3.5 h-3.5" /> PUBLIC CASES · {cases.length}
              </div>

              {casesLoading ? (
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
                </div>
              ) : cases.length === 0 ? (
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center text-white/40 text-sm">
                  No public team cases yet.
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

      {/* Team logo zoom lightbox */}
      {logoZoom && (
        <PhotoLightbox
          urls={[logoZoom]}
          index={0}
          onClose={() => setLogoZoom(null)}
          onNavigate={() => {}}
        />
      )}
    </div>
  );
}
