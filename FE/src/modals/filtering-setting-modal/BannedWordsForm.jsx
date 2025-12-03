import React, { useState } from 'react';
import useSettingStore from '@/stores/settingStore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import XIcon from '@/assets/icons/x.svg?react';

export function BannedWordsForm() {
  const [word, setWord] = useState('');
  const [error, setError] = useState(null);

  const audio = useSettingStore((s) => s.audio);
  const addBannedWord = useSettingStore((s) => s.addBannedWord);
  const removeBannedWord = useSettingStore((s) => s.removeBannedWord);
  const bannedWords = audio.category.bannedWords || [];

  // 유효성 검사: 조건에 따라 구체적인 메시지 반환
  const validateWord = (w, bannedWords) => {
    const newWord = w.trim();
    // if (!newWord) return '단어를 입력해주세요.';
    if (newWord.includes(' ')) return '띄어쓰기 없는 단어만 가능합니다.';
    if (/[^0-9A-Za-z가-힣]/.test(newWord)) return '자음, 특수문자는 사용할 수 없습니다.';
    if (newWord.length >= 1 && newWord.length < 2) return '2글자 이상 입력해주세요.';
    if (newWord.length > 10) return '10글자 이하만 가능합니다.';
    if (bannedWords.includes(newWord)) return '이미 등록된 단어입니다.';
    if (bannedWords.length >= 10) return '최대 10개까지 등록할 수 있습니다.';
    return null; // 통과
  };

  const handleAdd = () => {
    const msg = validateWord(word, bannedWords);
    if (msg) {
      setError(msg);
      return;
    }

    // 통과
    const newWord = word.trim();
    addBannedWord(newWord);
    setWord(''); // 입력창 초기화
    setError(null); // 에러 초기화
  };

  const handleDelete = (word) => {
    removeBannedWord(word);
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="space-y-0.5">
        <p className="text-zinc-50 text-base font-semibold">금지어 등록</p>
        <p className="text-zinc-400 text-xs font-normal">
          2글자 이상, 10글자 이하의 띄어쓰기 없는 단어만 가능하며, 최대 10개까지 지정 가능합니다.
        </p>
      </div>
      {/* 금지어 추가 입력창 */}
      <div className="flex w-full items-start gap-2">
        <div className="flex flex-col w-full">
          <Input
            type="text"
            value={word}
            onChange={(e) => {
              const v = e.target.value;
              setWord(v);
              // 입력 중 실시간 검증을 원치 않으면 이 줄은 빼세요.
              setError(validateWord(v, bannedWords));
            }}
            placeholder="금지어로 지정하고 싶은 단어를 입력해주세요."
            className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {/* 에러 메시지 */}
          {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        </div>
        <Button type="button" variant="inputBtn" size="inputBtn" onClick={handleAdd}>
          추가하기
        </Button>
      </div>
      {/* 등록된 금지어 목록 */}
      <div className="flex-1 max-h-[50px] overflow-y-auto pr-1">
        {bannedWords.length === 0 ? (
          <p className="text-zinc-400 text-sm justify-center">등록된 금지어가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bannedWords.map((word) => (
              <div
                key={word}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-700 rounded-lg text-zinc-300 text-sm font-semibold"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(word)}
                  className="text-zinc-500 hover:text-red-400"
                  aria-label="삭제"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
