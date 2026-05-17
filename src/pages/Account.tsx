import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import {
  changeEmail,
  changePassword,
  deleteMyAccount,
} from '../lib/profileActions';
import {
  Lock,
  Mail,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Bell,
  MessageSquare,
  ShieldCheck,
  AtSign,
} from 'lucide-react';

export default function Account() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Flash messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const onSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const res = await changePassword(newPassword);
    setSavingPassword(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    flashSuccess('Password updated.');
  };

  const onSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    const res = await changeEmail(newEmail);
    setSavingEmail(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    flashSuccess(
      `Confirmation links sent to both your old (${user.email}) and new (${newEmail}) addresses. Click the link in your NEW inbox to complete the change.`
    );
    setNewEmail('');
  };

  const onConfirmDelete = async () => {
    if (deleteConfirm !== 'DELETE MY ACCOUNT') return;
    setError(null);
    setDeleting(true);
    const res = await deleteMyAccount();
    setDeleting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/profile')}
        className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO PROFILE
      </button>

      <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
        // ACCOUNT
      </div>
      <h1 className="text-4xl font-medium tracking-tighter mb-2">
        Account settings
      </h1>
      <p className="text-white/60 text-sm mb-8">
        Email, password, and account closure.
      </p>

      {(error || success) && (
        <div
          className={`rounded-xl p-3 text-sm mb-6 flex items-start gap-x-2 ${
            error
              ? 'bg-red-950/40 border border-red-500/30 text-red-300'
              : 'bg-green-950/40 border border-green-500/30 text-green-300'
          }`}
        >
          {error ? (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="break-words">{error ?? success}</span>
        </div>
      )}

      {/* Current email (read-only display) */}
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
        <h2 className="text-xs font-mono text-white/40 tracking-widest mb-3">
          // CURRENT EMAIL
        </h2>
        <div className="font-mono text-sm">{user.email}</div>
      </div>

      {/* CHANGE PASSWORD */}
      <form
        onSubmit={onSavePassword}
        className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6 space-y-4"
      >
        <h2 className="text-xs font-mono text-white/40 tracking-widest">
          // CHANGE PASSWORD
        </h2>

        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            NEW PASSWORD
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            CONFIRM
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
              placeholder="Re-enter the same password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!newPassword || !confirmPassword || savingPassword}
          className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
        >
          {savingPassword ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> SAVING
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> CHANGE PASSWORD
            </>
          )}
        </button>
      </form>

      {/* CHANGE EMAIL */}
      <form
        onSubmit={onSaveEmail}
        className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6 space-y-4"
      >
        <h2 className="text-xs font-mono text-white/40 tracking-widest">
          // CHANGE EMAIL
        </h2>

        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            NEW EMAIL
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
              placeholder="new@example.com"
            />
          </div>
          <div className="text-xs text-white/40 mt-1">
            We'll send a confirmation to your new address. You'll need to click the link to complete the change.
          </div>
        </div>

        <button
          type="submit"
          disabled={!newEmail || savingEmail}
          className="w-full bg-white/10 hover:bg-white/20 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
        >
          {savingEmail ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> SENDING
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> SEND CONFIRMATION
            </>
          )}
        </button>
      </form>

      {/* NOTIFICATION PREFS */}
      <NotificationPrefs userId={user.id} />

      {/* DELETE ACCOUNT */}
      <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-6">
        <h2 className="text-xs font-mono text-red-400 tracking-widest mb-3 flex items-center gap-x-2">
          <ShieldAlert className="w-4 h-4" />
          // DANGER ZONE
        </h2>
        <h3 className="text-lg font-medium mb-2">Delete account</h3>
        <p className="text-sm text-white/70 mb-4 leading-relaxed">
          This permanently deletes your account, profile, private cases, and check-ins. Your public cases stay published but the author becomes <span className="font-mono">Deleted investigator</span>. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-xl text-sm font-mono tracking-widest flex items-center gap-x-2"
        >
          <Trash2 className="w-4 h-4" /> DELETE MY ACCOUNT
        </button>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-zinc-950 border border-red-500/30 rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-medium mb-2">Are you absolutely sure?</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              This permanently deletes your account and all associated data. Your public cases will remain visible but be attributed to <span className="font-mono">Deleted investigator</span>.
            </p>
            <p className="text-sm text-white/70 mb-4">
              Type <span className="font-mono text-red-300">DELETE MY ACCOUNT</span> below to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              disabled={deleting}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 mb-4 font-mono text-sm focus:border-red-500 outline-none"
              placeholder="DELETE MY ACCOUNT"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-5 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl text-sm font-mono tracking-widest"
              >
                CANCEL
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleteConfirm !== 'DELETE MY ACCOUNT' || deleting}
                className="flex-1 px-5 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-red-300 rounded-xl text-sm font-mono tracking-widest flex items-center justify-center gap-x-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> DELETING
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> CONFIRM DELETE
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Notification preferences (stub — persists to localStorage)
// ============================================================
// When real notifications ship, these toggles will write to a
// notification_prefs table in Supabase. For now they just persist
// locally so the UI feels real and users can configure intent.
type NotifPrefs = {
  email_claim_decisions: boolean;
  email_case_comments: boolean;
  email_team_invites: boolean;
  email_mentions: boolean;
  inapp_all: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  email_claim_decisions: true,
  email_case_comments: true,
  email_team_invites: true,
  email_mentions: true,
  inapp_all: true,
};

