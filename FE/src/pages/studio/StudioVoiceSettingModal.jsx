// StudioVoiceSettingModal.jsx
// 스튜디오 음성 현재 설정창 모달
// Author: Junghyun Park
// Date: 2025-07-28

import React from "react";
import { Badge } from "@/components/ui/badge";
import SettingStore from '@/stores/settingStore';

const actionLabels = {
  filtering: '필터링(음소거)',
  alert: '알림',
  logging: '로그기록',
};

const categoryLabels = {
  profanity: '욕설',
  hateSpeech: '혐오발언',
  bannedWords: '금지어',
};

const levelBadgeText = {
  low: '하',
  mid: '중',
  high: '상',
};

const StudioVoiceSettingModal = () => {
  const audio = SettingStore((state)=>state.audio);

  return (
    <div className="bg-zinc-800 rounded-xl pr-3 p-4 min-w-[100px] relative h-[135px] flex flex-col">
      {/* 상단 고정 영역 */}
      <div className="flex flex-col gap-3 pb-2 shrink-0">

        {/* 헤더 */}
        <div className="text-white text-base font-semibold">음성 설정값</div>
      </div>

      {/* 스크롤 가능한 설정 영역 */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {/* 현재 옵션 */}
        <div className="flex flex-col gap-1 w-full">
          <div className="text-xs font-semibold text-zinc-500">현재 옵션</div>
          <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 w-full">
            {Object.entries(audio.action).map(([key, value]) =>
              value ? <SettingItem key={key} label={actionLabels[key]} status="on" /> : <SettingItem key={key} label={actionLabels[key]} status="off" /> 
            )}
          </div>
        </div>

        {/* 현재 필터링 */}
        <div className="flex flex-col gap-1 w-full">
          <div className="text-xs font-semibold text-zinc-500">현재 필터링</div>
          <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 w-full">
            {Object.entries(audio.category).map(([key, value]) => {
              const label = categoryLabels[key] ?? key;

              if (key === 'banned_words') {
                const status = Array.isArray(value) && value.length > 0 ? 'on' : 'off';
                return <SettingItem key={key} label={label} status={status} />;
              }

              const isBoolean = typeof value === 'boolean';
              const status = isBoolean ? (value ? 'on' : 'off') : 'on';
              const badge2 = !isBoolean ? levelBadgeText[value] : undefined;

              return <SettingItem key={key} label={label} status={status} badge2={badge2} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


// SettingItem 컴포넌트
const SettingItem = ({ label, status, badge2 }) => (
  <div className="flex flex-row items-center gap-1">
    <div className="text-sm font-semibold text-zinc-400">{label}</div>
    <Badge
      variant="secondary"
      className={`px-[6px] py-[2px] text-xs bg-zinc-700 hover:bg-zinc-700 ${
        status === 'on' ? 'text-zinc-400' : 'text-zinc-500'
      }`}
    >
      {status.toUpperCase()}
    </Badge>
    {badge2 && (
      <Badge
        variant="outline"
        className="px-[6px] py-[2px] text-xs text-zinc-400 border-zinc-600"
      >
        {badge2}
      </Badge>
    )}
  </div>
);

export default StudioVoiceSettingModal;
