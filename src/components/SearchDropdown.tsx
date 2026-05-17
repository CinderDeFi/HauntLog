import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  searchPeopleAndTeams,
  type SearchResults,
  type SearchProfileHit,
  type SearchTeamHit,
} from '../lib/dataLayer';
import {
  Search,
  X,
  Loader2,
  AtSign,
  Users as UsersIcon,
  BadgeCheck,
  User as UserIcon,
} from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

// Flat list of "what's selectable" so arrow keys work across both sections.
type FlatHit =
  | { kind: 'profile'; data: SearchProfileHit }
  | { kind: 'team'; data: SearchTeamHit };

export default function SearchDropdown({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ profiles: [], teams: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Flatten profile + team hits into a single navigable list.
  const flat: FlatHit[] = [
    ...results.profiles.map((p) => ({ kind: 'profile' as const, data: p })),
    ...results.teams.map((t) => ({ kind: 'team' as const, data: t })),
  ];

  // Focus the input the moment we open. Reset query when we close.
  useEffect(() => {
    if (open) {
      // Defer so the panel mounts before we focus.
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery('');
      setResults({ profiles: [], teams: [] });
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults({ profiles: [], teams: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await searchPeopleAndTeams(query);
        setResults(r);
        setActiveIndex(0);
      } catch {
        setResults({ profiles: [], teams: [] });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // Click outside to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const goToHit = useCallback(
    (hit: FlatHit) => {
      if (hit.kind === 'profile') {
        navigate(`/u/${encodeURIComponent(hit.data.handle)}`);
      } else {
        navigate(`/t/${hit.data.slug}`);
      }
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard nav inside the input.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = flat[activeIndex];
      if (hit) goToHit(hit);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop for mobile so taps outside the panel feel intentional */}
      <div className="fixed inset-0 z-[1290] bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0" />

      <div
        ref={panelRef}
        className="fixed top-16 left-3 right-3 md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-[420px] z-[1300] bg-zinc-950 border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden"
      >
        {/* Input row */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
          <Search className="w-4 h-4 text-white/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search investigators and teams…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/40"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />}
          {query.length > 0 && !loading && (
            <button
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results body — capped height so it doesn't run off-screen */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-6 text-center text-xs font-mono text-white/40 tracking-widest">
              START TYPING TO SEARCH
              <div className="mt-2 text-[10px]">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> to close
              </div>
            </div>
          ) : flat.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-white/60">
              No matches for{' '}
              <span className="font-mono text-white">"{query}"</span>
            </div>
          ) : (
            <>
              {results.profiles.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-white/40 tracking-widest">
                    // INVESTIGATORS
                  </div>
                  {results.profiles.map((p, idx) => {
                    const absIdx = idx;
                    const active = absIdx === activeIndex;
                    return (
                      <button
                        key={p.id}
                        onClick={() => goToHit({ kind: 'profile', data: p })}
                        onMouseEnter={() => setActiveIndex(absIdx)}
                        className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                          active ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center shrink-0">
                            <UserIcon className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-x-1">
                            <div className="text-sm font-medium truncate">
                              {p.display_name}
                            </div>
                            {p.tier && p.tier !== 'free' && (
                              <BadgeCheck className="w-3 h-3 text-haunt-red shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-white/40 truncate inline-flex items-center gap-x-1">
                            <AtSign className="w-2.5 h-2.5" />
                            {p.handle.replace(/^@/, '')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.teams.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-mono text-white/40 tracking-widest border-t border-white/5">
                    // TEAMS
                  </div>
                  {results.teams.map((t, idx) => {
                    const absIdx = results.profiles.length + idx;
                    const active = absIdx === activeIndex;
                    return (
                      <button
                        key={t.id}
                        onClick={() => goToHit({ kind: 'team', data: t })}
                        onMouseEnter={() => setActiveIndex(absIdx)}
                        className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                          active ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        {t.logo_url ? (
                          <img
                            src={t.logo_url}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {t.name
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-x-1">
                            <div className="text-sm font-medium truncate">{t.name}</div>
                            {t.verified && (
                              <BadgeCheck className="w-3 h-3 text-haunt-red shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-white/40 truncate inline-flex items-center gap-x-1">
                            <UsersIcon className="w-2.5 h-2.5" />@{t.slug}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint with shortcuts + browse-all link */}
        <div className="border-t border-white/10 px-3 py-2 flex items-center gap-x-3 text-[10px] font-mono text-white/40 tracking-widest">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd> NAVIGATE
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↵</kbd> OPEN
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> CLOSE
          </span>
          <button
            onClick={() => {
              onClose();
              navigate(query.trim().length >= 2
                ? `/app/discover?q=${encodeURIComponent(query.trim())}`
                : '/app/discover');
            }}
            className="ml-auto text-haunt-red hover:underline"
          >
            DISCOVER →
          </button>
        </div>
      </div>
    </>
  );
}
