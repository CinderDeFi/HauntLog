import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';
import CaseView from './pages/CaseView';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PublicProfile from './pages/PublicProfile';
import TeamProfile from './pages/TeamProfile';
import FollowList from './pages/FollowList';
import VenueProfilePage from './pages/VenueProfilePage';
import NotFound from './pages/NotFound';
import { useSeedVenues } from './lib/useSeedVenues';

function App() {
  useSeedVenues();
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
export default App;
