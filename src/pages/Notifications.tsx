import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationLink,
  notificationText,
  type NotificationWithActor,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import { ArrowLeft, Bell, BellOff, Loader2, CheckCheck } from 'lucide-react';

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
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Notifications() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyNotifications(100);
      setItems(list);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    load();
  }, [authUser]);

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-medium mb-3">Sign in to see your notifications.</h1>
        <Link
          to="/auth/signin"
          className="inline-block bg-white text-black px-5 py-2.5 rounded-xl font-mono tracking-widest text-xs hover:bg-haunt-red hover:text-white transition-colors"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  const handleClickItem = async (n: NotificationWithActor) => {
    if (!n.read_at) {
      setItems((arr) =>
        arr.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      markNotificationRead(n.id).catch(() => {});
    }
    navigate(notificationLink(n));
  };

  const handleMarkAllRead = async () => {
    const prev = items;
    setItems(items.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      setItems(prev);
    }
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/app"
        className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> BACK
      </Link>

      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
            <Bell className="w-3.5 h-3.5" /> NOTIFICATIONS
          </div>
          <h1 className="text-4xl font-medium tracking-tighter">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono tracking-widest inline-flex items-center gap-x-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" /> MARK ALL READ
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <BellOff className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <h2 className="text-xl font-medium mb-2">No notifications yet.</h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            We'll let you know when someone follows you, comments on your cases,
            or activity happens at venues you follow.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden">
          {items.map((n) => {
            const isUnread = !n.read_at;
            const initials = (n.actor?.display_name ?? '?')
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <button
                key={n.id}
                onClick={() => handleClickItem(n)}
                className={`w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-white/5 border-b border-white/5 last:border-b-0 ${
                  isUnread ? 'bg-haunt-red/5' : ''
                }`}
              >
                {n.actor?.avatar_url ? (
                  <img
                    src={n.actor.avatar_url}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
                  <span className="w-2 h-2 bg-haunt-red rounded-full mt-2 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
