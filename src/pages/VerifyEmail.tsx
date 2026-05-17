import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Loader2, AlertCircle, Mail } from 'lucide-react';

type Status = 'checking' | 'signup_verified' | 'email_changed' | 'failed';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Read URL hash params first to figure out which flow we're in.
    // Supabase encodes a `type` param: 'signup' for first-time verification,
    // 'email_change' for email changes, etc.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const type = hashParams.get('type');
    const isEmailChange = type === 'email_change';

    const check = async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (isEmailChange) {
            setNewEmail(data.session.user.email ?? null);
            setStatus('email_changed');
          } else {
            setStatus('signup_verified');
            setTimeout(() => navigate('/app/live', { replace: true }), 1200);
          }
          return;
        }
      }
      const errDesc = hashParams.get('error_description') || hashParams.get('error');
      setError(errDesc || 'Verification link is invalid or expired.');
      setStatus('failed');
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-6 md:px-12 py-6">
        <Link to="/" className="flex items-center gap-x-2 w-fit">
          <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8 w-8" />
          <span className="font-mono text-2xl tracking-tighter">HAUNTLOG</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="w-10 h-10 text-white/60 animate-spin mx-auto mb-6" />
              <div className="text-xs font-mono text-white/40 tracking-widest mb-2">
                // VERIFYING
              </div>
              <h1 className="text-3xl font-medium tracking-tighter">One moment.</h1>
              <p className="text-white/60 mt-3">Confirming…</p>
            </>
          )}

          {status === 'signup_verified' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-400/10 border border-green-400/30 mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-xs font-mono text-green-400 tracking-widest mb-2">
                // VERIFIED
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">You're in.</h1>
              <p className="text-white/60">Taking you to the app…</p>
            </>
          )}

          {status === 'email_changed' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-400/10 border border-green-400/30 mb-6">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-xs font-mono text-green-400 tracking-widest mb-2">
                // EMAIL CHANGED
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">
                Email updated.
              </h1>
              {newEmail && (
                <p className="text-white/60 mb-2">Your sign-in email is now:</p>
              )}
              {newEmail && (
                <p className="text-white font-medium mb-6 break-all">{newEmail}</p>
              )}
              <Link
                to="/app/live"
                className="block w-full bg-haunt-red hover:bg-red-600 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
              >
                OPEN APP
              </Link>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-xs font-mono text-red-400 tracking-widest mb-2">
                // VERIFICATION FAILED
              </div>
              <h1 className="text-3xl font-medium tracking-tighter mb-3">
                Something went wrong.
              </h1>
              <p className="text-white/60 mb-6 break-words">{error}</p>
              <div className="space-y-3">
                <Link
                  to="/auth/signup"
                  className="block w-full bg-haunt-red hover:bg-red-600 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
                >
                  TRY SIGNING UP AGAIN
                </Link>
                <Link
                  to="/auth/signin"
                  className="block w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm"
                >
                  GO TO SIGN IN
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
