const JwtUtil = require('../util/jwt-utils');

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "토큰 없음" });
  
    try {
        const userInfo = JwtUtil.extractUserInfo(token);
        req.user = userInfo; // ✅ 인증된 사용자 정보 저장
        next();
    } catch (err) {
        return res.status(401).json({ message: `유효하지 않은 토큰${err}` });
    }
};

module.exports = authMiddleware;