import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import {
  submitVenue,
  fetchMyVenueSubmissions,
  type VenueSubmissionRow,
  type VenueSubmitterRole,
} from '../lib/dataLayer';
import { geocodeAddress } from '../lib/geocode';
import {
  ArrowLeft,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Info,
  Link2,
  Image as ImageIcon,
  ShieldQuestion,
  Clock,
  Check,
  X as XIcon,
} from 'lucide-react';

const INPUT_CLS =
  'w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm placeholder:text-white/30';

const ROLE_OPTIONS: { value: VenueSubmitterRole; label: string; sub: string }[] = [
  {
    value: 'owner',
    label: 'I own this venue',
    sub: "On approval, you'll be installed as the owner.",
  },
  {
    value: 'operator',
    label: "I operate / work here",
    sub: "On approval, you'll be installed as a manager.",
  },
  {
    value: 'hunter',
    label: "I've hunted here (or want to)",
    sub: "You're adding this for the community, not claiming the venue.",
  },
  {
    value: 'other',
    label: 'Something else',
    sub: 'Tell us in the notes field.',
  },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
      {children}
    </label>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-5 md:p-6 mb-5">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-haunt-red/10 border border-haunt-red/30 text-haunt-red flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-white">{title}</div>
          {subtitle && <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function VenueSubmit() {
  const { user: authUser, status } = useAuth();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('USA');
  const [website, setWebsite] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [role, setRole] = useState<VenueSubmitterRole>('hunter');
  const [roleOther, setRoleOther] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [myPending, setMyPending] = useState<VenueSubmissionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load the user's submission history (mainly to know if they have a pending
  // one — they can only have one at a time).
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      const list = await fetchMyVenueSubmissions(authUser.id);
      if (cancelled) return;
      setMyPending(list);
      setHistoryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (status === 'loading') {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }
  if (status !== 'signed_in' || !authUser) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <h1 className="text-2xl font-medium mb-2">Sign in to submit a venue</h1>
        <p className="text-white/60 text-sm mb-6">
          You need an account to submit. It's free.
        </p>
        <Link
          to="/auth/signin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-haunt-red hover:bg-red-600 text-white text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const hasPending = myPending.some((s) => s.status === 'pending');

  // ----- Validation -----
  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const trimmedCity = city.trim();
  const canSubmit =
    !submitting &&
    !hasPending &&
    trimmedName.length >= 2 &&
    trimmedName.length <= 120 &&
    trimmedDesc.length >= 20 &&
    trimmedCity.length >= 1;

  // ----- Submit -----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // Geocode BEFORE submitting. Previously the submission payload
    // had no coordinates, so admin approval defaulted lat/lng to
    // (0,0) — putting every approved venue off the coast of Africa.
    // Now we resolve the address first; if it can't be resolved we
    // refuse to submit rather than save bad data and discover it on
    // the map later.
    const geo = await geocodeAddress({
      street: street.trim() || undefined,
      city: trimmedCity,
      state: stateRegion.trim() || undefined,
      zip: zip.trim() || undefined,
      country: country.trim() || undefined,
    });
    if (!geo) {
      setSubmitting(false);
      setError(
        "We couldn't find that address on the map. Double-check the street, city, state, and ZIP — even small typos cause this — then try again."
      );
      return;
    }

    const res = await submitVenue({
      name: trimmedName,
      tagline: tagline.trim() || undefined,
      description: trimmedDesc,
      street: street.trim() || undefined,
      city: trimmedCity,
      state: stateRegion.trim() || undefined,
      zip: zip.trim() || undefined,
      country: country.trim() || undefined,
      website: website.trim() || undefined,
      booking_url: bookingUrl.trim() || undefined,
      submitter_role: role,
      submitter_role_other:
        role === 'other' ? roleOther.trim() || undefined : undefined,
      notes: notes.trim() || undefined,
      lat: geo.lat,
      lng: geo.lng,
    });

    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess('Submitted! An admin will review your venue. You\'ll get a notification when it\'s decided.');
    // Reset form
    setName('');
    setTagline('');
    setDescription('');
    setStreet('');
    setCity('');
    setStateRegion('');
    setZip('');
    setCountry('USA');
    setWebsite('');
    setBookingUrl('');
    setRole('hunter');
    setRoleOther('');
    setNotes('');
    // Refresh submission history
    const list = await fetchMyVenueSubmissions(authUser.id);
    setMyPending(list);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <Link
        to="/app/atlas"
        className="inline-flex items-center gap-x-2 text-sm text-white/60 hover:text-white mb-6 font-mono tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO ATLAS
      </Link>

      <h1 className="text-3xl md:text-4xl font-medium tracking-tighter mb-2">
        Submit a venue
      </h1>
      <p className="text-white/60 mb-8 text-sm md:text-base">
        Add a haunted location to the atlas. An admin reviews every submission
        to prevent spam and impersonation.
      </p>

      {/* Pending submission banner */}
      {hasPending && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-amber-300 mb-1">
              You have a pending submission
            </div>
            <p className="text-xs text-amber-200/80">
              You can only have one open submission at a time. Wait for it to be
              reviewed before submitting another.
            </p>
          </div>
        </div>
      )}

      {/* Status banners */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
          <span className="text-sm text-red-200 break-words">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-950/40 border border-green-500/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-300 shrink-0 mt-0.5" />
          <span className="text-sm text-green-200 break-words">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* IDENTITY */}
        <SectionCard
          icon={<Info className="w-5 h-5" />}
          title="The venue"
          subtitle="Tell us the basics so we can identify what you're submitting."
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>NAME *</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lizzie Borden House"
                className={INPUT_CLS}
                maxLength={120}
                required
              />
              <div className="text-[10px] font-mono text-white/40 mt-1">
                {trimmedName.length}/120 · 2 chars minimum
              </div>
            </div>
            <div>
              <FieldLabel>TAGLINE (optional)</FieldLabel>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A historic 1845 inn with documented activity"
                className={INPUT_CLS}
                maxLength={200}
              />
            </div>
            <div>
              <FieldLabel>DESCRIPTION *</FieldLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short paragraph about the location, its history, and why it's worth a hunt."
                rows={5}
                className={INPUT_CLS}
                required
              />
              <div className="text-[10px] font-mono text-white/40 mt-1">
                {trimmedDesc.length} chars · 20 minimum
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ADDRESS */}
        <SectionCard
          icon={<MapPin className="w-5 h-5" />}
          title="Where is it?"
          subtitle="At minimum we need a city so we can place it on the atlas. Full address helps investigators check in."
        >
          <div className="space-y-3">
            <div>
              <FieldLabel>STREET</FieldLabel>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="92 Second St"
                className={INPUT_CLS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>CITY *</FieldLabel>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Fall River"
                  className={INPUT_CLS}
                  required
                />
              </div>
              <div>
                <FieldLabel>STATE / REGION</FieldLabel>
                <input
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  placeholder="MA"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>ZIP</FieldLabel>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <FieldLabel>COUNTRY</FieldLabel>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* LINKS (optional) */}
        <SectionCard
          icon={<Link2 className="w-5 h-5" />}
          title="Links (optional)"
          subtitle="Help our admin verify the venue is real."
        >
          <div className="space-y-3">
            <div>
              <FieldLabel>OFFICIAL WEBSITE</FieldLabel>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className={INPUT_CLS}
              />
            </div>
            <div>
              <FieldLabel>BOOKING URL</FieldLabel>
              <input
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://... (where investigators book overnight access)"
                className={INPUT_CLS}
              />
            </div>
          </div>
        </SectionCard>

        {/* ROLE */}
        <SectionCard
          icon={<ShieldQuestion className="w-5 h-5" />}
          title="Your relationship to the venue"
          subtitle="If you own or operate the venue, you can manage it on the platform once approved."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((opt) => {
              const on = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    on
                      ? 'bg-haunt-red/10 border-haunt-red'
                      : 'bg-black border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="text-sm font-medium mb-1 flex items-center gap-2">
                    {on && <Check className="w-4 h-4 text-haunt-red" />}
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-white/50 leading-snug">{opt.sub}</div>
                </button>
              );
            })}
          </div>
          {role === 'other' && (
            <div className="mt-4">
              <FieldLabel>BRIEFLY EXPLAIN</FieldLabel>
              <input
                value={roleOther}
                onChange={(e) => setRoleOther(e.target.value)}
                placeholder="e.g. I'm a local historian writing about the place"
                className={INPUT_CLS}
              />
            </div>
          )}
        </SectionCard>

        {/* NOTES */}
        <SectionCard
          icon={<ImageIcon className="w-5 h-5" />}
          title="Anything else?"
          subtitle="Optional. Background, proof of ownership, what makes this place haunted, anything we should know."
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="(optional)"
            rows={4}
            className={INPUT_CLS}
          />
        </SectionCard>

        {/* SUBMIT */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Link
            to="/app/atlas"
            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-mono tracking-widest"
          >
            CANCEL
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-3 rounded-xl bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-mono tracking-widest inline-flex items-center gap-x-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            SUBMIT FOR REVIEW
          </button>
        </div>

        <p className="mt-3 text-[10px] font-mono text-white/30 text-right">
          Submitting falsely is grounds for permanent ban.
        </p>
      </form>

      {/* SUBMISSION HISTORY */}
      {!historyLoading && myPending.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xs font-mono text-white/40 tracking-widest mb-4">
            // YOUR SUBMISSIONS
          </h2>
          <div className="space-y-2">
            {myPending.map((s) => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ submission }: { submission: VenueSubmissionRow }) {
  const name = submission.payload?.name ?? '(unnamed)';
  const created = new Date(submission.created_at);
  const dateStr = created.toLocaleDateString();

  let badge: React.ReactNode;
  if (submission.status === 'pending') {
    badge = (
      <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono tracking-widest inline-flex items-center gap-x-1">
        <Clock className="w-3 h-3" /> PENDING
      </span>
    );
  } else if (submission.status === 'approved') {
    badge = (
      <span className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-green-300 text-[10px] font-mono tracking-widest inline-flex items-center gap-x-1">
        <Check className="w-3 h-3" /> APPROVED
      </span>
    );
  } else {
    badge = (
      <span className="px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] font-mono tracking-widest inline-flex items-center gap-x-1">
        <XIcon className="w-3 h-3" /> REJECTED
      </span>
    );
  }

  const content = (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="text-sm font-medium truncate">{name}</div>
        {badge}
      </div>
      <div className="text-[11px] font-mono text-white/40 tracking-widest">
        Submitted {dateStr}
        {submission.payload?.city && ` · ${submission.payload.city}`}
      </div>
      {submission.status === 'rejected' && submission.decision_note && (
        <div className="mt-2 text-xs text-red-300/80">
          Reason: {submission.decision_note}
        </div>
      )}
    </div>
  );

  if (submission.status === 'approved' && submission.approved_location_id) {
    return (
      <Link to={`/app/atlas/venue/${submission.approved_location_id}`}>
        {content}
      </Link>
    );
  }
  return content;
}
