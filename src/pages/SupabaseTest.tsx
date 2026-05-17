import { useEffect, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type LocationRow = {
  id: string;
  name: string;
  source: string;
  city: string | null;
  state: string | null;
};

export default function SupabaseTest() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setStatus('loading');
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('locations')
        .select('id, name, source, city, state')
        .order('name', { ascending: true });
      if (err) throw err;
      setRows(data ?? []);
      setStatus('ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (SUPABASE_CONFIGURED) runTest();
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
        // SUPABASE CONNECTION TEST
      </div>
      <h1 className="text-4xl font-medium tracking-tighter mb-6">DATABASE LINK</h1>

      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-5 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Env vars set</span>
          {SUPABASE_CONFIGURED ? (
            <span className="inline-flex items-center gap-x-1.5 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> YES
            </span>
          ) : (
            <span className="inline-flex items-center gap-x-1.5 text-red-400 text-sm">
              <XCircle className="w-4 h-4" /> NO — check .env.local
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Query status</span>
          {status === 'idle' && <span className="text-sm text-white/40">not started</span>}
          {status === 'loading' && (
            <span className="inline-flex items-center gap-x-1.5 text-white/70 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> querying
            </span>
          )}
          {status === 'ok' && (
            <span className="inline-flex items-center gap-x-1.5 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> {rows.length} rows
            </span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center gap-x-1.5 text-red-400 text-sm">
              <XCircle className="w-4 h-4" /> failed
            </span>
          )}
        </div>
        <button
          onClick={runTest}
          disabled={!SUPABASE_CONFIGURED}
          className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/30 text-white py-3 rounded-xl font-mono tracking-widest text-sm"
        >
          {status === 'loading' ? 'TESTING…' : 'RUN TEST'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 mb-6 text-sm text-red-300 font-mono break-words">
          {error}
        </div>
      )}

      {status === 'ok' && (
        <div>
          <div className="text-xs font-mono text-white/40 tracking-widest mb-3">
            // LOCATIONS FROM DATABASE
          </div>
          {rows.length === 0 ? (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 text-sm text-white/50">
              The query worked but the table is empty. Did you run
              <span className="font-mono"> 02-seed-locations.sql</span>?
            </div>
          ) : (
            <div className="bg-zinc-900 border border-white/10 rounded-3xl divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-white/40">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono tracking-widest ${
                      r.source === 'catalog' ? 'text-haunt-red' : 'text-white/40'
                    }`}
                  >
                    {r.source.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
