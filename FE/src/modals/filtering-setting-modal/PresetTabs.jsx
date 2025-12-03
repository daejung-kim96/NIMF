import React from 'react';
// import { Button } from '@/components/ui/button';

const presets = [
  { id: 'kids', label: '키즈/청정 방송' },
  { id: 'mild', label: '순한맛 방송' },
  { id: 'spicy', label: '매운맛 방송' },
];

function PresetTabs({ activePreset, onSelectPreset }) {
  return (
    <div className="self-stretch flex gap-4">
      {presets.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onSelectPreset(id)}
          className={`basis-1/3 shrink-1 px-4 py-2 rounded-lg text-sm transition-all
            ${activePreset === id
              ? 'bg-emerald-400 text-zinc-900 text-xl font-bold'
              : 'px-6 py-3 text-zinc-500 text-xl font-bold bg-zinc-700 rounded-xl hover:bg-zinc-600 hover:text-zinc-400'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default PresetTabs;
