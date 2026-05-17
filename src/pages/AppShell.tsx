import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LiveHunt from './LiveHunt';
import Vault from './Vault';
import Atlas from './Atlas';
import HuntStart from './HuntStart';
import SealCase from './SealCase';
import VenueView from './VenueView';

export default function AppShell() {
  const location = useLocation();
  const fullBleed = location.pathname === '/app/atlas';

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col">
      <Navbar />
      <div
        className={
          fullBleed
            ? 'flex-1 min-h-0 pb-14 md:pb-0'
            : 'max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 flex-1 min-h-0 overflow-y-auto pb-20 md:pb-8'
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/app/live" replace />} />
          <Route path="/live" element={<LiveHunt />} />
          <Route path="/hunt/new" element={<HuntStart />} />
          <Route path="/seal" element={<SealCase />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/atlas/venue/:id" element={<VenueView />} />
        </Routes>
      </div>
    </div>
  );
}
