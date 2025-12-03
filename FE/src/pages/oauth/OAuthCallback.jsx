import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import axios from '@/lib/axios'; // withCredentials 셋업된 인스턴스

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isNewUser = params.get('is_new_user') === 'true';

    // 쿠키 인증 기반으로 사용자 정보 요청
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/user`)
      .then((res) => {
        const userData = res.data.result;

        // Zustand 저장
        login({
          token: '', // 쿠키 인증이라 비워둠
          is_new_user: isNewUser, // ✅ 여기 값으로 분기
          result: {
            email: userData.email,
            name: userData.name,
            first_name: userData.first_name,
            last_name: userData.last_name,
            picture: userData.picture,
            pricing: userData.pricing,
            setting: userData.setting,
          },
        });

        // ✅ 로그인 직후 분기
        navigate(isNewUser ? '/pricing' : '/studio', { replace: true });
      })
      .catch((err) => {
        console.error('유저 정보 조회 실패:', err);
        alert('OAuth 로그인 실패!');
        navigate('/login', { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 콜백 한 번만 실행

  return <div className="text-white">로그인 처리 중입니다...</div>;
}
