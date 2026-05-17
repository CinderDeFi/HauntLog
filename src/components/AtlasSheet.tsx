import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

// Snap positions, expressed as fraction of viewport height the sheet OCCUPIES.
// Collapsed: just the handle + a peek of the first card title (~12%).
// Peek: cards visible, map dominant (~40%).
// Expanded: list dominates, map slice on top (~85%).
const SNAPS = [0.12, 0.4, 0.85] as const;
export type SnapIndex = 0 | 1 | 2;

type Props = {
  children: ReactNode;
  initialSnap?: SnapIndex;
  onSnapChange?: (snap: SnapIndex) => void;
};

export default function AtlasSheet({
  children,
  initialSnap = 1,
  onSnapChange,
}: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [snap, setSnap] = useState<SnapIndex>(initialSnap);
  const [dragging, setDragging] = useState(false);

  // Offline drag state — kept in refs to avoid re-render on every pointer move.
  const dragStateRef = useRef<{
    startY: number;
    startHeight: number;
    viewportH: number;
  } | null>(null);
  const liveHeightRef = useRef<number>(0);

  // Apply a height to the sheet element (used during drag and on snap).
  const applyHeight = (px: number) => {
    if (sheetRef.current) sheetRef.current.style.height = `${px}px`;
    liveHeightRef.current = px;
  };

  // Snap to a target index with a CSS transition.
  const snapTo = useCallback(
    (idx: SnapIndex) => {
      const vh = window.innerHeight;
      const targetPx = SNAPS[idx] * vh;
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'height 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
        applyHeight(targetPx);
        // Clear transition after the animation so drag is instantaneous.
        const clear = () => {
          if (sheetRef.current) sheetRef.current.style.transition = '';
          sheetRef.current?.removeEventListener('transitionend', clear);
        };
        sheetRef.current.addEventListener('transitionend', clear);
      }
      setSnap(idx);
      onSnapChange?.(idx);
    },
    [onSnapChange]
  );

  // Initial layout + window resize.
  useEffect(() => {
    snapTo(initialSnap);
    const onResize = () => snapTo(snap);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStateRef.current = {
      startY: e.clientY,
      startHeight: liveHeightRef.current,
      viewportH: window.innerHeight,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStateRef.current;
    if (!s) return;
    // Dragging UP increases sheet height. clientY decreases as you drag up.
    const delta = s.startY - e.clientY;
    const minPx = SNAPS[0] * s.viewportH;
    const maxPx = SNAPS[SNAPS.length - 1] * s.viewportH;
    const next = Math.max(minPx, Math.min(maxPx, s.startHeight + delta));
    applyHeight(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    const s = dragStateRef.current;
    dragStateRef.current = null;
    if (!s) return;

    // Snap to nearest position.
    const fraction = liveHeightRef.current / s.viewportH;
    let nearest: SnapIndex = 0;
    let bestDist = Infinity;
    (SNAPS as readonly number[]).forEach((target, idx) => {
      const d = Math.abs(target - fraction);
      if (d < bestDist) {
        bestDist = d;
        nearest = idx as SnapIndex;
      }
    });
    snapTo(nearest);
  };

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 bottom-0 z-30 bg-zinc-950 border-t border-white/10 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)] flex flex-col"
      style={{
        // height set imperatively via applyHeight; this is just a fallback.
        height: `${SNAPS[initialSnap] * 100}vh`,
        touchAction: dragging ? 'none' : 'auto',
      }}
    >
      {/* Drag handle — pointer events live here */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 py-2 px-4 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
      >
        <div className="mx-auto w-10 h-1 bg-white/30 rounded-full" />
      </div>

      {/* Quick-snap buttons (tap as an alternative to drag) */}
      <div className="shrink-0 flex items-center gap-1 px-4 pb-2 text-[10px] font-mono tracking-widest">
        {(['MAP', 'SPLIT', 'LIST'] as const).map((label, idx) => (
          <button
            key={label}
            onClick={() => snapTo(idx as SnapIndex)}
            className={`px-2 py-1 rounded-md transition-all ${
              snap === idx
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
