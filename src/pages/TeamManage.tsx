import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { normalizeSocial } from '../lib/socials';
import {
  fetchTeamBySlug,
  fetchTeamMembers,
  fetchTeamInvites,
  updateTeam,
  deleteTeam,
  leaveTeam,
  createInvite,
  rescindInvite,
  changeRole,
  removeMember,
  type MemberWithProfile,
  type InviteWithInvitee,
} from '../lib/teamActions';
import { fetchVenueForTeam } from '../lib/dataLayer';
import {
  createInvestigation,
  type ActiveInvestigationSummary,
  listActiveInvestigationsForUser,
} from '../lib/dataLayer';
import { useToast } from '../components/ui/Toast';
import AvatarUpload from '../components/AvatarUpload';
import type { TeamRow, TeamRole, LocationRow } from '../lib/database.types';
import {
  ArrowLeft,
  Users,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Music,
  Trash2,
  Crown,
  Shield,
  User as UserIcon,
  UserPlus,
  AtSign,
  X,
  AlertTriangle,
  MoreVertical,
  LogOut,
  BadgeCheck,
  Settings2,
  Radio,
  Plus,
  ChevronRight,
} from 'lucide-react';

type Tab = 'info' | 'members' | 'danger';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleBadge(role: TeamRole) {
  if (role === 'owner')
    return { icon: <Crown className="w-3 h-3" />, label: 'OWNER', color: 'text-haunt-red' };
  if (role === 'admin')
    return { icon: <Shield className="w-3 h-3" />, label: 'ADMIN', color: 'text-amber-400' };
  return { icon: <UserIcon className="w-3 h-3" />, label: 'MEMBER', color: 'text-white/60' };
}

