import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The reset-password email link puts a recovery token in the URL
    // fragment. The Supabase client (with detectSessionInUrl: true) picks
    // it up automatically and creates a temporary session. We wait briefly
    // for that, then check whether we have one.
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setPhase('ready');
          return;
        }
      }
      setPhase('invalid');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setPhase('done');
      setTimeout(() => navigate('/app/live', { replace: true }), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-6 md:px-12 py-6">
        <Link to="/" className="flex items-center gap-x-2 w-fit">
          <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8 w-8" />
          <span className="font-mono text-2xl tracking-tighter">HAUNTLOG</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {phase === 'checking' && (
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-white/60 animate-spin mx-auto mb-6" />
              <p className="text-white/60">Verifying reset link…</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">
                Invalid or expired link
              </h1>
              <p className="text-white/60 mb-6">
                Reset links expire after 1 hour. Request a fresh one.
              </p>
              <Link
                to="/auth/forgot"
                className="block w-full bg-haunt-red hover:bg-red-600 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
              >
                REQUEST NEW LINK
              </Link>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
                // PASSWORD RESET
              </div>
              <h1 className="text-4xl font-medium tracking-tighter mb-2">
                Set a new password.
              </h1>
              <p className="text-white/60 mb-8">
                Choose something strong and memorable.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                    NEW PASSWORD
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                    CONFIRM
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                      placeholder="Re-enter the same password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-words">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> UPDATING
                    </>
                  ) : (
                    <>
                      SET PASSWORD <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {phase === 'done' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-400/10 border border-green-400/30 mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-xs font-mono text-green-400 tracking-widest mb-2">
                // PASSWORD UPDATED
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">You're back in.</h1>
              <p className="text-white/60">Redirecting to the app…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
