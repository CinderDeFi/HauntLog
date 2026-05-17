import type { ReactNode } from 'react';

export type Stat = {
  /** A short label, will be uppercased in render */
  label: string;
  /** Pre-formatted value (e.g. "1,247" or "42h"). Pass a string for full control. */
  value: ReactNode;
  /** Optional icon shown above the value */
  icon?: ReactNode;
  /** Optional muted suffix (e.g. "hours hunted") below the value */
  hint?: string;
};

/**
 * A row of compact stat tiles. Wraps to 2 columns on narrow viewports.
 * Designed to live in the band between bio/socials and a content grid
 * on PublicProfile / TeamProfile.
 */
export default function StatStrip({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-zinc-900 border border-white/10 rounded-2xl px-3 py-3 md:px-4 md:py-4"
        >
          <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1 inline-flex items-center gap-x-1.5">
            {s.icon && <span className="text-haunt-red">{s.icon}</span>}
            {s.label.toUpperCase()}
          </div>
          <div className="text-2xl md:text-3xl font-medium tracking-tight leading-none">
            {s.value}
          </div>
          {s.hint && (
            <div className="text-[10px] font-mono text-white/40 tracking-widest mt-1.5">
              {s.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Helpers for formatting common stat values.
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format hours as "12h" / "1,247h" / "—" for zero. Accepts the
 * fractional hours we get from Postgres (e.g. 2.5 = 2h30m).
 */
export function formatHours(h: number): string {
  if (!h || h <= 0) return '—';
  if (h < 1) {
    // sub-hour: show minutes
    const m = Math.round(h * 60);
    return `${m}m`;
  }
  return `${Math.round(h).toLocaleString()}h`;
}
