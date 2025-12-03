import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import YouTubeLogo from '@/assets/logos/YouTube_logo.svg';
import TwitchLogo from '@/assets/logos/Twitch_logo.svg';
import ChzzkLogo from '@/assets/logos/CHZZK_logo_.svg';
import nimfIcon from '@/assets/icons/nimf.svg';

export default function StudioHeader({ onOpenSettingModal, youtubeConfig, setYoutubeConfig }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuthStore();

  // 유튜브 로그인 및 streamList 가져오기
  const handleOpenYouTubeModal = () => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${import.meta.env.VITE_API_BASE_URL}/auth/youtube`,
      'YouTubeLogin',
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    // 팝업에서 보내는 메시지 수신
    const handleMessage = (event) => {
      // console.log(`event.origin: ${event.origin}`);
      // console.log(`API_BASE_URL: ${import.meta.env.VITE_AI_BASE_URL}`);
      if (
        event.origin !== import.meta.env.VITE_AI_BASE_URL &&
        event.origin !== 'https://accounts.google.com'
      )
        return;

      const { type, data } = event.data;

      if (type === 'YOUTUBE_STREAM_LIST') {
        setYoutubeConfig((prev) => ({
          ...prev,
          streamList: Array.isArray(data) ? data : [], // ✅ null→[] 또는 목록
        }));
        console.log('받은 스트림 리스트:', data);
        // console.log('저장한 스트림 리스트1: ', youtubeConfig);
        // console.log('저장한 유튜브 id: ', youtubeConfig.streamList[0].id);
        // console.log('저장한 유튜브 channel id: ', youtubeConfig.streamList[0].snippet.channelId);
        window.removeEventListener('message', handleMessage);
        popup.close();
      }
    };

    window.addEventListener('message', handleMessage);
  };

  //뒤로가기로 스튜디오 페이지를 벗어나는 함수
  const handleLeaveStudio = () => {
    const confirmLeave = window.confirm('방송이 종료됩니다. 이 페이지를 벗어나시겠습니까?');
    if (confirmLeave) {
      navigate('/');
    }
  };

  return (
    <div className="w-full flex flex-col bg-zinc-800 text-white">
      {/* 상단 바 */}
      <div className="w-full h-10 px-5 flex items-center gap-2">
        <div className="w-5 h-5 bg-zinc-500" />
        <div
          className="text-emerald-400 text-xl font-black cursor-pointer"
          onClick={handleLeaveStudio}
        >
          NIMF
        </div>
      </div>

      {/* 하단 바 */}
      <div className="w-full h-14 px-6 border-t border-zinc-900 flex items-center justify-between">
        {/* 좌측: 플랫폼 연결 */}
        <div className="flex items-center gap-4 flex-1">
          <div className="text-base font-bold hidden sm:block whitespace-nowrap">
            플랫폼 연결하기
          </div>

          {/* 데스크탑: 로고 버튼 */}
          <div className="hidden lg:flex items-center gap-2">
            <img
              src={YouTubeLogo}
              alt="YouTube"
              className="h-10 hover:underline cursor-pointer"
              onClick={handleOpenYouTubeModal}
            />
            <img
              src={TwitchLogo}
              alt="Twitch"
              className="h-10 hover:underline cursor-pointer"
              onClick={() => alert('트위치 연동은 준비중입니다.')}
            />
            <img
              src={ChzzkLogo}
              alt="CHZZK"
              className="h-10 hover:underline cursor-pointer"
              onClick={() => alert('치지직 연동은 준비중입니다.')}
            />
          </div>

          {/* 모바일: 햄버거 메뉴 */}
          <div className="lg:hidden">
            <button
              className="text-white text-xl focus:outline-none"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰
            </button>
          </div>
        </div>

        {/* 필터링 설정 버튼 */}
        <div
          onClick={onOpenSettingModal}
          className="px-4 py-2 rounded-full outline outline-1 outline-offset-[-1px] outline-zinc-400 flex items-center gap-2.5 cursor-pointer"
        >
          <div className="text-base font-semibold">필터링 설정</div>
        </div>

        {/* 프로필 아이콘 */}
        <div className="w-10 h-10 ml-4 relative bg-emerald-600 rounded-full overflow-hidden cursor-pointer">
          <img
            src={user?.picture || nimfIcon}
            alt="프로필"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="lg:hidden px-6 py-4 bg-zinc-700 flex flex-col gap-3">
          <div className="text-sm font-semibold text-gray-300">플랫폼 연결하기</div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              handleOpenYouTubeModal();
              setMenuOpen(false);
            }}
          >
            <img src={YouTubeLogo} alt="YouTube" className="w-6 h-6" />
            <span>YouTube</span>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              alert('트위치 연동은 준비중입니다.');
              setMenuOpen(false);
            }}
          >
            <img src={TwitchLogo} alt="Twitch" className="w-6 h-6" />
            <span>Twitch</span>
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              alert('치지직 연동은 준비중입니다.');
              setMenuOpen(false);
            }}
          >
            <img src={ChzzkLogo} alt="CHZZK" className="w-6 h-6" />
            <span>CHZZK</span>
          </div>
        </div>
      )}
    </div>
  );
}
