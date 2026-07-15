// src/components/OnboardingWelcome.tsx
// One-time first-run welcome. Orients a brand-new hunter (what HauntLog is +
// the three-step flow) and points them straight at the aha moment — starting
// their first hunt — with a low-commitment "see a sample" escape hatch.
import { useNavigate } from 'react-router-dom';
import { Zap, ClipboardList, Lock, Sparkles, X } from 'lucide-react';
import { useHauntStore } from '../store/useHauntStore';
import { useOnboarding } from '../lib/useOnboarding';

const STEPS = [
  { icon: Zap, label: 'SETUP', text: 'Pick a place and the gear you brought.' },
  { icon: ClipboardList, label: 'LOG', text: 'Tap when your equipment reacts — every event is timestamped.' },
  { icon: Lock, label: 'SEAL', text: 'Lock it into a case file you can share or export.' },
];

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const user = useHauntStore((s) => s.user);
  const { showWelcome, dismissWelcome } = useOnboarding();

  if (!showWelcome) return null;

  const firstName = (user.name || '').trim().split(' ')[0] || 'investigator';

  const go = (to: string) => {
    dismissWelcome();
    navigate(to);
  };

  return (
    <div
      className="fixed inset-0 z-[1400] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to HauntLog"
      onClick={dismissWelcome}
    >
      <div
        className="w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden motion-safe:animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 md:p-8">
          <button
            onClick={dismissWelcome}
            aria-label="Skip for now"
            className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-x-2 text-xs font-mono text-haunt-red tracking-widest mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-haunt-red" />
            </span>
            WELCOME TO HAUNTLOG
          </div>

          <h2 className="text-3xl md:text-4xl font-medium tracking-tighter mb-3">
            Let's log your first haunt, {firstName}.
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-6 leading-relaxed">
            HauntLog is a real evidence vault — no fake spikes, no simulated
            voices. Just the moments your gear actually reacted, sealed into a
            case file. Here's the whole flow:
          </p>

          <div className="space-y-3 mb-7">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-start gap-x-3">
                  <div className="w-9 h-9 rounded-xl bg-haunt-red/10 border border-haunt-red/30 text-haunt-red flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="font-mono text-sm tracking-widest">
                      <span className="text-white/30">0{i + 1}</span>{' '}
                      <span className="text-white">{s.label}</span>
                    </div>
                    <div className="text-white/60 text-sm">{s.text}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => go('/app/hunt/new')}
              className="flex-1 bg-haunt-red hover:bg-red-600 text-white py-3.5 rounded-xl font-mono tracking-widest text-sm inline-flex items-center justify-center gap-x-2 transition-all active:scale-[0.98]"
            >
              START MY FIRST HUNT
              <span aria-hidden="true">→</span>
            </button>
            <button
              onClick={() => go('/case/sample')}
              className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-3.5 px-5 rounded-xl font-mono tracking-widest text-xs inline-flex items-center justify-center gap-x-2 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              SEE A SAMPLE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
