/**
 * 클라이언트 소켓 연결 핸들러
 * @module socket/handler
 * @author joon hyeok
 * @date 2025-07-29
 * @description 클라이언트 소켓 연결 시 토큰 인증, 세션 생성, GPU 서버 연결, WebRTC 시그널링 이벤트 등록 등 전체 흐름을 제어합니다.
 */

// --- 모듈 import ---
const cookie = require('cookie');
const { authenticateAndCreateSession } = require('./auth-session');
const { connectToAiServers } = require('./gpu-connector');
const { bindServerSocketEvents } = require('./signal-handler');
const { cleanUpConnections } = require('./cleaner');
const { bindWebRTCEvents } = require('./webrtc-flow');
const twilio = require('twilio');

// twilio 설정
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;

/**
 * 클라이언트 소켓 연결 처리 함수
 * @function handleSocketConnection
 * @param {Socket} socket - Socket.IO 클라이언트 소켓 인스턴스
 */
const handleSocketConnection = async (socket) => {
  console.log('클라이언트 연결됨:', socket.id);

  // ✅ 쿠키 파싱
  const rawCookie = socket.handshake.headers?.cookie;
  //if (!rawCookie) return next(new Error('No cookie provided'));
  const cookies = rawCookie ? cookie.parse(rawCookie) : {};
  const token = cookies.token || socket.handshake.auth?.token;
  if (!token) {
    console.log('❌ 토큰 없음');
    return socket.disconnect(true);
  }

  // 2. 소켓별로 서버 소켓 객체 및 연결 상태 변수 초기화
  let serverSockets = { unified: null };
  let socketConnected = { unified: false };

  try {
    // 3. 토큰 인증 및 세션 생성
    const { userInfo, sessionId } = await authenticateAndCreateSession(token);
    console.log('✅ 인증 성공:', userInfo);

    // 3-1. ICE 서버 토큰 생성(TURN 서버용)
    const client = twilio(accountSid, authToken);
    let turnToken = null;

    try {
      turnToken = await client.tokens.create();
      console.log('ICE Servers:', turnToken.iceServers);
    } catch (error) {
      console.error('TURN 서버 토큰 생성 Error:', error);
      // TURN 서버 토큰 생성 실패 시에도 기본 STUN 서버 제공
      turnToken = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };
    }

    // 4. 세션 ID를 클라이언트에 전달
    socket.emit('session_created', {
      type: 'session_id',
      turnToken,
      sessionId,
      message: `세션 생성 완료: ${sessionId}`,
    });

    // 5. GPU 서버(영상/음성)와 WebSocket 연결
    await connectToAiServers(sessionId, serverSockets);

    // 6. AI 서버 → 클라이언트 시그널 메시지 전달 설정
    bindServerSocketEvents(socket, serverSockets);

    // 7. 클라이언트와 WebRTC 시그널링 처리
    bindWebRTCEvents(socket, serverSockets, socketConnected, sessionId, cleanUpConnections);
  } catch (err) {
    console.error('❌ 오류:', err.message);

    // 오류 발생 시 소켓 및 서버 소켓 정리
    cleanUpConnections(socket, serverSockets);
  }

  // 8. 클라이언트 소켓 연결 해제 이벤트
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 종료:', socket.id);
  });
};

// --- 모듈 export ---
/**
 * 클라이언트 소켓 연결 핸들러를 외부로 내보냅니다.
 * @exports {Function} handleSocketConnection
 */
module.exports = { handleSocketConnection };
