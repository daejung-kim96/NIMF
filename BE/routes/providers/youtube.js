/**
 * 유튜브 OAuth 연동 및 스트림 조회 라우터
 * @module routes/providers/youtube
 * @author DJ
 * @date 2025-08-07
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config(); // .env 로드

// 환경변수
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const FRONTEND_URL = process.env.CLIENT_BASE_URL;

/**
 * 유튜브 OAuth 로그인 페이지로 리디렉션
 * @route GET /auth/youtube
 */
router.get('/', (req, res) => {
  const authURL =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&response_type=code` +
    `&scope=https://www.googleapis.com/auth/youtube.readonly` +
    `&access_type=online` +
    `&prompt=consent`;

  return res.redirect(authURL);
});

/**
 * OAuth 콜백 → access_token 발급 → 유튜브 스트림 리스트 조회
 * @route GET /auth/youtube/callback
 */
router.get('/callback', async (req, res) => {
  const code = req.query.code;

  try {
    // access_token 요청
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      },
    });

    const { access_token } = tokenRes.data;

    // 유튜브 스트림 조회
    const streamRes = await axios.get('https://www.googleapis.com/youtube/v3/liveStreams', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      params: {
        part: 'id,snippet,cdn,status',
        mine: true,
      },
    });

    const streams = streamRes.data.items || [];

    // 부모창에 메시지 전송 (팝업 종료)
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage(
              {
                type: 'YOUTUBE_STREAM_LIST',
                data: ${JSON.stringify(streams)}
              },
              '${FRONTEND_URL}'
            );
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[YouTube] OAuth 실패:', error.message);
    res.status(500).send('유튜브 인증 또는 스트림 조회 중 오류가 발생했습니다.');
  }
});

module.exports = router;
