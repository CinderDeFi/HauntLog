import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { fetchVenuesIManage, type ManagedVenue } from '../lib/dataLayer';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ChevronRight,
  Crown,
  Loader2,
  MapPin,
  Settings2,
  Star,
} from 'lucide-react';

export default function MyVenues() {
  const { user: authUser } = useAuth();
  const [venues, setVenues] = useState<ManagedVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    fetchVenuesIManage(authUser.id)
      .then(setVenues)
      .catch((e) => {
        // Supabase errors are plain objects (PostgrestError), not Error
        // instances — extract the .message explicitly so we don't render
        // "[object Object]".
        const msg =
          (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string')
            ? e.message
            : e instanceof Error
            ? e.message
            : String(e);
        setError(msg);
        console.error('[MyVenues] fetchVenuesIManage failed:', e);
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-medium mb-3">Sign in to see your managed venues.</h1>
        <Link
          to="/auth/signin"
          className="inline-block bg-white text-black px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs hover:bg-haunt-red hover:text-white transition-colors"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/app"
        className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK
      </Link>

      <div className="text-xs font-mono text-amber-400 tracking-widest mb-2 flex items-center gap-x-2">
        <Building2 className="w-3.5 h-3.5" /> MANAGED VENUES
      </div>
      <h1 className="text-4xl md:text-5xl font-medium tracking-tighter mb-2">Your venues</h1>
      <p className="text-white/60 mb-8">
        Locations you manage on HauntLog. Edit content, pricing, zones, and respond
        to investigator activity.
      </p>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
        </div>
      ) : venues.length === 0 ? (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <Building2 className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <h2 className="text-xl font-medium mb-2">No managed venues yet.</h2>
          <p className="text-white/60 text-sm mb-4 max-w-md mx-auto">
            If you own or operate a haunted location, you can claim it on HauntLog
            to manage its public profile, set pricing, and document its zones.
          </p>
          <Link
            to="/app/atlas"
            className="inline-block text-xs font-mono tracking-widest text-haunt-red hover:underline"
          >
            BROWSE THE ATLAS →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {venues.map((v) => (
            <VenueCard key={v.location.id} m={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VenueCard({ m }: { m: ManagedVenue }) {
  const { location, role } = m;
  const addressLine = [location.city, location.state].filter(Boolean).join(', ');
  const isOwner = role === 'owner';
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 hover:border-amber-400/40 transition-colors flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5 mb-0.5">
            <div className="font-medium truncate">{location.name}</div>
            {location.claim_status === 'verified' && (
              <BadgeCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
          </div>
          {addressLine && (
            <div className="text-xs font-mono text-white/40 tracking-widest inline-flex items-center gap-x-1">
              <MapPin className="w-2.5 h-2.5" />
              {addressLine}
            </div>
          )}
        </div>
        <span
          className={`text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-x-1 shrink-0 ${
            isOwner
              ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40'
              : 'bg-white/10 text-white/70 border border-white/10'
          }`}
        >
          {isOwner ? <Crown className="w-2.5 h-2.5" /> : <Star className="w-2.5 h-2.5" />}
          {role.toUpperCase()}
        </span>
      </div>

      {location.tagline && (
        <p className="text-xs italic text-white/60 mb-3 line-clamp-2">{location.tagline}</p>
      )}

      <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-2">
        <Link
          to={`/v/${location.id}`}
          className="flex-1 text-center px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono tracking-widest text-white/80"
        >
          VIEW PUBLIC
        </Link>
        <Link
          to={`/app/venues/${encodeURIComponent(location.id)}/edit`}
          className="flex-1 inline-flex items-center justify-center gap-x-1.5 px-3 py-2 rounded-lg bg-haunt-red hover:bg-red-600 text-xs font-mono tracking-widest text-white"
        >
          <Settings2 className="w-3 h-3" /> MANAGE
          <ChevronRight className="w-3 h-3 -mr-1" />
        </Link>
      </div>
    </div>
  );
}
