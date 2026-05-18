import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  fetchInvestigation,
  fetchInvestigationMembers,
  fetchInvestigationCases,
  joinInvestigationById,
  leaveInvestigation,
  closeInvestigation,
  listInvestigationGroups,
  createInvestigationGroup,
  joinInvestigationGroup,
  leaveInvestigationGroup,
  endInvestigationGroup,
  fetchMyInvestigationGroup,
  type InvestigationRow,
  type InvestigationGroupRow,
} from '../lib/dataLayer';
import { fetchMyTeams } from '../lib/teamActions';
import { useAuth } from '../lib/useAuth';
import { useToast } from '../components/ui/Toast';
import {
  Radio,
  MapPin,
  Users,
  Clock,
  Copy,
  Check,
  X,
  Lock,
  ChevronLeft,
  FileText,
  Loader2,
  UsersRound,
  Plus,
  Crown,
} from 'lucide-react';

type MemberRow = {
  user_id: string;
  joined_at: string;
  left_at: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function InvestigationView() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [inv, setInv] = useState<InvestigationRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iAmMember, setIAmMember] = useState(false);
  const [iCanManageTeam, setICanManageTeam] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [closing, setClosing] = useState(false);

  // Step 25: groups
  const [groups, setGroups] = useState<InvestigationGroupRow[]>([]);
  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [newGroupZone, setNewGroupZone] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupActionPending, setGroupActionPending] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const i = await fetchInvestigation(id);
        if (cancelled) return;
        if (!i) {
          setError('Investigation not found or you do not have access.');
          setLoading(false);
          return;
        }
        setInv(i);
        const [m, c, g] = await Promise.all([
          fetchInvestigationMembers(id),
          fetchInvestigationCases(id),
          listInvestigationGroups(id),
        ]);
        if (cancelled) return;
        setMembers(m);
        setCases(c);
        setGroups(g);
        if (authUser) {
          setIAmMember(
            m.some((x) => x.user_id === authUser.id && x.left_at === null)
          );
          // Fetch my current group_id within this investigation.
          const mine = await fetchMyInvestigationGroup(id, authUser.id);
          if (!cancelled) setMyGroupId(mine.group_id);
          // Check if the viewer is an owner/admin of the parent team.
          const teams = await fetchMyTeams(authUser.id);
          const t = teams.find((tm) => tm.team_id === i.team_id);
          setICanManageTeam(
            !!t && (t.role === 'owner' || t.role === 'admin')
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, authUser]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }
  if (error || !inv) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 text-center">
          <div className="text-sm text-white/70">{error ?? 'Not found.'}</div>
          <Link
            to="/app/teams"
            className="inline-flex items-center gap-x-1 text-xs font-mono tracking-widest text-haunt-red hover:text-white mt-4"
          >
            <ChevronLeft className="w-3 h-3" /> BACK TO TEAMS
          </Link>
        </div>
      </div>
    );
  }

  const isOpen = inv.status === 'open';
  const isHost = authUser?.id === inv.host_id;
  const canClose = isOpen && (isHost || iCanManageTeam);

  const handleJoin = async () => {
    if (!authUser || !id) return;
    setJoining(true);
    const res = await joinInvestigationById(id, authUser.id);
    setJoining(false);
    if (!res.ok) {
      toast.error('Could not join', { description: res.error });
      return;
    }
    toast.success('Joined investigation');
    setIAmMember(true);
    // Refetch members
    const m = await fetchInvestigationMembers(id);
    setMembers(m);
  };

  const handleLeave = async () => {
    if (!authUser || !id) return;
    if (!confirm('Leave this investigation?')) return;
    const res = await leaveInvestigation(id, authUser.id);
    if (!res.ok) {
      toast.error('Could not leave', { description: res.error });
      return;
    }
    toast.success('Left investigation');
    setIAmMember(false);
    const m = await fetchInvestigationMembers(id);
    setMembers(m);
  };

  const handleClose = async () => {
    if (!id) return;
    if (
      !confirm(
        'Close this investigation? Members will no longer be able to auto-link new cases to it.'
      )
    )
      return;
    setClosing(true);
    const res = await closeInvestigation(id);
    setClosing(false);
    if (!res.ok) {
      toast.error('Could not close', { description: res.error });
      return;
    }
    toast.success('Investigation closed');
    const refreshed = await fetchInvestigation(id);
    if (refreshed) setInv(refreshed);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inv.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  // ------- Step 25: group handlers -------
  const refreshGroups = async () => {
    if (!id || !authUser) return;
    const [g, mine] = await Promise.all([
      listInvestigationGroups(id),
      fetchMyInvestigationGroup(id, authUser.id),
    ]);
    setGroups(g);
    setMyGroupId(mine.group_id);
  };

  const handleCreateGroup = async () => {
    if (!id) return;
    const zone = newGroupZone.trim();
    if (!zone) {
      toast.error('Give the group a zone name');
      return;
    }
    setCreatingGroup(true);
    const res = await createInvestigationGroup(id, zone);
    setCreatingGroup(false);
    if (!res.ok) {
      toast.error('Could not create group', { description: res.error });
      return;
    }
    toast.success(`"${zone}" created`);
    setShowGroupCreate(false);
    setNewGroupZone('');
    await refreshGroups();
  };

  const handleJoinGroup = async (groupId: string) => {
    setGroupActionPending(groupId);
    const res = await joinInvestigationGroup(groupId);
    setGroupActionPending(null);
    if (!res.ok) {
      toast.error('Could not join group', { description: res.error });
      return;
    }
    toast.success('Joined group');
    await refreshGroups();
  };

  const handleLeaveGroup = async () => {
    if (!id) return;
    setGroupActionPending('leave');
    const res = await leaveInvestigationGroup(id);
    setGroupActionPending(null);
    if (!res.ok) {
      toast.error('Could not leave group', { description: res.error });
      return;
    }
    toast.success('Going solo');
    await refreshGroups();
  };

  const handleEndGroup = async (groupId: string, zone: string) => {
    if (!confirm(`End the "${zone}" group?`)) return;
    setGroupActionPending(groupId);
    const res = await endInvestigationGroup(groupId);
    setGroupActionPending(null);
    if (!res.ok) {
      toast.error('Could not end group', { description: res.error });
      return;
    }
    toast.success('Group ended');
    await refreshGroups();
  };

  const startHunt = () => {
    // Navigate to HuntStart with the investigation id and prefilled location.
    // If the user is currently in a group, pass that through too.
    const params = new URLSearchParams();
    params.set('investigation', inv.id);
    if (inv.venue_id) params.set('venue', inv.venue_id);
    params.set('location', inv.location_name);
    if (myGroupId) {
      params.set('group', myGroupId);
      const g = groups.find((x) => x.id === myGroupId);
      if (g) params.set('zone', g.zone);
    }
    navigate(`/app/hunt/new?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <Link
        to="/app/teams"
        className="inline-flex items-center gap-x-1 text-xs font-mono tracking-widest text-white/50 hover:text-white mb-4"
      >
        <ChevronLeft className="w-3 h-3" /> TEAMS
      </Link>

      {/* Header */}
      <div
        className={`rounded-3xl p-6 mb-6 ${
          isOpen
            ? 'bg-gradient-to-br from-haunt-red/10 to-zinc-900 border border-haunt-red/30'
            : 'bg-zinc-900 border border-white/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-x-2 mb-2">
              {isOpen ? (
                <>
                  <span className="relative inline-flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-haunt-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-haunt-red"></span>
                  </span>
                  <span className="text-xs font-mono tracking-widest text-haunt-red">
                    LIVE INVESTIGATION
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-white/40" />
                  <span className="text-xs font-mono tracking-widest text-white/40">
                    CLOSED
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">
              {inv.name ?? inv.location_name}
            </h1>
            {inv.name && (
              <div className="text-white/60 text-sm mt-1 flex items-center gap-x-1">
                <MapPin className="w-3.5 h-3.5" />
                {inv.location_name}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-white/60 mt-4 pt-4 border-t border-white/10">
          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-0.5">
              STARTED
            </div>
            <div>{formatWhen(inv.started_at)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-0.5">
              {inv.closed_at ? 'CLOSED' : 'LAST ACTIVITY'}
            </div>
            <div>
              {inv.closed_at
                ? formatWhen(inv.closed_at)
                : formatWhen(inv.last_activity_at)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-white/40 tracking-widest mb-0.5">
              MEMBERS
            </div>
            <div>
              {members.filter((m) => !m.left_at).length} active
              {members.some((m) => m.left_at) &&
                ` · ${members.filter((m) => m.left_at).length} left`}
            </div>
          </div>
        </div>

        {/* Join code (only while open) */}
        {isOpen && iAmMember && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-[10px] font-mono text-white/40 tracking-widest">
                JOIN CODE
              </div>
              <div className="text-2xl font-mono tracking-[0.3em] text-white">
                {inv.join_code}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono tracking-widest text-white/70 inline-flex items-center gap-x-1.5"
            >
              {codeCopied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {codeCopied ? 'COPIED' : 'COPY'}
            </button>
            <div className="text-xs text-white/40 ml-auto">
              Share this code with your teammates.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
          {isOpen && !iAmMember && authUser && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="bg-haunt-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-mono tracking-widest disabled:opacity-50"
            >
              {joining ? 'JOINING…' : 'JOIN INVESTIGATION'}
            </button>
          )}
          {isOpen && iAmMember && (
            <button
              onClick={startHunt}
              className="bg-haunt-red hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
            >
              <Radio className="w-3 h-3" /> START MY HUNT
            </button>
          )}
          {isOpen && iAmMember && !isHost && (
            <button
              onClick={handleLeave}
              className="text-white/60 hover:text-white px-3 py-2 rounded-xl text-xs font-mono tracking-widest"
            >
              LEAVE
            </button>
          )}
          {canClose && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="ml-auto text-white/60 hover:text-haunt-red px-3 py-2 rounded-xl text-xs font-mono tracking-widest disabled:opacity-50 inline-flex items-center gap-x-1.5"
            >
              <X className="w-3 h-3" /> {closing ? 'CLOSING…' : 'CLOSE INVESTIGATION'}
            </button>
          )}
        </div>
      </div>

      {/* Step 25: Groups — sub-parties within the investigation */}
      {iAmMember && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-x-2">
              <UsersRound className="w-4 h-4 text-white/40" />
              <div className="text-xs font-mono text-white/40 tracking-widest">
                GROUPS · {groups.filter((g) => !g.ended_at).length} ACTIVE
              </div>
            </div>
            {inv.status === 'open' && !showGroupCreate && (
              <button
                onClick={() => setShowGroupCreate(true)}
                className="inline-flex items-center gap-x-1.5 text-xs font-mono tracking-widest text-haunt-red hover:text-white"
              >
                <Plus className="w-3 h-3" /> ANNOUNCE A GROUP
              </button>
            )}
          </div>

          {/* My status row */}
          {inv.status === 'open' && (
            <div className="bg-black/40 border border-white/10 rounded-2xl px-3 py-2 mb-3 text-xs flex items-center justify-between gap-3 flex-wrap">
              <div className="text-white/60">
                {myGroupId
                  ? (() => {
                      const g = groups.find((x) => x.id === myGroupId);
                      return g ? (
                        <>
                          You're with <strong className="text-white">{g.zone}</strong>
                        </>
                      ) : (
                        'You are in a group'
                      );
                    })()
                  : (
                    <>
                      <span className="text-white">Going solo</span> — tap a group below to join one.
                    </>
                  )}
              </div>
              {myGroupId && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={groupActionPending === 'leave'}
                  className="text-xs font-mono tracking-widest text-white/60 hover:text-white disabled:opacity-40"
                >
                  {groupActionPending === 'leave' ? 'LEAVING…' : 'GO SOLO'}
                </button>
              )}
            </div>
          )}

          {/* Inline create form */}
          {showGroupCreate && (
            <div className="bg-haunt-red/5 border border-haunt-red/30 rounded-2xl p-3 mb-3 space-y-2">
              <label className="block text-[10px] font-mono text-white/40 tracking-widest">
                ZONE / GROUP NAME
              </label>
              <input
                value={newGroupZone}
                onChange={(e) => setNewGroupZone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                placeholder='e.g. "Basement sweep" or "Third floor & bell tower"'
                maxLength={80}
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-haunt-red outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={creatingGroup || !newGroupZone.trim()}
                  className="bg-haunt-red hover:bg-red-600 disabled:opacity-30 text-white px-4 py-2 rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
                >
                  {creatingGroup ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UsersRound className="w-3 h-3" />
                  )}
                  CREATE
                </button>
                <button
                  onClick={() => {
                    setShowGroupCreate(false);
                    setNewGroupZone('');
                  }}
                  className="text-white/60 hover:text-white px-3 py-2 text-xs font-mono tracking-widest"
                >
                  CANCEL
                </button>
              </div>
              <div className="text-[10px] text-white/40">
                You'll be the leader. Others can self-select to join your group.
              </div>
            </div>
          )}

          {/* Group list */}
          {groups.length === 0 ? (
            <div className="text-sm text-white/40 text-center py-4">
              {inv.status === 'open'
                ? 'No groups yet. Announce one if your team is splitting up.'
                : 'No groups were formed during this investigation.'}
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const isMine = myGroupId === g.id;
                const isLeader = authUser?.id === g.leader_id;
                const ended = !!g.ended_at;
                return (
                  <div
                    key={g.id}
                    className={`rounded-2xl p-3 border ${
                      isMine
                        ? 'bg-haunt-red/10 border-haunt-red/50'
                        : ended
                        ? 'bg-black/30 border-white/5 opacity-60'
                        : 'bg-black border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-x-2 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">
                            {g.zone}
                          </span>
                          {isLeader && (
                            <Crown className="w-3 h-3 text-yellow-400 shrink-0" />
                          )}
                          {ended && (
                            <span className="text-[10px] font-mono text-white/40 tracking-widest">
                              ENDED
                            </span>
                          )}
                          {isMine && !ended && (
                            <span className="text-[10px] font-mono text-haunt-red tracking-widest">
                              YOU'RE IN
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-white/40 tracking-widest">
                          LED BY @
                          {g.leader_handle ?? '?'} · {g.member_count}{' '}
                          {g.member_count === 1 ? 'MEMBER' : 'MEMBERS'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inv.status === 'open' && !ended && !isMine && (
                          <button
                            onClick={() => handleJoinGroup(g.id)}
                            disabled={groupActionPending === g.id}
                            className="bg-white/10 hover:bg-haunt-red text-white px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest disabled:opacity-50"
                          >
                            {groupActionPending === g.id
                              ? 'JOINING…'
                              : myGroupId
                              ? 'SWITCH IN'
                              : 'JOIN'}
                          </button>
                        )}
                        {(isLeader || iCanManageTeam) && !ended && inv.status === 'open' && (
                          <button
                            onClick={() => handleEndGroup(g.id, g.zone)}
                            disabled={groupActionPending === g.id}
                            className="text-white/40 hover:text-red-400 text-xs font-mono tracking-widest disabled:opacity-40"
                            title="End this group"
                          >
                            END
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-x-2 mb-3">
          <Users className="w-4 h-4 text-white/40" />
          <div className="text-xs font-mono text-white/40 tracking-widest">
            INVESTIGATORS · {members.length}
          </div>
        </div>
        {members.length === 0 ? (
          <div className="text-sm text-white/40">No members yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <Link
                key={m.user_id}
                to={`/u/${m.handle ?? m.user_id}`}
                className={`flex items-center gap-x-3 rounded-2xl p-3 border ${
                  m.left_at
                    ? 'border-white/5 bg-black/30 opacity-50'
                    : 'border-white/10 bg-black hover:border-white/30'
                }`}
              >
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-haunt-red/20 flex items-center justify-center text-haunt-red text-xs font-mono">
                    {(m.handle ?? '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {m.display_name ?? `@${m.handle}`}
                    {m.user_id === inv.host_id && (
                      <span className="ml-1.5 text-[10px] font-mono text-haunt-red tracking-widest">
                        HOST
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-white/40 tracking-widest">
                    {m.left_at ? 'LEFT' : 'JOINED ' + formatWhen(m.joined_at).toUpperCase()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cases */}
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-x-2">
            <FileText className="w-4 h-4 text-white/40" />
            <div className="text-xs font-mono text-white/40 tracking-widest">
              CASES SEALED · {cases.length}
            </div>
          </div>
          <Clock className="w-3 h-3 text-white/30" />
        </div>
        {cases.length === 0 ? (
          <div className="text-sm text-white/50 text-center py-6">
            {isOpen
              ? 'No cases sealed yet. Start your hunt and seal a case to add it here.'
              : 'No cases were sealed during this investigation.'}
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c: any) => (
              <Link
                key={c.id}
                to={`/case/${c.id}`}
                className="block bg-black border border-white/10 hover:border-haunt-red/40 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-xs font-mono text-white/40 tracking-widest">
                    #{c.id}
                  </div>
                  {c.zone && (
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">
                      {c.zone.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-white/40 mt-1">
                  {formatWhen(c.ended_at ?? c.started_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
