const wrtc = require('wrtc');
const { bindPeerEvents } = require('./bind-peer-events');
const dotenv = require('dotenv');

// dotenv 로드 (app.js에서 이미 로드되었지만 안전을 위해 다시 로드)
dotenv.config();

// Twilio 설정 (TURN 서버용)
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;

// 기본 STUN 서버
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Twilio TURN 서버 추가 (환경변수가 설정된 경우)
if (accountSid && authToken) {
  try {
    iceServers.push(
      {
        urls: 'turn:global.turn.twilio.com:3478?transport=udp',
        username: accountSid,
        credential: authToken
      },
      {
        urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
        username: accountSid,
        credential: authToken
      },
      {
        urls: 'turn:global.turn.twilio.com:443?transport=tcp',
        username: accountSid,
        credential: authToken
      }
    );
    console.log('✅ Twilio TURN 서버가 ICE 서버에 추가되었습니다.');
  } catch (error) {
    console.error('⚠️ Twilio TURN 서버 추가 실패:', error);
  }
} else {
  console.log('⚠️ Twilio 인증 정보가 설정되지 않아 TURN 서버를 사용할 수 없습니다.');
}

// 세션별로 PeerConnection 관리하기
const socketToSession = new Map(); // socket.id -> sessionId
const sessionToPeers = new Map(); // sessionId -> peer 객체
const sessionToStream = new Map(); // sessionId -> stream 객체 (플랫폼, 스트림 키 등 스트리밍 정보)

const handleSocketConnection = async (socket) => {
  console.log(`웹소켓 연결 성공: ${socket.id}`);

  // 세션 아이디 전달받음
  socket.on('set-session', (data) => {
    console.log(`set-session 이벤트 수신: ${data.sessionId}`);
    const { sessionId } = data;
    socketToSession.set(socket.id, sessionId);

    // 새로운 세션에 대한 WebRTC PeerConnection 생성
    console.log(`WebRTC PeerConnection 생성 시작: ${sessionId}`);

    const peer = new wrtc.RTCPeerConnection({
      iceServers: iceServers,
      // 버퍼링 최소화 설정
      sdpSemantics: 'unified-plan',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    console.log(`WebRTC PeerConnection 생성 완료: ${sessionId}`);

    // 세션별 Peer 저장
    sessionToPeers.set(sessionId, peer);

    // 세션 스트림 정보 초기화
    sessionToStream.set(sessionId, {
      ffmpegProcess: null,
      isStreaming: false,
      isStreamReady: false,
      videoTrack: null,
      audioTrack: null,
      mediaStream: null,
      streamKey: null,
      platform: null,
    });

    // peer 이벤트 바인딩
    bindPeerEvents(peer, sessionId, socket);

    // 비디오/오디오 트랜시버 추가 (AI 서버에서 스트림을 받기 위해)
    console.log(`트랜시버 추가: ${sessionId}`);

    // 비디오 트랜시버 - 지연 최소화 설정
    const videoTransceiver = peer.addTransceiver('video', {
      direction: 'recvonly',
    });

    // 오디오 트랜시버 - 지연 최소화 설정
    const audioTransceiver = peer.addTransceiver('audio', {
      direction: 'recvonly',
    });

    // Offer 생성 및 전송 (비디오/오디오 포함)
    peer
      .createOffer()
      .then((offer) => {
        peer.setLocalDescription(offer);
        console.log(`Offer 생성 및 전송 (video/audio 포함): ${sessionId}`);
        console.log(`SDP: ${offer.sdp.substring(0, 200)}...`);

        socket.emit('webrtc-signal', {
          sessionId,
          signal: {
            type: 'offer',
            sdp: offer.sdp,
          },
        });
      })
      .catch((err) => {
        console.error(`Offer 생성 실패: ${sessionId}:`, err);
      });
  });

  // WebRTC 시그널링 처리
  socket.on('webrtc-signal', (data) => {
    console.log(`webrtc-signal 이벤트 수신: ${JSON.stringify(data).substring(0, 100)}...`);

    // 세션 ID 가져오기
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) {
      console.log('세션 ID 없음');
      return;
    }

    // 해당 세션의 peer 객체 가져오기
    const peer = sessionToPeers.get(sessionId);
    if (!peer) {
      console.error('Peer 없음');
      return;
    }

    // 시그널 데이터 처리 (WebRTC Native)
    console.log(`시그널 데이터 처리 중: ${sessionId}, 타입: ${data.signal?.type}`);

    if (data.signal.type === 'answer') {
      const desc = new wrtc.RTCSessionDescription(data.signal);
      peer.setRemoteDescription(desc);
    } else if (data.signal.type === 'ice') {
      const candidate = new wrtc.RTCIceCandidate(data.signal.candidate);
      peer.addIceCandidate(candidate);
    }
  });

  // 연결 해제 처리
  socket.on('disconnect', () => {
    // 세션 ID 가져오기
    const sessionId = socketToSession.get(socket.id);
    if (sessionId) {
      const peer = sessionToPeers.get(sessionId);
      const streamInfo = sessionToStream.get(sessionId);

      // FFmpeg 프로세스 종료
      if (streamInfo && streamInfo.ffmpegProcess) {
        streamInfo.ffmpegProcess.kill('SIGINT');
      }

      // Peer 연결 종료
      if (peer) {
        peer.close();
        sessionToPeers.delete(sessionId);
      }

      // 세션 정보 정리
      sessionToStream.delete(sessionId);
      socketToSession.delete(socket.id);
      console.log(`세션 연결 종료: ${sessionId}`);
    }
  });
};

module.exports = {
  handleSocketConnection,
  sessionToPeers,
  sessionToStream,
};
