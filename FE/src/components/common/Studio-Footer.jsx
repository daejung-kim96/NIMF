// Studio-Footer.jsx
import { useRef, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { useBroadcastStore } from '@/stores/broadcastStore';
import { useWebrtcStore } from '@/stores/webrtcStore';

import cameraOnIcon from '@/assets/icons/camera-on.svg';
import cameraOffIcon from '@/assets/icons/camera-off.svg';
import micOnIcon from '@/assets/icons/mic-on.svg';
import micOffIcon from '@/assets/icons/mic-off.svg';
import { useEffect } from 'react';
export default function StudioFooter({
  youtubeConfig,
  setYoutubeConfig,
  setIsYouTubeSettingOpen,
  logs = [],
  enableLogExport = false,
  openSaveConfirmModal,
  recordDecision = null,
  clearRecordDecision,
}) {
  // Zustand 상태
  const {
    isCameraOn,
    isMicOn,
    isLive,
    isRecording,
    toggleCamera,
    toggleMic,
    toggleLive,
    toggleRecording,
  } = useBroadcastStore();

  // 방송 시간 측정
  const liveTime = useRef(0);
  const intervalRef = useRef(null);
  const openFromStartRef = useRef(false);
  const [, forceUpdate] = useState(0); // 시간 업데이트용 리렌더
  const testKey = import.meta.env.VITE_TEST_KEY; // test용 stream key
  const AI_BASE = import.meta.env.VITE_AI_BASE_URL;

  const sessionId = useWebrtcStore((s) => s.sessionId);

  const [pending, setPending] = useState(false);

  // ✅ 송출서버(5002) 루트. 절대 /api 붙이지 마세요.
  const STREAM_BASE = import.meta.env.VITE_AI_BASE_URL;

  const getSelectedStream = () => {
    const list = youtubeConfig?.streamList || [];
    const id = youtubeConfig?.selectedStreamId;
    if (!id) return null;
    return list.find((s) => s.id === id) || null;
  };
  const extractStreamKey = () => getSelectedStream()?.cdn?.ingestionInfo?.streamName ?? null;

  const maskKey = (k) =>
    typeof k === 'string' && k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : k;

  // 409일 때만 짧게 재시도하는 helper
  const tryStartOnce = async (payload) => {
    try {
      await axios.post(`${STREAM_BASE}/stream/start`, payload);
      return { ok: true };
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) return { ok: false, retry: true }; // 브릿지 미준비
      const msg = e?.response?.data?.message || e?.response?.data || e?.message || 'unknown error';
      return { ok: false, retry: false, msg };
    }
  };

  const start = async () => {
    if (!sessionId) {
      alert('세션 ID가 없습니다. 먼저 연결(세션 생성)부터 해주세요.');
      return;
    }
    const streamKey = extractStreamKey();
    if (!streamKey) {
      if (Array.isArray(youtubeConfig?.streamList) && youtubeConfig.streamList.length > 0) {
        setYoutubeConfig?.((p) => ({ ...p, selectedStreamId: null }));
        setIsYouTubeSettingOpen?.(true);
        alert('방송에 사용할 스트림을 선택하세요.');
      } else {
        alert('송출할 플랫폼을 먼저 선택하세요');
      }
      return;
    }

    setPending(true);
    const payload = { sessionId, streamKey, platform: 'youtube' };
    console.log('▶️ /stream/start', { ...payload, streamKey: maskKey(streamKey) });

    try {
      // 1차 시도
      let r = await tryStartOnce(payload);
      // 409면 짧게 재시도 (예: 최대 8회, 총 6~7초)
      for (let i = 0; i < 8 && !r.ok && r.retry; i++) {
        await new Promise((res) => setTimeout(res, 800));
        r = await tryStartOnce(payload);
      }
      if (!r.ok) {
        alert(r.msg || '브릿지가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
        return;
      }
      console.log('✅ start ok');
      toggleLive();
    } finally {
      setPending(false);
    }
  };

  const stop = async () => {
    if (!sessionId) return;
    setPending(true);
    try {
      await axios.post(`${STREAM_BASE}/stream/stop`, { sessionId });
      console.log('🛑 stop ok');
      toggleLive();
      if (isRecording) toggleRecording();
    } catch (err) {
      console.error('송출 종료 실패:', err?.response?.data || err?.message);
      // alert('송출 종료 실패');
    } finally {
      setPending(false);
      if (enableLogExport && Array.isArray(logs) && logs.length > 0) {
        exportLogsTxt(logs);
      }
      clearLogs();
    }
  };

  const handleLiveToggle = async () => {
    if (pending) return;

    if (!isLive) {
      const list = youtubeConfig?.streamList || [];
      const hasList = Array.isArray(list) && list.length > 0;
      const hasKey = !!extractStreamKey(); // 선택된 스트림의 streamName 존재 여부

      // 1) 스트림 목록 자체가 없음 → 먼저 받아오라고 안내
      if (!hasList) {
        alert('송출할 플랫폼을 먼저 선택하세요');
        return;
      }
      // 2) 목록은 있는데 선택/키가 없음 → 선택 안내 + 유튜브 세팅 모달 열기
      if (!hasKey) {
        alert('방송에 사용할 스트림을 선택하세요.');
        openFromStartRef.current = true;
        setIsYouTubeSettingOpen?.(true);
        return;
      }
      // 3) 선택까지 끝났으면 → 저장 확인 모달
      openSaveConfirmModal?.();
      return;
    }
    // 이미 라이브 중이면 종료
    await stop();
  };

  // 유튜브 모달에서 선택 완료되면(= selectedStreamId 변경) 자동으로 저장 모달 오픈
  useEffect(() => {
    if (!openFromStartRef.current) return; // 방송 시작 흐름으로 연 모달이 아닐 때는 무시
    const key = extractStreamKey();
    if (key) {
      openFromStartRef.current = false; // 1회성 플래그 해제
      openSaveConfirmModal?.(); // 저장 모달 즉시 오픈
    }
  }, [youtubeConfig?.selectedStreamId, youtubeConfig?.streamList]);

  // 부모가 결정(true/false) 내려주면 여기서 실제로 송출/녹화를 처리
  useEffect(() => {
    if (recordDecision === null) return; // 아직 결정 없음
    (async () => {
      try {
        // 녹화 여부 반영
        if (recordDecision && !isRecording) toggleRecording();
        if (!recordDecision && isRecording) toggleRecording(); // 보수적: 시작 전에 꺼두기
        await start(); // 송출 공통
      } finally {
        // 한 번 처리했으면 플래그 리셋하여 재트리거 방지
        clearRecordDecision?.();
      }
    })();
  }, [recordDecision]);

  // 로그 초기화
  const clearLogs = useWebrtcStore((s) => s.clearLogs);

  // txt 내보내기
  function exportLogsTxt(logArray) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    const header = [
      '.                                 |￣￣￣￣￣￣|',
      '(＼ ∧♛∧          .+° °*.    |    NIMF가    |',
      '(ヾ( *･ω･)        °・  ꕥ      |   처리완료   |',
      '`し(   つ つ━✩*  .+°       |＿＿＿＿＿＿|',
      '(／しーＪ                                ||',
      '',
      '#-------------------- 저장한 로그 --------------------#',
      `# 방송 날짜 : ${new Date().toISOString()}`,
      `# 저장된 로그 개수 : ${logArray.length}`,
      '#-------------------------------------------------------#',
      '',
    ].join('\n');

    const body = logArray
      .map((l, i) => {
        const idx = String(i + 1).padStart(3, '0');
        const time = l?.time ?? '-';
        const type = l?.type ?? '-';
        const category = l?.category ?? '-';
        const detail = l?.detail ? ` (${l.detail})` : '';
        return `[${idx}] ${time} | ${type} | ${category}${detail}`;
      })
      .join('\n');

    const blob = new Blob([header, body, '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `studio_logs_${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (isLive) {
      // 방송 시작 시 타이머 시작
      intervalRef.current = setInterval(() => {
        liveTime.current += 1;
        forceUpdate((n) => n + 1);
      }, 1000);
    } else {
      // 방송 종료 시 타이머 초기화
      clearInterval(intervalRef.current);
      liveTime.current = 0;
      forceUpdate((n) => n + 1);
    }

    return () => clearInterval(intervalRef.current);
  }, [isLive]);

  useEffect(() => {
    let audioStream;

    if (isMicOn) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          audioStream = stream;
          // 실제 마이크 스트림이 필요하다면 저장해둘 수도 있음
          // 예: remoteAudioRef.current.srcObject = stream;
        })
        .catch((err) => {
          console.error('마이크 연결 실패:', err);
        });
    }

    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMicOn]);

  const formatTime = (seconds) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const selected = getSelectedStream();
  const selectedLabel =
    selected?.snippet?.title || selected?.name || (selected ? selected.id : '선택 안됨');

  return (
    <footer className="w-full bg-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-between items-center gap-3">
      {/* 좌: 카메라 / 마이크 */}
      <div className="flex flex-wrap items-center gap-3 min-w-[200px]">
        <Button
          variant={isCameraOn ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleCamera}
          disabled={pending}
          className={`p-5 rounded-full flex items-center gap-2 ${
            isCameraOn
              ? 'bg-zinc-700 hover:bg-zinc-600'
              : 'bg-zinc-800 hover:bg-zinc-900 border-zinc-500'
          }`}
        >
          <img src={isCameraOn ? cameraOnIcon : cameraOffIcon} className="w-5 h-5" alt="camera" />
          <span className="text-zinc-400 text-sm sm:text-base font-semibold">
            {isCameraOn ? '카메라끄기' : '카메라켜기'}
          </span>
        </Button>

        <Button
          variant={isMicOn ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleMic}
          disabled={pending}
          className={`p-5 rounded-full flex items-center gap-2 ${
            isMicOn
              ? 'bg-zinc-700 hover:bg-zinc-600'
              : 'bg-zinc-800 hover:bg-zinc-900 border-zinc-500'
          }`}
        >
          <img src={isMicOn ? micOnIcon : micOffIcon} className="w-5 h-5" alt="mic" />
          <span className="text-zinc-400 text-sm sm:text-base font-semibold">
            {isMicOn ? '마이크끄기' : '마이크켜기'}
          </span>
        </Button>
      </div>

      {/* 우: 선택 상태 / LIVE / 시작/종료 */}
      <div className="flex flex-wrap items-center sm:gap-5 min-w-[320px] justify-end">
        {/* LIVE 상태 표시 */}
        <div className="flex items-center gap-2 w-28">
          <span
            className={`${
              isLive ? 'text-rose-500' : 'text-zinc-500'
            } sm:text-base text-sm font-bold`}
          >
            LIVE
          </span>
          <span
            className={`text-sm sm:text-base font-bold ${
              isLive ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            {formatTime(liveTime.current)}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-end mr-3">
          <span className="text-xs text-zinc-500">선택된 스트림</span>
          <button
            type="button"
            className="text-xs text-emerald-300 underline text-right"
            onClick={() => setIsYouTubeSettingOpen?.(true)}
            title="스트림 선택/변경"
          >
            {selectedLabel}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleLiveToggle}
            variant="default"
            disabled={!sessionId || pending}
            className={`px-7 py-5 rounded-xl flex items-center text-md sm:text-lg font-bold ${
              isLive
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-emerald-300 text-zinc-900 hover:bg-emerald-400'
            }`}
            title={!sessionId ? '세션 없음 (먼저 연결)' : pending ? '처리 중...' : ''}
          >
            {pending ? '처리 중…' : isLive ? '방송 종료' : '방송 시작'}
          </Button>
        </div>
      </div>
    </footer>
  );
}
