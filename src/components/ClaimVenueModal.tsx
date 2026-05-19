import { useState } from 'react';
import {
  submitClaim,
  CLAIMED_ROLE_LABELS,
  type ClaimedRole,
  type SubmitClaimInput,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BadgeCheck,
  Send,
  Info,
} from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  locationId: string;
  locationName: string;
  onSubmitted: () => void;
};

const INPUT_CLS =
  'w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm placeholder:text-white/30';

export default function ClaimVenueModal({
  open,
  onClose,
  locationId,
  locationName,
  onSubmitted,
}: Props) {
  const { user: authUser } = useAuth();
  const [claimedRole, setClaimedRole] = useState<ClaimedRole>('owner');
  const [message, setMessage] = useState('');
  const [proofLinksText, setProofLinksText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const proofLinks = proofLinksText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const canSubmit = !!authUser && message.trim().length >= 20 && !submitting;

  const handleSubmit = async () => {
    if (!authUser || submitting) return;
    setSubmitting(true);
    setError(null);
    const input: SubmitClaimInput = {
      locationId,
      claimedRole,
      message: message.trim(),
      proofLinks,
    };
    const res = await submitClaim(authUser.id, input);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    onSubmitted();
  };

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-white/10 px-6 md:px-8 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-amber-400 tracking-widest inline-flex items-center gap-x-1.5">
              <BadgeCheck className="w-3.5 h-3.5" /> CLAIM VENUE
            </div>
            <h2 className="text-xl font-medium mt-1 leading-tight">{locationName}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-8 py-6">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-3" />
              <h3 className="text-xl font-medium mb-2">Claim submitted</h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto text-sm">
                We'll review your claim and follow up. You'll be able to manage the
                venue once approved. Approval usually takes 1-3 days.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white text-black font-mono tracking-widest text-xs hover:bg-haunt-red hover:text-white transition-colors"
              >
                CLOSE
              </button>
            </div>
          ) : (
            <>
              {/* Intro card */}
              <div className="bg-amber-400/5 border border-amber-400/30 rounded-2xl px-4 py-3 mb-6 flex items-start gap-x-3 text-amber-200 text-sm">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  Claiming a venue lets you manage its public profile, set pricing,
                  document zones, and respond to investigator activity. We manually
                  review every claim to prevent impersonation.
                </div>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              {/* Role */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                  YOUR ROLE AT THIS VENUE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(CLAIMED_ROLE_LABELS) as [ClaimedRole, string][]).map(
                    ([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setClaimedRole(k)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-mono tracking-widest border transition-colors ${
                          claimedRole === k
                            ? 'bg-haunt-red text-white border-haunt-red'
                            : 'bg-black text-white/70 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {label.toUpperCase()}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Verification message */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                  HOW CAN WE VERIFY YOU?
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. I'll send a photo of my driver's license matching the address. Or: DM me from the official Instagram @venue."
                  rows={4}
                  className={INPUT_CLS}
                />
                <div className="text-[10px] font-mono text-white/40 mt-1 flex justify-between">
                  <span>Required. Tell us how you'd like to prove ownership.</span>
                  <span
                    className={
                      message.trim().length < 20 ? 'text-amber-400/60' : 'text-white/30'
                    }
                  >
                    {message.trim().length}/20 min
                  </span>
                </div>
              </div>

              {/* Proof links */}
              <div className="mb-6">
                <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                  PROOF LINKS — one per line, optional
                </label>
                <textarea
                  value={proofLinksText}
                  onChange={(e) => setProofLinksText(e.target.value)}
                  placeholder={
                    'https://yourwebsite.com/about\nhttps://instagram.com/yourvenue'
                  }
                  rows={3}
                  className={INPUT_CLS}
                />
                <div className="text-[10px] font-mono text-white/40 mt-1">
                  News article, business listing, official social account, anything
                  that confirms your relationship to the venue.
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full px-5 py-3.5 rounded-xl bg-haunt-red text-white font-mono tracking-widest text-sm inline-flex items-center justify-center gap-x-2 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                SUBMIT CLAIM
              </button>

              <p className="text-[10px] font-mono text-white/40 text-center mt-3">
                Submitting falsely is grounds for permanent ban.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
