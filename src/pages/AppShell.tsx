import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import InvestigationsBanner from '../components/InvestigationsBanner';
import HuntDraftRecoveryBanner from '../components/HuntDraftRecoveryBanner';
import OnboardingChecklist from '../components/OnboardingChecklist';
import OnboardingWelcome from '../components/OnboardingWelcome';
import PageLoader from '../components/ui/PageLoader';
import { useAuth } from '../lib/useAuth';
import { useHauntStore } from '../store/useHauntStore';
import { useHuntDraftSync } from '../lib/useHuntDraftSync';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

// Every authed-app page is code-split. LiveHunt is the default landing route
// inside the shell, so it eagerly hints its chunk (see prefetch below) to keep
// the common path snappy; the rest stream in on navigation.
const LiveHunt = lazy(() => import('./LiveHunt'));
const Feed = lazy(() => import('./Feed'));
const Discover = lazy(() => import('./Discover'));
const Vault = lazy(() => import('./Vault'));
const Atlas = lazy(() => import('./Atlas'));
const HuntStart = lazy(() => import('./HuntStart'));
const SealCase = lazy(() => import('./SealCase'));
const VenueView = lazy(() => import('./VenueView'));
const SupabaseTest = lazy(() => import('./SupabaseTest'));
const Profile = lazy(() => import('./Profile'));
const Account = lazy(() => import('./Account'));
const Admin = lazy(() => import('./Admin'));
const Teams = lazy(() => import('./Teams'));
const TeamNew = lazy(() => import('./TeamNew'));
const TeamManage = lazy(() => import('./TeamManage'));
const VenueEditor = lazy(() => import('./VenueEditor'));
const VenueZoneEditor = lazy(() => import('./VenueZoneEditor'));
const MyVenues = lazy(() => import('./MyVenues'));
const VenueSubmit = lazy(() => import('./VenueSubmit'));
const Notifications = lazy(() => import('./Notifications'));
const InvestigationView = lazy(() => import('./InvestigationView'));
const NotFound = lazy(() => import('./NotFound'));

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
      // Pull the venue catalog too so the Atlas, LocationPicker, and
      // HuntStart all see admin-approved venues without waiting for
      // an Atlas mount.
      await store.hydrateAtlasVenues();
    })();
    return () => {
      cancelled = true;
    };
    // Depend on the id, not the profile object: setFieldMode/refreshProfile
    // replace `profile` with a new identity, which would otherwise re-run
    // this full server sync on every Field Mode toggle. This effect only
    // cares about which user is signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, profile?.id]);

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
      <OnboardingChecklist />
      <div
        className={
          fullBleed
            ? 'flex-1 min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-hidden'
            : 'max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 flex-1 min-h-0 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8'
        }
        style={fullBleed ? { overscrollBehavior: 'none' } : undefined}
      >
        {fullBleed ? (
          <Suspense fallback={<PageLoader />}>{appRoutes}</Suspense>
        ) : (
          // key by pathname so the fade replays on every navigation. The
          // full-bleed Atlas is excluded — a translate on the map container
          // would fight Leaflet's own sizing on entry.
          <div key={location.pathname} className="motion-safe:animate-fadeInUp">
            <Suspense fallback={<PageLoader />}>{appRoutes}</Suspense>
          </div>
        )}
      </div>
      <OnboardingWelcome />
    </div>
  );
}

const appRoutes = (
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
);
