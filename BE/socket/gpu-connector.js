/**
 * GPU 서버(WebSocket) 연결 유틸리티
 * @module socket/gpu-connector
 * @author joon hyeok
 * @date 2025-07-24
 */

const SocketUtil = require('../util/socket-utils');

// --- GPU 서버 주소 설정 ---
const aiServerUrl = process.env.AI_BASE_URL;

/**
 * GPU 서버들과의 WebSocket 연결을 수행
 * @async
 * @function
 * @param {string} sessionId - 세션 고유 ID
 * @param {Object} serverSockets - GPU 서버 소켓 저장 객체
 * @throws GPU 서버 연결 실패 시 에러 발생
 */
async function connectToAiServers(sessionId, serverSockets) {
  try {
    const [aiSocket] = await Promise.all([
      SocketUtil.createAiServerSocket(sessionId, aiServerUrl)
    ]);
    serverSockets.unified = aiSocket;
  } catch (err) {
    throw new Error("GPU 서버 연결 실패: " + err.message);
  }
}

module.exports = { connectToAiServers };
