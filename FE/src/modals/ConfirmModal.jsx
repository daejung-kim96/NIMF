import React, { useEffect } from 'react';
import PlayIcon from '@/assets/icons/play.svg?react';
import PricingIcon from '@/assets/icons/pricing.svg?react';
import CloseIcon from '@/assets/icons/x.svg?react';
import { Button } from '@/components/ui/button';

/**
 * Props
 * - icon: ReactNode (예: <PricingIcon className="..." />) — 있으면 이걸 우선 사용
 * - iconVariant: 'play' | 'pricing' — icon이 없을 때만 사용, 기본 'play'
 * - iconClassName: 아이콘 공통 스타일 (기본 사이즈/색)
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title = '확인',
  body,
  confirmText = '확인',
  cancelText = '취소',
  icon,
  iconVariant = 'play',
  iconClassName = 'text-emerald-400 w-[60px] h-[60px]',
}) => {
  const stopPropagation = (e) => e.stopPropagation();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const FallbackIcon = iconVariant === 'pricing' ? PricingIcon : PlayIcon;
  const HeaderIcon = icon ?? <FallbackIcon className={iconClassName} />;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 rounded-xl p-6 flex flex-col gap-6 items-center relative w-[360px] max-w-[90%]"
        onClick={stopPropagation}
      >
        {/* 닫기 */}
        <button className="absolute top-4 right-4" onClick={onClose}>
          <CloseIcon className="w-5 h-5 text-zinc-500" />
        </button>

        {/* 헤더 */}
        <div className="flex flex-col items-center gap-2 w-full">
          {HeaderIcon}
          <h2 className="text-zinc-50 text-2xl font-bold text-center">{title}</h2>
        </div>

        {/* 바디 */}
        <div className="flex flex-col gap-5 items-center w-full">
          <p className="text-zinc-50 text-sm font-normal text-center">{body}</p>
        </div>

        {/* 푸터 */}
        <div className="flex flex-row gap-2 w-full">
          <Button
            className="flex-1"
            variant="confirmModalCancel"
            size="confirmModal"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            className="flex-1"
            variant="confirmModalConfirm"
            size="confirmModal"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
