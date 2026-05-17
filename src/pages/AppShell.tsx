import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LiveHunt from './LiveHunt';
import Vault from './Vault';
import Atlas from './Atlas';
export default function AppShell() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/app/live" replace />} />
          <Route path="/live" element={<LiveHunt />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/atlas" element={<Atlas />} />
        </Routes>
      </div>
    </div>
  );
}
