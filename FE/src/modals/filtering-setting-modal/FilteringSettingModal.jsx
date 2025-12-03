import React, { useState, useEffect, useRef } from 'react';
import { isEqual, cloneDeep  } from 'lodash'; // 프리셋<->사용자설정 비교용 lodash 설치
import useSettingStore, { PRESETS, deepOmit } from '@/stores/settingStore'; // store import

import { Button } from '@/components/ui/button';
import XIcon from '@/assets/icons/x.svg?react';
import InfoCircle from '@/assets/icons/info-circle.svg?react';
import PresetTabs from './PresetTabs';
import VideoFilterSection from './VideoFilterSection';
import AudioFilterSection from './AudioFilterSection';

/* 순서-----------------------------
1. 사용자가 로그인을 함
2. 그 첫 로그인때 GET해오는 정보 중 result.setting만 가져옴 (이건 authStore 부분에 구현)
3. 그 값으로 settingStore 초기화해줌
4. 만약 사용자가 값을 바꾸고 저장을 누르면, DB에 PUT요청을 보내고 모달을 닫음. settingStore는 사용자가 바꾼 최신 상태를 계속 들고있음
5. 로그아웃하면 settingStore 비움

프리셋 버튼 관련 로직:
사용자가 모달을 열 때마다 사용자의 설정값과 프리셋을 비교하여 (금지어목록은 비교 대상에서 제외)
만약 프리셋 중 사용자 설정값과 일치하는 것이 있다면 해당 프리셋 버튼을 활성화
만약 없다면 프리셋 버튼은 전부 대기상태
----------------------------- */

// 버블링 방지
const stopPropagation = (e) => e.stopPropagation()

// 프리셋 <-> 사용자값 비교
function findMatchingPresetId(userSetting, presetsObj) {
  const omitPaths = ['audio.category.bannedWords']

  // 사용자 설정에서 bannedWords만 제거
  const cleanedUser = deepOmit(userSetting, omitPaths)

  // 각 프리셋(value)에 대해 반복
  for (const [key, preset] of Object.entries(presetsObj)) {
    // 이 preset 객체 내부에서만 bannedWords를 제거
    const cleanedPreset = deepOmit(preset, omitPaths)

    // 비교
    if (isEqual(cleanedUser, cleanedPreset)) {
      return key
    }
  }

  return null
}

// 필터링 모달 함수
function FilteringSettingModal({ isOpen, onClose}) {

  // settingStore에서 필요한거 가져오기
  const audio = useSettingStore(s => s.audio)
  const video = useSettingStore(s => s.video)
  const saveSetting = useSettingStore(s => s.saveSetting)
  const applyPresetSetting = useSettingStore(s => s.applyPresetSetting)
  

  // 사용자 설정값 복사 저장해둘 공간
  const originalSettingRef = useRef(null); 

  // preset 탭(버튼) 상태관리
    // kids, mild, spicy 중 하나 or null
  const [activePreset, setActivePreset] = useState(null); 

  // dirty flags (사용자가 설정값을 바꿨는지 확인하는 용도)
  const [isDirty, setIsDirty] = useState(false);

  // 모달 오픈(랜더링)시 사용자 값에 따라 프리셋 버튼 활성화 
  useEffect(() => {
    if (isOpen) {
      const userSetting = { video, audio };
      originalSettingRef.current = cloneDeep(userSetting);  // 원본 사용자 설정값 저장
      const matched = findMatchingPresetId(userSetting, PRESETS); // 프리셋<->사용자값 비교
      setActivePreset(matched);
      setIsDirty(false);
    }
  }, [isOpen]); // 사용자가 값을 바꿀때마다 실행시키고싶으면 배열에 [, video, audio] 추가하면 됨  

  // Preset 변경 시 store 전체 Preset 세팅값으로 덮어쓰기 (금지어 제외)
  useEffect(() => {
    if (!activePreset) return;
    applyPresetSetting(activePreset)
    setIsDirty(false)
  }, [activePreset])

  // video OR audio 바뀔 때마다 preset 버튼 해제
  useEffect(() => {
    if (isDirty && activePreset !== null) {
      setActivePreset(null);
    }
  }, [isDirty]);


  // 설정값 DB에 반영 (PUT요청)
  const handleSave = async (data) => {
    saveSetting(data)
    onClose()
  };


  if (!isOpen) return null
  
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      // onClick={onClose}
    >
      {/* 실제 모달 영역 */}
      <div className="flex flex-col w-[1120px] max-w-[95vw] max-h-[95vh] gap-4 px-8 py-7 relative bg-zinc-800 rounded-3xl overflow-hidden">
        {/* 닫기 버튼 */}
        <button
          onClick={(e) => {
            stopPropagation(e);
            useSettingStore.setState(originalSettingRef.current); // 상태 복원
            onClose();
          }}
          className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-400"
          aria-label="닫기"
        >
          <XIcon className="w-7 h-7" />
        </button>
  
        {/* 본문 영역: 세로 플렉스 */}
        <div className="flex-1 min-h-0 flex flex-col">
        {/* <div className="flex-1 min-h-0 overflow-y-auto"> */}
          {/* 헤더(고정): 제목/설명 + 탭 */}
          <div className="shrink-0 self-stretch space-y-6 mb-4">
            <h1 className="text-xl font-bold">필터링 설정하기</h1>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <h2 className="text-2xl font-bold">프리셋& 커스텀 선택</h2>
                <InfoCircle className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-zinc-400 font-normal">
                선택한 프리셋에 따라 NIMF가 최적의 필터링 세팅을 제공합니다. 모든 항목은 직접 켜고 끌 수 있으며, 완전히 사용자 맞춤 설정이 가능합니다.
              </p>
            </div>
            {/* 탭 영역 (고정) */}
            <PresetTabs
                activePreset={activePreset}
                onSelectPreset={setActivePreset}
              />
          </div>
          {/* 스크롤 영역: 영상/음성 세팅 */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="self-stretch flex flex-wrap justify-start items-stretch gap-4">
              {/* 영상 세팅 영역 */}
              <VideoFilterSection markDirty={() => setIsDirty(true)} />
              {/* 음성 세팅 영역 */}
              <AudioFilterSection markDirty={() => setIsDirty(true)} />
            </div>
          </div>
        </div>
  
        <Button
          variant="modalButton"
          size="modalButton"
          onClick={() => handleSave({ video, audio })}
        >
          저장하기
        </Button>
      </div>
    </div>
  )  
}

export default FilteringSettingModal
