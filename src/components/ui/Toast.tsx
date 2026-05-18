import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/**
 * Lightweight toast system. Replaces window.alert() for non-blocking
 * user feedback. Three intents: success, error, info.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved');
 *   toast.error('Could not save', { description: err.message });
 *   toast.info('Check your email');
 *
 * Toasts auto-dismiss after ~4 seconds. Errors stick around for 6.
 */

type ToastIntent = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  intent: ToastIntent;
  title: string;
  description?: string;
};

type ToastOptions = {
  description?: string;
  /** Override default dismiss time (ms). 0 = never auto-dismiss. */
  duration?: number;
};

type ToastApi = {
  success: (title: string, opts?: ToastOptions) => void;
  error: (title: string, opts?: ToastOptions) => void;
  info: (title: string, opts?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;
const makeId = () => `t-${++nextId}-${Date.now()}`;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [timers] = useState(() => new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback(
    (id: string) => {
      const t = timers.get(id);
      if (t) {
        clearTimeout(t);
        timers.delete(id);
      }
      setToasts((prev) => prev.filter((x) => x.id !== id));
    },
    [timers]
  );

  const push = useCallback(
    (intent: ToastIntent, title: string, opts?: ToastOptions) => {
      const id = makeId();
      const item: ToastItem = {
        id,
        intent,
        title,
        description: opts?.description,
      };
      setToasts((prev) => [...prev, item]);

      const duration =
        opts?.duration ?? (intent === 'error' ? 6000 : 4000);
      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration);
        timers.set(id, t);
      }
    },
    [dismiss, timers]
  );

  // Clean up all pending timers on unmount.
  useEffect(() => {
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [timers]);

  const api: ToastApi = {
    success: (title, opts) => push('success', title, opts),
    error: (title, opts) => push('error', title, opts),
    info: (title, opts) => push('info', title, opts),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast viewport — fixed bottom on mobile, bottom-right on desktop */}
      <div
        className="fixed left-0 right-0 bottom-0 md:left-auto md:right-4 md:bottom-4 z-[9999] flex flex-col gap-2 p-3 md:p-0 md:max-w-sm pointer-events-none"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const { intent, title, description } = item;
  const palette =
    intent === 'success'
      ? {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          ring: 'border-emerald-500/40',
        }
      : intent === 'error'
      ? {
          icon: <AlertCircle className="w-5 h-5 text-red-400" />,
          ring: 'border-red-500/40',
        }
      : {
          icon: <Info className="w-5 h-5 text-blue-400" />,
          ring: 'border-blue-500/40',
        };

  return (
    <div
      className={`pointer-events-auto bg-zinc-900/95 backdrop-blur-md border ${palette.ring} rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] px-4 py-3 flex items-start gap-3 animate-[fadeInUp_0.18s_ease-out]`}
    >
      <div className="shrink-0 mt-0.5">{palette.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white break-words">{title}</div>
        {description && (
          <div className="text-xs text-white/60 mt-0.5 break-words">{description}</div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 -m-1 text-white/40 hover:text-white rounded-md"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Hook to access the toast API. Must be used inside <ToastProvider>.
 *
 * If used outside the provider (e.g. during testing), returns no-op
 * functions so calling code doesn't crash.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    success: () => {},
    error: () => {},
    info: () => {},
  };
}
