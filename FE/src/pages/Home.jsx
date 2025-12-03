import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import backgroundImg from '@/assets/background.png';
import startIcon from '@/assets/start.svg';
import { useAuthStore } from '@/stores/authStore';

import PresetModal from '@/modals/PresetModal';
import FilteringSettingModal from '@/modals/filtering-setting-modal/FilteringSettingModal';
import YouTubeSettingModal from '@/modals/YoutubeSettingModal';

import carousel1 from '@/assets/images/carousel1.png';
import carousel2 from '@/assets/images/carousel2.png';
import carousel3 from '@/assets/images/carousel3.png';
import carousel4 from '@/assets/images/carousel4.png';
import carousel5 from '@/assets/images/carousel5.png';
// import carousel6 from '@/assets/images/carousel6.png';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';

function Home() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();

  return (
    <div className="w-full relative flex flex-col items-center overflow-hidden pt-[108px] pb-[108px]">
      {/* 배경 이미지 */}
      <img
        src={backgroundImg}
        className="
          absolute top-[288px] left-1/2 -translate-x-1/2 origin-center rotate-0 opacity-100 pointer-events-none z-[-10]
          max-w-[640px] sm:max-w-[820px]"
        alt="background"
      />
      
      {/* Hero Section */}
      <div className="
        w-full max-w-[1200px] h-auto flex flex-col items-center justify-between gap-6
        px-4 sm:px-8"
      >
        <div className="text-2xl sm:text-3xl font-bold text-neutral-50 text-center">싫은 건 프레임 밖으로!</div>
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center items-center gap-2 text-center font-['Orbitron'] leading-snug">
            <span className="text-5xl sm:text-6xl md:text-[72px] font-extrabold text-neutral-50 break-keep">
              Not In My Frame - 
            </span>
            <span className="text-5xl sm:text-6xl md:text-[72px] font-extrabold text-emerald-400 break-keep ml-2">
              NIMF
            </span>
          </div>
          <div className="text-sm sm:text-base font-medium leading-normal text-neutral-50 text-center">
            NIMF는 당신의 스트리밍을 보호하는 AI 필터링 솔루션입니다.
            <br />
            방송 중 욕설, 얼굴 노출, 원치 않는 물건들을 실시간으로 감지하고 자동으로 처리해주는
            NIMF와 함께 걱정 없이 방송하세요!
          </div>
        </div>
        <div className="pl-6 pr-7 py-3 mt-6 bg-neutral-50 rounded-full inline-flex justify-center items-center">
          <div
            className="text-zinc-900 text-[22px] font-extrabold leading-normal cursor-pointer"
            onClick={() => navigate(isLoggedIn ? '/studio' : '/login')}
          >
            사용하러 가기
          </div>
        </div>
      </div>

      {/* 서비스 지표 섹션 */}
      <div className="w-full max-w-[1432px] px-4 mt-[200px] 
        grid gap-4
        grid-cols-2
        sm:grid-cols-4
        "
        // grid-cols-[repeat(auto-fit,minmax(220px,1fr))]
      >
        {[
          { title: '100M', desc: 'Service Users' },
          { title: '4.75+', desc: 'Rating' },
          { title: '20M', desc: 'Streamed Hours' },
          { title: '40+', desc: 'Partners' },
        ].map((stat, index) => (
          <div
            key={index}
            className="h-[128px] flex flex-col items-center justify-center bg-zinc-900/70 rounded-2xl"
          >
            <div className="text-3xl font-medium text-neutral-50 text-center">{stat.title}</div>
            <div className="text-base font-medium text-zinc-300 text-center">{stat.desc}</div>
          </div>
        ))}
      </div>

      {/* 시연 영상 섹션 */}
      {/* <div className="w-full max-w-[1200px] mt-[108px] flex flex-col items-start gap-5 px-4 sm:px-8">
        <div className="w-full flex flex-col items-start gap-2">
          <div className="text-2xl font-bold text-neutral-400">시연 영상</div>
          <div className="text-base font-normal text-neutral-400">
            실시간 블러. 자동 음소거. 누구보다 빠르게, 누구보다 정확하게. 이게 바로 NIMF입니다.
          </div>
        </div>
        <div className="w-full aspect-[16/9] bg-zinc-800 relative rounded-xl overflow-hidden flex justify-center items-center">
          <img
            src={startIcon}
            alt="재생 버튼"
            className="w-24 h-24 cursor-pointer"
            onClick={() => alert('영상 추가 예정')}
          />
        </div>
      </div> */}

      {/* 설명용 캐러셀 섹션 */}
      <div className="w-full max-w-[1264px] mt-[240px] flex flex-col items-start gap-7 px-4 sm:px-8">
        <div className="w-full max-w-[1200px] flex flex-col items-start gap-1">
          <div className="text-2xl font-bold text-zinc-50">NIMF 기능 소개</div>
          <div className="text-base font-normal text-zinc-400">
            NIMF의 핵심 기능을 슬라이드를 통해 확인해보세요. 실시간 블러, 금지어 음소거, 로그
            기록까지!
          </div>
        </div>
        <div className="relative w-full bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
          <Carousel className="w-full h-full">
            <CarouselContent className="h-full">
              {[
                {img: carousel1, title:'첫번째 이미지'},
                {img: carousel2, title:'두번째 이미지'},
                {img: carousel3, title:'세번째 이미지'},
                {img: carousel4, title:'네번째 이미지'},
                {img: carousel5, title:'다섯번째 이미지'},
                // {img: carousel6, title:'여섯번째 이미지'},
              ].map((item, index) => (
                <CarouselItem key={index} className="basis-full shrink-0 flex justify-center items-center">
                  <Card className="
                    w-full max-w-full md:max-w-[90%] lg:max-w-[85%]
                    bg-transparent border-0 ring-0 rounded-xl overflow-hidden"
                  >
                    <CardContent className="w-full h-auto object-contain flex flex-col justify-center items-center p-0">
                      <img
                        src={item.img}
                        alt={item.title}
                        className="rounded-lg w-full h-full object-cover"
                      />
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-white/20 text-white p-2 rounded-full shadow-lg hover:bg-white/30" />
            <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-white/20 text-white p-2 rounded-full shadow-lg hover:bg-white/30" />
          </Carousel>
        </div>
      </div>
    </div>
  );
}

export default Home;
