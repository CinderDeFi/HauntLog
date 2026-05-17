import { Link, useLocation } from 'react-router-dom';
import { useHauntStore } from '../store/useHauntStore';
import { Zap, BookOpen, Map, User } from 'lucide-react';
export default function Navbar() {
  const location = useLocation();
  const { user } = useHauntStore();
  const isActive = (path: string) => location.pathname.includes(path);
  return (
    <nav className="bg-haunt-dark border-b border-white/10">
      <div className="max-w-screen-2xl mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-x-8">
          <Link to="/app" className="flex items-center gap-x-2">
            <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8 w-8" />
            <span className="font-mono text-2xl tracking-tighter text-white">HAUNTLOG</span>
          </Link>
          <div className="flex items-center gap-x-6 text-sm">
            <Link to="/app/live" className={`flex items-center gap-x-2 px-4 py-2 rounded-xl transition-colors ${isActive('/live') ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'}`}>
              <Zap className="w-4 h-4" /> LIVE HUNT
            </Link>
            <Link to="/app/vault" className={`flex items-center gap-x-2 px-4 py-2 rounded-xl transition-colors ${isActive('/vault') ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'}`}>
              <BookOpen className="w-4 h-4" /> VAULT
            </Link>
            <Link to="/app/atlas" className={`flex items-center gap-x-2 px-4 py-2 rounded-xl transition-colors ${isActive('/atlas') ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'}`}>
              <Map className="w-4 h-4" /> ATLAS
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-x-4">
          <div className="flex items-center gap-x-3">
            <div className="text-right">
              <div className="text-white text-sm font-medium">{user.name}</div>
              <div className="text-white/60 text-xs">{user.handle}</div>
            </div>
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-red-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
              RH
            </div>
          </div>
          <Link to="/app/profile" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center gap-x-2 text-sm">
            <User className="w-4 h-4" />
            PROFILE
          </Link>
        </div>
      </div>
    </nav>
  );
}
