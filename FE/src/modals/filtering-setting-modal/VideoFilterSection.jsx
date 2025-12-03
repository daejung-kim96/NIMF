import React from 'react';
import useSettingStore from '@/stores/settingStore';

import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';

const ACTIONS = [
  {key: 'filtering', label: '필터링'}, 
  {key: 'alert', label: '알림'}, 
  {key: 'logging', label: '로그기록'}
];

const CATEGORIES = [
  { key: 'smoke', label: '흡연', desc: '다양한 종류의 담배갑, 담배, 전자담배,담배연기, 흡연 장면 전체' },
  { key: 'drink', label: '음주', desc: '세계의 다양한 술병, 잔에 담겨 있는 술' },
  { key: 'sharpObjects', label: '날카로운 도구', desc: '다양한 종류의 칼, 가위, 송곳, 드라이버 등 날카롭거나 위험한 도구' },
  { key: 'flammables', label: '화기류', desc: '라이터, 성냥, 가스불, 불꽃이 나오는 도구' },
  { key: 'firearms', label: '총기류', desc: '실제 총기 또는 사실적인 모형 총기' },
  // { key: 'exposure', label: '노출', desc: '현재 노출 필드는 랜더링 x' },
];

function VideoFilterSection({ markDirty }) {
  const video = useSettingStore((s) => s.video);
  const updateVideoCategory = useSettingStore((s) => s.updateVideoCategory);
  const updateVideoAction = useSettingStore((s) => s.updateVideoAction);
  // const [selectedAction, setSelectedAction] = useState('필터링');

  const handleAction = (action) => {
    markDirty();
    updateVideoAction(action);
  };

  const handleCategory = (category) => {
    markDirty();
    updateVideoCategory(category);
  };

  return (
    <div className="min-w-[300px] flex-1 flex flex-col gap-3.5 bg-zinc-700 px-5 py-4 rounded-xl">
      <h1 className="h-6 text-neutral-50 text-xl font-bold">영상</h1>
      {/* Action 버튼 */}
      <div className="flex gap-3">
        {ACTIONS.map(({ key, label }) => (
          <Toggle
            key={key}
            pressed={video.action[key]} // ✅ 상태 연동
            onPressedChange={() => handleAction(key)} // ✅ 상태 토글 함수
            variant="outline"
            size="sm"
            className="basis-1/3 shrink-1"
          >
            {label}
          </Toggle>
        ))}
      </div>

      {/* 카테고리 (토글 목록) */}
      <div className="flex flex-col gap-5 bg-zinc-800 p-5 rounded-xl">
        {CATEGORIES.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center gap-4">
            <Switch
              id={`category-${key}`}
              checked={video.category[key]}
              onCheckedChange={() => handleCategory(key)}
              className="data-[state=checked]:bg-emerald-400 data-[state=unchecked]:bg-zinc-600 mt-1"
            />
            <label
              htmlFor={`category-${key}`}
              className="cursor-pointer space-y-0.5"
            >
              <p className="text-zinc-50 text-base font-semibold">{label}</p>
              <p className="text-zinc-400 text-xs font-normal">{desc}</p>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VideoFilterSection;
