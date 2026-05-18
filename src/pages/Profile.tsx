import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import {
  changeHandle,
  getHandleCooldown,
  updateProfile,
  validateHandle,
} from '../lib/profileActions';
import { normalizeSocial } from '../lib/socials';
import AvatarUpload from '../components/AvatarUpload';
import {
  User as UserIcon,
  AtSign,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ExternalLink,
  Settings,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Music,
} from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [facebook, setFacebook] = useState('');
  const [youtube, setYoutube] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingHandle, setSavingHandle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setHandle(profile.handle);
    setBio(profile.bio ?? '');
    setAvatarUrl(profile.avatar_url ?? '');
    setWebsite(profile.website ?? '');
    setInstagram(profile.instagram ?? '');
    setTiktok(profile.tiktok ?? '');
    setFacebook(profile.facebook ?? '');
    setYoutube(profile.youtube ?? '');
  }, [profile]);

  if (!profile || !user) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  const cooldown = getHandleCooldown(profile);
  const handleChanged = handle !== profile.handle;
  const profileChanged =
    displayName !== profile.display_name ||
    bio !== (profile.bio ?? '') ||
    // avatarUrl is excluded — the AvatarUpload widget saves it directly
    website !== (profile.website ?? '') ||
    instagram !== (profile.instagram ?? '') ||
    tiktok !== (profile.tiktok ?? '') ||
    facebook !== (profile.facebook ?? '') ||
    youtube !== (profile.youtube ?? '');

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 4000);
  };

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    setSavingProfile(true);
    const res = await updateProfile(user.id, {
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      // avatar_url omitted — managed by AvatarUpload widget
      website: normalizeSocial('website', website),
      instagram: normalizeSocial('instagram', instagram),
      tiktok: normalizeSocial('tiktok', tiktok),
      facebook: normalizeSocial('facebook', facebook),
      youtube: normalizeSocial('youtube', youtube),
    });
    setSavingProfile(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refreshProfile();
    flashSuccess('Profile saved.');
  };

  const onSaveHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!cooldown.canChange) return;
    const validation = validateHandle(handle);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (validation.handle === profile.handle) return;

    setSavingHandle(true);
    const res = await changeHandle(user.id, validation.handle);
    setSavingHandle(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refreshProfile();
    flashSuccess('Handle updated. You can change it again in 60 days.');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
            // PROFILE
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tighter">Your profile</h1>
          <p className="text-white/60 text-sm mt-1">
            This is how other investigators see you.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/u/${encodeURIComponent(profile.handle)}`)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
          >
            <ExternalLink className="w-3.5 h-3.5" /> VIEW PUBLIC
          </button>
          <button
            onClick={() => navigate('/app/account')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
          >
            <Settings className="w-3.5 h-3.5" /> ACCOUNT
          </button>
        </div>
      </div>

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

      {/* PROFILE FIELDS */}
      <form
        onSubmit={onSaveProfile}
        className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-6 space-y-5"
      >
        <h2 className="text-xs font-mono text-white/40 tracking-widest">// DETAILS</h2>

        <Field icon={<UserIcon className="w-4 h-4" />} label="DISPLAY NAME">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
            placeholder="Riley Hunts"
          />
        </Field>

        <Field icon={<FileText className="w-4 h-4" />} label="BIO">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={280}
            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none resize-none"
            placeholder="Lead investigator, K-II enthusiast, etc."
          />
          <div className="text-xs text-white/40 mt-1 text-right">{bio.length}/280</div>
        </Field>

        {/* Avatar — step 19 widget. Persists immediately on upload so
            users don't need to click Save Profile separately. */}
        <div>
          <div className="text-xs font-mono text-white/40 tracking-widest mb-3">
            AVATAR
          </div>
          <AvatarUpload
            ownerId={user.id}
            currentUrl={avatarUrl || null}
            fallbackInitials={(displayName || profile.handle || '?')
              .slice(0, 2)
              .toUpperCase()}
            onUploaded={async (newUrl) => {
              setAvatarUrl(newUrl);
              const res = await updateProfile(user.id, { avatar_url: newUrl });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              await refreshProfile();
              flashSuccess('Avatar updated.');
            }}
            onCleared={async () => {
              setAvatarUrl('');
              const res = await updateProfile(user.id, { avatar_url: null });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              await refreshProfile();
              flashSuccess('Avatar removed.');
            }}
          />
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="text-xs font-mono text-white/40 tracking-widest mb-3 pt-3">
            // SOCIALS (OPTIONAL)
          </div>
          <p className="text-xs text-white/40 mb-4">
            Paste a full URL or just your handle. We'll fix the rest.
          </p>
          <div className="space-y-3">
            <Field icon={<Globe className="w-4 h-4" />} label="WEBSITE">
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                placeholder="rileyhunts.com"
              />
            </Field>
            <Field icon={<Instagram className="w-4 h-4" />} label="INSTAGRAM">
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                placeholder="@rileyhunts or full URL"
              />
            </Field>
            <Field icon={<Music className="w-4 h-4" />} label="TIKTOK">
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                placeholder="@rileyhunts or full URL"
              />
            </Field>
            <Field icon={<Facebook className="w-4 h-4" />} label="FACEBOOK">
              <input
                type="text"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                placeholder="rileyhunts or full URL"
              />
            </Field>
            <Field icon={<Youtube className="w-4 h-4" />} label="YOUTUBE">
              <input
                type="text"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                placeholder="@rileyhunts or full URL"
              />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={!profileChanged || savingProfile}
          className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
        >
          {savingProfile ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> SAVING
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> SAVE PROFILE
            </>
          )}
        </button>
      </form>

      {/* HANDLE */}
      <form
        onSubmit={onSaveHandle}
        className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4"
      >
        <h2 className="text-xs font-mono text-white/40 tracking-widest">// HANDLE</h2>

        {profile.handle_changed_at === null && (
          <div className="bg-haunt-red/10 border border-haunt-red/30 rounded-xl p-3 text-sm text-haunt-red/90">
            We auto-generated your handle from your email. You can change it once now for free. After that, changes are limited to once every 60 days.
          </div>
        )}

        <Field icon={<AtSign className="w-4 h-4" />} label="USERNAME">
          <input
            type="text"
            value={handle.startsWith('@') ? handle.slice(1) : handle}
            onChange={(e) => setHandle('@' + e.target.value.toLowerCase())}
            disabled={!cooldown.canChange}
            pattern="[a-z0-9._]{2,30}"
            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            placeholder="riley.hunts"
          />
          <div className="text-xs text-white/40 mt-1">
            2-30 characters. Lowercase letters, numbers, dots, underscores.
          </div>
        </Field>

        {!cooldown.canChange ? (
          <div className="bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-sm text-white/60 flex items-start gap-x-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
            <span>
              Handle changes are limited to once every 60 days. You can change yours again in{' '}
              <span className="text-white font-medium">{cooldown.daysRemaining}</span>{' '}
              {cooldown.daysRemaining === 1 ? 'day' : 'days'}.
            </span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!handleChanged || savingHandle}
            className="w-full bg-white/10 hover:bg-white/20 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
          >
            {savingHandle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> CHECKING
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> CHANGE HANDLE
              </>
            )}
          </button>
        )}
      </form>

      <div className="mt-8 text-xs text-white/40 text-center">
        Need to change your email or password? Visit{' '}
        <button
          onClick={() => navigate('/app/account')}
          className="text-haunt-red hover:underline"
        >
          Account settings
        </button>
        .
      </div>
    </div>
  );
}

// Helper for icon-prefixed input fields
function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="text-white/40 absolute left-3 top-3.5">{icon}</div>
        {children}
      </div>
    </div>
  );
}
