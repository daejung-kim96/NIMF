import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-zinc-900 flex justify-center">
      <div className="w-full flex flex-col items-center text-sm text-neutral-400 gap-4">
        <div className="w-full bg-zinc-800 px-4 py-10 flex flex-col items-center gap-4 text-zinc-400 font-['Pretendard'] text-[10px] sm:text-xs">
          {/* 프로젝트 이름 */}
          <div className="text-center font-semibold leading-none">SSAFY NIMF 프로젝트</div>

          {/* 약관 링크 (정상 플로우 내 배치) */}
          <div className="w-full flex flex-col items-center gap-y-1 text-xs">
            {/* 큰 화면: 한 줄 */}
            <div className="hidden sm:flex flex-wrap justify-center gap-x-2">
              <span onClick={() => navigate('/nopage')} className="hover:underline cursor-pointer">
                이용약관
              </span>
              <span>|</span>
              <span onClick={() => navigate('/nopage')} className="hover:underline cursor-pointer">
                개인정보 처리방침
              </span>
              <span>|</span>
              <span onClick={() => navigate('/nopage')} className="hover:underline cursor-pointer">
                판매 및 환불
              </span>
              <span>|</span>
              <span onClick={() => navigate('/nopage')} className="hover:underline cursor-pointer">
                법적 고지
              </span>
            </div>

            {/* 작은 화면: 2개씩 2줄 */}
            <div className="flex flex-col gap-y-1 sm:hidden">
              <div className="flex justify-center gap-x-2">
                <span
                  onClick={() => navigate('/nopage')}
                  className="hover:underline cursor-pointer"
                >
                  이용약관
                </span>
                <span>|</span>
                <span
                  onClick={() => navigate('/nopage')}
                  className="hover:underline cursor-pointer"
                >
                  개인정보 처리방침
                </span>
              </div>
              <div className="flex justify-center gap-x-2">
                <span
                  onClick={() => navigate('/nopage')}
                  className="hover:underline cursor-pointer"
                >
                  판매 및 환불
                </span>
                <span>|</span>
                <span
                  onClick={() => navigate('/nopage')}
                  className="hover:underline cursor-pointer"
                >
                  법적 고지
                </span>
              </div>
            </div>
          </div>

          {/* 회사 정보 */}
          <div className="w-full text-center flex flex-col gap-y-1 leading-relaxed text-[10px] sm:text-xs">
            {/* 큰 화면: 2줄 */}
            <div className="hidden sm:flex flex-wrap justify-center gap-x-2">
              <span>Be 효율</span>
              <span>| NIMF - Not In My Frame</span>
              <span>
                | 대표자명: 김준혁 (<span className="underline text-neutral-500">Peridot Kim</span>)
              </span>
              <span>| 주소: 서울 강남구 테헤란로 212</span>
              <span>| 전화: 010-0000-0000</span>
              <span className="w-full" />
              <span>| 사업자등록번호: 000-00-0000</span>
              <span>| 호스팅 서비스 제공: NIMF Inc.</span>
            </div>

            {/* 작은 화면: 3줄 (2개씩 고정) */}
            <div className="flex sm:hidden flex-col gap-y-1">
              <div className="flex justify-center gap-x-2">
                <span>Be 효율</span>
                <span>| NIMF - Not In My Frame</span>
              </div>
              <div className="flex justify-center gap-x-2">
                <span>
                  | 대표자명: 김준혁 (
                  <span className="underline text-neutral-500">Peridot Kim</span>)
                </span>
                <span>| 주소: 서울 강남구 테헤란로 212</span>
              </div>
              <div className="flex justify-center gap-x-2">
                <span>| 전화: 010-0000-0000</span>
                <span>| 사업자등록번호: 000-00-0000</span>
              </div>
              <div className="flex justify-center gap-x-2">
                <span>| 호스팅 서비스 제공: NIMF Inc.</span>
              </div>
            </div>
          </div>

          {/* 카피라이트 */}
          <div className="w-full text-center text-[10px] sm:text-xs mt-2">
            Copyright © 2025 NIMF. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
