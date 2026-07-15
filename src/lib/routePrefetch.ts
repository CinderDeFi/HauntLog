// src/lib/routePrefetch.ts
//
// Warm a route's code-split chunk before the user clicks. Hovering (or
// focusing, or touch-starting) a nav link fires the same dynamic import that
// AppShell's React.lazy() will use on navigation — so by the time the click
// lands, the chunk is already in the module cache and the page renders with
// no Suspense fallback.
//
// These loaders MUST point at the same page modules AppShell lazy-loads.
// Rollup dedupes dynamic imports by *resolved module id* (not by the
// specifier string), so `import('../pages/Feed')` here and `import('./Feed')`
// in AppShell share one chunk — hovering genuinely warms the click target.

const loaders: Record<string, () => Promise<unknown>> = {
  '/app/live': () => import('../pages/LiveHunt'),
  '/app/feed': () => import('../pages/Feed'),
  '/app/vault': () => import('../pages/Vault'),
  '/app/atlas': () => import('../pages/Atlas'),
  '/app/profile': () => import('../pages/Profile'),
  '/app/account': () => import('../pages/Account'),
  '/app/teams': () => import('../pages/Teams'),
  '/app/notifications': () => import('../pages/Notifications'),
  '/app/my-venues': () => import('../pages/MyVenues'),
  '/app/admin': () => import('../pages/Admin'),
  '/app/hunt/new': () => import('../pages/HuntStart'),
};

// Track what's already been requested so repeated hovers don't re-fire.
const warmed = new Set<string>();

/**
 * Fire-and-forget prefetch for a known app route. No-ops for unknown paths
 * (e.g. dynamic /u/:handle links) and for routes already warmed. On failure
 * the entry is un-warmed so a later hover can retry.
 */
export function prefetchRoute(path: string): void {
  const loader = loaders[path];
  if (!loader || warmed.has(path)) return;
  warmed.add(path);
  loader().catch(() => warmed.delete(path));
}

/** Handler props to spread onto any link/button that navigates to `path`. */
export function prefetchHandlers(path: string) {
  const fire = () => prefetchRoute(path);
  return {
    onMouseEnter: fire,
    onFocus: fire,
    // Touch devices have no hover; touchstart fires just before the click,
    // buying a small head start on the chunk download.
    onTouchStart: fire,
  };
}
