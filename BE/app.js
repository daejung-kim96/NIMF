/**
 * Express 애플리케이션 설정
 * @module app
 * @author joon hyeok
 * @date 2025-07-22
 */

// --- 의존성 require ---
const express = require('express');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

// --- Express 애플리케이션 설정 ---

// Express 애플리케이션 인스턴스 생성
const app = express();
app.use(cookieParser());

/**
 * CORS 미들웨어 설정
 */
app.use(cors({
  origin: process.env.CLIENT_BASE_URL,  // ✅ 클라이언트 주소
  credentials: true                     // ✅ withCredentials 지원
}));

// JSON 파싱을 위한 미들웨어
app.use(express.json());

// 라우트 설정
app.use('/', routes);
app.use('/auth', authRoutes);
app.use('/user', userRoutes);

// --- 모듈 export ---
module.exports = app;
