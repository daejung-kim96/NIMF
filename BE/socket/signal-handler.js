/**
 * GPU 서버 → 클라이언트로의 시그널 메시지 전송 처리
 * @module socket/signal-handler
 * @author joon hyeok
 * @date 2025-07-24
 */

/**
 * GPU 서버에서 오는 메시지를 클라이언트에게 전달하는 핸들러 등록
 * @function
 * @param {Socket} socket - 클라이언트 소켓
 * @param {Object} serverSockets - GPU 서버 소켓 목록 (video, audio)
 */
function bindServerSocketEvents(socket, serverSockets) {
  for (const target of Object.keys(serverSockets)) {
    serverSockets[ target ]?.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg);
        socket.emit("signal-from-ai", {
          target: "unified",  // 통합 서버로 변경되어 target은 항상 unified
          signal: parsed.signal
        });
      } catch (err) {
        console.error(`❌ ${target} 메세지 처리 오류:`, err.message);
      }
    });
  }
}

module.exports = { bindServerSocketEvents };
