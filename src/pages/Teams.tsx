import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import {
  fetchMyTeams,
  fetchMyPendingInvites,
  acceptInvite,
  declineInvite,
  type TeamMembershipWithTeam,
  type InviteWithTeamAndInviter,
} from '../lib/teamActions';
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  BadgeCheck,
  Crown,
  Shield,
  User as UserIcon,
  Mail,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

function formatRole(role: string) {
  if (role === 'owner')
    return { label: 'OWNER', icon: <Crown className="w-3 h-3" />, color: 'text-haunt-red' };
  if (role === 'admin')
    return { label: 'ADMIN', icon: <Shield className="w-3 h-3" />, color: 'text-amber-400' };
  return { label: 'MEMBER', icon: <UserIcon className="w-3 h-3" />, color: 'text-white/60' };
}

export default function Teams() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [teams, setTeams] = useState<TeamMembershipWithTeam[]>([]);
  const [invites, setInvites] = useState<InviteWithTeamAndInviter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [t, i] = await Promise.all([fetchMyTeams(user.id), fetchMyPendingInvites(user.id)]);
      setTeams(t);
      setInvites(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (inviteId: string) => {
    setActing(inviteId);
    const res = await acceptInvite(inviteId);
    if (!res.ok) setError(res.error);
    await load();
    setActing(null);
  };

  const handleDecline = async (inviteId: string) => {
    setActing(inviteId);
    const res = await declineInvite(inviteId);
    if (!res.ok) setError(res.error);
    await load();
    setActing(null);
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
            <Users className="w-3.5 h-3.5" /> TEAMS
          </div>
          <h1 className="text-4xl font-medium tracking-tighter">Your teams</h1>
          <p className="text-white/60 text-sm mt-1">
            Investigate together. Manage members. Build a reputation.
          </p>
        </div>
        <button
          onClick={() => navigate('/app/teams/new')}
          className="px-5 py-2.5 bg-haunt-red hover:bg-red-600 text-white rounded-xl font-mono tracking-widest text-sm flex items-center gap-x-2"
        >
          <Plus className="w-4 h-4" /> NEW TEAM
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-mono text-white/40 tracking-widest mb-2 flex items-center gap-x-2">
            <Mail className="w-3 h-3" /> PENDING INVITES · {invites.length}
          </div>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="bg-haunt-red/5 border border-haunt-red/30 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <div className="text-xs font-mono text-haunt-red tracking-widest mb-1">
                      INVITED AS {inv.role.toUpperCase()}
                    </div>
                    <div className="text-lg font-medium">{inv.team.name}</div>
                    {inv.inviter && (
                      <div className="text-xs text-white/60 mt-1">
                        From{' '}
                        <span className="text-white/90">{inv.inviter.display_name}</span>{' '}
                        ({inv.inviter.handle})
                      </div>
                    )}
                  </div>
                </div>
                {inv.message && (
                  <p className="text-sm text-white/70 italic bg-zinc-900/50 border border-white/5 rounded-lg p-3 mb-3 whitespace-pre-wrap">
                    "{inv.message}"
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(inv.id)}
                    disabled={acting === inv.id}
                    className="flex-1 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 disabled:opacity-50 text-green-300 rounded-xl text-xs font-mono tracking-widest flex items-center justify-center gap-x-2"
                  >
                    {acting === inv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    ACCEPT
                  </button>
                  <button
                    onClick={() => handleDecline(inv.id)}
                    disabled={acting === inv.id}
                    className="flex-1 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-300 rounded-xl text-xs font-mono tracking-widest flex items-center justify-center gap-x-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    DECLINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams */}
      <div className="text-xs font-mono text-white/40 tracking-widest mb-2">
        // YOUR TEAMS · {teams.length}
      </div>

      {loading && (
        <div className="text-center py-10">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
        </div>
      )}

      {!loading && teams.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <Users className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <h2 className="text-2xl font-medium mb-2">You're not on any teams yet.</h2>
          <p className="text-white/60 mb-6">
            Create one and invite the rest of your crew, or wait for an invite.
          </p>
          <button
            onClick={() => navigate('/app/teams/new')}
            className="bg-haunt-red hover:bg-red-600 text-white px-6 py-3 rounded-xl font-mono tracking-widest text-sm"
          >
            CREATE A TEAM
          </button>
        </div>
      )}

      <div className="space-y-2">
        {teams.map((m) => {
          const r = formatRole(m.role);
          return (
            <div
              key={m.team_id}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-white/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-x-2 mb-1">
                    <button
                      onClick={() => navigate(`/t/${m.team.slug}`)}
                      className="text-lg font-medium hover:text-haunt-red transition-colors text-left"
                    >
                      {m.team.name}
                    </button>
                    {m.team.verified && (
                      <BadgeCheck className="w-4 h-4 text-haunt-red shrink-0" />
                    )}
                  </div>
                  <div className="text-xs font-mono text-white/40">@{m.team.slug}</div>
                  {m.team.description && (
                    <p className="text-sm text-white/70 mt-2 line-clamp-2">
                      {m.team.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest px-2 py-1 bg-white/5 rounded-md ${r.color}`}
                  >
                    {r.icon}
                    {r.label}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => navigate(`/t/${m.team.slug}`)}
                  className="px-3 py-1.5 text-xs font-mono tracking-widest text-white/70 hover:text-white flex items-center gap-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> VIEW PUBLIC
                </button>
                {(m.role === 'owner' || m.role === 'admin') && (
                  <button
                    onClick={() => navigate(`/app/teams/${m.team.slug}/manage`)}
                    className="px-3 py-1.5 text-xs font-mono tracking-widest text-haunt-red hover:bg-haunt-red/10 rounded-lg"
                  >
                    MANAGE →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
