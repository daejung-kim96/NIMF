import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Studio from '@/pages/studio/Studio';
import Login from '@/pages/Login';
import Pricing from '@/pages/pricing/Pricing';
import OAuthCallback from '@/pages/oauth/OAuthCallback';
import Nopage from '@/pages/Nopage';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="*" element={<Nopage />} />
      </Routes>
    </BrowserRouter>
  );
}