export default function TeamManage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invites, setInvites] = useState<InviteWithInvitee[]>([]);
  const [teamVenue, setTeamVenue] = useState<LocationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Investigations — list of active ones owned by THIS team, plus
  // inline-create state when owner/admin clicks "START INVESTIGATION".
  const [activeInvestigations, setActiveInvestigations] = useState<
    ActiveInvestigationSummary[]
  >([]);
  const [showInvCreate, setShowInvCreate] = useState(false);
  const [invLocationName, setInvLocationName] = useState('');
  const [invName, setInvName] = useState('');
  const [creatingInv, setCreatingInv] = useState(false);
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('info');

  // Determine the current user's role in this team — drives permission gates.
  const myRole = useMemo<TeamRole | null>(() => {
    if (!user) return null;
    const me = members.find((m) => m.user_id === user.id);
    return (me?.role as TeamRole | undefined) ?? null;
  }, [members, user]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    try {
      const t = await fetchTeamBySlug(slug);
      if (!t) {
        setNotFound(true);
        return;
      }
      setTeam(t);
      const [m, i, v] = await Promise.all([
        fetchTeamMembers(t.id),
        fetchTeamInvites(t.id),
        fetchVenueForTeam(t.id).catch(() => null),
      ]);
      m.sort((a, b) => {
        const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
        if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
        return a.profile.display_name.localeCompare(b.profile.display_name);
      });
      setMembers(m);
      setInvites(i);
      setTeamVenue(v);
      // Filter active investigations for this team only.
      try {
        const allActive = await listActiveInvestigationsForUser();
        setActiveInvestigations(allActive.filter((inv) => inv.team_id === t.id));
      } catch {
        // Non-blocking — empty list is fine.
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return <Navigate to="/app/teams" replace />;
  }

  if (loading || !team || !user) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 text-sm text-red-300">
          {loadError}
        </div>
      </div>
    );
  }

  // Authorization gate
  if (myRole !== 'owner' && myRole !== 'admin') {
    return <Navigate to={`/t/${team.slug}`} replace />;
  }

  const handleCreateInvestigation = async () => {
    if (!team) return;
    const loc = invLocationName.trim();
    if (!loc) {
      toast.error('Pick a location for this investigation');
      return;
    }
    setCreatingInv(true);
    const res = await createInvestigation({
      teamId: team.id,
      locationName: loc,
      name: invName.trim() || undefined,
    });
    setCreatingInv(false);
    if (!res.ok) {
      toast.error('Could not start investigation', { description: res.error });
      return;
    }
    toast.success('Investigation started');
    setShowInvCreate(false);
    setInvLocationName('');
    setInvName('');
    navigate(`/app/investigations/${res.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/app/teams')}
        className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO TEAMS
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
            <Users className="w-3.5 h-3.5" /> MANAGE
          </div>
          <h1 className="text-4xl font-medium tracking-tighter">{team.name}</h1>
          <div className="text-sm font-mono text-white/40 mt-1">@{team.slug}</div>
        </div>
        <button
          onClick={() => navigate(`/t/${team.slug}`)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest"
        >
          VIEW PUBLIC PROFILE
        </button>
      </div>

      {/* Step 24: Investigations — team-wide hunt umbrella.
          Owners/admins start one; members one-tap join via the
          app-wide banner or by typing the join code. */}
      <div className="bg-gradient-to-br from-haunt-red/10 to-zinc-900 border border-haunt-red/30 rounded-2xl px-4 py-4 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-haunt-red/20 border border-haunt-red/40 flex items-center justify-center text-haunt-red shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-haunt-red tracking-widest">
                INVESTIGATIONS
              </div>
              <div className="text-sm text-white/70 mt-0.5">
                Coordinate a team night out. Members auto-join and their sealed cases group together.
              </div>
            </div>
          </div>
          {!showInvCreate && activeInvestigations.length === 0 && (
            <button
              onClick={() => setShowInvCreate(true)}
              className="bg-haunt-red hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 shrink-0"
            >
              <Plus className="w-3 h-3" /> START
            </button>
          )}
        </div>

        {/* Active investigations list */}
        {activeInvestigations.length > 0 && (
          <div className="space-y-2 mb-3">
            {activeInvestigations.map((inv) => (
              <Link
                key={inv.id}
                to={`/app/investigations/${inv.id}`}
                className="flex items-center gap-3 bg-black/40 border border-haunt-red/30 hover:border-haunt-red rounded-xl px-3 py-2.5"
              >
                <span className="relative inline-flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-haunt-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-haunt-red"></span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {inv.name ?? inv.location_name}
                  </div>
                  <div className="text-[10px] font-mono text-white/40 tracking-widest">
                    {inv.member_count}{' '}
                    {inv.member_count === 1 ? 'INVESTIGATOR' : 'INVESTIGATORS'} ·{' '}
                    CODE {inv.join_code}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
              </Link>
            ))}
            {!showInvCreate && (
              <button
                onClick={() => setShowInvCreate(true)}
                className="inline-flex items-center gap-x-1 text-xs font-mono tracking-widest text-haunt-red hover:text-white"
              >
                <Plus className="w-3 h-3" /> START ANOTHER
              </button>
            )}
          </div>
        )}

        {/* Inline create form */}
        {showInvCreate && (
          <div className="mt-3 pt-3 border-t border-haunt-red/20 space-y-2">
            <div>
              <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
                LOCATION
              </label>
              <input
                value={invLocationName}
                onChange={(e) => setInvLocationName(e.target.value)}
                placeholder="e.g. Stanley Hotel, Estes Park, CO"
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-haunt-red outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
                LABEL (OPTIONAL)
              </label>
              <input
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder='e.g. "Halloween 2026 overnight"'
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-haunt-red outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateInvestigation}
                disabled={creatingInv || !invLocationName.trim()}
                className="bg-haunt-red hover:bg-red-600 disabled:opacity-30 text-white px-4 py-2 rounded-xl text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
              >
                {creatingInv ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Radio className="w-3 h-3" />
                )}
                START INVESTIGATION
              </button>
              <button
                onClick={() => {
                  setShowInvCreate(false);
                  setInvLocationName('');
                  setInvName('');
                }}
                className="text-white/60 hover:text-white px-3 py-2 text-xs font-mono tracking-widest"
              >
                CANCEL
              </button>
            </div>
            <div className="text-[10px] text-white/40 pt-1">
              Once started, your team members will see a banner and can one-tap join.
              Auto-closes after 24h of inactivity.
            </div>
          </div>
        )}
      </div>

      {/* Legacy: this team claimed a venue via the team-claim path
          (the older model before step 15). Card points to the new
          venue editor which still respects team-admin permissions via
          RLS. */}
      {teamVenue && (myRole === 'owner' || myRole === 'admin') && (
        <Link
          to={`/app/venues/${encodeURIComponent(teamVenue.id)}/edit`}
          className="block bg-amber-400/5 border border-amber-400/40 rounded-2xl px-4 py-3 mb-6 hover:bg-amber-400/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-amber-300 tracking-widest">
                VERIFIED LOCATION (LEGACY TEAM CLAIM)
              </div>
              <div className="text-sm">
                Manage <strong>{teamVenue.name}</strong> — description, pricing, zones, social links →
              </div>
            </div>
            <Settings2 className="w-4 h-4 text-amber-300 shrink-0" />
          </div>
        </Link>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10">
        {(['info', 'members', 'danger'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-mono tracking-widest border-b-2 transition-colors ${
              tab === t
                ? 'border-haunt-red text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            } ${t === 'danger' ? (tab === t ? 'text-red-400' : 'text-red-400/40') : ''}`}
          >
            {t === 'info' && 'TEAM INFO'}
            {t === 'members' && `MEMBERS · ${members.length}`}
            {t === 'danger' && 'DANGER ZONE'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <InfoTab team={team} onSaved={load} />
      )}

      {tab === 'members' && (
        <MembersTab
          team={team}
          members={members}
          invites={invites}
          myRole={myRole}
          myUserId={user.id}
          onChange={load}
        />
      )}

      {tab === 'danger' && (
        <DangerTab team={team} myRole={myRole} onDeleted={() => navigate('/app/teams', { replace: true })} />
      )}
    </div>
  );
}

