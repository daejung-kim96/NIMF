/**
 * 인증 관련 라우터
 * @module routes/auth
 * @author joon hyeok
 * @date 2025-07-30
 */

// --- 의존성 require ---
const express = require('express');
const router = express.Router();

const googleProvider = require('./providers/google');
//유튜브 스트림키 전용 api 라우터
const youtubeProvider = require('./providers/youtube');

/**
 * 로그인 라우터
 * 지원하는 provider에 따라 적절한 OAuth 로그인 페이지로 리다이렉트
 * @route GET /auth/login
 * @param {string} provider - 로그인 제공자 (google, facebook, kakao 등)
 * @returns {Object} 400 에러 또는 해당 프로바이더로 리다이렉트
 */
router.get('/login', (req, res) => {
  console.log('login 라우터 진입');
  const { provider } = req.query;

  switch (provider) {
    case 'google':
      console.log('provider : google');
      const baseUrl = `${process.env.SERVER_BASE_URL}`;
      return res.redirect(`${baseUrl}/auth/google`);
    default:
      return res.status(400).json({
        success: false,
        error: { code: 400, message: '지원하지 않는 provider 입니다.' },
      });
  }
});

// --- provider 라우터로 연결 ---

// 구글 OAuth 라우터 연결
router.use('/google', googleProvider);
// 유튜브 스트림키 전용 API 라우터 연결
router.use('/youtube', youtubeProvider);

// --- 모듈 export ---
module.exports = router;
