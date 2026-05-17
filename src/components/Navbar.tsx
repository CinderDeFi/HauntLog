import { Link, useLocation } from 'react-router-dom';
import { useHauntStore } from '../store/useHauntStore';
import { Zap, BookOpen, Map, User } from 'lucide-react';

const TABS = [
  { to: '/app/live', label: 'LIVE', icon: Zap, match: '/live' },
  { to: '/app/vault', label: 'VAULT', icon: BookOpen, match: '/vault' },
  { to: '/app/atlas', label: 'ATLAS', icon: Map, match: '/atlas' },
] as const;

export default function Navbar() {
  const location = useLocation();
  const { user } = useHauntStore();
  const isActive = (match: string) => location.pathname.includes(match);

  return (
    <>
      {/* TOP HEADER — desktop full nav, mobile slim brand only */}
      <nav className="bg-black border-b border-white/10 shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3">
          {/* LEFT — brand + (desktop only) nav links */}
          <div className="flex items-center gap-x-3 md:gap-x-8 min-w-0">
            <Link to="/app" className="flex items-center gap-x-2 shrink-0">
              <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-7 w-7 md:h-8 md:w-8" />
              <span className="font-mono text-lg md:text-2xl tracking-tighter text-white">
                HAUNTLOG
              </span>
            </Link>

            {/* Desktop-only inline nav */}
            <div className="hidden md:flex items-center gap-x-6 text-sm">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`flex items-center gap-x-2 px-4 py-2 rounded-xl transition-colors ${
                      isActive(t.match)
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label === 'LIVE' ? 'LIVE HUNT' : t.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* RIGHT — user info + profile button (collapses on mobile) */}
          <div className="flex items-center gap-x-2 md:gap-x-4 shrink-0">
            <div className="hidden md:flex items-center gap-x-3">
              <div className="text-right">
                <div className="text-white text-sm font-medium">{user.name}</div>
                <div className="text-white/60 text-xs">{user.handle}</div>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-red-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
                {user.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            </div>
            <Link
              to="/app/profile"
              className="px-3 py-2 md:px-5 md:py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl flex items-center gap-x-2 text-xs md:text-sm"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">PROFILE</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1200] bg-black border-t border-white/10 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = isActive(t.match);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                on ? 'text-haunt-red' : 'text-white/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${on ? '' : ''}`} />
              <span className="text-[10px] font-mono tracking-widest">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