// ============================================================
// INFO TAB
// ============================================================
function InfoTab({ team, onSaved }: { team: TeamRow; onSaved: () => void }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [logoUrl, setLogoUrl] = useState(team.logo_url ?? '');
  const [website, setWebsite] = useState(team.website ?? '');
  const [instagram, setInstagram] = useState(team.instagram ?? '');
  const [tiktok, setTiktok] = useState(team.tiktok ?? '');
  const [facebook, setFacebook] = useState(team.facebook ?? '');
  const [youtube, setYoutube] = useState(team.youtube ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }
    setSaving(true);
    const res = await updateTeam(team.id, {
      name: name.trim(),
      description: description.trim() || null,
      // logo_url omitted — managed by AvatarUpload widget
      website: normalizeSocial('website', website),
      instagram: normalizeSocial('instagram', instagram),
      tiktok: normalizeSocial('tiktok', tiktok),
      facebook: normalizeSocial('facebook', facebook),
      youtube: normalizeSocial('youtube', youtube),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 3000);
    onSaved();
  };

  return (
    <form onSubmit={onSave} className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-5">
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      {savedFlash && (
        <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-3 text-sm text-green-300 flex items-start gap-x-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          Saved.
        </div>
      )}

      <div>
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
          NAME <span className="text-haunt-red">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
          DESCRIPTION
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none"
        />
        <div className="text-xs text-white/40 mt-1 text-right">{description.length}/500</div>
      </div>

      <div>
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-3">
          TEAM LOGO
        </label>
        <AvatarUpload
          ownerId={team.id}
          currentUrl={logoUrl || null}
          fallbackInitials={(team.name || '?').slice(0, 2).toUpperCase()}
          onUploaded={async (newUrl) => {
            setLogoUrl(newUrl);
            const res = await updateTeam(team.id, { logo_url: newUrl });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 3000);
            onSaved();
          }}
          onCleared={async () => {
            setLogoUrl('');
            const res = await updateTeam(team.id, { logo_url: null });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 3000);
            onSaved();
          }}
        />
      </div>

      <div className="pt-2 border-t border-white/5">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-3 pt-3">// SOCIALS</div>
        <div className="space-y-3">
          <SocialField icon={<Globe className="w-4 h-4" />} label="WEBSITE" value={website} onChange={setWebsite} />
          <SocialField icon={<Instagram className="w-4 h-4" />} label="INSTAGRAM" value={instagram} onChange={setInstagram} />
          <SocialField icon={<Music className="w-4 h-4" />} label="TIKTOK" value={tiktok} onChange={setTiktok} />
          <SocialField icon={<Facebook className="w-4 h-4" />} label="FACEBOOK" value={facebook} onChange={setFacebook} />
          <SocialField icon={<Youtube className="w-4 h-4" />} label="YOUTUBE" value={youtube} onChange={setYoutube} />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> SAVING
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> SAVE CHANGES
          </>
        )}
      </button>
    </form>
  );
}

