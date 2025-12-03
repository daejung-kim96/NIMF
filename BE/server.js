/**
 * HTTP 서버 및 Socket.IO 서버 설정
 * @module server
 * @author joon hyeok
 * @date 2025-07-22
 */


// --- 의존성 require ---
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const { handleConnection } = require('./socket');
const { connectDB } = require('./config/database');


// --- 서버 설정 ---

// 서버 포트
const port = process.env.PORT;

// DB 연결 후 서버 시작
connectDB()
  .then(() => {
    // HTTP 서버 생성
    const server = http.createServer(app);

    // Socket.IO 서버 생성 (CORS 설정 추가)
    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_BASE_URL, // 클라이언트 도메인
        methods: ["GET", "POST"],
        credentials: true,  // 쿠키 전달 허용
      },
      path: "/socket.io",
      transports: ['polling', 'websocket'], // 명시적으로 transport 설정
      allowEIO3: true, // Socket.IO v3 클라이언트 호환성
      pingTimeout: 60000, // ping 타임아웃 설정
      pingInterval: 25000 // ping 간격 설정
    });

    // 소켓 이벤트 핸들러 설정
    handleConnection(io);

    // 서버 시작
    server.listen(port, () => {
      console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다.`);
    });
    
  }).catch((err) => {
    console.error('❌ DB 연결 실패로 서버 실행 중단:', err);
});
