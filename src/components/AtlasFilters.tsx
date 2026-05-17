import { Search, X } from 'lucide-react';

export type SourceFilter = 'all' | 'catalog' | 'user';

type Props = {
  search: string;
  onSearchChange: (s: string) => void;
  source: SourceFilter;
  onSourceChange: (s: SourceFilter) => void;
  allTags: string[];
  tagFilter: string | null;
  onTagChange: (t: string | null) => void;
};

export default function AtlasFilters({
  search,
  onSearchChange,
  source,
  onSourceChange,
  allTags,
  tagFilter,
  onTagChange,
}: Props) {
  return (
    <div className="space-y-3">
      {/* SEARCH */}
      <div className="relative">
        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search venues, cities, tags…"
          className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:border-haunt-red outline-none"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/40"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* SOURCE */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'catalog', 'user'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onSourceChange(f)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-mono tracking-widest border transition-all ${
              source === f
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
            }`}
          >
            {f === 'all' ? 'ALL' : f === 'catalog' ? 'OFFICIAL' : 'COMMUNITY'}
          </button>
        ))}
      </div>

      {/* TAGS */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
          <button
            onClick={() => onTagChange(null)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all ${
              tagFilter === null
                ? 'bg-haunt-red/10 border-haunt-red text-haunt-red'
                : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
            }`}
          >
            ALL TAGS
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => onTagChange(t)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border transition-all ${
                tagFilter === t
                  ? 'bg-haunt-red/10 border-haunt-red text-haunt-red'
                  : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
