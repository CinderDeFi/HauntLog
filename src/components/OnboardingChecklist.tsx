// src/components/OnboardingChecklist.tsx
// Getting-started progress. Follows an un-activated hunter across app pages,
// showing the three steps to the aha moment (first sealed case) with live
// checkmarks and a single CTA pointing at the next incomplete step. Auto-hides
// the moment they seal (useOnboarding.activated) — or when dismissed.
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useOnboarding } from '../lib/useOnboarding';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const { showChecklist, steps, dismissChecklist } = useOnboarding();

  if (!showChecklist) return null;

  const items = [
    { key: 'startedHunt', done: steps.startedHunt, label: 'Start a hunt', to: '/app/hunt/new', cta: 'START A HUNT' },
    { key: 'loggedEvent', done: steps.loggedEvent, label: 'Log an event', to: '/app/live', cta: 'LOG AN EVENT' },
    { key: 'sealedCase', done: steps.sealedCase, label: 'Seal your first case', to: '/app/seal', cta: 'SEAL YOUR CASE' },
  ] as const;

  const doneCount = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done);

  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/80">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3 md:gap-5 flex-wrap">
        <div className="flex items-center gap-x-2 shrink-0">
          <span className="text-[10px] font-mono tracking-widest text-haunt-red">
            GET STARTED
          </span>
          <span className="text-[10px] font-mono tracking-widest text-white/40">
            {doneCount}/{items.length}
          </span>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-x-3 md:gap-x-5 flex-wrap min-w-0">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-x-1.5">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                  it.done
                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                    : 'border-white/20 text-transparent'
                }`}
              >
                <Check className="w-2.5 h-2.5" />
              </span>
              <span
                className={`text-xs ${
                  it.done ? 'text-white/40 line-through' : 'text-white/80'
                }`}
              >
                {it.label}
              </span>
            </div>
          ))}
        </div>

        {/* Next-step CTA + dismiss */}
        <div className="flex items-center gap-x-2 ml-auto shrink-0">
          {next && (
            <button
              onClick={() => navigate(next.to)}
              className="px-3 py-1.5 rounded-lg bg-haunt-red hover:bg-red-600 text-white text-[10px] font-mono tracking-widest transition-all active:scale-95"
            >
              {next.cta} →
            </button>
          )}
          <button
            onClick={dismissChecklist}
            aria-label="Dismiss getting started"
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white transition-all active:scale-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
