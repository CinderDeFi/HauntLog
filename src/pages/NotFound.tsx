import { Link } from 'react-router-dom';
import { MapPin, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-8">
      <div className="max-w-md w-full text-center">
        <div className="text-xs font-mono text-haunt-red tracking-widest mb-2">
          // 404
        </div>
        <h1 className="text-6xl font-medium tracking-tighter mb-3">
          Lost in the dark.
        </h1>
        <p className="text-white/60 mb-8 leading-relaxed">
          We couldn't find what you were looking for. The page might have moved,
          been sealed, or never existed in the first place.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            to="/"
            className="px-5 py-3 bg-haunt-red hover:bg-red-600 text-white rounded-xl font-mono tracking-widest text-sm flex items-center gap-x-2"
          >
            <Home className="w-4 h-4" /> GO HOME
          </Link>
          <Link
            to="/app/atlas"
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono tracking-widest text-sm flex items-center gap-x-2"
          >
            <MapPin className="w-4 h-4" /> OPEN ATLAS
          </Link>
        </div>
      </div>
    </div>
  );
}
