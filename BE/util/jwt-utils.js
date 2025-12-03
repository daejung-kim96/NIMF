/**
 * JWT 토큰 관리 유틸리티
 * @module util/jwt-utils
 * @author joon hyeok
 * @date 2025-07-25
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT 시크릿 키를 환경변수에서 가져오기
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * JWT 토큰 생성
 * @param {Object} payload - 토큰에 포함할 데이터
 * @param {string} payload.userId - 사용자 ID
 * @param {string} payload.email - 사용자 이메일
 * @param {string} payload.name - 사용자 이름
 * @param {string} payload.picture - 사용자 프로필 이미지
 * @param {Object} options - 토큰 옵션
 * @param {string} options.expiresIn - 토큰 만료 시간 (기본값: '24h')
 * @param {string} options.algorithm - 암호화 알고리즘 (기본값: 'HS256')
 * @returns {string} 생성된 JWT 토큰
 * @throws {Error} 토큰 생성에 실패한 경우
 */
const generateToken = (payload, options = {}) => {

  const defaultOptions = {
    expiresIn: '24h',
    algorithm: 'HS256'
  };

  const tokenOptions = { ...defaultOptions, ...options };

  try {
    const token = jwt.sign(payload, JWT_SECRET, tokenOptions);
    return token;
  } catch (error) {
    throw new Error(`토큰 생성 실패: ${error.message}`);
  }
};

/**
 * JWT 토큰 검증
 * @param {string} token - 검증할 JWT 토큰
 * @returns {Object} 검증된 토큰의 페이로드
 * @throws {Error} 토큰이 유효하지 않은 경우
 */
const verifyToken = (token) => {

  if (!token) {
    throw new Error('토큰이 제공되지 않았습니다.');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('토큰이 만료되었습니다.');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('유효하지 않은 토큰입니다.');
    } else {
      throw new Error(`토큰 검증 실패: ${error.message}`);
    }
  }
};

/**
 * JWT 토큰 디코딩 (검증 없이)
 * @param {string} token - 디코딩할 JWT 토큰
 * @returns {Object} 디코딩된 토큰의 페이로드
 * @throws {Error} 토큰 형식이 잘못된 경우
 */
const decodeToken = (token) => {
  if (!token) {
    throw new Error('토큰이 제공되지 않았습니다.');
  }

  try {
    const decoded = jwt.decode(token);
    if (!decoded) {
      throw new Error('토큰 디코딩에 실패했습니다.');
    }
    return decoded;
  } catch (error) {
    throw new Error(`토큰 디코딩 실패: ${error.message}`);
  }
};

/**
 * 토큰에서 사용자 정보 추출
 * @param {string} token - JWT 토큰
 * @param {boolean} verify - 토큰 검증 여부 (기본값: true)
 * @returns {{userId: string, email: string, name: string}} 사용자 정보
 * @throws {Error} 토큰이 유효하지 않거나 사용자 정보가 없는 경우
 */
const extractUserInfo = (token, verify = true) => {
  try {
    const payload = verify ? verifyToken(token) : decodeToken(token);
    
    const userInfo = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name
    };

    // 필수 필드 검증
    if (!userInfo.userId || !userInfo.email) {
      throw new Error('토큰에 필수 사용자 정보가 없습니다.');
    }

    return userInfo;
  } catch (error) {
    throw new Error(`사용자 정보 추출 실패: ${error.message}`);
  }
};

/**
 * 토큰 만료 시간 확인
 * @param {string} token - JWT 토큰
 * @returns {{isExpired: boolean, expiresAt: Date|null, remainingTime: number|null}} 만료 정보
 */
const checkTokenExpiration = (token) => {
  try {
    const payload = decodeToken(token);
    
    // exp 가 없는 토큰 -> 만료 시간이 없는 영구 토큰
    if (!payload.exp) {
      return {
        isExpired: false,
        expiresAt: null,
        remainingTime: null
      };
    }

    const expiresAt = new Date(payload.exp * 1000);
    const now = new Date();
    const remainingTime = expiresAt.getTime() - now.getTime();

    return {
      isExpired: remainingTime <= 0,
      expiresAt: expiresAt,
      remainingTime: remainingTime > 0 ? remainingTime : 0
    };
  } catch (error) {
    throw new Error(`토큰 만료 확인 실패: ${error.message}`);
  }
};

/**
 * 토큰 갱신 (기존 토큰의 페이로드를 사용하여 새 토큰 생성)
 * @param {string} token - 갱신할 JWT 토큰
 * @param {Object} options - 새 토큰 옵션
 * @returns {string} 갱신된 JWT 토큰
 * @throws {Error} 토큰이 유효하지 않은 경우
 */
const refreshToken = (token, options = {}) => {
  try {
    const payload = verifyToken(token);
    
    // 민감한 정보 제거
    const { iat, exp, ...cleanPayload } = payload;
    
    return generateToken(cleanPayload, options);
  } catch (error) {
    throw new Error(`토큰 갱신 실패: ${error.message}`);
  }
};

/**
 * HTTP 요청에서 토큰 추출
 * @param {Object} req - Express 요청 객체
 * @returns {string|null} 추출된 토큰 또는 null
 */
const extractTokenFromRequest = (req) => {
  // 1. Authorization 헤더에서 추출
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. 쿼리 파라미터에서 추출
  if (req.query.token) {
    return req.query.token;
  }

  // 3. 쿠키에서 추출
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // 4. 해당 사항 없음
  return null;
};

/**
 * JWT 미들웨어 (Express용)
 * @param {Object} options - 미들웨어 옵션
 * @param {boolean} options.required - 토큰 필수 여부 (기본값: true)
 * @param {boolean} options.attachUser - 사용자 정보를 req에 첨부 여부 (기본값: true)
 * @returns {Function} Express 미들웨어 함수
 */
const jwtMiddleware = (options = {}) => {
  const { required = true, attachUser = true } = options;

  return (req, res, next) => {
    try {
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        if (required) {
          return res.status(401).json({
            success: false,
            message: '인증 토큰이 필요합니다.'
          });
        }
        return next();
      }

      const userInfo = extractUserInfo(token, true);
      
      if (attachUser) {
        req.user = userInfo;
      }
      
      req.token = token;
      next();
    } catch (error) {
      if (required) {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }
      next();
    }
  };
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  extractUserInfo,
  checkTokenExpiration,
  refreshToken,
  extractTokenFromRequest,
  jwtMiddleware
}; 