import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useHauntStore } from '../store/useHauntStore';
import {
  Zap,
  Activity,
  BookOpen,
  Map,
  LogOut,
  User as UserIcon,
  Settings,
  ChevronDown,
  ShieldAlert,
  Users,
  Search,
  Building2,
} from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { fetchMyPendingInvites } from '../lib/teamActions';
import { fetchVenuesIManage } from '../lib/dataLayer';
import SearchDropdown from './SearchDropdown';
import NotificationBell from './NotificationBell';

const TABS = [
  { to: '/app/live', label: 'LIVE', icon: Zap, match: '/live' },
  { to: '/app/feed', label: 'FEED', icon: Activity, match: '/feed' },
  { to: '/app/vault', label: 'VAULT', icon: BookOpen, match: '/vault' },
  { to: '/app/atlas', label: 'ATLAS', icon: Map, match: '/atlas' },
] as const;

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useHauntStore();
  const { signOut, profile, user: authUser } = useAuth();
  const isActive = (match: string) => location.pathname.includes(match);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [managedVenuesCount, setManagedVenuesCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  // Global Cmd/Ctrl+K to open the search. Esc closes via the dropdown's
  // own handler. We also bail out if focus is in a textarea or contentEditable
  // so users editing case notes don't get hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        // Don't fire while typing in a textarea — those are usually long-form
        // log/comment composers and Cmd+K shouldn't steal focus.
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === 'textarea') return;
        e.preventDefault();
        setSearchOpen(true);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Refresh pending invite count when menu opens, and once on mount.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      try {
        const [invs, venues] = await Promise.all([
          fetchMyPendingInvites(authUser.id),
          fetchVenuesIManage(authUser.id).catch(() => []),
        ]);
        if (!cancelled) {
          setPendingInvitesCount(invs.length);
          setManagedVenuesCount(venues.length);
        }
      } catch {
        // Best-effort; don't break the navbar if this fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, menuOpen]);

  // Close the menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/auth/signin', { replace: true });
  };

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <nav className="bg-black border-b border-white/10 shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-x-3 md:gap-x-8 min-w-0">
            <Link to="/app" className="flex items-center gap-x-2 shrink-0">
              <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-7 w-7 md:h-8 md:w-8" />
              <span className="font-mono text-lg md:text-2xl tracking-tighter text-white">
                HAUNTLOG
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-x-2 lg:gap-x-4 text-sm">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`flex items-center gap-x-2 px-3 lg:px-4 py-2 rounded-xl transition-colors ${
                      isActive(t.match)
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* RIGHT — search + avatar with dropdown */}
          <div className="flex items-center gap-x-1 md:gap-x-2 shrink-0">
            <div className="relative" ref={searchWrapRef}>
              <button
                onClick={() => setSearchOpen((s) => !s)}
                aria-label="Search investigators and teams"
                title="Search (⌘K)"
                className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white"
              >
                <Search className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              </button>
              <SearchDropdown
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
              />
            </div>

            <NotificationBell />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="flex items-center gap-x-2 md:gap-x-3 px-2 py-1.5 hover:bg-white/10 rounded-xl transition-colors"
              >
              <div className="hidden md:block text-right">
                <div className="text-white text-sm font-medium leading-tight">
                  {user.name}
                </div>
                <div className="text-white/60 text-xs font-mono">{user.handle}</div>
              </div>
              {profile?.avatar_url ? (
                <div className="relative">
                  <img
                    src={profile.avatar_url}
                    alt={user.name}
                    className="w-9 h-9 rounded-2xl object-cover"
                  />
                  {pendingInvitesCount > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-haunt-red rounded-full border-2 border-black"></div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-red-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm">
                    {initials}
                  </div>
                  {pendingInvitesCount > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-haunt-red rounded-full border-2 border-black"></div>
                  )}
                </div>
              )}
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-950 border border-white/10 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-[1200] overflow-hidden">
                {/* User block — visible on mobile where it doesn't show in the header */}
                <div className="md:hidden px-4 py-3 border-b border-white/10">
                  <div className="text-white text-sm font-medium">{user.name}</div>
                  <div className="text-white/60 text-xs font-mono">{user.handle}</div>
                </div>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/app/profile');
                  }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5"
                >
                  <UserIcon className="w-4 h-4 text-white/60" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/app/account');
                  }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5"
                >
                  <Settings className="w-4 h-4 text-white/60" />
                  Account settings
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/app/teams');
                  }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5 border-t border-white/10"
                >
                  <Users className="w-4 h-4 text-white/60" />
                  <span className="flex-1">Teams</span>
                  {pendingInvitesCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-haunt-red text-white text-[10px] font-mono rounded-md">
                      {pendingInvitesCount}
                    </span>
                  )}
                </button>
                {managedVenuesCount > 0 && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/app/my-venues');
                    }}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5 border-t border-white/10"
                  >
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span className="flex-1">Managed venues</span>
                    <span className="px-1.5 py-0.5 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-mono rounded-md">
                      {managedVenuesCount}
                    </span>
                  </button>
                )}
                {profile?.is_admin && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/app/admin');
                    }}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5 text-haunt-red border-t border-white/10"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(`/u/${encodeURIComponent(user.handle)}`);
                  }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5 border-t border-white/10"
                >
                  <UserIcon className="w-4 h-4 text-white/60" />
                  View public profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-x-3 hover:bg-white/5 text-red-300 border-t border-white/10"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1200] bg-black border-t border-white/10 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
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
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-mono tracking-widest">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
