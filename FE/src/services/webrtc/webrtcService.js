import SimplePeer from 'simple-peer';
import { io } from 'socket.io-client';
import { log } from '@/lib/logger';
import { useWebrtcStore } from '@/stores/webrtcStore';

async function connect() {
  const { socket, setSocket, setSessionId, setLocalStream, setIceServers } =
    useWebrtcStore.getState();

  // 이미 연결된 소켓은 연결 해제하기
  if (socket) {
    socket.disconnect();
  }

  log('🔌 웹소켓 연결 시도...', 'info');

  // 시그널링 서버에 웹소켓 연결
  const socketUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
  const newSocket = io(socketUrl, {
    withCredentials: true,
    path: '/socket.io',
    transports: ['polling', 'websocket'], // 명시적으로 transport 설정
    upgrade: true, // 자동 업그레이드 활성화
    rememberUpgrade: true, // 업그레이드 기억
    timeout: 20000, // 연결 타임아웃
    forceNew: true, // 새로운 연결 강제
  });

  // 스토어에 소켓 저장
  setSocket(newSocket);

  // 연결 성공 이벤트
  newSocket.on('connect', () => {
    log('✅ 웹소켓 연결 성공!', 'success');
    log(`Socket ID: ${newSocket.id}`, 'info');
  });

  // 연결 실패 이벤트
  newSocket.on('connect_error', (error) => {
    log(`❌ 웹소켓 연결 실패: ${error.message}`, 'error');
    console.error('Socket.IO 연결 에러 상세:', error);
  });

  // 연결 해제 이벤트
  newSocket.on('disconnect', (reason) => {
    log(`🔌 웹소켓 연결 해제: ${reason}`, 'info');
    console.log('Socket.IO 연결 해제 이유:', reason);
  });

  // 재연결 시도 이벤트
  newSocket.on('reconnect_attempt', (attemptNumber) => {
    log(`🔄 웹소켓 재연결 시도: ${attemptNumber}번째`, 'info');
  });

  // 재연결 성공 이벤트
  newSocket.on('reconnect', (attemptNumber) => {
    log(`✅ 웹소켓 재연결 성공: ${attemptNumber}번째 시도`, 'success');
  });

  newSocket.on('start-webrtc', () => {
    log('📡 시그널링 서버로부터 연결 지시 수신', 'info');

    // 카메라 권한 요청
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          mimeType: 'video/H264;codecs=avc1',
        },
        audio: {
          sampleRate: 16000, // ← 16kHz 샘플레이트
          channelCount: 1, // ← 모노 채널
          sampleSize: 16, // ← 16bit
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      .then((stream) => {
        // 스토어에 로컬 스트림 저장
        setLocalStream(stream);

        // 트랙 분리
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack && audioTrack) {
          // 두 트랙을 하나의 스트림으로 병합
          const aiServerStream = new MediaStream([videoTrack, audioTrack]);

          // 각각의 peer에 전달
          log(`peer 생성 시작`, 'info');
          createPeer('unified', aiServerStream);
        } else {
          log('❌ 비디오 또는 오디오 트랙을 찾을 수 없습니다.', 'error');
        }
      })
      .catch((error) => {
        log(`❌ 웹캠 접근 실패: ${error.message}`, 'error');
        console.error('getUserMedia 에러 상세:', error);
      });
  });

  // 세션 생성 이벤트
  newSocket.on('session_created', (data) => {
    setSessionId(data.sessionId);

    // ICE 서버 설정 (에러 처리 추가)
    if (data.turnToken && data.turnToken.iceServers) {
      setIceServers(data.turnToken.iceServers);
      log(`🔌 ICE 서버 설정 완료: ${data.turnToken.iceServers.length}개 서버`, 'info');
    } else {
      // 기본 STUN 서버 설정
      const defaultIceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      setIceServers(defaultIceServers);
      log(`⚠️ TURN 서버 없음, 기본 STUN 서버 사용`, 'warn');
    }

    log(`🔌 세션 생성됨: ${data.sessionId}`, 'info');
  });

  // AI 서버로부터 시그널 수신
  newSocket.on('signal-from-ai', ({ target, signal }) => {
    const { peers } = useWebrtcStore.getState();
    if (peers[target]) {
      peers[target].signal(signal);
    } else {
      console.warn(`⚠️ unknown peer target: ${target}`);
    }
  });
}

function disconnect() {
  log('🔘 연결 해제 버튼 클릭됨', 'info');

  const { socket, peers, localStream, setSocket, setLocalStream, setPeers, clearStreams } =
    useWebrtcStore.getState();

  if (socket) {
    socket.disconnect();
    setSocket(null);
  }

  Object.values(peers).forEach((peer) => peer.destroy());
  setPeers({});

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
  }

  clearStreams();
  log('🔌 연결 해제 완료', 'info');
}

function createPeer(target, stream) {
  log(`peer 생성 시작: ${target}`, 'info');

  const { iceServers } = useWebrtcStore.getState();

  // ICE 서버 정보 로깅
  log(`🔧 ICE 서버 설정: ${JSON.stringify(iceServers)}`, 'info');

  try {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: iceServers,
      },
    });
    log(`peer 생성 완료: ${target}`, 'success');

    // 스토어에서 현재 peers 가져와서 새 peer 추가
    const { peers, setPeers, setRemoteStream } = useWebrtcStore.getState();
    const newPeers = { ...peers, [target]: peer };
    setPeers(newPeers);
    log(`setPeers 완료: ${target}`, 'info');

    peer.on('signal', (data) => {
      const { socket, sessionId } = useWebrtcStore.getState();
      if (socket && sessionId) {
        socket.emit('signal-to-ai', {
          sessionId,
          target,
          signal: data,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      log(`📡 ${target}에서 스트림 수신됨`, 'info');
      console.log('수신된 스트림:', remoteStream);
      console.log('스트림 트랙:', remoteStream.getTracks());

      // AI 서버에서 보내는 스트림을 원격 비디오에 표시
      setRemoteStream(remoteStream);
      log('📺 원격 비디오 스트림을 연결했습니다', 'success');
    });

    peer.on('connect', () => {
      console.log(`✅ ${target} peer 연결 완료`);
      const { socket } = useWebrtcStore.getState();
      if (socket) {
        socket.emit('peer-connected', { target });
      }
    });

    peer.on('error', (error) => {
      log(`❌ ${target} peer 에러: ${error.message}`, 'error');
      console.error(`${target} peer 에러:`, error);
    });

    // Data channel 이벤트 처리
    peer.on('data', (data) => {
      if (data instanceof Uint8Array) {
        try {
          const decoder = new TextDecoder('utf-8');
          const decodedString = decoder.decode(data);
          console.log('📨 Data Channel 수신 데이터: ', decodedString);

          const parsed = JSON.parse(decodedString);

          if (Array.isArray(parsed)) {
            parsed.forEach((log) => {
              useWebrtcStore.getState().addLog(log);
            });
          } else if (parsed && typeof parsed === 'object') {
            useWebrtcStore.getState().addLog(parsed);
          } else {
            console.warn('⚠️ 예상치 못한 로그 형식:', parsed);
          }
        } catch (error) {
          console.log('📨 디코딩 또는 파싱 실패:', error);
        }
      }
    });
  } catch (error) {
    log(`❌ peer 생성 실패: ${target} - ${error.message}`, 'error');
    console.error('peer 생성 에러:', error);
  }
}

// 함수들을 외부로 export
export { connect, disconnect, createPeer };
