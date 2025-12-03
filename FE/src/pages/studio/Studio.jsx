// Studio.jsx
// 메인 서비스 페이지
// Author: Junghyun Park
// Update: 2025-08-08

import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { useBroadcastStore } from '@/stores/broadcastStore';
import { useAuthStore } from '@/stores/authStore';
import { useWebrtcStore } from '@/stores/webrtcStore';
import { connect, disconnect } from '@/services/webrtc/webrtcService';

import StudioVideoSettingModal from '@/pages/studio/StudioVideoSettingModal';
import StudioVoiceSettingModal from '@/pages/studio/StudioVoiceSettingModal';
import StudioLogModal from '@/pages/studio/StudioLogModal';
import StudioHeader from '@/components/common/Studio-Header';
import StudioFooter from '@/components/common/Studio-Footer';
import PresetModal from '@/modals/PresetModal';
import FilteringSettingModal from '@/modals/filtering-setting-modal/FilteringSettingModal';
import ConfirmModal from '@/modals/ConfirmModal';
import YouTubeSettingModal from '@/modals/YoutubeSettingModal';
import useSettingStore from '@/stores/settingStore';

function useScrollDirection(throttleDelay = 200) {
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const throttleTimeout = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowHeader(currentScrollY <= lastScrollY.current);
      lastScrollY.current = currentScrollY;
    };

    const throttledScroll = () => {
      if (!throttleTimeout.current) {
        throttleTimeout.current = setTimeout(() => {
          handleScroll();
          throttleTimeout.current = null;
        }, throttleDelay);
      }
    };

    window.addEventListener('scroll', throttledScroll);
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [throttleDelay]);

  return showHeader;
}

