// src/components/AudioFilterSection.jsx
import React from 'react'
import useSettingStore from '@/stores/settingStore'

import { Switch } from '@/components/ui/switch'
import { Toggle } from '@/components/ui/toggle'
import MultiToggle from '@/components/ui/multiToggle'
import { BannedWordsForm } from './BannedWordsForm';


const ACTIONS = [
  { key: 'filtering', label: '필터링' },
  { key: 'alert', label: '알림'    },
  { key: 'logging', label: '로그기록' },
]

const CATEGORIES = [
  { key: 'profanity', label: '욕설', desc: '' },
  { key: 'hateSpeech', label: '혐오 발언', desc: '특정 인종이나 성별, 지역을 비하하는 단어' },
]

const OPTIONS = [
  { key: 'low',  label: '하', tooltip: '최소한의 필터링. 아주 강한 욕설만 차단합니다.' },
  { key: 'mid',  label: '중', tooltip: '중간 수준의 필터링. 일상적인 험담은 허용하지만, 심한 욕설은 차단합니다.' },
  { key: 'high', label: '상', tooltip: '가장 엄격한 필터링. ‘바보, 멍청이’ 같은 가벼운 비속어까지 모두 차단합니다.' }
]


export default function AudioFilterSection({ markDirty }) {
  const audio                   = useSettingStore(s => s.audio)
  const updateAudioAction       = useSettingStore(s => s.updateAudioAction)
  const updateAudioCategory     = useSettingStore(s => s.updateAudioCategory)
  const updateAudioProfanity    = useSettingStore(s => s.updateAudioProfanity)

  const handleAction = key => {
    markDirty();
    updateAudioAction(key)
  }

  const handleCategory = key => {
    markDirty();
    updateAudioCategory(key)
  }

  const handleProfanityLevel = level => {
    markDirty();
    updateAudioProfanity(level)
  }

  return (
    <div className="min-w-[300px] flex-1 flex flex-col gap-3.5 bg-zinc-700 px-5 py-4 rounded-xl min-h-0"> {/* ✅ min-h-0 추가 */}
      <h1 className="h-6 text-neutral-50 text-xl font-bold ">오디오</h1>
  
      {/* Action 버튼 */}
      <div className="flex gap-3">
        {ACTIONS.map(({ key, label }) => (
          <Toggle
            key={key}
            pressed={audio.action[key]}
            onPressedChange={() => handleAction(key)}
            variant="outline"
            size="sm"
            className="basis-1/3"
          >
            {label}
          </Toggle>
        ))}
      </div>
  
      {/* 카테고리 섹션 */}
      <div className="flex flex-col gap-5 bg-zinc-800 p-5 rounded-xl">
        {CATEGORIES.map(({ key, label, desc }) => {
          const isProfanity = key === 'profanity'
          const checked = isProfanity
            ? audio.category.profanity !== null
            : audio.category[key]
  
          return (
            <div key={key} className="flex items-center gap-4">
              {/* 스위치 */}
              <Switch
                id={`category-${key}`}
                checked={checked}
                onCheckedChange={() => handleCategory(key)}
                className="data-[state=checked]:bg-emerald-400 data-[state=unchecked]:bg-zinc-600"
              />
  
              {/* 레이블 */}
              <label htmlFor={`category-${key}`} className="cursor-pointer inline-flex flex-col items-start space-y-0.5">
                <p className="text-zinc-50 text-base font-semibold">{label}</p>
                {desc && (
                  <p className="text-zinc-400 text-xs font-normal">{desc}</p>
                )}
              </label>
  
              {/* ‘욕설’이 켜져 있을 때만 */}
              {isProfanity && checked && (
                <MultiToggle
                  value={audio.category.profanity}
                  onChange={handleProfanityLevel}
                  options={OPTIONS}
                />
              )}
            </div>
          )
        })}
      </div>
  
      {/* 금지어 섹션 */}
      <div className="flex flex-col gap-6 bg-zinc-800 px-5 py-4 rounded-xl flex-1 min-h-0"> {/* ✅ 높이 확장 */}
        <BannedWordsForm />
      </div>
    </div>
  )  
}
