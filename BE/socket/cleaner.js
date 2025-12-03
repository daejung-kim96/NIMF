/**
 * WebRTC 및 WebSocket 연결 정리 유틸리티
 * @module socket/cleaner
 * @author joon hyeok
 * @date 2025-07-24
 */

/**
 * 클라이언트 소켓 및 GPU 서버 소켓 정리
 * @function
 * @param {Socket} socket - 클라이언트 소켓
 * @param {Object} serverSockets - GPU 서버 소켓 목록 (video, audio)
 */
function cleanUpConnections(socket, serverSockets) {
  if (socket.connected) socket.disconnect();

  for (const target of Object.keys(serverSockets)) {
    try {
      serverSockets[target]?.close();
    } catch (err) {
      console.warn(`⚠️ ${target} 소켓 종료 실패:`, err.message);
    }
  }

  console.log("🔌 모든 소켓 연결 종료");
}

module.exports = { cleanUpConnections };
