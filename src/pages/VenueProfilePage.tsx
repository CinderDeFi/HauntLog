import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchVenueProfile,
  followVenue,
  unfollowVenue,
  isFollowingVenue,
  getVenueFollowerCount,
  fetchRecentCasesAtVenue,
  fetchMyVenueRole,
  fetchVenueManagers,
  fetchMyClaimForVenue,
  withdrawClaim,
  type VenueProfile,
  type VenueCaseRow,
  type VenueManagerWithProfile,
} from '../lib/dataLayer';
import type { LocationClaimRow } from '../lib/database.types';
import ClaimVenueModal from '../components/ClaimVenueModal';
import PublicNav from '../components/PublicNav';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../lib/useAuth';
import { parseVideoUrl } from '../lib/videoUrl';
import {
  BadgeCheck,
  Bookmark,
  CalendarPlus,
  Camera,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Loader2,
  MapPin,
  Pin,
  Settings2,
  Users,
  Youtube,
  Box,
  DoorOpen,
  Smile,
  Octagon,
  PanelsTopLeft,
  Sofa,
  ArrowDownFromLine,
  MonitorDot,
  Home,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

// Curated set of zone icons by kebab-case key. Keeps the bundle lean.
const ZONE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  box: Box,
  'door-open': DoorOpen,
  smile: Smile,
  octagon: Octagon,
  'panels-top-left': PanelsTopLeft,
  sofa: Sofa,
  'arrow-down-from-line': ArrowDownFromLine,
  'monitor-dot': MonitorDot,
  home: Home,
  camera: Camera,
};

type ZoneIconName = string;

function ZoneIcon({ name, className }: { name: ZoneIconName | null; className?: string }) {
  const Cmp = (name && ZONE_ICONS[name]) || Box;
  return <Cmp className={className} />;
}

// TikTok isn't in lucide. Tiny inline SVG for parity with SocialLinks.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.85a8.16 8.16 0 0 0 4.77 1.52V6.92a4.85 4.85 0 0 1-1.84-.23z" />
    </svg>
  );
}

