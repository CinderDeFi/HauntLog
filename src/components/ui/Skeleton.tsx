// src/components/ui/Skeleton.tsx
// Content-shaped loading placeholders. Each skeleton deliberately mirrors the
// real card it stands in for (same container, radius, padding, and rough line
// positions) so the page doesn't reflow when data arrives — the skeleton just
// cross-fades into the real thing.

/** Base shimmer block. Give it width/height via className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`hl-skeleton rounded-md ${className}`} />;
}

/** Mirrors Feed's FeedCard (rounded-3xl zinc-900 card). */
export function FeedCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-x-2">
          <Skeleton className="w-7 h-7 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-3" />
      <Skeleton className="h-3.5 w-2/5 mb-4" />
      <div className="pt-3 border-t border-white/5 flex items-center gap-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-8 ml-auto" />
      </div>
    </div>
  );
}

/** A column of feed skeletons. */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors Vault's grid card (rounded-3xl zinc-900, p-6). */
export function VaultCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6">
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-4/5 mb-2" />
      <Skeleton className="h-6 w-3/5 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-5" />
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

/** Vault's responsive grid, filled with skeleton cards. */
export function VaultSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      role="status"
      aria-label="Loading your vault"
    >
      {Array.from({ length: count }).map((_, i) => (
        <VaultCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors AtlasVenueRow (rounded-2xl zinc-900, p-3). */
export function AtlasVenueRowSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-4 h-4 rounded mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/3 mb-3" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
        <Skeleton className="h-2.5 w-28" />
      </div>
    </div>
  );
}

/** A list of venue-row skeletons for the Atlas sheet/panel. */
export function AtlasListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading locations">
      {Array.from({ length: count }).map((_, i) => (
        <AtlasVenueRowSkeleton key={i} />
      ))}
    </div>
  );
}
