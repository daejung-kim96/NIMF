/**
 * 구글 OAuth 인증 프로바이더
 * @module routes/providers/google
 * @author joon hyeok
 * @date 2025-07-30
 */

// --- 의존성 require ---
const express = require('express');
const router = express.Router();
const axios = require('axios');

const jwtUtil = require('../../util/jwt-utils');
const User = require('../../models/User');

// 상수 선언
const PROVIDER = 'google';

/**
 * 구글 OAuth 로그인 시작
 * 구글 인증 페이지로 리다이렉트하여 사용자 인증을 시작
 * @route GET /auth/google
 * @returns {void} 구글 OAuth 인증 페이지로 리다이렉트
 */
router.get('/', (req, res) => {
  const redirectUri = process.env.GOOGLE_LOGIN_ENDPOINT;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code', // authorization code 발급 요청
    scope: 'profile email', // 사용자의 profile, email 정보 접근 권한 요청
    access_type: 'online', // access token만 받기 (offline: refresh token도 함께 받기)
    prompt: 'consent', // 매 로그인마다 동의 화면 표시 (none: 기존 동의가 있으면 자동 로그인, login: 매번 다시 로그인 요구, select_account: 사용자 계정 선택 화면 항상 표시)
  });

  res.redirect(`${redirectUri}?${params.toString()}`);
});

/**
 * 구글 OAuth 콜백 처리
 * 구글 인증 완료 후 authorization code를 받아 사용자 정보를 조회하고 JWT 토큰을 발급
 * @route GET /auth/google/callback
 * @param {string} code - 구글에서 받은 authorization code
 * @returns {Object} 로그인 성공 시 JWT 토큰과 사용자 정보, 실패 시 에러 메시지
 */
router.get('/callback', async (req, res) => {
  console.log(req.query);
  const { code } = req.query;
  let isNewUser = false;

  try {
    // 1. 구글에 토큰 요청
    const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code',
      },
    });

    const { access_token } = data;
    console.log(`access_token: ${access_token}`);

    // 2. 구글에서 사용자 정보 가져오기
    const profile = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = profile.data;
    console.log(`user: ${JSON.stringify(user)}`);

    // 3. 해당 이메일을 가진 사용자 정보를 users 컬렉션에서 조회
    let loginUser = await User.findOne({
      provider: PROVIDER,
      providerId: user.id,
    });

    // 존재하지 않는 유저 -> 회원가입
    if (!loginUser) {
      isNewUser = true;

      const newUser = new User({
        email: user.email,
        name: user.name,
        firstName: user.given_name,
        lastName: user.family_name,
        picture: user.picture,
        provider: PROVIDER,
        providerId: user.id,
        lastLoginAt: new Date(),
      });

      loginUser = await newUser.save();
    } else {
      loginUser.lastLoginAt = new Date();
      await loginUser.save();
    }

    // 4. JWT 발급
    const token = jwtUtil.generateToken(
      {
        userId: loginUser._id,
        email: loginUser.email,
        name: loginUser.name,
      },
      {
        expiresIn: '2h',
      },
    );

    // 5. 쿠키 생성
    res.cookie("token", token, {
      httpOnly: true,               // JS 접근 불가 (XSS 방지지)
      // secure: true,                 // HTTPS 환경에서만 작동
      sameSite: "Strict",           // CSRF 방지
      maxAge: 1000 * 60 * 60 * 2    // 2시간
    })

    // 5. 프론트로 리디렉트
    const redirectUrl = `${process.env.CLIENT_BASE_URL}/oauth/callback?is_new_user=${isNewUser}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.log(`OAuth 오류: ${err}`);
    res.status(500).json({
      success: false,
      error: {
        code: 500,
        message: `OAuth 오류 발생: ${err.message}`,
      },
    });
  }
});

// --- 모듈 export ---
module.exports = router;
