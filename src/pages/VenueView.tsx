import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useHauntStore, formatAddress } from '../store/useHauntStore';
import {
  ArrowLeft,
  MapPin,
  History,
  Edit3,
  Save,
  X,
  BadgeCheck,
  Bookmark,
  User as UserIcon,
  Globe,
  Clock,
  Mail,
  Phone,
  Tag as TagIcon,
  ShieldCheck,
} from 'lucide-react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VenueView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const venues = useHauntStore((s) => s.venues);
  const cases = useHauntStore((s) => s.cases);
  const editVenue = useHauntStore((s) => s.editVenue);

  const venue = venues.find((v) => v.id === id);

  const [editing, setEditing] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  // Edit form state — keyed to current venue
  const [name, setName] = useState(venue?.name ?? '');
  const [lat, setLat] = useState(String(venue?.lat ?? ''));
  const [lng, setLng] = useState(String(venue?.lng ?? ''));
  const [description, setDescription] = useState(venue?.description ?? '');
  const [website, setWebsite] = useState(venue?.website ?? '');
  const [hours, setHours] = useState(venue?.hours ?? '');
  const [contactEmail, setContactEmail] = useState(venue?.contact?.email ?? '');
  const [contactPhone, setContactPhone] = useState(venue?.contact?.phone ?? '');
  const [bookingUrl, setBookingUrl] = useState(venue?.bookingUrl ?? '');
  const [rulesText, setRulesText] = useState((venue?.rules ?? []).join('\n'));
  const [tagsText, setTagsText] = useState((venue?.tags ?? []).join(', '));
  // Address
  const [street, setStreet] = useState(venue?.address?.street ?? '');
  const [city, setCity] = useState(venue?.address?.city ?? '');
  const [state, setState] = useState(venue?.address?.state ?? '');
  const [zip, setZip] = useState(venue?.address?.zip ?? '');
  const [country, setCountry] = useState(venue?.address?.country ?? '');

  if (!venue) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">// 404</div>
        <h1 className="text-3xl font-medium mb-4">Location not found</h1>
        <Link
          to="/app/atlas"
          className="inline-block bg-white text-black px-6 py-3 rounded-xl font-mono tracking-widest text-sm hover:bg-haunt-red hover:text-white transition-colors"
        >
          ← BACK TO ATLAS
        </Link>
      </div>
    );
  }

  const venueCases = cases.filter((c) => c.venueId === venue.id && c.visibility !== 'private');

  const startEdit = () => {
    setName(venue.name);
    setLat(String(venue.lat));
    setLng(String(venue.lng));
    setDescription(venue.description ?? '');
    setWebsite(venue.website ?? '');
    setHours(venue.hours ?? '');
    setContactEmail(venue.contact?.email ?? '');
    setContactPhone(venue.contact?.phone ?? '');
    setBookingUrl(venue.bookingUrl ?? '');
    setRulesText((venue.rules ?? []).join('\n'));
    setTagsText((venue.tags ?? []).join(', '));
    setStreet(venue.address?.street ?? '');
    setCity(venue.address?.city ?? '');
    setState(venue.address?.state ?? '');
    setZip(venue.address?.zip ?? '');
    setCountry(venue.address?.country ?? '');
    setEditing(true);
  };

  const saveEdit = () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (!name.trim() || Number.isNaN(latN) || Number.isNaN(lngN)) return;

    const rules = rulesText
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const tags = tagsText
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const anyAddress = street || city || state || zip || country;

    editVenue(venue.id, {
      name: name.trim(),
      lat: latN,
      lng: lngN,
      description: description.trim() || undefined,
      website: website.trim() || undefined,
      hours: hours.trim() || undefined,
      contact:
        contactEmail || contactPhone
          ? {
              email: contactEmail.trim() || undefined,
              phone: contactPhone.trim() || undefined,
            }
          : undefined,
      bookingUrl: bookingUrl.trim() || undefined,
      rules: rules.length > 0 ? rules : undefined,
      tags: tags.length > 0 ? tags : undefined,
      address: anyAddress
        ? {
            street: street.trim() || undefined,
            city: city.trim() || undefined,
            state: state.trim() || undefined,
            zip: zip.trim() || undefined,
            country: country.trim() || undefined,
          }
        : undefined,
    });
    setEditing(false);
  };

  const isCatalog = venue.source === 'catalog';
  const addressLine = formatAddress(venue.address);
  const pinClass = venue.verified
    ? 'text-green-400'
    : isCatalog
    ? 'text-haunt-red'
    : 'text-white/60';

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK
      </button>

      {/* Verified catalog venues have a rich public profile at /v/:id */}
      {venue.verified && isCatalog && (
        <Link
          to={`/v/${venue.id}`}
          className="block bg-amber-400/5 border border-amber-400/40 rounded-2xl px-4 py-3 mb-6 hover:bg-amber-400/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-amber-300 tracking-widest">
                VERIFIED LOCATION
              </div>
              <div className="text-sm">
                View this venue's rich profile, booking info, and documented zones →
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
        <MapPin className={`w-4 h-4 ${pinClass}`} /> LOCATION
      </div>

      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
            <h1 className="text-5xl font-medium tracking-tighter">{venue.name}</h1>
            <div className="flex gap-2">
              {isCatalog && !venue.claimedByHandle && (
                <button
                  onClick={() => setShowClaim(true)}
                  className="px-4 py-2 bg-haunt-red/10 hover:bg-haunt-red/20 text-haunt-red border border-haunt-red/30 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> CLAIM THIS LOCATION
                </button>
              )}
              <button
                onClick={startEdit}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
              >
                <Edit3 className="w-3.5 h-3.5" /> SUGGEST EDIT
              </button>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {venue.verified && (
              <span className="inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest text-green-400 px-2 py-0.5 bg-green-400/10 rounded">
                <BadgeCheck className="w-3 h-3" /> VERIFIED
              </span>
            )}
            {isCatalog && !venue.verified && (
              <span className="inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest text-haunt-red px-2 py-0.5 bg-haunt-red/10 rounded">
                <Bookmark className="w-3 h-3" /> OFFICIAL
              </span>
            )}
            {!isCatalog && (
              <span className="inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest text-white/40 px-2 py-0.5 bg-white/5 rounded">
                <UserIcon className="w-3 h-3" /> COMMUNITY
              </span>
            )}
            {venue.tags?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest text-white/60 px-2 py-0.5 bg-white/5 border border-white/10 rounded"
              >
                <TagIcon className="w-2.5 h-2.5" />
                {t.toUpperCase()}
              </span>
            ))}
          </div>

          {addressLine && (
            <div className="text-sm text-white/60 mb-1">{addressLine}</div>
          )}
          <div className="font-mono text-xs text-white/40 mb-4">
            {venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}
          </div>

          {venue.description && (
            <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">
              {venue.description}
            </p>
          )}

          {/* Info grid */}
          {(venue.website || venue.hours || venue.contact || venue.bookingUrl) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {venue.website && (
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-haunt-red/50 transition-all flex items-start gap-x-3"
                >
                  <Globe className="w-4 h-4 text-haunt-red mt-1 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">
                      WEBSITE
                    </div>
                    <div className="text-sm truncate">{venue.website}</div>
                  </div>
                </a>
              )}
              {venue.hours && (
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex items-start gap-x-3">
                  <Clock className="w-4 h-4 text-haunt-red mt-1 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">HOURS</div>
                    <div className="text-sm">{venue.hours}</div>
                  </div>
                </div>
              )}
              {venue.contact?.email && (
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex items-start gap-x-3">
                  <Mail className="w-4 h-4 text-haunt-red mt-1 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">EMAIL</div>
                    <div className="text-sm truncate">{venue.contact.email}</div>
                  </div>
                </div>
              )}
              {venue.contact?.phone && (
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex items-start gap-x-3">
                  <Phone className="w-4 h-4 text-haunt-red mt-1 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">PHONE</div>
                    <div className="text-sm">{venue.contact.phone}</div>
                  </div>
                </div>
              )}
              {venue.bookingUrl && (
                <a
                  href={venue.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-haunt-red/10 border border-haunt-red/30 hover:bg-haunt-red/20 text-haunt-red rounded-2xl p-4 transition-all flex items-start gap-x-3 md:col-span-2"
                >
                  <Bookmark className="w-4 h-4 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono tracking-widest opacity-70">BOOKING</div>
                    <div className="text-sm truncate">{venue.bookingUrl}</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {venue.rules && venue.rules.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-mono text-white/40 tracking-widest mb-3">
                // HOUSE RULES
              </div>
              <ul className="space-y-2">
                {venue.rules.map((r, i) => (
                  <li key={i} className="text-sm text-white/80 flex items-start gap-x-2">
                    <span className="text-haunt-red mt-0.5">·</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-white/40 mb-10">
            {isCatalog ? 'Added by HauntLog catalog' : 'First added by'}{' '}
            <span className="text-white/70 font-medium">{venue.createdByHandle}</span> on{' '}
            {formatDate(venue.createdAt)}
            {venue.claimedByHandle && (
              <>
                {' '}
                · Managed by <span className="text-white/70 font-medium">{venue.claimedByHandle}</span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-8 space-y-4">
          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                LATITUDE
              </label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                LONGITUDE
              </label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                STREET
              </label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                CITY
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                STATE
              </label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                ZIP
              </label>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                COUNTRY
              </label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                WEBSITE
              </label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                BOOKING URL
              </label>
              <input
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              HOURS
            </label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. Fri-Sat 8pm-2am · Tours by appt"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                CONTACT EMAIL
              </label>
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                CONTACT PHONE
              </label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              HOUSE RULES (one per line)
            </label>
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              rows={4}
              placeholder={'No flash photography\n21+'}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              TAGS (comma-separated)
            </label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="historic-prison, abandoned, featured-on-tv"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="px-5 py-3 text-white/60 hover:text-white font-mono tracking-widest text-sm"
            >
              <X className="w-4 h-4 inline mr-1.5" /> CANCEL
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 bg-haunt-red hover:bg-red-600 text-white py-3 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
            >
              <Save className="w-4 h-4" /> SAVE EDIT
            </button>
          </div>
          <p className="text-xs text-white/40">
            Your edit becomes the current version. The previous values are preserved in the
            revision history below.
          </p>
        </div>
      )}

      {/* Cases at this venue */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono text-white/40 tracking-widest">
            // PUBLIC CASES AT THIS LOCATION
          </div>
          <div className="text-xs font-mono text-white/40">
            {venueCases.length} {venueCases.length === 1 ? 'CASE' : 'CASES'}
          </div>
        </div>
        {venueCases.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 text-center text-white/40 text-sm">
            No public cases logged here yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {venueCases.map((c) => (
              <Link
                key={c.id}
                to={`/case/${c.id}`}
                className="bg-zinc-900 border border-white/10 rounded-2xl p-5 hover:border-haunt-red/50 transition-all"
              >
                <div className="text-xs font-mono text-white/40 tracking-widest mb-1">#{c.id}</div>
                <div className="font-medium text-lg leading-tight mb-1">{c.title}</div>
                <div className="text-xs text-white/50 flex items-center justify-between mt-3 pt-3 border-t border-white/10 font-mono">
                  <span>
                    <span className="text-white">{c.logs.length}</span> events
                  </span>
                  <span>{formatDate(c.endedAt ?? c.startedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Revision history */}
      {venue.revisions.length > 0 && (
        <div>
          <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
            <History className="w-4 h-4" /> REVISION HISTORY
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-3xl divide-y divide-white/5">
            {venue.revisions.map((rev, i) => {
              const fields = Object.entries(rev.changes).filter(([, v]) => v !== undefined);
              return (
                <div key={i} className="px-5 py-4">
                  <div className="text-xs text-white/40 mb-2">
                    {formatDateTime(rev.at)} · edit by{' '}
                    <span className="text-white/70 font-medium">{rev.byHandle}</span>
                  </div>
                  <div className="space-y-1">
                    {fields.map(([field, oldValue]) => {
                      const label =
                        typeof oldValue === 'object' && oldValue !== null
                          ? JSON.stringify(oldValue)
                          : String(oldValue);
                      return (
                        <div key={field} className="text-xs font-mono">
                          <span className="text-white/40 tracking-widest">
                            {field.toUpperCase()}
                          </span>{' '}
                          <span className="text-white/40">was</span>{' '}
                          <span className="line-through text-white/60 break-all">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Claim modal placeholder */}
      {showClaim && (
        <div
          className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowClaim(false)}
        >
          <div
            className="bg-zinc-950 border border-white/10 rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-mono text-haunt-red tracking-widest">
                CLAIM THIS LOCATION
              </div>
              <button
                onClick={() => setShowClaim(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-medium mb-2">{venue.name}</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-5">
              Location accounts are coming in a future update. Once live, the location owner will be
              able to claim this listing, edit official details, set house rules, and manage booking
              links. Each claim is manually reviewed by HauntLog.
            </p>
            <button
              onClick={() => setShowClaim(false)}
              className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl text-sm font-mono tracking-widest"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
