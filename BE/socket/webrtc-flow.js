/**
 * WebRTC 시그널링 및 연결 이벤트 처리
 * @module socket/webrtc-flow
 * @author joon hyeok
 * @date 2025-07-24
 */

/**
 * 클라이언트 소켓에 WebRTC 관련 이벤트 바인딩
 * @function
 * @param {Socket} socket - 클라이언트 소켓
 * @param {Object} serverSockets - GPU 서버 소켓들
 * @param {Object} socketConnected - 서버별 연결 여부 상태
 * @param {string} sessionId - 세션 ID
 * @param {Function} cleanUp - 연결 정리 함수
 */
function bindWebRTCEvents(socket, serverSockets, socketConnected, sessionId, cleanUp) {

    // 클라이언트 -> AI 서버 시그널 전달
    socket.on("signal-to-ai", ({ target, signal }) => {
      const message = JSON.stringify({ type: "webrtc", sessionId, target, signal });
      serverSockets[target]?.send(message);
    });
  
    // 클라이언트로부터 WebRTC 연결 완료됨을 전달받음
    socket.on("peer-connected", ({ target }) => {
      socketConnected[target] = true;
      console.log(`${target} 와 WebRTC 연결 완료`);
  
      // 모든 AI 서버와 연결이 완료되면 웹소켓 연결 해제
      if (Object.values(socketConnected).every(value => value === true)) {
        console.log("✅ 모든 AI 서버 연결 완료. 2초 후 종료 예정...");
        setTimeout(() => cleanUp(socket, serverSockets), 2000);
      }
    });

    // TODO: 클라이언트로부터 WebRTC 연결이 종료됨을 전달받음 -> 세션 삭제해야함
    socket.on("webrtc-disconnected", (data) => {
      // data에는 세션 아이디 포함 -> 해당 세션 mongodb에서 삭제하기
    })
  
    // webrtc 연결 시작 이벤트 전달
    socket.emit("start-webrtc");
  }
  
  module.exports = { bindWebRTCEvents };
  