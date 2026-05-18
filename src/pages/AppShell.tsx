import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LiveHunt from './LiveHunt';
import Feed from './Feed';
import Discover from './Discover';
import Vault from './Vault';
import Atlas from './Atlas';
import HuntStart from './HuntStart';
import SealCase from './SealCase';
import VenueView from './VenueView';
import SupabaseTest from './SupabaseTest';
import Profile from './Profile';
import Account from './Account';
import Admin from './Admin';
import Teams from './Teams';
import TeamNew from './TeamNew';
import TeamManage from './TeamManage';
import VenueEditor from './VenueEditor';
import VenueZoneEditor from './VenueZoneEditor';
import MyVenues from './MyVenues';
import VenueSubmit from './VenueSubmit';
import Notifications from './Notifications';
import InvestigationView from './InvestigationView';
import NotFound from './NotFound';
import InvestigationsBanner from '../components/InvestigationsBanner';
import HuntDraftRecoveryBanner from '../components/HuntDraftRecoveryBanner';
import { useAuth } from '../lib/useAuth';
import { useHauntStore } from '../store/useHauntStore';
import { useHuntDraftSync } from '../lib/useHuntDraftSync';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AppShell() {
  const location = useLocation();
  const fullBleed = location.pathname === '/app/atlas';
  const { status, profile } = useAuth();

  // Step 41: backup the active hunt to the server every time it
  // changes (debounced). Lets users recover from a dead phone /
  // cleared browser without losing logged observations.
  useHuntDraftSync();

  // Mirror the authenticated profile into the local store so the existing
  // app code that reads useHauntStore().user keeps working.
  useEffect(() => {
    if (status !== 'signed_in' || !profile) return;
    useHauntStore.setState({
      user: {
        name: profile.display_name,
        handle: profile.handle,
        tier: profile.tier,
      },
    });
  }, [status, profile]);

  // Once signed in: first push any local-only cases to the server, then
  // refresh from the server. The two-step protects test data accumulated
  // during pre-step-4 development. Runs once per session per user.
  useEffect(() => {
    if (status !== 'signed_in' || !profile) return;
    const uid = profile.id;
    let cancelled = false;
    (async () => {
      const store = useHauntStore.getState();
      const result = await store.syncLocalCasesToServer(uid);
      if (cancelled) return;
      if (result.migrated > 0) {
        console.info(
          `[sync] migrated ${result.migrated} local cases to Supabase`
        );
      }
      // Always end with a fresh load so the cache reflects server state.
      await store.loadMyCases(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, profile]);

  // If Supabase isn't configured at all, skip the auth gate so the rest of
  // the app still works on localStorage in development. (Useful escape hatch.)
  if (SUPABASE_CONFIGURED) {
    if (status === 'loading') {
      return (
        <div className="h-screen bg-black text-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/60" />
        </div>
      );
    }
    if (status === 'signed_out') {
      return (
        <Navigate
          to="/auth/signin"
          replace
          state={{ from: location.pathname + location.search }}
        />
      );
    }
  }

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col">
      <Navbar />
      <InvestigationsBanner />
      <HuntDraftRecoveryBanner />
      <div
        className={
          fullBleed
            ? 'flex-1 min-h-0 pb-14 md:pb-0 overflow-hidden'
            : 'max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto pb-20 md:pb-8'
        }
        style={fullBleed ? { overscrollBehavior: 'none' } : undefined}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/app/live" replace />} />
          <Route path="/live" element={<LiveHunt />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/hunt/new" element={<HuntStart />} />
          <Route path="/seal" element={<SealCase />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/atlas" element={<Atlas />} />
          <Route path="/atlas/venue/:id" element={<VenueView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/new" element={<TeamNew />} />
          <Route path="/teams/:slug/manage" element={<TeamManage />} />
          <Route path="/my-venues" element={<MyVenues />} />
          <Route path="/venues/submit" element={<VenueSubmit />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/investigations/:id" element={<InvestigationView />} />
          <Route path="/venues/:locationId/edit/zones" element={<VenueZoneEditor />} />
          <Route path="/venues/:locationId/edit" element={<VenueEditor />} />
          <Route path="/_supabase" element={<SupabaseTest />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}
