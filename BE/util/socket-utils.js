/**
 * 소켓 관리 유틸리티
 * @module util/socket-utils
 * @author joon hyeok
 * @date 2025-07-25
 */

// --- 의존성 require ---
const WebSocket = require('ws');
const { getUserFiltersBySessionId } = require('./session-utils');


/**
 * GPU 서버와의 WebSocket 연결 생성
 * @param {string} sessionId - 세션 ID
 * @param {string} serverUrl - GPU 서버 WebSocket URL
 * @returns {WebSocket} 생성된 WebSocket 연결 객체
 */
const createAiServerSocket = (sessionId, serverUrl) => {
    // 웹소켓 연결 요청
    const socket = new WebSocket(serverUrl);

    // 웹소켓 연결 완료 이벤트 리스너
    socket.on('open', async () => {
        console.log('✅ GPU 서버에 연결됨');

        const userFilters = await getUserFiltersBySessionId(sessionId);
        if (userFilters) {
            // ✅ 디버깅 로그 추가
            console.log('🔍 전송할 필터 데이터:');
            console.log('  sessionId:', sessionId);
            console.log('  userFilters:', userFilters);
            console.log('  userFilters 타입:', typeof userFilters);
            console.log('  userFilters 키들:', Object.keys(userFilters));

            // 연결 후 세션 정보 전송
            socket.send(JSON.stringify({
                type: 'session_id',
                sessionId: sessionId,
                filters: userFilters,
                message: `새로운 세션 생성: ${sessionId}`,
            }));
        }
    });

    // 클라이언트로부터 signal 수신
    socket.on("signal-from-client", ({ target, signal }) => {
        socket.send(JSON.stringify({
            type: "signal",
            target: target,
            signal: signal
        }))
    });

    // 웹소켓 연결 해제 이벤트 리스너
    socket.on('close', () => {
        console.log('�� GPU 서버 연결 해제됨');
    });

    return socket;
}

// --- 모듈 export ---
module.exports = {
    createAiServerSocket,
}