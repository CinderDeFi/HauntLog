import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';
import CaseView from './pages/CaseView';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<AppShell />} />
        <Route path="/case/:id" element={<CaseView />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
