import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import profileIcon from '@/assets/icons/nimf.svg';

export default function Header() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    alert('로그아웃 되었습니다.');
  };

  // 테스트용 하드코딩 로그인

  // const handleFakeLogin = () => {
  //   useAuthStore.getState().login({
  //     success: true,
  //     is_new_user: true,
  //     token: 'test_token',
  //     result: {
  //       email: 'test@example.com',
  //       name: '홍길동',
  //       first_name: '홍',
  //       last_name: '길동',
  //       picture: '',
  //       pricing: 'free',
  //       setting: {
  //         video: {
  //           category: {
  //             smoke: false,
  //             drink: false,
  //             sharpObjects: false,
  //             flammables: false,
  //             firearms: false,
  //             exposure: false,
  //           },
  //           action: {
  //             filtering: false,
  //             alert: false,
  //             logging: false,
  //           },
  //         },
  //         audio: {
  //           category: {
  //             profanity: 'low',
  //             hateSpeech: false,
  //             bannedWords: [],
  //           },
  //           action: {
  //             filtering: false,
  //             alert: false,
  //             logging: false,
  //           },
  //         },
  //       },
  //     },
  //   });

  //   alert('로그인 되었습니다.');
  // };

  return (
    <header className="w-full bg-zinc-900">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex justify-between items-center">
        <div
          className="text-emerald-400 text-2xl sm:text-3xl font-black cursor-pointer"
          onClick={() => navigate('/')}
        >
          NIMF
        </div>

        <button
          className="sm:hidden text-white focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

        <div className="hidden sm:flex items-center gap-4">
          <div
            className="px-4 py-2 rounded-full outline outline-1 outline-offset-[-1px] outline-emerald-400 flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate('/pricing')}
          >
            <div className="text-emerald-400 text-base font-semibold">PRICING</div>
          </div>

          {isLoggedIn ? (
            <div
              className="w-10 h-10 relative bg-emerald-600 rounded-full overflow-hidden cursor-pointer"
              onClick={handleLogout}
            >
              <img
                className="w-10 h-10 object-cover"
                src={user?.picture || profileIcon}
                alt="프로필"
              />
            </div>
          ) : (
            <div className='flex flex-row gap-2'>
              <div
                className="px-4 py-2 bg-zinc-700 rounded-lg text-white font-semibold cursor-pointer"
                onClick={() => navigate('/login')}
              >
                로그인
              </div>
              <div
                className="px-4 py-2 bg-white rounded-lg text-zinc-900 font-semibold cursor-pointer"
                onClick={() => navigate('/login')}
              >
                회원가입
              </div>
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="sm:hidden px-4 py-4 bg-zinc-800 flex flex-col gap-3 items-start">
          <div
            className="text-emerald-400 font-semibold cursor-pointer"
            onClick={() => {
              navigate('/pricing');
              setMenuOpen(false);
            }}
          >
            PRICING
          </div>

          {isLoggedIn ? (
            <div
              className="text-red-300 font-semibold cursor-pointer"
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
            >
              로그아웃
            </div>
          ) : (
            <>
              <div
                className="text-white font-semibold cursor-pointer"
                onClick={() => {
                  navigate('/login');
                  setMenuOpen(false);
                }}
              >
                로그인
              </div>
              <div
                className="text-white font-semibold cursor-pointer"
                onClick={() => {
                  navigate('/login');
                  setMenuOpen(false);
                }}
              >
                회원가입
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
