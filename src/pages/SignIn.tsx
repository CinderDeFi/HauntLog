import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/app/live';
  const { status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the user successfully calls signInWithPassword. Then we
  // wait for the auth status to flip to 'signed_in' before navigating.
  const [awaitingSignIn, setAwaitingSignIn] = useState(false);

  // When auth flips to signed_in AFTER a successful submit, navigate.
  // This handles both fresh sign-in (after submit) and the edge case
  // where the user lands on /auth/signin while already signed in.
  useEffect(() => {
    if (status === 'signed_in') {
      navigate(redirectTo, { replace: true });
    }
  }, [status, navigate, redirectTo]);

  // "Resend verification" sub-state — appears when the error suggests
  // an unconfirmed email.
  const [resendStatus, setResendStatus] = useState<
    'idle' | 'sending' | 'sent' | 'failed'
  >('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  // Heuristic: Supabase returns errors like "Email not confirmed" verbatim
  // when an unverified user tries to sign in. We surface a "Resend
  // verification" button in that case.
  const errorLooksLikeUnverified =
    !!error && /email not confirmed|email is not confirmed/i.test(error);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) {
      setError('Supabase is not configured. Check .env.local.');
      return;
    }
    setError(null);
    setResendStatus('idle');
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      // Don't navigate here — wait for useAuth() to flip to 'signed_in'
      // (the useEffect above handles it). Navigating eagerly races with
      // the auth-state propagation and produces the "two-try sign-in" bug.
      setAwaitingSignIn(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!email.trim()) {
      setResendError('Enter your email above first.');
      return;
    }
    setResendStatus('sending');
    setResendError(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      });
      if (err) throw err;
      setResendStatus('sent');
    } catch (e) {
      setResendError(e instanceof Error ? e.message : String(e));
      setResendStatus('failed');
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
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
            // SIGN IN
          </div>
          <h1 className="text-4xl font-medium tracking-tighter mb-2">Welcome back.</h1>
          <p className="text-white/60 mb-8">Pick up where you left off.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                EMAIL
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono text-white/40 tracking-widest">
                  PASSWORD
                </label>
                <Link
                  to="/auth/forgot"
                  className="text-xs text-white/40 hover:text-white"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
                <div className="flex items-start gap-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
                {errorLooksLikeUnverified && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    {resendStatus === 'sent' ? (
                      <div className="text-green-300 text-xs inline-flex items-center gap-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verification email resent. Check your inbox.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={onResend}
                        disabled={resendStatus === 'sending'}
                        className="text-xs text-white/90 hover:text-white underline disabled:opacity-50"
                      >
                        {resendStatus === 'sending'
                          ? 'Sending…'
                          : 'Resend verification email'}
                      </button>
                    )}
                    {resendError && (
                      <div className="text-xs text-red-300 mt-1">{resendError}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || awaitingSignIn}
              className="w-full bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm flex items-center justify-center gap-x-2"
            >
              {submitting || awaitingSignIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> SIGNING IN
                </>
              ) : (
                <>
                  SIGN IN <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-white/60">
            New here?{' '}
            <Link to="/auth/signup" className="text-haunt-red hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
