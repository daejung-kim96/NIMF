// src/components/SeverityToggle.jsx
import React, { useState } from 'react'
import { cn } from '@/lib/utils'


export default function MultiToggle({ options, value, onChange }) {
  const [hovered, setHovered] = useState(null)
  
  return (
    <div className="inline-flex bg-zinc-700 rounded-md">
      {options.map(({ key, label, tooltip }) => {
        const isSelected = value === key
        return (
          <div key={key} className="relative inline-block">
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'px-4 py-0.5 text-sm font-semibold focus:outline-none',
                // 첫/마지막 버튼에만 모서리 살리기
                key === 'low' ? 'rounded-l-md' : '',
                key === 'high' ? 'rounded-r-md' : '',
                // 선택된 경우 vs 아닌 경우
                isSelected
                  ? 'bg-zinc-500 text-neutral-50'
                  : 'bg-transparent text-zinc-400 hover:text-neutral-50'
              )}
              onClick={() => {
                if (!isSelected) onChange(key)
              }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            >
              {label}
            </button>

            {/* hover 시 tooltip */}
            {hovered === key && tooltip && (
              <div
                className="
                  absolute left-0 mt-1
                  w-[200px] px-2 py-1 text-xs text-zinc-400 bg-zinc-600 rounded-md shadow-lg
                  break-keep
                  z-[9999]
                "
              >
                {tooltip}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
