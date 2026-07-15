// src/lib/monitoring.ts
// Thin wrapper around Sentry error tracking. EVERYTHING here is a no-op until
// VITE_SENTRY_DSN is set, so local dev and un-configured builds behave exactly
// as before. Error-focused: no session replay, no perf tracing (keeps bundle
// small and stays well inside the free tier).
import * as Sentry from '@sentry/react';

/** Call once, as early as possible (main.tsx), before the app renders. */
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // unconfigured → stay silent

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'production' | 'development'
    // Stamped by the Vite build (see vite.config.ts) so Sentry can group
    // errors by release and match uploaded source maps.
    release: import.meta.env.VITE_APP_RELEASE as string | undefined,
    // Error tracking only — no tracing/replay. Turn these up later if needed.
    tracesSampleRate: 0,
    // We set user context explicitly (id/handle/email); don't harvest IPs etc.
    sendDefaultPii: false,
    ignoreErrors: [
      // Benign browser noise, not app bugs.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      // Extensions / cancelled navigations surface as these.
      'Non-Error promise rejection captured',
    ],
  });
}

/** True once Sentry has a live client (i.e. a DSN was configured). */
function active(): boolean {
  return !!Sentry.getClient();
}

/** Attach the signed-in user to errors, or clear on sign-out. Only id/handle/
 * email — never tokens or hunt content. */
export function setMonitoringUser(
  user: { id: string; email?: string | null; handle?: string | null } | null
): void {
  if (!active()) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.handle ?? undefined,
  });
}

/** Report a HANDLED error (a swallowed Supabase failure, a caught exception).
 * Always console.warns so local dev is unchanged; also sends to Sentry when
 * configured, tagged with `context` so it's filterable. */
export function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  // eslint-disable-next-line no-console
  console.warn(`[${context}]`, error, extra ?? '');
  if (!active()) return;
  Sentry.captureException(
    error instanceof Error ? error : new Error(String(error)),
    { tags: { context }, extra }
  );
}

/** Report a React render crash from the ErrorBoundary, preserving the
 * component stack Sentry shows in its UI. */
export function reportRenderError(error: Error, componentStack: string): void {
  if (!active()) return;
  Sentry.captureException(error, {
    contexts: { react: { componentStack } },
    tags: { context: 'react-render' },
  });
}