function loadPrefs(userId: string): NotifPrefs {
  try {
    const raw = localStorage.getItem(`hauntlog-notif-prefs:${userId}`);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(userId: string, prefs: NotifPrefs) {
  try {
    localStorage.setItem(`hauntlog-notif-prefs:${userId}`, JSON.stringify(prefs));
  } catch {
    /* localStorage quota exceeded — silent failure is fine here */
  }
}

function NotificationPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs(userId));
  const [savedFlash, setSavedFlash] = useState(false);

  const update = (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(userId, next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono text-white/40 tracking-widest flex items-center gap-x-2">
          <Bell className="w-3.5 h-3.5" />
          // NOTIFICATIONS
        </h2>
        {savedFlash && (
          <span className="text-xs text-green-400 inline-flex items-center gap-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      <p className="text-xs text-white/40 mb-5">
        Stub UI. Real notifications ship in a future step; your choices are saved locally for now.
      </p>

      <div className="space-y-1">
        <Toggle
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Claim & verification decisions"
          description="When your location claim or team verification is approved or rejected."
          checked={prefs.email_claim_decisions}
          onChange={(v) => update('email_claim_decisions', v)}
        />
        <Toggle
          icon={<MessageSquare className="w-4 h-4" />}
          label="Case comments"
          description="When someone comments on a case you logged."
          checked={prefs.email_case_comments}
          onChange={(v) => update('email_case_comments', v)}
        />
        <Toggle
          icon={<Bell className="w-4 h-4" />}
          label="Team invites"
          description="When you're invited to join a team."
          checked={prefs.email_team_invites}
          onChange={(v) => update('email_team_invites', v)}
        />
        <Toggle
          icon={<AtSign className="w-4 h-4" />}
          label="Mentions"
          description="When another investigator mentions your handle."
          checked={prefs.email_mentions}
          onChange={(v) => update('email_mentions', v)}
        />
        <div className="h-px bg-white/5 my-2"></div>
        <Toggle
          icon={<Bell className="w-4 h-4" />}
          label="In-app notifications"
          description="Show a badge on the bell icon and in the menu."
          checked={prefs.inapp_all}
          onChange={(v) => update('inapp_all', v)}
        />
      </div>
    </div>
  );
}

function Toggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 py-3 px-1 hover:bg-white/5 rounded-xl transition-colors text-left"
    >
      <div className="text-white/60 mt-1 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-white/50 mt-0.5">{description}</div>
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 mt-1 ${
          checked ? 'bg-haunt-red' : 'bg-white/10'
        }`}
        aria-checked={checked}
        role="switch"
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}
