import { Routes, Route } from 'react-router-dom';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import HomePage from '@/pages/Home';
import PricingPage from '@/pages/pricing/Pricing';
import LoginPage from '@/pages/Login';
import Studio from '@/pages/studio/Studio';
import OAuthCallback from '@/pages/oauth/OAuthCallback';
import Nopage from '@/pages/Nopage';

function App() {
  return (
    <Routes>
      {/* 홈 페이지 */}
      <Route
        path="/"
        element={
          <>
            <Header />
            <HomePage />
            <Footer />
          </>
        }
      />

      {/* 요금제 페이지 */}
      <Route
        path="/pricing"
        element={
          <>
            <Header />
            <PricingPage />
            <Footer />
          </>
        }
      />

      {/* 로그인 페이지 */}
      <Route
        path="/login"
        element={
          <>
            <Header />
            <LoginPage />
            <Footer />
          </>
        }
      />

      {/* 스튜디오 페이지 */}
      <Route
        path="/studio/*"
        element={
          <>
            <Studio />
          </>
        }
      />

      <Route
        path="/oauth/callback"
        element={
          <>
            <OAuthCallback />
          </>
        }
      />

      {/* 명시적 404 페이지 */}
      <Route
        path="/nopage"
        element={
          <>
            <Header />
            <Nopage />
            <Footer />
          </>
        }
      />

      {/* 모든 기타 경로 대응 (catch-all) */}
      <Route
        path="*"
        element={
          <>
            <Header />
            <Nopage />
            <Footer />
          </>
        }
      />
    </Routes>
  );
}

export default App;
