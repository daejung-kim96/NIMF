// StudioVideoSettingModal.jsx
// 스튜디오 영상 현재 설정창 모달
// Author: Junghyun Park
// Date: 2025-07-28

import React from "react";
import { Badge } from "@/components/ui/badge";
import SettingStore from '@/stores/settingStore';

const actionLabels = {
  filtering: '필터링(모자이크)',
  alert: '알림',
  logging: '로그기록',
};

const categoryLabels = {
  smoke: '흡연',
  drink: '음주',
  sharpObjects:'날카로운도구',
  flammables: '화기류',
  firearms: '총기류',
  exposure: '노출',
};

const StudioVideoSettingModal = () => {
  const video = SettingStore((state)=>state.video);

  return (
    <div className="bg-zinc-800 rounded-xl pr-3 p-4 min-w-[100px] relative h-[135px] flex flex-col">
      {/* 상단 고정 영역 */}
      <div className="flex flex-row justify-between items-start w-full pb-2 shrink-0">
        <div className="text-white text-base font-bold">영상 설정값</div>
      </div>

      {/* 스크롤 가능한 영역 */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {/* 현재 옵션 */}
        <div className="flex flex-col gap-1 w-full">
          <div className="text-xs font-semibold text-zinc-500">현재 옵션</div>
          <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 w-full">
            {Object.entries(video.action).map(([key, value]) => (
              <SettingItem key={key} label={actionLabels[key]} status={value ? 'on' : 'off'} />
            ))}
          </div>
        </div>

        {/* 현재 필터링 */}
        <div className="flex flex-col gap-1 w-full">
          <div className="text-xs font-semibold text-zinc-500">현재 필터링</div>
          <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 w-full">
            {Object.entries(video.category).map(([key, value]) => (
              <SettingItem key={key} label={categoryLabels[key]} status={value ? 'on' : 'off'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingItem = ({ label, status = 'on' }) => (
  <div className="flex flex-row items-center gap-1">
    <div className="text-sm font-semibold text-zinc-400">{label}</div>
    <Badge
      variant="secondary"
      className={`px-[6px] py-[2px] text-[11px] bg-zinc-700 hover:bg-zinc-700 ${
        status === 'on' ? 'text-zinc-400' : 'text-zinc-500'
      }`}
    >
      {status.toUpperCase()}
    </Badge>
  </div>
);

export default StudioVideoSettingModal;
