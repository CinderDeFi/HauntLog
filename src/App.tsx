import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import PageLoader from './components/ui/PageLoader';
import { useSeedVenues } from './lib/useSeedVenues';

// Landing + NotFound stay eager: Landing is the public first paint (no spinner
// flash on the marketing page) and NotFound is tiny. Everything else is
// code-split so the initial bundle carries only what the landing route needs.
// AppShell pulls in the whole authed app (Atlas/Leaflet, Vault, editors, …);
// keeping it lazy is what actually shrinks the first load.
const AppShell = lazy(() => import('./pages/AppShell'));
const CaseView = lazy(() => import('./pages/CaseView'));
const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const TeamProfile = lazy(() => import('./pages/TeamProfile'));
const FollowList = lazy(() => import('./pages/FollowList'));
const VenueProfilePage = lazy(() => import('./pages/VenueProfilePage'));

function AppRoutes() {
  const { pathname } = useLocation();
  // Fade key: public routes fade per-path, but the whole /app/* subtree is
  // treated as ONE group so navigating between in-app screens never remounts
  // AppShell (which would re-run its sync/hydrate effects). AppShell runs its
  // own per-screen fade internally.
  const fadeKey = pathname.startsWith('/app') ? 'app' : pathname;
  return (
    <div key={fadeKey} className="motion-safe:animate-fadeInUp">
      <Suspense fallback={<div className="min-h-screen bg-black"><PageLoader /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="/auth/verify" element={<VerifyEmail />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="/u/:handle" element={<PublicProfile />} />
          <Route path="/u/:handle/followers" element={<FollowList mode="followers" />} />
          <Route path="/u/:handle/following" element={<FollowList mode="following" />} />
          <Route path="/t/:slug" element={<TeamProfile />} />
          <Route path="/v/:id" element={<VenueProfilePage />} />
          <Route path="/app/*" element={<AppShell />} />
          <Route path="/case/:id" element={<CaseView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  useSeedVenues();
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
export default App;
