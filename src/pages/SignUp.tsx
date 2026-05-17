import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Loader2,
  MailCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

type Phase = 'form' | 'check_inbox';

export default function SignUp() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('form');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendStatus, setResendStatus] = useState<
    'idle' | 'sending' | 'sent' | 'failed'
  >('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) {
      setError('Supabase is not configured. Check .env.local.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Supabase stores this in raw_user_meta_data which the
          // handle_new_user trigger reads to set the display_name.
          data: { full_name: displayName.trim() },
          // Where Supabase sends the user after they click the email link.
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      });
      if (err) throw err;
      setPhase('check_inbox');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
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
          {phase === 'form' && (
            <>
              <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
                // SIGN UP
              </div>
              <h1 className="text-4xl font-medium tracking-tighter mb-2">
                Join the hunt.
              </h1>
              <p className="text-white/60 mb-8">
                Free account. Log evidence, share cases, claim the atlas.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                    DISPLAY NAME
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:border-haunt-red outline-none"
                      placeholder="Riley Hunts"
                    />
                  </div>
                  <div className="text-xs text-white/40 mt-1.5">
                    We'll give you a username automatically based on your email. You can change it later.
                  </div>
                </div>

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
                  <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                    PASSWORD
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
                      <Loader2 className="w-4 h-4 animate-spin" /> CREATING ACCOUNT
                    </>
                  ) : (
                    <>
                      CREATE ACCOUNT <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-xs text-white/40 text-center">
                By creating an account, you agree to HauntLog's terms and privacy policy. (Both coming soon.)
              </p>

              <div className="mt-8 text-center text-sm text-white/60">
                Already have an account?{' '}
                <Link to="/auth/signin" className="text-haunt-red hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}

          {phase === 'check_inbox' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-haunt-red/10 border border-haunt-red/30 mb-6">
                <MailCheck className="w-8 h-8 text-haunt-red" />
              </div>
              <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
                // CHECK YOUR INBOX
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">
                Verify your email.
              </h1>
              <p className="text-white/60 mb-2">
                We just sent a verification link to:
              </p>
              <p className="text-white font-medium mb-6 break-all">{email}</p>
              <p className="text-sm text-white/50 mb-8 leading-relaxed">
                Click the link in the email to activate your account. Then come back and sign in. The link expires in 24 hours.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/auth/signin')}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
                >
                  GO TO SIGN IN
                </button>

                {resendStatus === 'sent' ? (
                  <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-3 text-sm text-green-300 inline-flex items-center justify-center gap-x-2 w-full">
                    <CheckCircle2 className="w-4 h-4" />
                    Verification email resent.
                  </div>
                ) : (
                  <button
                    onClick={onResend}
                    disabled={resendStatus === 'sending'}
                    className="w-full text-white/70 hover:text-white py-3 text-sm flex items-center justify-center gap-x-2 disabled:opacity-50"
                  >
                    {resendStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> RESENDING…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" /> Didn't get it? Resend
                      </>
                    )}
                  </button>
                )}

                {resendError && (
                  <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-x-2 text-left">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-words">{resendError}</span>
                  </div>
                )}

                <button
                  onClick={() => setPhase('form')}
                  className="w-full text-white/40 hover:text-white py-2 text-sm"
                >
                  Wrong email? Start over
                </button>
              </div>
              <p className="mt-8 text-xs text-white/40">
                No email after a few minutes? Check your spam folder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
