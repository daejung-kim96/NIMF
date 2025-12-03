/**
 * 세션 관리 유틸리티
 * @module util/session-utils
 * @author joon hyeok
 * @date 2025-07-25
 */

// --- 의존성 require ---
const crypto = require('crypto');

const LiveSession = require('../models/live-session');
const User = require('../models/User');

// 세션 저장소 (개발용 메모리 저장소, 프로덕션에서는 Redis 사용 권장)
// const sessionStore = new Map();

/**
 * 세션 ID 생성
 * @returns {string} 고유한 세션 ID
 */
const generateSessionId = () => {
    return `sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
};

/**
 * 세션 생성
 * @param {string} userId - 사용자 ID
 * @returns {string} 생성된 세션 ID
 */
const createLiveSession = async (userId) => {
    const newSession = new LiveSession({
        userId: userId,
        sessionId: generateSessionId(),
    });

    const savedSession = await newSession.save();
    const sessionId = savedSession.sessionId;
    console.log("saved sessionId : ", sessionId);

    return sessionId;
};

/**
 * 세션 조회
 * @param {string} sessionId - 세션 ID
 * @returns {Object|null} Mongoose 문서 객체 또는 null
 */
const getSession = async (sessionId) => {
    if (!sessionId) return null;

    const session = await LiveSession.findOne({ sessionId: sessionId });
    if (!session) return null;

    return session;
};



/**
 * 세션 삭제
 * @param {string} sessionId - 세션 ID
 * @returns {boolean} 삭제 성공 여부 (true: 성공, false: 실패)
 */
const destroySession = async (sessionId) => {
    try {
        const result = await LiveSession.deleteOne({ sessionId: sessionId });
        console.log(`세션 삭제 완료: sessionId=${sessionId}`);
        return true;
    } catch (err) {
        console.error(`세션 삭제 중 오류 발생: ${err.message}`);
        return false;
    }
};

/**
 * 세션 ID로 사용자 필터 설정 조회
 * @param {string} sessionId - 세션 ID
 * @returns {Object|null} 사용자 필터 설정 또는 null
 */
const getUserFiltersBySessionId = async (sessionId) => {
    try {
        // 1. sessionId로 LiveSession 조회하여 userId 가져오기
        const liveSession = await LiveSession.findOne({ sessionId: sessionId });
        if (!liveSession) {
            console.log(`❌ 세션 ID ${sessionId}에 해당하는 LiveSession을 찾을 수 없습니다.`);
            return null;
        }

        // 2. userId로 User 조회하여 필터 설정 가져오기
        const user = await User.findById(liveSession.userId);
        if (!user) {
            console.log(`❌ 사용자 ID ${liveSession.userId}에 해당하는 User를 찾을 수 없습니다.`);
            return null;
        }

        // 3. 필터 설정 반환
        const filters = {
            videoFilter: user.videoFilter,
            audioFilter: user.audioFilter,
            userId: user._id,
            email: user.email
        };

        console.log(`✅ 세션 ${sessionId}의 사용자 필터 설정 조회 완료:`, filters);
        return filters;

    } catch (error) {
        console.error(`❌ 세션 ${sessionId}의 필터 설정 조회 실패:`, error);
        return null;
    }
};


module.exports = {
    createLiveSession,
    getSession,
    destroySession,
    getUserFiltersBySessionId,
}; 