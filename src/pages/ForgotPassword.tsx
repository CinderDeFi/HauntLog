import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import {
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  MailCheck,
  ArrowLeft,
} from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) {
      setError('Supabase is not configured.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/reset` }
      );
      if (err) throw err;
      // Supabase returns success regardless of whether the email exists, by
      // design (prevents email enumeration). So we always show the same
      // success state.
      setSent(true);
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
          {!sent && (
            <>
              <Link
                to="/auth/signin"
                className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>

              <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
                // PASSWORD RESET
              </div>
              <h1 className="text-4xl font-medium tracking-tighter mb-2">
                Forgot your password?
              </h1>
              <p className="text-white/60 mb-8">
                Enter your email and we'll send a reset link.
              </p>

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
                      <Loader2 className="w-4 h-4 animate-spin" /> SENDING
                    </>
                  ) : (
                    <>
                      SEND RESET LINK <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {sent && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-haunt-red/10 border border-haunt-red/30 mb-6">
                <MailCheck className="w-8 h-8 text-haunt-red" />
              </div>
              <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
                // CHECK YOUR INBOX
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">
                Reset link sent.
              </h1>
              <p className="text-white/60 mb-2">If an account exists for:</p>
              <p className="text-white font-medium mb-6 break-all">{email}</p>
              <p className="text-sm text-white/50 leading-relaxed mb-8">
                You'll receive a link to set a new password. The link expires in 1 hour. Check your spam folder if it doesn't arrive in a few minutes.
              </p>
              <Link
                to="/auth/signin"
                className="block w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
              >
                BACK TO SIGN IN
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
