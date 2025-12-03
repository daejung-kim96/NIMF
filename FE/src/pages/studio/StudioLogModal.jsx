// StudioLogModal.jsx
// 스튜디오 로그 모달
// Author: Junghyun Park
// Date: 2025-07-28

import React, { useEffect, useRef } from 'react';

const formatMessage = (type, category, detail) => {
  if (type === 'video') {
    return (
      <>
        <span className="font-semibold">{category}</span>
        {detail && <span className="text-zinc-400"> ({detail})</span>}
        <span> 이 감지되었습니다.</span>
      </>
    );
  } else {
    return (
      <>
        <span className="font-semibold">{category} </span>
        {detail && <span className="text-zinc-400"> ({detail})</span>}
        <span> 이 감지되었습니다.</span>
      </>
    );
  }
};

const StudioLogModal = ({logs=[], lastLogKey}) => {
  const containerRef = useRef(null);

  // 로그가 추가될 때마다 스크롤 맨 아래로 이동
  useEffect(
    () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
  }},[logs],);

  return (
    <div className="bg-zinc-800 rounded-xl p-3 h-[135px] relative flex-1 overflow-hidden">
      <div ref={containerRef} className="overflow-y-auto h-full pr-2">
        {logs?.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-zinc-400 text-md font-medium">여기에 알림이 표시됩니다.</p>
          </div>
        ) : (
          [...logs].reverse().map((log, idx) => (
            <LogItem key={idx} {...log} highlight={idx===0} />
          ))
        )}
      </div>
    </div>
  );
};

const LogItem = ({ type, category, detail, time, highlight }) => {
  const typeLabel = type === 'voice' ? '음성' : '영상';
  const message = formatMessage(type, category, detail);

  return (
    <div
      className={`rounded-lg px-5 min-h-[40px] ${
        highlight 
        ? 'py-2.5 mb-1 bg-zinc-900 border border-emerald-400 animate-fadeInUp' 
        : 'bg-transparent'
      } flex flex-row justify-between items-center w-full`}
    >
      <div className="flex flex-row items-center gap-2 overflow-hidden w-full">
        {/* 뱃지 */}
        {highlight ? (
          <span className="bg-emerald-600 text-white px-2 py-1 text-[12px] font-semibold rounded shrink-0">
            {typeLabel}
          </span>
        ) : (
          <span className="px-2 py-1 text-[12px] font-semibold text-zinc-400 rounded border border-zinc-600 shrink-0">
            {typeLabel}
          </span>
        )}

        {/* 메시지 텍스트 */}
        <div
          className={`truncate overflow-hidden whitespace-nowrap w-full ${
            highlight ? 'text-white text-sm' : 'text-zinc-400 text-sm font-semibold'
          }`}
        >
          {message}
        </div>
      </div>

      {/* 시간 */}
      <div className="flex items-center text-sm pl-2 shrink-0">
        <span
          className={`${
            highlight ? 'text-white font-bold text-sm' : 'text-zinc-400 font-semibold text-sm'
          }`}
        >
          {time}
        </span>
      </div>
    </div>
  );
};

export default StudioLogModal;
