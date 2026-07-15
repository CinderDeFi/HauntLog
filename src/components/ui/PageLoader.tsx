// src/components/ui/PageLoader.tsx
// Shared Suspense fallback for lazily-loaded routes. Intentionally quiet:
// a single dim brand mark with a slow pulse so route chunk-loading reads as
// "developing" rather than "broken". Fills its parent, never the whole screen,
// so the Navbar/shell chrome stays put while a page's chunk streams in.
export default function PageLoader({ label }: { label?: string }) {
  return (
    <div className="w-full h-full min-h-[40vh] flex flex-col items-center justify-center gap-4 text-white/40">
      <img
        src="/hauntlog-mark-color.svg"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 opacity-70 motion-safe:animate-pulse"
      />
      <span className="font-mono text-[10px] tracking-[3px] uppercase">
        {label ?? 'Loading'}
      </span>
    </div>
  );
}
