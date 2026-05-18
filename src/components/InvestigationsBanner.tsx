import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, X } from 'lucide-react';
import {
  listActiveInvestigationsForUser,
  type ActiveInvestigationSummary,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';

/**
 * Thin banner shown above page content whenever any team the user
 * belongs to has an open investigation. One row per investigation.
 * Members see "OPEN" badge; non-joined teammates see "JOIN" link.
 *
 * The banner is dismissable per-investigation per-session via the X.
 */
export default function InvestigationsBanner() {
  const { user: authUser } = useAuth();
  const [items, setItems] = useState<ActiveInvestigationSummary[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authUser) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const list = await listActiveInvestigationsForUser();
      if (!cancelled) setItems(list);
    };
    load();
    // Re-poll every 60 seconds so members see new investigations
    // appear without a hard refresh.
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [authUser]);

  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="bg-haunt-red/10 border-b border-haunt-red/30">
      {visible.map((inv) => (
        <div
          key={inv.id}
          className="max-w-screen-2xl mx-auto px-4 md:px-8 py-2 flex items-center gap-3 text-sm"
        >
          <span className="relative inline-flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-haunt-red opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-haunt-red"></span>
          </span>
          <Radio className="w-3.5 h-3.5 text-haunt-red shrink-0" />
          <div className="flex-1 min-w-0 truncate">
            <span className="font-mono text-[10px] text-haunt-red tracking-widest mr-2">
              LIVE INVESTIGATION
            </span>
            <span className="text-white font-medium">{inv.team_name}</span>
            <span className="text-white/60"> at </span>
            <span className="text-white">{inv.location_name}</span>
            <span className="text-white/40">
              {' '}
              · {inv.member_count} {inv.member_count === 1 ? 'investigator' : 'investigators'}
            </span>
          </div>
          <Link
            to={`/app/investigations/${inv.id}`}
            className="text-xs font-mono tracking-widest text-haunt-red hover:text-white px-3 py-1 rounded-md border border-haunt-red/40 hover:bg-haunt-red shrink-0"
          >
            {inv.i_am_member ? 'OPEN' : 'JOIN'}
          </Link>
          <button
            type="button"
            onClick={() =>
              setDismissed((prev) => {
                const next = new Set(prev);
                next.add(inv.id);
                return next;
              })
            }
            aria-label="Dismiss"
            className="text-white/40 hover:text-white p-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
