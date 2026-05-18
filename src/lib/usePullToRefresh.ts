import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh hook. Attaches touch listeners to the document
 * scroll container and fires `onRefresh` when the user pulls down
 * from the top by more than ~80px.
 *
 * Designed for full-page feeds where the entire window scrolls.
 * Skips silently on desktop (no touch events).
 *
 * Returns:
 *   - pulling: boolean - true while user is dragging
 *   - pullDistance: number (px) - current drag distance, 0 when not pulling
 *   - threshold: number (px) - distance needed to trigger refresh
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);
  const threshold = 80;
  const maxPull = 140;

  // Keep the latest onRefresh in a ref so the listeners stay stable.
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    // Only attach on touch-capable devices.
    if (typeof window === 'undefined') return;
    if (!('ontouchstart' in window)) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start tracking if we're at the very top of the page.
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? null;
      triggeredRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      // If the user has scrolled down since touchstart, abort.
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPulling(false);
        setPullDistance(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? startYRef.current;
      const delta = y - startYRef.current;
      if (delta <= 0) {
        setPulling(false);
        setPullDistance(0);
        return;
      }
      // Resist further pulling past maxPull (rubber-band feel).
      const resisted = delta < maxPull ? delta : maxPull + (delta - maxPull) * 0.3;
      setPulling(true);
      setPullDistance(resisted);
    };

    const handleTouchEnd = () => {
      if (startYRef.current === null) {
        setPulling(false);
        setPullDistance(0);
        return;
      }
      if (pullDistance >= threshold && !triggeredRef.current) {
        triggeredRef.current = true;
        Promise.resolve(refreshRef.current()).catch(() => {});
      }
      setPulling(false);
      setPullDistance(0);
      startYRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance]);

  return { pulling, pullDistance, threshold };
}
