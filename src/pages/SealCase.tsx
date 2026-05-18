import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHauntStore, equipmentAbbr } from '../store/useHauntStore';
import { Lock, Globe, EyeOff, MapPin, Star, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export default function SealCase() {
  const navigate = useNavigate();
  const toast = useToast();
  const activeHunt = useHauntStore((s) => s.activeHunt);
  const sealCase = useHauntStore((s) => s.sealCase);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

  if (!activeHunt) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
          // NO ACTIVE HUNT
        </div>
        <h1 className="text-3xl font-medium mb-4">Nothing to seal.</h1>
        <button
          onClick={() => navigate('/app/hunt/new')}
          className="bg-haunt-red hover:bg-red-600 text-white px-8 py-3 rounded-xl font-mono tracking-widest text-sm transition-colors"
        >
          START A HUNT
        </button>
      </div>
    );
  }

  const canSeal = title.trim().length > 0;
  const starredCount = activeHunt.logs.filter((l) => l.starred).length;

  const normalizeTag = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

  const commitTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t || tags.includes(t) || tags.length >= 8) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSeal = async () => {
    if (!canSeal || sealing) return;
    setSealError(null);
    setSealing(true);
    const result = await sealCase({
      title,
      summary: summary.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setSealing(false);
    if (!result.ok) {
      setSealError(result.error);
      return;
    }
    // If some photos didn't upload, warn so the user knows. Most of
    // the time this is zero / zero (clean seal). The case is sealed
    // regardless; missing photos can be added later from the case page.
    if (result.photosFailed > 0) {
      toast.error(
        `${result.photosFailed} of ${result.photosAttempted} photos didn't upload`,
        {
          description:
            'The case is sealed. You can retry adding photos from the case page.',
        }
      );
    }
    navigate(`/case/${result.sealed.id}?fresh=1`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-xs font-mono text-haunt-red tracking-widest mb-3 flex items-center gap-x-2">
        <Lock className="w-4 h-4" /> SEAL CASE FILE
      </div>
      <h1 className="text-5xl font-medium tracking-tighter mb-2">One last look.</h1>
      <p className="text-white/60 mb-10">
        Give your case a title and a short summary. Once sealed, it can't be edited — but you can
        attach video footage later during post-review.
      </p>

      {/* Visibility (read-only, set at hunt start) */}
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
            VISIBILITY (SET AT HUNT START)
          </div>
          <div className="text-sm flex items-center gap-x-2">
            {activeHunt.visibility === 'public' && (
              <>
                <Globe className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Public</span>
                <span className="text-white/40">— visible on the community feed and atlas</span>
              </>
            )}
            {activeHunt.visibility === 'anonymous' && (
              <>
                <EyeOff className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400">Anonymous</span>
                <span className="text-white/40">— venue visible, your handle hidden</span>
              </>
            )}
            {activeHunt.visibility === 'private' && (
              <>
                <Lock className="w-4 h-4 text-white/60" />
                <span className="text-white/80">Private</span>
                <span className="text-white/40">— only you can see this case</span>
              </>
            )}
          </div>
        </div>
        {activeHunt.gpsVerified && (
          <div className="text-[10px] font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1 px-2 py-1 bg-green-400/10 rounded">
            <ShieldCheck className="w-3 h-3" /> GPS VERIFIED
          </div>
        )}
      </div>

      {/* Stats preview */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
          <div className="text-3xl font-mono tabular-nums">{activeHunt.logs.length}</div>
          <div className="text-xs text-white/40 mt-1">EVENTS</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
          <div className="text-3xl font-mono tabular-nums">
            {activeHunt.equipmentUsed.length}
          </div>
          <div className="text-xs text-white/40 mt-1">DEVICES</div>
        </div>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
          <div className="text-3xl font-mono tabular-nums flex items-center gap-x-2">
            {starredCount}
            {starredCount > 0 && <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
          </div>
          <div className="text-xs text-white/40 mt-1">STARRED</div>
        </div>
      </div>

      {/* Location reminder */}
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 mb-6 flex items-center gap-x-3 text-sm">
        <MapPin className="w-4 h-4 text-haunt-red shrink-0" />
        <div className="flex-1">
          <div className="font-medium">{activeHunt.location}</div>
          {activeHunt.zone && <div className="text-white/50 text-xs mt-0.5">{activeHunt.zone}</div>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {activeHunt.equipmentUsed.map((id) => (
            <span
              key={id}
              className="px-2 py-1 bg-white/5 text-[10px] font-mono tracking-widest text-white/60 rounded-md"
            >
              {equipmentAbbr(id, activeHunt.customEquipment)}
            </span>
          ))}
          {activeHunt.equipmentUsed.length === 0 && (
            <span className="text-[10px] font-mono tracking-widest text-white/40 italic">
              observation-only
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-5">
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
          TITLE <span className="text-haunt-red">*</span>
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The whispering tenant"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-lg"
        />
      </div>

      {/* Summary */}
      <div className="mb-5">
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
          SUMMARY (OPTIONAL)
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          placeholder="What stood out? What patterns did you notice?"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none"
        />
      </div>

      {/* Tags */}
      <div className="mb-8">
        <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
          TAGS (OPTIONAL)
        </label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-haunt-red/10 border border-haunt-red/30 text-haunt-red rounded-md text-[10px] font-mono tracking-widest"
              >
                {t.toUpperCase()}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="text-haunt-red/60 hover:text-haunt-red"
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitTag(tagInput);
            } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
              setTags((prev) => prev.slice(0, -1));
            }
          }}
          onBlur={() => tagInput && commitTag(tagInput)}
          placeholder={
            tags.length >= 8
              ? 'Max 8 tags reached'
              : 'apparition, sb7, k2-hit — press Enter or comma'
          }
          disabled={tags.length >= 8}
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm disabled:opacity-50"
        />
        <p className="text-xs text-white/40 mt-1.5">
          Lowercase, no spaces (spaces become hyphens). Up to 8.
        </p>
      </div>

      {sealError && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-3">
          {sealError}
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => navigate('/app/live')}
          disabled={sealing}
          className="px-3 md:px-6 py-3 md:py-4 text-white/60 hover:text-white font-mono tracking-widest text-xs md:text-sm disabled:opacity-50 whitespace-nowrap"
        >
          ← BACK
        </button>
        <button
          onClick={handleSeal}
          disabled={!canSeal || sealing}
          className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-3 md:py-4 rounded-2xl font-mono tracking-widest text-sm md:text-lg flex items-center justify-center gap-x-2 md:gap-x-3 transition-colors active:scale-[0.98]"
        >
          {sealing ? (
            <>
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              SEALING…
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 md:w-5 md:h-5" />
              SEAL FOREVER
            </>
          )}
        </button>
      </div>

      {!canSeal && <p className="text-xs text-white/40 mt-3">Title is required to seal.</p>}
    </div>
  );
}
