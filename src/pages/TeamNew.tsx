import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeam, validateSlug } from '../lib/teamActions';
import {
  ArrowLeft,
  Users,
  AtSign,
  FileText,
  Loader2,
  AlertCircle,
  Save,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Music,
} from 'lucide-react';

export default function TeamNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [facebook, setFacebook] = useState('');
  const [youtube, setYoutube] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest a slug from the team name.
  const onNameChange = (next: string) => {
    setName(next);
    if (slug === '' || slug === validateSlugSilently(name).slug) {
      setSlug(validateSlugSilently(next).slug);
    }
  };

  const slugCheck = validateSlug(slug);
  const canSubmit = name.trim().length > 0 && slugCheck.ok && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit || !slugCheck.ok) return;
    setSubmitting(true);
    const res = await createTeam({
      slug: slugCheck.slug,
      name,
      description,
      website,
      instagram,
      tiktok,
      facebook,
      youtube,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigate(`/app/teams/${slugCheck.slug}/manage`, { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/teams')}
        className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO TEAMS
      </button>

      <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
        <Users className="w-3.5 h-3.5" /> NEW TEAM
      </div>
      <h1 className="text-4xl font-medium tracking-tighter mb-2">Build your crew.</h1>
      <p className="text-white/60 mb-8">
        Set up your team profile. You can invite members on the next screen.
      </p>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            TEAM NAME <span className="text-haunt-red">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Bellamy Paranormal"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            SLUG <span className="text-haunt-red">*</span>
          </label>
          <div className="relative">
            <AtSign className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="bellamy-paranormal"
              className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none font-mono text-sm"
            />
          </div>
          <div className="text-xs text-white/40 mt-1">
            3–40 characters. Lowercase letters, numbers, hyphens. Your team URL will be{' '}
            <span className="font-mono">/t/{slug || 'your-slug'}</span>.
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
            DESCRIPTION
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-white/40 absolute left-3 top-3.5" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What's your team about? Where do you hunt? What gear?"
              className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none resize-none"
            />
          </div>
          <div className="text-xs text-white/40 mt-1 text-right">
            {description.length}/500
          </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="text-xs font-mono text-white/40 tracking-widest mb-3 pt-3">
            // SOCIALS (OPTIONAL)
          </div>
          <div className="space-y-3">
            <SocialField icon={<Globe className="w-4 h-4" />} label="WEBSITE" value={website} onChange={setWebsite} placeholder="bellamyparanormal.com" />
            <SocialField icon={<Instagram className="w-4 h-4" />} label="INSTAGRAM" value={instagram} onChange={setInstagram} placeholder="@bellamyparanormal" />
            <SocialField icon={<Music className="w-4 h-4" />} label="TIKTOK" value={tiktok} onChange={setTiktok} placeholder="@bellamyparanormal" />
            <SocialField icon={<Facebook className="w-4 h-4" />} label="FACEBOOK" value={facebook} onChange={setFacebook} placeholder="bellamyparanormal" />
            <SocialField icon={<Youtube className="w-4 h-4" />} label="YOUTUBE" value={youtube} onChange={setYoutube} placeholder="@bellamyparanormal" />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> CREATING
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> CREATE TEAM
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function SocialField({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-white/40 tracking-widest mb-1">
        {label}
      </label>
      <div className="relative">
        <div className="text-white/40 absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:border-haunt-red outline-none text-sm"
        />
      </div>
    </div>
  );
}

// Validator that always returns an object so we can read .slug for autofill.
function validateSlugSilently(raw: string): { slug: string } {
  const r = validateSlug(raw);
  if (r.ok) return { slug: r.slug };
  // Best-effort: strip invalid chars.
  return {
    slug: raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  };
}
