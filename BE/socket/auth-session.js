/**
 * 토큰 인증 및 세션 생성 유틸리티
 * @module socket/auth-session
 * @author joon hyeok
 * @date 2025-07-24
 */

const JwtUtil = require('../util/jwt-utils');
const SessionUtil = require('../util/session-utils');

/**
 * 토큰 인증 및 세션 생성
 * @async
 * @function
 * @param {string} token - 클라이언트가 보낸 JWT
 * @returns {Object} { userInfo, sessionId }
 * @throws 인증 실패 또는 세션 생성 실패
 */
async function authenticateAndCreateSession(token) {
  const userInfo = JwtUtil.extractUserInfo(token);
  const sessionId = await SessionUtil.createLiveSession(userInfo.userId);
  return { userInfo, sessionId };
}

module.exports = { authenticateAndCreateSession };
