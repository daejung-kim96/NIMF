/**
 * Socket.IO WebSocket 진입점 모듈
 * @module socket/index
 * @author joon hyeok
 * @date 2025-07-24
 */

const { handleSocketConnection } = require('./handler');

/**
 * Socket.IO 연결 이벤트 핸들러 등록
 * @function
 * @param {Object} io - Socket.IO 서버 인스턴스
 */
const handleConnection = (io) => {
  io.on('connection', handleSocketConnection);
};

module.exports = { handleConnection };
