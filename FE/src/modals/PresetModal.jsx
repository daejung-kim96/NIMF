// PresetModal.jsx
// 프리셋 모달 컴포넌트
// Author: Junghyun Park
// Date: 2025-07-25

import React, { useEffect } from 'react';
import useSettingStore, { PRESETS } from '@/stores/settingStore';

import ChildIcon from '@/assets/icons/child.svg';
import Human1Icon from '@/assets/icons/human1.svg';
import Human2Icon from '@/assets/icons/human2.svg';

const PresetModal = ({ isOpen, onClose, name }) => {
  const stopPropagation = (e) => e.stopPropagation();

  // settingStore에서 필요한거 가져오기
  const saveSetting = useSettingStore(s => s.saveSetting)
  const applyPresetSetting = useSettingStore(s => s.applyPresetSetting)
  
  useEffect(()=>{
    const handleKeyDown = (e) => {
      if (e.key === 'Escape'){
        onClose();
      }
    };
    
    if(isOpen){
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return ()=>{
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);



  const handlePresetSave = async (presetName) => {
    applyPresetSetting(presetName);
    const { video, audio } = useSettingStore.getState();

    await saveSetting({ video, audio });
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/90 flex items-center justify-center" onClick={onClose}>
      {/* 모달 박스: 세로 레이아웃 + 최대 높이 고정 */}
      <div
        className="bg-zinc-800 p-10 rounded-2xl text-white w-[1120px] m-5 flex flex-col max-h-[85vh]"
        onClick={stopPropagation}
      >
        <h4 className="text-xl font-bold text-emerald-400 text-center">반갑습니다, {name} 님!</h4>

        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-center mt-6 mb-2">방송 카테고리를 선택해 주세요</h2>
          <p className="text-base font-normal text-center text-gray-400 mb-8">
            어떤 방송을 하든, 실수는 생기기 마련이죠. 방송 성격에 맞는 카테고리를 선택하면 NIMF가
            그에 맞게 알아서 필터링해드립니다!
          </p>
        </div>

        {/* 스크롤 가능 영역 래퍼: flex-1 + min-h-0 필수 */}
        <div className="flex-1 min-h-0">
          {/* 작은 화면에서만 스크롤: max-h-[500px] & overflow-y-auto
              md 이상에서는 스크롤 해제 */}
          <div className="max-h-[440px] overflow-y-auto sm:max-h-none sm:overflow-visible pr-1">
            {/* 카테고리 카드 3개 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* 카드 1 */}
              <button
                onClick={() => handlePresetSave('kids')}
                className="bg-zinc-700 shadow-sm hover:bg-zinc-600 rounded-xl px-6 py-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
                  <img src={ChildIcon} alt="키즈/청정 방송 아이콘" className="w-16 h-16" />
                </div>
                <h3 className="text-2xl font-bold">키즈/청정 방송</h3>
                <p className="text-xs font-normal text-gray-300">
                  욕설·노출 완전 차단, 최강 안전 모드
                  <br />
                  모든 민감 요소를 강력하게 필터링합니다
                </p>
              </button>

              {/* 카드 2 */}
              <button
                onClick={() => handlePresetSave('mild')}
                className="bg-zinc-700 shadow-sm hover:bg-zinc-600 rounded-xl px-6 py-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
                  <img src={Human1Icon} alt="순한 맛 방송 아이콘" className="w-16 h-16" />
                </div>
                <h3 className="text-2xl font-bold">순한 맛 방송</h3>
                <p className="text-xs font-normal text-gray-300">
                  일반적인 욕설·노출은 자동으로 필터링돼요
                  <br />
                  부적절한 표현은 유연하게 차단됩니다
                </p>
              </button>

              {/* 카드 3 */}
              <button
                onClick={() => handlePresetSave('spicy')}
                className="bg-zinc-700 shadow-sm hover:bg-zinc-600 rounded-xl px-6 py-10 flex flex-col items-center gap-4 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
                  <img src={Human2Icon} alt="매운 맛 방송 아이콘" className="w-16 h-16" />
                </div>
                <h3 className="text-2xl font-bold">매운 맛 방송</h3>
                <p className="text-xs font-normal text-gray-300">
                  표현의 자유를 존중합니다. 최소한의 필터만 적용돼요
                  <br />
                  편집에 필요한 로그 정보만 제공, 그대로 방송됩니다
                </p>
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-center mt-8 bg-zinc-800">
          <button onClick={onClose} className="text-sm text-gray-400 underline hover:text-white">
            나중에 설정할게요 &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresetModal;