function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function VenueProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser, profile: authProfile } = useAuth();
  const isAdmin = !!authProfile?.is_admin;
  const toast = useToast();
  const [profile, setProfile] = useState<VenueProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>(
    'loading'
  );
  const [error, setError] = useState<string | null>(null);

  // Follow state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Cases at this venue
  const [recentCases, setRecentCases] = useState<VenueCaseRow[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  // Can the current viewer manage this venue? True when the viewer is
  // in location_managers with role owner/manager. Drives the inline
  // MANAGE CTA.
  const [canManage, setCanManage] = useState(false);

  // The list of venue managers — used by the MANAGED BY card to show
  // the primary owner's profile.
  const [managers, setManagers] = useState<VenueManagerWithProfile[]>([]);

  // Claim state — if the viewer has an existing claim row, we show it.
  const [myClaim, setMyClaim] = useState<LocationClaimRow | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!id) {
      setStatus('not_found');
      return;
    }
    (async () => {
      try {
        const v = await fetchVenueProfile(id);
        if (!v) {
          setStatus('not_found');
          return;
        }
        setProfile(v);
        setStatus('found');

        // Fan out best-effort queries: follower count, the viewer's
        // follow relationship, recent cases, the manager list, and (if
        // authed) the viewer's venue role for management permissions.
        setCasesLoading(true);
        await Promise.all([
          getVenueFollowerCount(id)
            .then(setFollowerCount)
            .catch(() => {
              /* best-effort */
            }),
          authUser
            ? isFollowingVenue(authUser.id, id)
                .then(setFollowing)
                .catch(() => {
                  /* best-effort */
                })
            : Promise.resolve(),
          fetchRecentCasesAtVenue(id, 6)
            .then(setRecentCases)
            .catch(() => {
              /* best-effort */
            })
            .finally(() => setCasesLoading(false)),
          fetchVenueManagers(id)
            .then(setManagers)
            .catch(() => {
              /* best-effort */
            }),
          authUser
            ? fetchMyVenueRole(authUser.id, id)
                .then((r) => setCanManage(r === 'owner' || r === 'manager'))
                .catch(() => {
                  /* best-effort */
                })
            : Promise.resolve(),
          authUser
            ? fetchMyClaimForVenue(authUser.id, id)
                .then(setMyClaim)
                .catch(() => {
                  /* best-effort */
                })
            : Promise.resolve(),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, [id, authUser]);

  const handleFollow = async () => {
    if (!authUser || !id || followLoading) return;
    setFollowLoading(true);
    const prev = following;
    // Optimistic toggle
    setFollowing(!prev);
    setFollowerCount((c) => c + (prev ? -1 : 1));
    const res = prev
      ? await unfollowVenue(authUser.id, id)
      : await followVenue(authUser.id, id);
    if (!res.ok) {
      // Rollback
      setFollowing(prev);
      setFollowerCount((c) => c + (prev ? 1 : -1));
    }
    setFollowLoading(false);
  };

  const handleWithdrawClaim = async () => {
    if (!myClaim || withdrawing) return;
    if (!confirm('Withdraw your pending claim for this venue?')) return;
    setWithdrawing(true);
    const res = await withdrawClaim(myClaim.id);
    setWithdrawing(false);
    if (res.ok) {
      setMyClaim(null);
      toast.success('Claim withdrawn');
    } else {
      toast.error('Could not withdraw claim', { description: res.error });
    }
  };

  const handleClaimSubmitted = async () => {
    // Re-fetch the claim row so the page shows the pending state.
    if (!authUser || !id) return;
    try {
      const c = await fetchMyClaimForVenue(authUser.id, id);
      setMyClaim(c);
    } catch {
      /* best-effort */
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-20 text-center">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">// 404</div>
        <h1 className="text-3xl font-medium mb-2">Venue not found</h1>
        <p className="text-white/60 mb-8">
          That location doesn't exist in the HauntLog atlas.
        </p>
        <Link
          to="/app/atlas"
          className="inline-block bg-white text-black px-6 py-3 rounded-xl font-mono tracking-widest text-sm hover:bg-haunt-red hover:text-white transition-colors"
        >
          ← BACK TO ATLAS
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-20 text-center">
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 text-sm text-red-300 max-w-md mx-auto">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) return null;
  const { location, zones, claimedByTeam } = profile;
  const isVerified = location.claim_status === 'verified';
  const addressLine = [location.street, location.city, location.state]
    .filter(Boolean)
    .join(' · ');

  // Stats strip values for the header band
  const stats: Array<{ value: string; label: string }> = [];
  if (zones.length > 0) {
    stats.push({ value: String(zones.length), label: 'ZONES' });
  }
  if (location.features.some((f) => /camera/i.test(f))) {
    stats.push({ value: '24/7', label: 'CAMERAS' });
  }
  if (location.built_year) {
    stats.push({ value: String(location.built_year), label: 'BUILT' });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PublicNav />

      {/* ----- HERO IMAGE ----- */}
      {/* Full-bleed banner image, when the venue has one. Magazine-cover
          treatment: cinematic aspect on desktop (16/9), shorter on
          mobile (3/2) so it doesn't eat half the viewport. A dark
          bottom gradient softens the transition into the main content
          below so the page doesn't feel like two stacked rectangles. */}
      {location.hero_image && (
        <div className="relative w-full overflow-hidden bg-zinc-950">
          <div className="relative aspect-[3/2] md:aspect-[16/9] max-h-[60vh] mx-auto max-w-screen-xl">
            <img
              src={location.hero_image}
              alt={`${location.name} — venue photo`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
            />
            {/* Gradient scrim so the page-fold transition feels intentional
                and any pinned page chrome stays readable. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"
            />
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-10">
        {/* ----- HERO ----- */}

        {/* Inline MANAGE CTA — visible when the viewer is in
            location_managers (owner or manager). */}
        {canManage && (
          <Link
            to={`/app/venues/${encodeURIComponent(location.id)}/edit`}
            className="block bg-amber-400/5 border border-amber-400/40 rounded-2xl px-4 py-3 mb-5 hover:bg-amber-400/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Settings2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-amber-300 tracking-widest">
                  YOU CAN MANAGE THIS VENUE
                </div>
                <div className="text-sm">
                  Edit description, pricing, social links, and zones →
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Admin override CTA — only when the viewer is an admin AND
            isn't already a manager (otherwise they already see the
            manage CTA above). Lets admins jump straight to the editor
            for moderation tasks like fixing bad data or deleting
            user-submitted venues, without having to fake-claim the
            venue first. */}
        {!canManage && isAdmin && (
          <Link
            to={`/app/venues/${encodeURIComponent(location.id)}/edit`}
            className="block bg-red-500/5 border border-red-500/40 rounded-2xl px-4 py-3 mb-5 hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-red-300 tracking-widest">
                  ADMIN
                </div>
                <div className="text-sm">
                  Open editor to moderate, fix, or delete this venue →
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Claim CTAs — only when the viewer is NOT already a manager.
            Three states based on existing claim row:
              - pending: review-in-progress card with WITHDRAW
              - rejected: rejection note + RE-CLAIM
              - none: invitation to CLAIM */}
        {!canManage && authUser && (
          <>
            {myClaim && myClaim.status === 'pending' && (
              <div className="bg-blue-500/5 border border-blue-500/30 rounded-2xl px-4 py-3 mb-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-blue-300 tracking-widest">
                    CLAIM UNDER REVIEW
                  </div>
                  <div className="text-sm text-white/80">
                    Submitted{' '}
                    {new Date(myClaim.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    . We'll follow up once a decision is made.
                  </div>
                  <button
                    onClick={handleWithdrawClaim}
                    disabled={withdrawing}
                    className="mt-2 text-[11px] font-mono tracking-widest text-white/50 hover:text-red-300 underline disabled:opacity-50"
                  >
                    {withdrawing ? 'WITHDRAWING…' : 'WITHDRAW CLAIM'}
                  </button>
                </div>
              </div>
            )}

            {myClaim && myClaim.status === 'rejected' && (
              <div className="bg-red-500/5 border border-red-500/30 rounded-2xl px-4 py-3 mb-5">
                <div className="text-xs font-mono text-red-300 tracking-widest mb-1">
                  YOUR CLAIM WAS NOT APPROVED
                </div>
                {myClaim.admin_note && (
                  <div className="text-sm text-white/80 mb-2 italic">
                    "{myClaim.admin_note}"
                  </div>
                )}
                <button
                  onClick={() => setClaimModalOpen(true)}
                  className="text-xs font-mono tracking-widest text-red-200 hover:text-white underline"
                >
                  SUBMIT A NEW CLAIM
                </button>
              </div>
            )}

            {(!myClaim || myClaim.status === 'rejected') &&
              !managers.some((m) => m.role === 'owner') && (
                <button
                  onClick={() => setClaimModalOpen(true)}
                  className="w-full text-left bg-haunt-red/5 border border-haunt-red/40 rounded-2xl px-4 py-3 mb-5 hover:bg-haunt-red/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-haunt-red/15 border border-haunt-red/40 flex items-center justify-center text-haunt-red shrink-0">
                      <BadgeCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-haunt-red tracking-widest">
                        DO YOU OPERATE THIS VENUE?
                      </div>
                      <div className="text-sm">
                        Claim this listing to manage its content, pricing, and zones →
                      </div>
                    </div>
                  </div>
                </button>
              )}
          </>
        )}

        {/* Verified badge */}
        {isVerified && (
          <div className="inline-flex items-center gap-x-2 mb-5 px-3 py-2 bg-amber-400/10 border border-amber-400/40 rounded-xl">
            <BadgeCheck className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <span className="font-mono text-xs tracking-widest text-amber-300">
              VERIFIED LOCATION
            </span>
          </div>
        )}

        {/* Title + tagline */}
        <h1 className="text-4xl md:text-5xl font-medium tracking-tighter mb-2">
          {location.name}
        </h1>
        {location.tagline && (
          <p className="italic text-white/80 mb-4">{location.tagline}</p>
        )}

        {/* Address strip */}
        <div className="flex items-center gap-x-2 text-white/70 mb-3">
          <MapPin className="w-4 h-4 text-haunt-red shrink-0" />
          <div className="font-mono text-sm">
            {addressLine || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
            {location.built_year && (
              <span className="text-white/40"> · EST. {location.built_year}</span>
            )}
          </div>
        </div>

        {/* Follower count strip */}
        <div className="flex items-center gap-x-2 text-white/60 text-sm mb-6">
          <Users className="w-3.5 h-3.5 text-white/40" />
          <span>
            <span className="font-medium text-white">{followerCount}</span>{' '}
            {followerCount === 1 ? 'follower' : 'followers'}
          </span>
        </div>

        {/* Features ribbon — amber, like the booking window */}
        {(location.features.length > 0 || location.operating_window) && (
          <div className="bg-amber-400/5 border border-amber-400/30 rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-amber-300">
            {location.features.includes('24/7 LIVE CAMERAS') && (
              <span className="inline-flex items-center gap-x-2 text-xs font-mono tracking-widest">
                <Camera className="w-3.5 h-3.5" /> 24/7 LIVE CAMERAS
              </span>
            )}
            {location.features
              .filter((f) => f !== '24/7 LIVE CAMERAS')
              .map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-x-2 text-xs font-mono tracking-widest"
                >
                  {f}
                </span>
              ))}
            {location.operating_window && (
              <span className="text-xs font-mono tracking-widest ml-auto">
                {location.operating_window}
              </span>
            )}
          </div>
        )}

        {/* Stats strip — bordered cells */}
        {stats.length > 0 && (
          <div
            className={`grid bg-zinc-900 border border-white/10 rounded-2xl mb-10 overflow-hidden`}
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s, idx) => (
              <div
                key={s.label}
                className={`px-4 py-4 text-center ${
                  idx !== stats.length - 1 ? 'border-r border-white/10' : ''
                }`}
              >
                <div className="text-2xl md:text-3xl font-mono tracking-tight font-medium">
                  {s.value}
                </div>
                <div className="text-[10px] font-mono text-white/40 tracking-widest mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----- ABOUT ----- */}
        {location.description && (
          <section className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              ABOUT THIS VENUE
            </div>
            <div className="bg-zinc-900/60 border-l-2 border-amber-400 rounded-r-xl px-5 py-4">
              <p className="italic text-white/80 leading-relaxed whitespace-pre-wrap">
                "{location.description}"
              </p>
            </div>
          </section>
        )}

        {/* ----- FEATURE VIDEO ----- */}
        {/* Single embed — when the venue has a curated video that
            captures what makes this place worth investigating. */}
        {(() => {
          if (!location.video_url) return null;
          const parsed = parseVideoUrl(location.video_url);
          if (!parsed) return null;
          return (
            <section className="mb-10">
              <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
                FEATURE VIDEO
              </div>
              <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black">
                <iframe
                  src={parsed.embedUrl}
                  title={`${location.name} — feature video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                  loading="lazy"
                />
              </div>
            </section>
          );
        })()}

        {/* ----- GALLERY ----- */}
        {/* Supplemental photos — rooms, exteriors, etc. */}
        {location.photos && location.photos.length > 0 && (
          <section className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              GALLERY · {location.photos.length}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              {location.photos.map((url, idx) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-zinc-900 hover:border-haunt-red/50 transition-colors"
                >
                  <img
                    src={url}
                    alt={`${location.name} — photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ----- BOOKING ----- */}
        {location.pricing && location.pricing.tiers.length > 0 && (
          <section className="mb-10">
            <div className="bg-zinc-950 border border-haunt-red/40 rounded-3xl p-5 md:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                  <div className="text-xs font-mono text-haunt-red tracking-widest mb-1 inline-flex items-center gap-x-2">
                    <KeyRound className="w-3.5 h-3.5" /> PRIVATE BOOKING · YOUR WAY
                  </div>
                  <p className="text-sm text-white/80">
                    The entire venue is yours
                    {location.operating_window && (
                      <>
                        {' '}
                        <strong className="text-white">
                          {/* extract just the time portion if present */}
                          {location.operating_window
                            .replace(/^[^·]*·\s*/, '')
                            .trim()}
                        </strong>
                        .{' '}
                      </>
                    )}
                    Investigate however you want — no fixed schedule, no other groups.
                  </p>
                </div>
                {location.operating_window?.match(/\d+\s*HRS?/i) && (
                  <div className="text-[10px] font-mono tracking-widest text-amber-400 border border-amber-400/40 rounded px-2 py-1">
                    {location.operating_window.match(/\d+\s*HRS?/i)?.[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-3">
                {location.pricing.tiers.map((t) => (
                  <div
                    key={t.label}
                    className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm flex items-center gap-x-2">
                        <span>{t.label}</span>
                        {t.promo && (
                          <span className="text-[10px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/30 rounded px-1.5 py-0.5">
                            {t.promo}
                          </span>
                        )}
                      </div>
                      {t.subtitle && (
                        <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase mt-0.5">
                          {t.subtitle}
                        </div>
                      )}
                    </div>
                    <div
                      className={`text-2xl md:text-3xl font-medium ${
                        t.promo ? 'text-green-400' : 'text-white'
                      }`}
                    >
                      {formatPrice(t.price, location.pricing?.currency ?? 'USD')}
                    </div>
                  </div>
                ))}
              </div>

              {location.pricing.fine_print && (
                <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
                  {location.pricing.fine_print}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ----- ZONES ----- */}
        {zones.length > 0 && (
          <section className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              DOCUMENTED ZONES · {zones.length} {zones.length === 1 ? 'ROOM' : 'ROOMS'}
            </div>
            <div className="space-y-2">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className="bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                    <ZoneIcon name={z.icon} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{z.name}</div>
                    {z.tags.length > 0 && (
                      <div className="text-[10px] font-mono text-white/40 tracking-widest mt-0.5">
                        {z.tags.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ----- MANAGED BY ----- */}
        {(() => {
          const primaryOwner = managers.find((m) => m.role === 'owner') ?? managers[0] ?? null;
          if (!primaryOwner && !claimedByTeam) return null;

          return (
            <section className="mb-10">
              <div className="text-xs font-mono text-amber-400 tracking-widest mb-3 inline-flex items-center gap-x-2">
                <Pin className="w-3.5 h-3.5" />
                MANAGED BY VENUE OWNER
              </div>

              {primaryOwner && (
                <Link
                  to={`/u/${primaryOwner.handle.replace(/^@/, '')}`}
                  className="block bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 hover:border-amber-400/40 transition-colors mb-2"
                >
                  <div className="flex items-center gap-3">
                    {primaryOwner.avatar_url ? (
                      <img
                        src={primaryOwner.avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {primaryOwner.display_name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium inline-flex items-center gap-x-1.5">
                        {primaryOwner.display_name}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 tracking-widest">
                        {primaryOwner.handle} · {primaryOwner.role.toUpperCase()}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/30 shrink-0" />
                  </div>
                </Link>
              )}

              {claimedByTeam && (
                <Link
                  to={`/t/${claimedByTeam.slug}`}
                  className="block bg-zinc-950 border border-white/5 rounded-2xl px-4 py-2.5 hover:border-amber-400/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {claimedByTeam.logo_url ? (
                      <img
                        src={claimedByTeam.logo_url}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {claimedByTeam.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono text-white/40 tracking-widest mb-0.5">
                        ALSO OPERATED BY TEAM
                      </div>
                      <div className="text-sm inline-flex items-center gap-x-1.5">
                        {claimedByTeam.name}
                        {claimedByTeam.verified && (
                          <BadgeCheck className="w-3 h-3 text-haunt-red" />
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  </div>
                </Link>
              )}
            </section>
          );
        })()}

        {/* ----- RECENT CASES HERE ----- */}
        <section className="mb-10">
          <div className="text-xs font-mono text-white/40 tracking-widest mb-3 flex items-center gap-x-2">
            <FileText className="w-3.5 h-3.5" />
            RECENT CASES AT THIS VENUE
            {!casesLoading && recentCases.length > 0 && (
              <span className="text-white">· {recentCases.length}</span>
            )}
          </div>
          {casesLoading ? (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
            </div>
          ) : recentCases.length === 0 ? (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center text-sm text-white/50">
              No public cases logged here yet. Be the first.
            </div>
          ) : (
            <div className="space-y-2">
              {recentCases.map((c) => (
                <VenueCaseRowCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>

        {/* ----- VISIT (outbound links) ----- */}
        {(location.website ||
          location.youtube_url ||
          location.instagram_url ||
          location.facebook_url ||
          location.tiktok_url) && (
          <section className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-3">
              VISIT
            </div>
            <div className="space-y-2">
              {location.website && (
                <VisitLink
                  href={location.website}
                  icon={<Globe className="w-4 h-4" />}
                  title={cleanHost(location.website)}
                  subtitle="OFFICIAL SITE"
                />
              )}
              {location.youtube_url && (
                <VisitLink
                  href={location.youtube_url}
                  icon={<Youtube className="w-4 h-4" />}
                  title={claimedByTeam?.name ?? location.name}
                  subtitle="FULL EPISODES · FREE STREAMING"
                />
              )}
              {location.instagram_url && (
                <VisitLink
                  href={location.instagram_url}
                  icon={<Instagram className="w-4 h-4" />}
                  title={cleanHandle(location.instagram_url)}
                  subtitle="BEHIND THE SCENES · NEW EVIDENCE"
                />
              )}
              {location.facebook_url && (
                <VisitLink
                  href={location.facebook_url}
                  icon={<Facebook className="w-4 h-4" />}
                  title={location.name}
                  subtitle="EVENT UPDATES"
                />
              )}
              {location.tiktok_url && (
                <VisitLink
                  href={location.tiktok_url}
                  icon={<TikTokIcon className="w-4 h-4" />}
                  title={cleanHandle(location.tiktok_url)}
                  subtitle="SHORT-FORM EVIDENCE"
                />
              )}
            </div>
          </section>
        )}

        {/* ----- CTAS -----
            Sticky bottom bar. When the venue has a booking URL we
            show a 2-up grid (FOLLOW · BOOK); otherwise the FOLLOW
            button takes full width — the old "NO BOOKING LINK"
            placeholder button looked like a broken disabled control. */}
        <div
          className={`sticky bottom-0 bg-black/80 backdrop-blur py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${
            location.booking_url ? 'grid grid-cols-2 gap-3' : ''
          }`}
        >
          <button
            onClick={handleFollow}
            disabled={!authUser || followLoading}
            title={!authUser ? 'Sign in to follow venues' : undefined}
            className={`w-full px-5 py-3.5 rounded-xl text-sm font-mono tracking-widest inline-flex items-center justify-center gap-x-2 transition-colors disabled:opacity-60 ${
              following
                ? 'bg-amber-400/15 border border-amber-400/40 text-amber-300 hover:bg-amber-400/20'
                : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
            }`}
          >
            {followLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : following ? (
              <BadgeCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            {following ? 'FOLLOWING' : 'FOLLOW VENUE'}
          </button>
          {location.booking_url && (
            <a
              href={location.booking_url}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3.5 bg-haunt-red hover:bg-red-600 rounded-xl text-sm font-mono tracking-widest text-white inline-flex items-center justify-center gap-x-2 text-center"
            >
              <CalendarPlus className="w-4 h-4" />
              {location.pricing && location.pricing.tiers.length > 0
                ? `BOOK FROM ${formatPrice(
                    Math.min(...location.pricing.tiers.map((t) => t.price)),
                    location.pricing.currency ?? 'USD'
                  )}`
                : 'BOOK NOW'}
            </a>
          )}
        </div>
      </main>

      {/* Claim modal — overlay */}
      <ClaimVenueModal
        open={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        locationId={location.id}
        locationName={location.name}
        onSubmitted={handleClaimSubmitted}
      />
    </div>
  );
}

function VisitLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 hover:border-white/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{title}</div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest">
            {subtitle}
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-white/30 shrink-0" />
      </div>
    </a>
  );
}

function cleanHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function cleanHandle(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      return last.startsWith('@') ? last : '@' + last;
    }
    return u.host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function VenueCaseRowCard({ c }: { c: VenueCaseRow }) {
  const isAnon = c.visibility === 'anonymous';
  const initials = (c.ownerDisplayName ?? 'AN')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Link
      to={`/case/${c.id}`}
      className="block bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 hover:border-haunt-red/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        {isAnon ? (
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shrink-0">
            <EyeOff className="w-4 h-4" />
          </div>
        ) : c.ownerAvatar ? (
          <img
            src={c.ownerAvatar}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5 mb-0.5">
            <div className="font-medium truncate">{c.title}</div>
            {isAnon ? (
              <span className="text-[9px] font-mono tracking-widest text-amber-300 bg-amber-300/10 border border-amber-300/30 rounded px-1 py-0.5">
                ANON
              </span>
            ) : (
              <span className="text-[9px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/30 rounded px-1 py-0.5">
                <Eye className="w-2.5 h-2.5 inline mr-0.5" />
                PUBLIC
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-white/40 tracking-widest flex items-center gap-x-2 flex-wrap">
            <span>{formatShortDate(c.startedAt)}</span>
            <span className="text-white/20">·</span>
            <span>
              {c.logCount} {c.logCount === 1 ? 'ENTRY' : 'ENTRIES'}
            </span>
            {!isAnon && c.ownerHandle && (
              <>
                <span className="text-white/20">·</span>
                <span>{c.ownerHandle}</span>
              </>
            )}
            {c.teamSlug && (
              <>
                <span className="text-white/20">·</span>
                <span>@{c.teamSlug}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
