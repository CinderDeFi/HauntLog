import { useEffect, useState } from 'react';
import { Search, Eye, HelpCircle, Snowflake } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import {
  fetchCaseReactionCounts,
  fetchMyCaseReaction,
  setCaseReaction,
  clearCaseReaction,
  type CaseReaction,
  type CaseReactionCounts,
} from '../lib/dataLayer';
import { useToast } from './ui/Toast';

/**
 * Domain-specific reactions on a sealed case. Four stances:
 *
 *   EXAMINE   — worth scrutinizing closely
 *   WITNESSED — I've had a similar experience
 *   SKEPTICAL — I'm not convinced; could be explained
 *   CHILLED   — this gave me goosebumps
 *
 * One reaction per user. Tapping a new one swaps; tapping your
 * current one clears it. Counts are denormalized server-side via
 * a trigger on case_reactions so we render them in O(1).
 *
 * Hidden on the case owner's view of their own case (they can't
 * react to themselves — would be vanity counting). Also hidden
 * on private cases since no one else can see them.
 */
type Props = {
  caseId: string;
  /** Owner's user id, used to suppress the bar on owner-self view. */
  ownerId: string | null;
  /** Visibility — bar hidden on 'private' cases (only owner sees). */
  visibility: 'public' | 'private' | 'anonymous';
};

type ReactionMeta = {
  key: CaseReaction;
  label: string;
  Icon: typeof Search;
  /** Tailwind classes for the SELECTED state: ring + text + bg. */
  selectedClasses: string;
  /** Tailwind classes for the icon color in the unselected state. */
  iconHover: string;
};

const REACTIONS: ReactionMeta[] = [
  {
    key: 'examine',
    label: 'EXAMINE',
    Icon: Search,
    selectedClasses: 'border-white/40 text-white bg-white/10',
    iconHover: 'group-hover:text-white/80',
  },
  {
    key: 'witnessed',
    label: 'WITNESSED',
    Icon: Eye,
    selectedClasses: 'border-cyan-400/50 text-cyan-200 bg-cyan-400/10',
    iconHover: 'group-hover:text-cyan-300',
  },
  {
    key: 'skeptical',
    label: 'SKEPTICAL',
    Icon: HelpCircle,
    selectedClasses: 'border-amber-400/50 text-amber-200 bg-amber-400/10',
    iconHover: 'group-hover:text-amber-300',
  },
  {
    key: 'chilled',
    label: 'CHILLED',
    Icon: Snowflake,
    selectedClasses: 'border-haunt-red/60 text-haunt-red bg-haunt-red/10',
    iconHover: 'group-hover:text-haunt-red',
  },
];

export default function CaseReactions({ caseId, ownerId, visibility }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState<CaseReactionCounts>({});
  const [mine, setMine] = useState<CaseReaction | null>(null);
  const [pending, setPending] = useState<CaseReaction | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Conditions to suppress the bar. Computed before the early return
  // BUT only used to decide whether to render — hooks still run in
  // a consistent order on every render.
  const isOwner = !!user && !!ownerId && user.id === ownerId;
  const suppressed = visibility === 'private' || isOwner;

  useEffect(() => {
    if (suppressed) return;
    let cancelled = false;
    (async () => {
      const [c, m] = await Promise.all([
        fetchCaseReactionCounts(caseId),
        user ? fetchMyCaseReaction(caseId) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setCounts(c);
      setMine(m);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, user, suppressed]);

  if (suppressed) return null;

  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  const handleTap = async (reaction: CaseReaction) => {
    if (!user) {
      toast.error('Sign in to react');
      return;
    }
    if (pending) return; // debounce double-taps

    const wasSelected = mine === reaction;
    const previous = mine;
    setPending(reaction);

    // Optimistic update — adjust counts and selection right away so
    // the tap feels instant; revert on error.
    setCounts((prev) => {
      const next = { ...prev };
      if (previous) {
        next[previous] = Math.max(0, (next[previous] ?? 0) - 1);
      }
      if (!wasSelected) {
        next[reaction] = (next[reaction] ?? 0) + 1;
      }
      return next;
    });
    setMine(wasSelected ? null : reaction);

    try {
      const result = wasSelected
        ? await clearCaseReaction({ caseId, userId: user.id })
        : await setCaseReaction({ caseId, userId: user.id, reaction });
      if (!result.ok) {
        // Revert optimistic changes.
        const fresh = await fetchCaseReactionCounts(caseId);
        const myFresh = await fetchMyCaseReaction(caseId);
        setCounts(fresh);
        setMine(myFresh);
        toast.error('Reaction failed', { description: result.error });
      }
    } finally {
      setPending(null);
    }
  };

  if (!loaded) {
    // Skeleton — same height as the real bar, no flicker on load.
    return (
      <div className="h-12 rounded-2xl bg-white/[0.02] border border-white/5" aria-hidden />
    );
  }

  return (
    <div>
      <div className="text-[10px] font-mono text-white/40 tracking-[0.2em] mb-3 flex items-center justify-between">
        <span>// REACTIONS{total > 0 ? ` · ${total}` : ''}</span>
        {!user && (
          <span className="text-white/30 normal-case tracking-normal">
            Sign in to react
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ key, label, Icon, selectedClasses, iconHover }) => {
          const n = counts[key] ?? 0;
          const selected = mine === key;
          const isPending = pending === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTap(key)}
              disabled={isPending || !user}
              aria-pressed={selected}
              className={`group inline-flex items-center gap-x-2 px-3 py-2 rounded-xl border font-mono text-[10px] md:text-xs tracking-widest transition-all disabled:cursor-not-allowed ${
                selected
                  ? selectedClasses
                  : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/30 hover:text-white/80'
              } ${isPending ? 'opacity-60' : ''}`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  selected ? '' : `text-white/40 ${iconHover} transition-colors`
                }`}
              />
              <span>{label}</span>
              {n > 0 && (
                <span
                  className={`tabular-nums ${
                    selected ? '' : 'text-white/40'
                  }`}
                >
                  · {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