function SocialField({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-white/40 tracking-widest mb-1">{label}</label>
      <div className="relative">
        <div className="text-white/40 absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="@handle or full URL"
          className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:border-haunt-red outline-none text-sm"
        />
      </div>
    </div>
  );
}

// ============================================================
// MEMBERS TAB
// ============================================================
function MembersTab({
  team,
  members,
  invites,
  myRole,
  myUserId,
  onChange,
}: {
  team: TeamRow;
  members: MemberWithProfile[];
  invites: InviteWithInvitee[];
  myRole: TeamRole | null;
  myUserId: string;
  onChange: () => void;
}) {
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canInvite = myRole === 'owner' || myRole === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inviteHandle.trim()) {
      setError('Enter an investigator handle.');
      return;
    }
    setInviting(true);
    const res = await createInvite(team.id, inviteHandle.trim(), inviteRole, inviteMessage.trim() || undefined);
    setInviting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setInviteHandle('');
    setInviteMessage('');
    setInviteRole('member');
    onChange();
  };

  const handleRescind = async (inviteId: string) => {
    setBusy(inviteId);
    const res = await rescindInvite(inviteId);
    if (!res.ok) setError(res.error);
    await onChange();
    setBusy(null);
  };

  const handleRoleChange = async (userId: string, newRole: TeamRole) => {
    setBusy(userId);
    const res = await changeRole(team.id, userId, newRole);
    if (!res.ok) setError(res.error);
    await onChange();
    setBusy(null);
    setMemberMenu(null);
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    setBusy(userId);
    const res = await removeMember(team.id, userId);
    if (!res.ok) setError(res.error);
    await onChange();
    setBusy(null);
    setMemberMenu(null);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Invite form */}
      {canInvite && (
        <form
          onSubmit={handleInvite}
          className="bg-zinc-900 border border-white/10 rounded-3xl p-6"
        >
          <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
            <UserPlus className="w-3.5 h-3.5" />
            // INVITE BY HANDLE
          </div>
          <div className="grid md:grid-cols-[1fr,auto] gap-3 mb-3">
            <div className="relative">
              <AtSign className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={inviteHandle}
                onChange={(e) => setInviteHandle(e.target.value)}
                placeholder="rileyhunts"
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:border-haunt-red outline-none text-sm font-mono"
              />
            </div>
            {myRole === 'owner' && (
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="bg-black border border-white/10 rounded-xl px-3 py-2.5 focus:border-haunt-red outline-none text-sm font-mono"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            )}
          </div>
          <textarea
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            rows={2}
            placeholder="Optional message — they'll see this on their invite."
            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 mb-3 focus:border-haunt-red outline-none text-sm resize-none"
          />
          <button
            type="submit"
            disabled={inviting}
            className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-2.5 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
          >
            {inviting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> SENDING
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> SEND INVITE
              </>
            )}
          </button>
        </form>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <div className="text-xs font-mono text-white/40 tracking-widest mb-2">
            // PENDING INVITES · {invites.length}
          </div>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-3 flex items-center gap-3"
              >
                {inv.invitee.avatar_url ? (
                  <img src={inv.invitee.avatar_url} alt="" className="w-10 h-10 rounded-xl shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white/40 shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {inv.invitee.display_name}
                  </div>
                  <div className="text-xs font-mono text-white/40 truncate">
                    {inv.invitee.handle} · as {inv.role} · sent {formatDateTime(inv.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleRescind(inv.id)}
                  disabled={busy === inv.id}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-300 rounded-lg text-xs font-mono tracking-widest"
                >
                  {busy === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'RESCIND'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div>
        <div className="text-xs font-mono text-white/40 tracking-widest mb-2">
          // MEMBERS · {members.length}
        </div>
        <div className="space-y-2">
          {members.map((m) => {
            const r = roleBadge(m.role);
            const isMe = m.user_id === myUserId;
            const canManageThis =
              myRole === 'owner' && !isMe;
            const adminCanRemove = myRole === 'admin' && !isMe && m.role === 'member';

            return (
              <div
                key={m.user_id}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-3 flex items-center gap-3 relative"
              >
                {m.profile.avatar_url ? (
                  <img
                    src={m.profile.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-xl shrink-0"
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.profile.display_name}
                    {isMe && <span className="text-white/40 ml-1">(you)</span>}
                  </div>
                  <div className="text-xs font-mono text-white/40 truncate">
                    {m.profile.handle}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest shrink-0 px-2 py-1 bg-white/5 rounded-md ${r.color}`}
                >
                  {r.icon}
                  {r.label}
                </span>
                {(canManageThis || adminCanRemove) && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMemberMenu(memberMenu === m.user_id ? null : m.user_id)
                      }
                      className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {memberMenu === m.user_id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-950 border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
                        {canManageThis && m.role !== 'owner' && (
                          <button
                            onClick={() => handleRoleChange(m.user_id, 'owner')}
                            className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/5 flex items-center gap-x-2 text-haunt-red"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            Transfer ownership
                          </button>
                        )}
                        {canManageThis && m.role === 'member' && (
                          <button
                            onClick={() => handleRoleChange(m.user_id, 'admin')}
                            className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/5 flex items-center gap-x-2"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Promote to admin
                          </button>
                        )}
                        {canManageThis && m.role === 'admin' && (
                          <button
                            onClick={() => handleRoleChange(m.user_id, 'member')}
                            className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/5 flex items-center gap-x-2"
                          >
                            <UserIcon className="w-3.5 h-3.5" />
                            Demote to member
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(m.user_id)}
                          disabled={busy === m.user_id}
                          className="w-full px-3 py-2.5 text-left text-xs hover:bg-red-500/10 flex items-center gap-x-2 text-red-300 border-t border-white/5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Remove from team
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DANGER TAB
// ============================================================
function DangerTab({
  team,
  myRole,
  onDeleted,
}: {
  team: TeamRow;
  myRole: TeamRole | null;
  onDeleted: () => void;
}) {
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleLeave = async () => {
    if (!confirm('Leave this team?')) return;
    setLeaveBusy(true);
    const res = await leaveTeam(team.id);
    setLeaveBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDeleted();
  };

  const handleDelete = async () => {
    if (confirmText !== team.name) return;
    setDeleteBusy(true);
    const res = await deleteTeam(team.id);
    setDeleteBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDeleted();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Leave */}
      {myRole !== 'owner' && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6">
          <div className="text-xs font-mono text-amber-400 tracking-widest mb-2 flex items-center gap-x-2">
            <LogOut className="w-3.5 h-3.5" />
            // LEAVE TEAM
          </div>
          <h3 className="text-lg font-medium mb-2">Leave {team.name}</h3>
          <p className="text-sm text-white/70 mb-4 leading-relaxed">
            You'll lose access to team-only content. Cases you logged personally stay
            yours. You can be re-invited any time.
          </p>
          <button
            onClick={handleLeave}
            disabled={leaveBusy}
            className="px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-sm font-mono tracking-widest disabled:opacity-50 flex items-center gap-x-2"
          >
            {leaveBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            LEAVE TEAM
          </button>
        </div>
      )}

      {/* Delete (owner only) */}
      {myRole === 'owner' && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-6">
          <div className="text-xs font-mono text-red-400 tracking-widest mb-2 flex items-center gap-x-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            // DELETE TEAM
          </div>
          <h3 className="text-lg font-medium mb-2">Delete {team.name}</h3>
          <p className="text-sm text-white/70 mb-4 leading-relaxed">
            Permanently deletes the team, its members list, and all pending invites.
            Cases authored under the team's name stay published (attributed to "Deleted team").
            <span className="block mt-2 text-red-300">This cannot be undone.</span>
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-xl text-sm font-mono tracking-widest flex items-center gap-x-2"
            >
              <Trash2 className="w-4 h-4" />
              DELETE TEAM
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/70">
                Type <span className="font-mono text-red-300">{team.name}</span> to confirm:
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:border-red-500 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setConfirmText('');
                  }}
                  className="flex-1 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-mono tracking-widest"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== team.name || deleteBusy}
                  className="flex-1 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-red-300 rounded-xl text-sm font-mono tracking-widest flex items-center justify-center gap-x-2"
                >
                  {deleteBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  CONFIRM DELETE
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
