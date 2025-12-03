import React from 'react';
import GoogleLogo from '@/assets/logos/google_logo_login.svg';
import KakaoTalkLogo from '@/assets/logos/KakaoTalk_logo_login.svg';
import NaverLogo from '@/assets/logos/naver_logo_login.svg';

const Login = () => {
  const handleOAuthLogin = (provider) => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/login?provider=${provider}`;
  };

  return (
    <div className="min-h-dvh bg-zinc-900">

      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-900">
        <main className="w-full max-w-[480px] flex flex-col items-center gap-8 sm:gap-10 md:gap-12 px-4 pb-10 sm:pb-16 md:pb-[120px]">
          {/* 헤더 */}
          <div className="flex flex-col gap-2 items-center w-full">
            <h1 className="text-5xl font-black text-emerald-400 w-full text-center">NIMF</h1>
            <p className="text-base text-zinc-400 text-center">
              님프는 별도의 회원가입 없이 사용할 수 있어요!
            </p>
          </div>

          {/* 소셜 버튼들 */}
          <div className="flex w-full flex-col gap-4 sm:gap-5 md:gap-6">
            {/* Google */}
            <button
              onClick={() => handleOAuthLogin('google')}
              className="relative w-full rounded-xl bg-zinc-800 px-5 py-4 sm:px-6 sm:py-5 md:py-6 flex items-center justify-center transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-50">구글로 시작하기</span>
              <img
                src={GoogleLogo}
                alt="google"
                className="absolute left-4 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10"
                />
            </button>

            {/* Naver */}
            <button
              onClick={() => alert('네이버 연동은 준비 중입니다.')}
              className="relative w-full rounded-xl bg-zinc-800 px-5 py-4 sm:px-6 sm:py-5 md:py-6 flex items-center justify-center transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-50">네이버로 시작하기</span>
              <img
                src={NaverLogo}
                alt="naver"
                className="absolute left-4 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10"
                />
            </button>

            {/* Kakao */}
            <button
              onClick={() => alert('카카오 연동은 준비 중입니다.')}
              className="relative w-full rounded-xl bg-zinc-800 px-5 py-4 sm:px-6 sm:py-5 md:py-6 flex items-center justify-center transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-50">카카오로 시작하기</span>
              <img
                src={KakaoTalkLogo}
                alt="kakao"
                className="absolute left-4 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10"
                />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
