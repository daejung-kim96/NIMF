// YouTubeSettingModal.jsx
// Author: DJ
// Date: 2025-08-06

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const YouTubeSettingModal = ({
  isOpen,
  onClose,
  streamList = [],
  youtubeConfig = {},
  setYoutubeConfig,
}) => {
  const [selectedId, setSelectedId] = useState(youtubeConfig?.selectedStreamId || '');
  const [title, setTitle] = useState(youtubeConfig?.title || '');
  const [description, setDescription] = useState(youtubeConfig?.description || '');
  const [category, setCategory] = useState(youtubeConfig?.category || '');
  const [isMadeForKids, setIsMadeForKids] = useState(youtubeConfig?.isMadeForKids ?? false);

  const stopPropagation = (e) => e.stopPropagation();

  // 모달이 닫혀야 하면 아예 렌더를 하지 않음

  // ✅ 목록이 갱신되었고 아직 선택이 없으면 첫 항목 자동 선택(선택)
  useEffect(() => {
    if (!selectedId && Array.isArray(streamList) && streamList.length > 0) {
      setSelectedId(streamList[0].id);
    }
  }, [streamList, selectedId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // ✅ 'new'는 아직 미구현이면 막기
    if (selectedId === 'new') {
      alert('새 방송 생성 기능은 아직 준비 중입니다. 기존 방송을 선택해주세요.');
      return;
    }
    // ✅ 아무 것도 선택 안 했으면 막기
    if (!selectedId) {
      alert('방송을 선택해주세요.');
      return;
    }

    // ✅ 병합 업데이트(덮어쓰기 금지). 다른 필드(accessToken 등) 보존
    setYoutubeConfig((prev) => ({
      ...prev,
      selectedStreamId: selectedId,
      title,
      description,
      category,
      isMadeForKids,
      streamList: Array.isArray(streamList) ? streamList : [],
    }));

    // ⛔️ 강제 클릭으로 시작하지 않음 (푸터의 pendingStart useEffect가 자동으로 시작)
    // document.getElementById('startLiveButton')?.click();

    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 text-white rounded-2xl w-[640px] max-h-[90vh] overflow-y-auto p-8 shadow-xl"
        onClick={stopPropagation}
      >
        <h2 className="text-2xl font-bold text-center text-zinc-50 mb-6">YouTube 방송 설정</h2>

        {/* 방송 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">방송 선택</label>
          <select
            className="w-full px-4 py-2 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-50"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="" disabled>
              기존 방송을 선택하세요
            </option>
            {/* '새 방송' 미구현이면 아예 빼거나 disabled 처리하세요 */}
            {/* <option value="new">새로운 방송을 시작하겠습니다</option> */}
            {streamList.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.snippet?.title || '(제목 없음)'}
              </option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="방송 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-50"
          />
        </div>

        {/* 카테고리 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-50"
          >
            <option value="">선택 안 함</option>
            <option>게임</option>
            <option>과학기술</option>
            <option>교육</option>
            <option>노하우/스타일</option>
            <option>뉴스/정치</option>
            <option>비영리/사회운동</option>
            <option>스포츠</option>
            <option>애완동물/동물</option>
            <option>엔터테인먼트</option>
            <option>여행/이벤트</option>
            <option>영화/애니메이션</option>
            <option>음악</option>
            <option>인물/블로그</option>
            <option>자동차/교통</option>
            <option>코미디</option>
          </select>
        </div>

        {/* 설명 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">설명</label>
          <textarea
            rows="3"
            placeholder="방송 설명을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-zinc-700 border border-zinc-600 text-zinc-50 resize-none"
          />
        </div>

        {/* 아동용 여부 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            아동용 동영상 여부 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kid"
                checked={isMadeForKids === true}
                onChange={() => setIsMadeForKids(true)}
                className="accent-emerald-400"
              />
              <span>예, 아동용입니다.</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kid"
                checked={isMadeForKids === false}
                onChange={() => setIsMadeForKids(false)}
                className="accent-emerald-400"
              />
              <span>아니요, 아동용이 아닙니다.</span>
            </label>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-700 text-sm font-semibold"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md bg-emerald-400 hover:bg-emerald-500 text-zinc-900 text-sm font-bold"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default YouTubeSettingModal;
