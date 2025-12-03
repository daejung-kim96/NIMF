/**
 * 메인 라우터
 * @module routes/index
 * @author joon hyeok
 * @date 2025-07-24
 */

// --- 의존성 require ---
const express = require('express');
const router = express.Router();

const User = require('../models/User');

// --- 라우트 ---

/**
 * 기본 라우트
 * @route GET /
 * @description 서버 상태 확인을 위한 기본 엔드포인트
 */
router.get('/', (req, res) => {
  res.json({ message: '시그널링 서버(Node.js) 실행중!' });
});



// --- 모듈 export --- 

/**
 * 라우터를 외부로 내보냅니다.
 * @exports {express.Router} router - Express 라우터
 */
module.exports = router; 