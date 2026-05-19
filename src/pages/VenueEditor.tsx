import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchVenueProfile,
  fetchMyVenueRole,
  updateVenue,
  type VenueUpdatePatch,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import HeroImageUpload from '../components/HeroImageUpload';
import VenueGalleryUpload from '../components/VenueGalleryUpload';
import { useToast } from '../components/ui/Toast';
import { parseVideoUrl } from '../lib/videoUrl';
import type {
  LocationRow,
  LocationPricing,
  LocationPricingTier,
  LocationManagerRole,
} from '../lib/database.types';
import {
  ArrowLeft,
  Loader2,
  Save,
  AlertCircle,
  BadgeCheck,
  ExternalLink,
  Plus,
  Trash2,
  DollarSign,
  Settings2,
  Crown,
  Star,
  MapPin,
  Link2,
  Info,
  Image as ImageIcon,
  Video as VideoIcon,
  CheckCircle2,
} from 'lucide-react';

/**
 * Field labels are kept short and ALL CAPS in mono — matches the
 * Profile / Account / TeamManage style.
 */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
      {children}
    </label>
  );
}

const INPUT_CLS =
  'w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm placeholder:text-white/30';

export default function VenueEditor() {
  const { locationId } = useParams<{ locationId: string }>();
  const { user: authUser } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'not_permitted' | 'not_found' | 'error'
  >('loading');
  const [error, setError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<LocationManagerRole | null>(null);
  const [venue, setVenue] = useState<LocationRow | null>(null);

  // Editable fields — populated from the venue row on load.
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [builtYear, setBuiltYear] = useState<string>('');
  const [operatingWindow, setOperatingWindow] = useState('');
  const [featuresText, setFeaturesText] = useState(''); // newline-separated
  const [website, setWebsite] = useState('');
  const [youtube, setYoutube] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [heroImage, setHeroImage] = useState('');
  // Step 44: video + gallery
  const [videoUrl, setVideoUrl] = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);

  // Pricing tiers as a discrete list.
  const [currency, setCurrency] = useState('USD');
  const [tiers, setTiers] = useState<LocationPricingTier[]>([]);
  const [finePrint, setFinePrint] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!locationId || !authUser) return;
    setStatus('loading');
    setError(null);
    (async () => {
      try {
        // Fetch the venue first — gives us a quick not_found bail.
        const profile = await fetchVenueProfile(locationId);
        if (!profile) {
          setStatus('not_found');
          return;
        }
        const v = profile.location;

        // Permission check via location_managers.
        const role = await fetchMyVenueRole(authUser.id, locationId);
        if (role !== 'owner' && role !== 'manager') {
          setStatus('not_permitted');
          return;
        }
        setMyRole(role);
        setVenue(v);

        // Seed all the form fields from the row.
        setTagline(v.tagline ?? '');
        setDescription(v.description ?? '');
        setBuiltYear(v.built_year ? String(v.built_year) : '');
        setOperatingWindow(v.operating_window ?? '');
        setFeaturesText((v.features ?? []).join('\n'));
        setWebsite(v.website ?? '');
        setYoutube(v.youtube_url ?? '');
        setInstagram(v.instagram_url ?? '');
        setFacebook(v.facebook_url ?? '');
        setTiktok(v.tiktok_url ?? '');
        setBookingUrl(v.booking_url ?? '');
        setStreet(v.street ?? '');
        setCity(v.city ?? '');
        setState(v.state ?? '');
        setZip(v.zip ?? '');
        setCountry(v.country ?? '');
        setHeroImage(v.hero_image ?? '');
        setVideoUrl(v.video_url ?? '');
        setGalleryPhotos(v.photos ?? []);
        if (v.pricing) {
          setCurrency(v.pricing.currency ?? 'USD');
          setTiers(v.pricing.tiers ?? []);
          setFinePrint(v.pricing.fine_print ?? '');
        }
        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, [locationId, authUser]);

  const buildPatch = (): VenueUpdatePatch => {
    const features = featuresText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const pricing: LocationPricing | null =
      tiers.length > 0
        ? {
            currency: currency.trim() || 'USD',
            tiers: tiers.map((t) => ({
              label: t.label.trim(),
              price: Number(t.price) || 0,
              subtitle: t.subtitle?.trim() || undefined,
              promo: t.promo?.trim() || undefined,
            })),
            fine_print: finePrint.trim() || undefined,
          }
        : null;

    return {
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      built_year: builtYear.trim() ? Number(builtYear) : null,
      operating_window: operatingWindow.trim() || null,
      features,
      website: website.trim() || null,
      youtube_url: youtube.trim() || null,
      instagram_url: instagram.trim() || null,
      facebook_url: facebook.trim() || null,
      tiktok_url: tiktok.trim() || null,
      booking_url: bookingUrl.trim() || null,
      street: street.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      country: country.trim() || null,
      hero_image: heroImage.trim() || null,
      video_url: videoUrl.trim() || null,
      // photos are written directly by the gallery component, not from
      // local form state, so we deliberately omit them here.
      pricing,
    };
  };

  const handleSave = async () => {
    if (!venue || saving) return;
    setSaving(true);
    setSaveOk(false);
    setError(null);
    const res = await updateVenue(venue.id, buildPatch());
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      // Surface the failure as a toast too — the in-form error banner
      // is at the top of a long page and easy to miss when the user
      // is focused on the SAVE button at the bottom.
      toast.error('Save failed', { description: res.error });
      return;
    }
    setVenue(res.row);
    setSaveOk(true);
    // Toast is the primary success signal — the top-of-page banner is
    // out of view when you're tapping SAVE at the bottom of the form.
    toast.success('Venue saved');
    // Hide the green confirmation after a beat (still useful when the
    // user scrolls back to the top after saving).
    setTimeout(() => setSaveOk(false), 2500);
  };

  // Pricing tier editor helpers
  const addTier = () =>
    setTiers((arr) => [...arr, { label: '', price: 0, subtitle: '' }]);
  const updateTier = (i: number, patch: Partial<LocationPricingTier>) =>
    setTiers((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTier = (i: number) =>
    setTiers((arr) => arr.filter((_, idx) => idx !== i));

  // ----- Render -----

  if (!authUser) {
    return (
      <NoAccess message="Sign in to manage your team's venue." linkTo="/auth/signin" linkLabel="Sign in →" />
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (status === 'not_found') {
    return <NoAccess message="Venue not found." linkTo="/app/my-venues" linkLabel="← MY VENUES" />;
  }

  if (status === 'not_permitted') {
    return (
      <NoAccess
        message="You don't manage this venue."
        linkTo={locationId ? `/v/${locationId}` : '/app/my-venues'}
        linkLabel="← BACK TO VENUE"
      />
    );
  }

  if (status === 'error') {
    return (
      <NoAccess message={error ?? 'Unknown error'} linkTo="/app/my-venues" linkLabel="← MY VENUES" />
    );
  }

  if (!venue) return null;

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <Link
        to="/app/my-venues"
        className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> MY VENUES
      </Link>

      <div className="text-xs font-mono text-amber-400 tracking-widest mb-2 flex items-center gap-x-2">
        <BadgeCheck className="w-3.5 h-3.5" /> VERIFIED LOCATION · EDITOR
      </div>
      <h1 className="text-3xl md:text-4xl font-medium tracking-tighter mb-1">
        {venue.name}
      </h1>
      <p className="text-white/60 mb-6 inline-flex items-center gap-x-2 flex-wrap">
        <span className="inline-flex items-center gap-x-1.5">
          {myRole === 'owner' ? (
            <>
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-amber-300 font-mono text-xs tracking-widest">OWNER</span>
            </>
          ) : (
            <>
              <Star className="w-3.5 h-3.5 text-white/70" />
              <span className="text-white/70 font-mono text-xs tracking-widest">MANAGER</span>
            </>
          )}
        </span>
        <span className="text-white/30">·</span>
        <Link to={`/v/${venue.id}`} className="text-haunt-red hover:underline inline-flex items-center gap-x-1">
          View public profile <ExternalLink className="w-3 h-3" />
        </Link>
      </p>

      <Link
        to={`/app/venues/${encodeURIComponent(venue.id)}/edit/zones`}
        className="block bg-amber-400/5 border border-amber-400/30 rounded-2xl px-4 py-3 mb-8 hover:bg-amber-400/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-mono text-amber-300 tracking-widest">
              MANAGE ZONES
            </div>
            <div className="text-sm">
              Add, edit, reorder, or remove rooms documented at this venue →
            </div>
          </div>
        </div>
      </Link>

      {/* Error / save status banners */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      {saveOk && (
        <div className="bg-green-950/40 border border-green-500/30 rounded-xl p-3 text-sm text-green-300 mb-4">
          Saved.
        </div>
      )}

      {/* IDENTITY */}
      <SectionCard
        icon={<Info className="w-5 h-5" />}
        title="Identity"
        subtitle="Name, story, and the headline image investigators see first."
      >
        <div className="space-y-4">
          <div>
            <FieldLabel>TAGLINE</FieldLabel>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Home of My Haunted Manor USA"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <FieldLabel>DESCRIPTION</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Built in 1804..."
              rows={6}
              className={INPUT_CLS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>BUILT YEAR</FieldLabel>
              <input
                value={builtYear}
                onChange={(e) => setBuiltYear(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="1804"
                className={INPUT_CLS}
                maxLength={4}
              />
            </div>
            <div>
              <FieldLabel>OPERATING WINDOW</FieldLabel>
              <input
                value={operatingWindow}
                onChange={(e) => setOperatingWindow(e.target.value)}
                placeholder="PRIVATE BOOKINGS · 7PM – 7AM"
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div>
            <FieldLabel>FEATURES — one per line</FieldLabel>
            <textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={'24/7 LIVE CAMERAS\nCONTENT CREATORS WELCOME'}
              rows={3}
              className={INPUT_CLS}
            />
            <div className="text-[10px] font-mono text-white/40 mt-1">
              Short ALL-CAPS badges shown in the amber ribbon.
            </div>
          </div>
        </div>
      </SectionCard>

      {/* HERO IMAGE */}
      <SectionCard
        icon={<ImageIcon className="w-5 h-5" />}
        title="Hero image"
        subtitle="The big banner photo at the top of your venue profile. 16:9, ideally a wide shot of the building or grounds at dusk."
      >
        <HeroImageUpload
          locationId={venue.id}
          currentUrl={heroImage || null}
          onUploaded={async (newUrl) => {
            setHeroImage(newUrl);
            const res = await updateVenue(venue.id, { hero_image: newUrl });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSaveOk(true);
            setTimeout(() => setSaveOk(false), 2500);
          }}
          onCleared={async () => {
            setHeroImage('');
            const res = await updateVenue(venue.id, { hero_image: null });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSaveOk(true);
            setTimeout(() => setSaveOk(false), 2500);
          }}
        />
      </SectionCard>

      {/* GALLERY — supplemental photos (rooms, exterior, key spots) */}
      <SectionCard
        icon={<ImageIcon className="w-5 h-5" />}
        title="Photo gallery"
        subtitle="Room-by-room shots, exteriors, anything that gives investigators a feel for the location. Distinct from the hero banner above."
      >
        <VenueGalleryUpload
          locationId={venue.id}
          photos={galleryPhotos}
          onChange={async (next) => {
            // Persist immediately — gallery is autosaved unlike the
            // rest of the form (which has an explicit SAVE button).
            // Reason: each photo upload is already a network commit,
            // so making the user click SAVE afterwards would feel weird.
            const res = await updateVenue(venue.id, { photos: next });
            if (!res.ok) return { ok: false, error: res.error };
            setGalleryPhotos(next);
            return { ok: true };
          }}
        />
      </SectionCard>

      {/* VIDEO — single embed (typically YouTube) */}
      <SectionCard
        icon={<VideoIcon className="w-5 h-5" />}
        title="Feature video"
        subtitle="A single video that captures what makes this place worth investigating. YouTube or Vimeo URL — paste any standard share link."
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>VIDEO URL</FieldLabel>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
            />
            <div className="text-[10px] font-mono text-white/40 mt-1">
              Save the form below for the video to appear on the public profile.
            </div>
          </div>
          {videoUrl.trim() && (
            <VideoUrlPreview url={videoUrl.trim()} />
          )}
        </div>
      </SectionCard>

      {/* ADDRESS */}
      <SectionCard
        icon={<MapPin className="w-5 h-5" />}
        title="Address"
        subtitle="Where investigators will physically check in."
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>STREET</FieldLabel>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="131 Locust St"
              className={INPUT_CLS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>CITY</FieldLabel>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <FieldLabel>STATE</FieldLabel>
              <input value={state} onChange={(e) => setState(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>ZIP</FieldLabel>
              <input value={zip} onChange={(e) => setZip(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <FieldLabel>COUNTRY</FieldLabel>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* LINKS */}
      <SectionCard
        icon={<Link2 className="w-5 h-5" />}
        title="Links"
        subtitle="Where investigators go to learn more or book."
      >
        <div className="space-y-3">
          <div>
            <FieldLabel>WEBSITE</FieldLabel>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={INPUT_CLS} />
          </div>
          <div>
            <FieldLabel>BOOKING URL</FieldLabel>
            <input
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://..."
              className={INPUT_CLS}
            />
            <div className="text-[10px] font-mono text-white/40 mt-1">
              Opens in a new tab when investigators tap BOOK FROM $X.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>YOUTUBE URL</FieldLabel>
              <input value={youtube} onChange={(e) => setYoutube(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <FieldLabel>INSTAGRAM URL</FieldLabel>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <FieldLabel>FACEBOOK URL</FieldLabel>
              <input value={facebook} onChange={(e) => setFacebook(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <FieldLabel>TIKTOK URL</FieldLabel>
              <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* PRICING */}
      <SectionCard
        icon={<DollarSign className="w-5 h-5" />}
        title="Pricing tiers"
        subtitle="Shown on your venue profile and used to render the BOOK FROM $X CTA."
      >
        <div className="grid grid-cols-[1fr_auto] gap-3 mb-4 items-end">
          <div>
            <FieldLabel>CURRENCY (3-letter ISO)</FieldLabel>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="USD"
              className={INPUT_CLS}
            />
          </div>
          <button
            onClick={addTier}
            className="px-3 py-3 rounded-xl bg-haunt-red text-white text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5 hover:bg-red-600"
          >
            <Plus className="w-3.5 h-3.5" /> ADD TIER
          </button>
        </div>

        <div className="space-y-3">
          {tiers.length === 0 && (
            <div className="bg-black/40 border border-white/10 border-dashed rounded-2xl p-6 text-center text-sm text-white/40">
              No pricing tiers. Investigators won't see a "BOOK FROM $X" CTA until
              you add at least one.
            </div>
          )}
          {tiers.map((t, i) => (
            <TierEditor
              key={i}
              tier={t}
              currency={currency}
              onChange={(patch) => updateTier(i, patch)}
              onRemove={() => removeTier(i)}
            />
          ))}
        </div>

        <div className="mt-4">
          <FieldLabel>FINE PRINT</FieldLabel>
          <input
            value={finePrint}
            onChange={(e) => setFinePrint(e.target.value)}
            placeholder="+$50 per additional guest over 10 · 7-day cancel or reschedule policy"
            className={INPUT_CLS}
          />
        </div>
      </SectionCard>

      {/* Bottom padding so the sticky save bar doesn't cover content.
          Bumped to account for the larger sticky bar with safe-area padding. */}
      <div className="h-24"></div>

      {/* STICKY SAVE BAR
          z-[1250] so it sits ABOVE the mobile bottom nav (z-[1200]).
          Without this the SAVE button was hidden behind the nav on
          phones, making the editor effectively non-functional there. */}
      <div className="fixed bottom-0 left-0 right-0 z-[1250] bg-black/95 backdrop-blur border-t border-white/10 py-3 md:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
        <div className="max-w-3xl mx-auto px-6 md:px-8 flex items-center justify-between gap-3">
          {/* Inline save status — visible on both mobile and desktop.
              Without this the green "Saved." confirmation banner at the
              top of the page is out of view for anyone using the SAVE
              button (which is at the bottom of a long form), so saves
              feel silent and people retap thinking it didn't work. */}
          <div className="min-w-0 flex-1 text-xs font-mono tracking-widest">
            {saving ? (
              <span className="inline-flex items-center gap-x-2 text-white/60">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> SAVING…
              </span>
            ) : saveOk ? (
              <span className="inline-flex items-center gap-x-2 text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> SAVED
              </span>
            ) : error ? (
              <span className="inline-flex items-center gap-x-2 text-red-300">
                <AlertCircle className="w-3.5 h-3.5" /> SAVE FAILED · SEE TOP
              </span>
            ) : (
              <span className="text-white/40 hidden md:inline">
                CHANGES SAVE TO ALL INVESTIGATORS IMMEDIATELY
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-haunt-red text-white font-mono tracking-widest text-sm inline-flex items-center gap-x-2 hover:bg-red-600 disabled:opacity-50 shrink-0"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            SAVE
          </button>
        </div>
      </div>
    </div>
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
          {subtitle && (
            <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function TierEditor({
  tier,
  currency,
  onChange,
  onRemove,
}: {
  tier: LocationPricingTier;
  currency: string;
  onChange: (patch: Partial<LocationPricingTier>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <FieldLabel>LABEL</FieldLabel>
          <input
            value={tier.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="FRI – SAT"
            className={INPUT_CLS}
          />
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove tier"
          className="self-end px-3 py-3 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-white/70"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div>
          <FieldLabel>PRICE ({currency})</FieldLabel>
          <div className="relative">
            <DollarSign className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min={0}
              value={tier.price}
              onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
              className={INPUT_CLS + ' pl-7 w-28'}
            />
          </div>
        </div>
        <div>
          <FieldLabel>SUBTITLE</FieldLabel>
          <input
            value={tier.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="up to 10 guests"
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div>
        <FieldLabel>PROMO TAG (optional)</FieldLabel>
        <input
          value={tier.promo ?? ''}
          onChange={(e) => onChange({ promo: e.target.value })}
          placeholder="SAVE $150"
          className={INPUT_CLS}
        />
        <div className="text-[10px] font-mono text-white/40 mt-1">
          Shown as a green pill next to the label. Leave blank for no promo.
        </div>
      </div>
    </div>
  );
}

function NoAccess({
  message,
  linkTo,
  linkLabel,
}: {
  message: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-medium mb-3">{message}</h1>
      <Link
        to={linkTo}
        className="inline-block bg-white text-black px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs hover:bg-haunt-red hover:text-white transition-colors"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

/**
 * Inline preview that resolves the pasted URL through the parser and
 * either shows the iframe at scale or a "we don't recognise this URL"
 * hint. Helps owners catch typos before they save.
 */
function VideoUrlPreview({ url }: { url: string }) {
  const parsed = parseVideoUrl(url);
  if (!parsed) {
    return (
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 inline-flex items-center gap-x-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        That URL doesn't look like a YouTube or Vimeo video. Double-check and try again.
      </div>
    );
  }
  return (
    <div className="aspect-video w-full max-w-md rounded-xl overflow-hidden border border-white/10 bg-black">
      <iframe
        src={parsed.embedUrl}
        title="Video preview"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
