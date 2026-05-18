import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

/**
 * Minimal header used on publicly-shareable pages (PublicProfile,
 * TeamProfile, VenueProfilePage). Switches between a "Sign in" CTA
 * for anonymous viewers and an avatar/handle link for signed-in viewers.
 *
 * Intentionally simpler than the full app Navbar (no tabs, search, or
 * bell) since these pages can be opened by people who have never seen
 * the app before — keeps the chrome out of the way of the content.
 */
export default function PublicNav() {
  const { user: authUser, profile: viewerProfile } = useAuth();

  return (
    <header className="border-b border-white/10">
      <div className="max-w-screen-xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        <Link to={authUser ? '/app/live' : '/'} className="flex items-center gap-x-2">
          <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8 w-8" />
          <span className="font-mono text-2xl tracking-tighter">HAUNTLOG</span>
        </Link>

        {authUser && viewerProfile ? (
          <Link
            to="/app/profile"
            className="flex items-center gap-x-2.5 text-sm text-white/70 hover:text-white group"
          >
            {viewerProfile.avatar_url ? (
              <img
                src={viewerProfile.avatar_url}
                alt=""
                className="w-8 h-8 rounded-2xl object-cover border border-white/10 group-hover:border-white/30 transition-colors"
              />
            ) : (
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-haunt-red to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                {(viewerProfile.display_name || viewerProfile.handle || '?')
                  .replace(/^@/, '')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline font-mono">
              {viewerProfile.handle}
            </span>
          </Link>
        ) : (
          <Link
            to="/auth/signin"
            className="text-sm text-white/70 hover:text-white"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
