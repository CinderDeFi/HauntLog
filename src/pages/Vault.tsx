import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHauntStore, type Visibility } from '../store/useHauntStore';
import { Globe, Lock, EyeOff, MapPin, Star } from 'lucide-react';

type Filter = 'all' | Visibility;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function VisibilityBadge({ v }: { v: Visibility }) {
  if (v === 'public')
    return (
      <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-green-400">
        <Globe className="w-3 h-3" /> PUBLIC
      </div>
    );
  if (v === 'anonymous')
    return (
      <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-amber-400">
        <EyeOff className="w-3 h-3" /> ANON
      </div>
    );
  return (
    <div className="flex items-center gap-x-1 text-xs font-mono tracking-widest text-white/40">
      <Lock className="w-3 h-3" /> PRIVATE
    </div>
  );
}

export default function Vault() {
  const navigate = useNavigate();
  const cases = useHauntStore((s) => s.cases);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = cases.filter((c) => (filter === 'all' ? true : c.visibility === filter));

  return (
    <div>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-5xl font-medium tracking-tighter">YOUR VAULT</h1>
          <p className="text-white/60 mt-1">
            {cases.length} sealed {cases.length === 1 ? 'case' : 'cases'}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/hunt/new')}
          className="bg-haunt-red hover:bg-red-600 text-white px-6 py-3 rounded-xl font-mono tracking-widest text-sm transition-colors active:scale-[0.98]"
        >
          + NEW HUNT
        </button>
      </div>

      {cases.length > 0 && (
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['all', 'public', 'anonymous', 'private'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-mono tracking-widest border transition-all ${
                filter === f
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {cases.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
            // VAULT IS EMPTY
          </div>
          <h2 className="text-3xl font-medium mb-2">No cases yet.</h2>
          <p className="text-white/60 mb-8">
            Start your first hunt — log what your gear catches (or what you notice), then seal the
            file.
          </p>
          <button
            onClick={() => navigate('/app/hunt/new')}
            className="bg-haunt-red hover:bg-red-600 text-white px-8 py-3 rounded-xl font-mono tracking-widest text-sm transition-colors"
          >
            START A HUNT →
          </button>
        </div>
      )}

      {cases.length > 0 && filtered.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 text-center text-white/50">
          No {filter} cases yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const starred = c.logs.filter((l) => l.starred).length;
          return (
            <Link
              key={c.id}
              to={`/case/${c.id}`}
              className="block bg-zinc-900 border border-white/10 rounded-3xl p-6 hover:border-haunt-red/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="font-mono text-xs text-white/40 tracking-widest">#{c.id}</div>
                <VisibilityBadge v={c.visibility} />
              </div>

              <h3 className="text-2xl font-medium leading-tight mb-2 line-clamp-2">{c.title}</h3>
              <div className="flex items-start gap-x-1.5 text-white/60 text-sm mb-4">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-1">
                  {c.location}
                  {c.zone ? ` · ${c.zone}` : ''}
                </span>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-x-4 font-mono text-white/60">
                  <span>
                    <span className="text-white font-medium">{c.logs.length}</span> events
                  </span>
                  {starred > 0 && (
                    <span className="flex items-center gap-x-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-white font-medium">{starred}</span>
                    </span>
                  )}
                </div>
                <div className="text-white/40">{formatDate(c.endedAt ?? c.startedAt)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
