import { Link } from 'react-router-dom';
import { MapPin, BadgeCheck, Bookmark, User as UserIcon } from 'lucide-react';
import type { Venue } from '../store/useHauntStore';
import { venueProfileUrl } from '../store/useHauntStore';

type Props = {
  venue: Venue;
  caseCount: number;
  isSelected: boolean;
  onSelect: () => void;
};

function pinColorClass(v: Venue): string {
  if (v.verified) return 'text-green-400';
  if (v.source === 'catalog') return 'text-haunt-red';
  return 'text-white/60';
}

export default function AtlasVenueRow({
  venue,
  caseCount,
  isSelected,
  onSelect,
}: Props) {
  const city = venue.address?.city;
  const state = venue.address?.state;
  const subtitle = [city, state].filter(Boolean).join(', ');

  return (
    <div
      onClick={onSelect}
      className={`group rounded-2xl border p-3 cursor-pointer transition-all ${
        isSelected
          ? 'bg-haunt-red/10 border-haunt-red'
          : 'bg-zinc-900 border-white/10 hover:border-white/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <MapPin className={`w-4 h-4 ${pinColorClass(venue)} mt-1 shrink-0`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-[15px] leading-tight line-clamp-1">
              {venue.name}
            </div>
            {venue.verified && (
              <BadgeCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
            )}
          </div>

          {subtitle && (
            <div className="text-xs text-white/50 mt-0.5 line-clamp-1">{subtitle}</div>
          )}

          <div className="flex items-center gap-2 mt-2 text-[10px] font-mono tracking-widest text-white/40">
            {venue.source === 'catalog' && !venue.verified && (
              <span className="inline-flex items-center gap-x-1 text-haunt-red">
                <Bookmark className="w-2.5 h-2.5" /> OFFICIAL
              </span>
            )}
            {venue.source === 'user' && (
              <span className="inline-flex items-center gap-x-1">
                <UserIcon className="w-2.5 h-2.5" /> COMMUNITY
              </span>
            )}
            {caseCount > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span>
                  <span className="text-white">{caseCount}</span>{' '}
                  {caseCount === 1 ? 'case' : 'cases'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <Link
        to={venueProfileUrl(venue)}
        onClick={(e) => e.stopPropagation()}
        className="block mt-3 pt-3 border-t border-white/5 text-[10px] font-mono tracking-widest text-white/40 hover:text-haunt-red text-right"
      >
        OPEN LOCATION →
      </Link>
    </div>
  );
}
