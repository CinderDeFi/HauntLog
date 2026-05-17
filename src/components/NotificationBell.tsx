import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  notificationLink,
  notificationText,
  type NotificationWithActor,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import { Bell, BellOff, Loader2, CheckCheck } from 'lucide-react';

/**
 * Compact "x minutes ago" timestamp. Falls back to date for older.
 */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Refresh unread count: on mount, when dropdown opens, every 60s.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    const refresh = () =>
      getUnreadNotificationCount()
        .then((c) => {
          if (!cancelled) setUnread(c);
        })
        .catch(() => {
          /* best-effort */
        });
    refresh();
    const i = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [authUser]);

  // Load list each time dropdown opens.
  useEffect(() => {
    if (!open || !authUser) return;
    setLoading(true);
    fetchMyNotifications(10)
      .then(setItems)
      .catch(() => {
        /* best-effort */
      })
      .finally(() => setLoading(false));
  }, [open, authUser]);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClickItem = async (n: NotificationWithActor) => {
    setOpen(false);
    // Optimistic mark-read
    if (!n.read_at) {
      setItems((arr) =>
        arr.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      setUnread((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    navigate(notificationLink(n));
  };

  const handleMarkAllRead = async () => {
    if (unread === 0) return;
    const prev = items;
    setItems(items.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      // Rollback
      setItems(prev);
      // Recount
      getUnreadNotificationCount().then(setUnread).catch(() => {});
    }
  };

  if (!authUser) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-haunt-red text-white text-[9px] font-mono rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-zinc-950 border border-white/10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-[1200] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-xs font-mono text-white/40 tracking-widest">
              NOTIFICATIONS{unread > 0 && <span className="text-haunt-red ml-1">· {unread}</span>}
            </div>
            <button
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              className="text-[10px] font-mono tracking-widest text-white/40 hover:text-white disabled:opacity-30 inline-flex items-center gap-x-1"
            >
              <CheckCheck className="w-3 h-3" /> MARK ALL READ
            </button>
          </div>

          {/* List */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-10">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-white/40">
                <BellOff className="w-6 h-6 mx-auto mb-2 text-white/30" />
                Nothing yet.
              </div>
            ) : (
              items.map((n) => (
                <NotificationItem key={n.id} n={n} onClick={() => handleClickItem(n)} />
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 border-t border-white/10 text-center text-xs font-mono tracking-widest text-white/60 hover:text-white hover:bg-white/5"
          >
            SEE ALL →
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  n,
  onClick,
}: {
  n: NotificationWithActor;
  onClick: () => void;
}) {
  const isUnread = !n.read_at;
  const initials = (n.actor?.display_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 border-b border-white/5 last:border-b-0 ${
        isUnread ? 'bg-haunt-red/5' : ''
      }`}
    >
      {n.actor?.avatar_url ? (
        <img
          src={n.actor.avatar_url}
          alt=""
          className="w-9 h-9 rounded-xl object-cover shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug break-words text-white/90">
          {notificationText(n)}
        </div>
        <div className="text-[10px] font-mono tracking-widest text-white/40 mt-1">
          {relTime(n.created_at)}
        </div>
      </div>
      {isUnread && (
        <span className="w-1.5 h-1.5 bg-haunt-red rounded-full mt-2 shrink-0" />
      )}
    </button>
  );
}