function Studio() {
  //알림(로그) (on/off) 플래그
  const videoAlert = useSettingStore((s) => s.video?.action?.alert ?? false);
  const audioAlert = useSettingStore((s) => s.audio?.action?.alert ?? false);
  const shouldShowLog = videoAlert || audioAlert;

  const localVideoRef = useRef(null); // 원본 화면
  const remoteVideoRef = useRef(null); // 미리보기 화면 (서버 통신으로 받은 화면)

  
  const headerRef = useRef(null);
  const footerRef = useRef(null);
  const logSectionRef = useRef(null);
  const labelBarRef = useRef(null);
  
  // 사이즈 확인용 변수
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [logSectionHeight, setLogSectionHeight] = useState(0);
  const [labelBarHeight, setLabelBarHeight] = useState(0);
  
  // 로그 내보내기 ON/OFF
  const videoLogging = useSettingStore((s) => s.video?.action?.logging ?? false);
  const audioLogging = useSettingStore((s) => s.audio?.action?.logging ?? false);
  const enableLogExport = videoLogging || audioLogging;
  
  // 로그용
  const logs = useWebrtcStore((s) => s.logs);
  const lastLogKey = useWebrtcStore((s) => s.lastLogKey);
  
  // 카메라 관련 상태
  const isCameraOn = useBroadcastStore((state) => state.isCameraOn);
  // 마이크 관련 상태
  const isMicOn = useBroadcastStore((state) => state.isMicOn);
  
  // WebRTC 관련 상태들
  const { remoteStream, localStream } = useWebrtcStore();
  
  // WebRTC 관련 액션들
  const { clearStreams, reset: resetWebrtc } = useWebrtcStore();
  
  // 새 유저인지 확인
  const isNewUser = useAuthStore((s) => s.isNewUser);
  const setIsNewUser = useAuthStore((s) => s.setIsNewUser);
  const user = useAuthStore((s) => s.user);
  
  // Preset 모달
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const handlePresetClose = () => setIsPresetOpen(false);
  
  // FilteringSetting 모달
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const handleSettingClose = () => setIsSettingOpen(false);
  
  // YoutubeSetting 모달
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [isReadyToStream, setIsReadyToStream] = useState(false); // 조건 분기 예시
  const [isStreamingConfirmOpen, setIsStreamingConfirmOpen] = useState(false); // 두 번째 확인 모달
  
  // 유튜브 송출 관련 로컬 상태
  const [youtubeConfig, setYoutubeConfig] = useState({
    streamList: null,
    selectedStreamId: null,
    title: '',
    description: '',
    category: '',
    isMadeForKids: false,
    accessToken: '',
  });

  // 헤더 스크롤하면 닫히도록
  const showHeader = useScrollDirection();
  // 모바일 환경인지 확인
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  
  // Preset 모달 열기
  useEffect(() => {
    if (isNewUser) {
      setIsPresetOpen(true);
      setIsNewUser(false);
    }
  }, [isNewUser]);
  
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    if (labelBarRef.current) setLabelBarHeight(labelBarRef.current.offsetHeight);
  }, []);
  
  useLayoutEffect(() => {
    const resizeFooter = new ResizeObserver(() => {
      if (footerRef.current) setFooterHeight(footerRef.current.offsetHeight);
    });
    if (footerRef.current) resizeFooter.observe(footerRef.current);
    return () => resizeFooter.disconnect();
  }, []);
  
  useLayoutEffect(() => {
    const resizeLog = new ResizeObserver(() => {
      if (logSectionRef.current) setLogSectionHeight(logSectionRef.current.offsetHeight);
    });
    if (logSectionRef.current) resizeLog.observe(logSectionRef.current);
    return () => resizeLog.disconnect();
  }, []);
  
  useEffect(() => {
    // 1) sessionId 변경 로깅 (subscribeWithSelector 없이 수동 비교)
    let prevSid = useWebrtcStore.getState().sessionId;
    const unsub = useWebrtcStore.subscribe((state) => {
      if (state.sessionId !== prevSid) {
        prevSid = state.sessionId;
        console.log('🪪 sessionId 업데이트:', state.sessionId);
      }
    });
    
    // 2) WebRTC 연결 시작
    (async () => {
      try {
        await connect();
      } catch (error) {
        console.error('WebRTC 연결 실패:', error);
      }
    })();
    
    // 3) 정리
    return () => {
      unsub();
      disconnect();
      clearStreams();
      resetWebrtc();
    };
  }, []);
  
  // 로컬 비디오 요소에 localStream 연결
  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream ?? null;
  }, [localStream]);
  
  // 원격 비디오 연결
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream ?? null;
  }, [remoteStream]);
  
  // 카메라 on/off
  useEffect(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
  }, [isCameraOn, localStream]);
  
  // 마이크 on/off
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = isMicOn));
  }, [isMicOn, localStream]);
  
  // 모바일환경인지 확인 (가로모드 특화)
  useEffect(() => {
    const MOBILE_MAX_WIDTH = 1024; // 모바일로 간주할 최대 폭
    const LANDSCAPE_MAX_HEIGHT = 520; // 가로모드에서의 최대 높이 (필요시 조정)
    
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      const isLandscape = w > h;
      const isMobileWidth = w <= MOBILE_MAX_WIDTH;
      const isShortHeight = h <= LANDSCAPE_MAX_HEIGHT;
      
      setIsMobileLandscape(isLandscape && isMobileWidth && isShortHeight);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);
  
  // 원본 영상 로컬 저장용 변수
  const [recordDecision, setRecordDecision] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const isRecording = useBroadcastStore((s) => s.isRecording);
  
  // 로컬 저장 confirm 모달
  const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
  const [saveConfirmModalProps, setSaveConfirmModalProps] = useState();

  // Footer가 "방송 시작"을 눌렀을 때 모달 열기
  const openSaveConfirmModal = () => {
    setSaveConfirmModalProps({
      title: '원본 영상 저장',
      body: '방송 중 원본 영상을 로컬에 저장할까요?',
      confirmText: '저장하고 방송',
      cancelText: '저장 없이 방송',
      onConfirm: () => {
        setRecordDecision(true);          // 녹화 + 송출
        setSaveConfirmModalOpen(false);
      },
      onCancel: () => {
        setRecordDecision(false);         // 송출만
        setSaveConfirmModalOpen(false);
      },
    });
    setSaveConfirmModalOpen(true);
  };
  
  useEffect(() => {
    if (!localStream){
      console.log('[REC] skip: no localStream');
      return;
    } 
    if (isRecording) {
    // 이미 돌고 있으면 중복 시작 방지
    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('[REC] already recording');
      return;
    }

    // 브라우저 지원 MIME 탐색 (폴백)
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    const supported = (type) =>
      typeof MediaRecorder !== 'undefined' &&
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported(type);
    const mimeType = candidates.find(supported);

    try {
     const options = mimeType ? { mimeType } : undefined;
     const recorder = new MediaRecorder(localStream, options);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
     recorder.onerror = (e) => {
       console.error('[REC] recorder error:', e);
     };
     recorder.onstart = () => {
       console.log('[REC] started with', mimeType ?? '(default)');
     };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `녹화본_${new Date().toISOString()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        mediaRecorderRef.current = null;
      };
     recorder.start(); // 필요하면 recorder.start(1000)로 1초 단위 chunk
      mediaRecorderRef.current = recorder;
    } catch (err) {
     console.error('[REC] failed to start MediaRecorder:', err);
      // 브라우저/코덱 미지원일 수 있음
    }
  } else {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
     console.log('[REC] stop requested');
      mediaRecorderRef.current.stop();
    }
  }
}, [isRecording, localStream]);

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col relative overflow-x-hidden overflow-y-auto">
      {/* 헤더 */}
      <div
        ref={headerRef}
        className={`sticky top-0 z-50 transition-transform duration-300 ease-in-out ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        } bg-zinc-800`}
        >
        <StudioHeader
          onOpenSettingModal={() => setIsSettingOpen(true)}
          youtubeConfig={youtubeConfig}
          setYoutubeConfig={setYoutubeConfig}
          setIsYouTubeSettingOpen={setIsYoutubeModalOpen}
          />
      </div>

      {/* 본문 */}
      <div
        className="flex-1 flex flex-col"
        style={{ minHeight: `calc(100vh - ${footerHeight}px)` }}
      >
        <div ref={labelBarRef} className="flex w-full gap-x-6 items-center h-12 px-2">
          <div className="w-full text-center text-xl font-bold text-zinc-500">원본 화면</div>
          <div className="w-full text-center text-xl font-bold text-zinc-500">송출될 화면</div>
        </div>

        {/* 영상 */}
        <div className="flex w-full items-center justify-center gap-x-6 px-3">
          {[localVideoRef, remoteVideoRef].map((ref, i) => (
            <div
              key={i}
              className="w-full flex items-center justify-center"
              style={
                isMobileLandscape
                  ? undefined
                  : {
                      height: `calc(100vh - ${
                        headerHeight + footerHeight + logSectionHeight + labelBarHeight
                      }px)`,
                    }
              }
            >
              <div
                style={{
                  aspectRatio: '16 / 9',
                  width: '100%',
                  maxHeight: '100%',
                  backgroundColor: 'black',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <video
                  ref={ref}
                  autoPlay
                  muted={ref === localVideoRef}
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>

        {/* 설정 및 로그 */}
        <div
          ref={logSectionRef}
          className={`mt-4 px-3 py-3 bg-zinc-900 z-40 w-full ${
            isMobileLandscape ? '' : 'fixed bottom-0'
          }`}
          style={{ marginBottom: `${footerHeight}px` }}
        >
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <div className="flex flex-row gap-3 w-full">
              <div className="w-full">
                <StudioVideoSettingModal />
              </div>
              <div className="w-full">
                <StudioVoiceSettingModal />
              </div>
            </div>
            {shouldShowLog && (
              <div className="w-full">
                <StudioLogModal logs={logs} lastLogKey={lastLogKey} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div ref={footerRef} className="fixed bottom-0 left-0 w-full z-40">
        <StudioFooter
          youtubeConfig={youtubeConfig}
          setYoutubeConfig={setYoutubeConfig}
          setIsYouTubeSettingOpen={setIsYoutubeModalOpen}
          logs={logs}
          enableLogExport={enableLogExport}
          openSaveConfirmModal={openSaveConfirmModal}
          recordDecision={recordDecision}
          clearRecordDecision={()=>setRecordDecision(null)}
        />
      </div>

      {/* 모달들 */}
      <PresetModal
        isOpen={isPresetOpen}
        onClose={() => setIsPresetOpen(false)}
        name={user?.first_name || '방송인'}
      />
      <FilteringSettingModal
        isOpen={isSettingOpen}
        onClose={() => setIsSettingOpen(false)}
        name={user?.first_name || '방송인'}
      />
      <YouTubeSettingModal
        isOpen={isYoutubeModalOpen}
        onClose={() => setIsYoutubeModalOpen(false)}
        youtubeConfig={youtubeConfig}
        setYoutubeConfig={setYoutubeConfig}
        streamList={youtubeConfig?.streamList ?? []}
        onConfirm={() => {
          setIsYoutubeModalOpen(false);
          setIsStreamingConfirmOpen(true); // 송출 확인 단계로 넘어감
        }}
      />
      <ConfirmModal
        isOpen={saveConfirmModalOpen}
        onClose={() => setSaveConfirmModalOpen(false)}
        {...(saveConfirmModalProps ?? {})}
      />
    </div>
  );
}

export default Studio;
