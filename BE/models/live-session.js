/**
 * 라이브 세션 모델
 * @module models/LiveSession
 * @author joon hyeok
 * @date 2025-07-24
 */

// --- 의존성 require ---
const mongoose = require('mongoose');


// --- 라이브 세션 스키마 정의 ---

/**
 * 라이브 세션 스키마
 * @type {mongoose.Schema}
 * @description 라이브 세션의 데이터 구조를 정의합니다.
 */
const liveSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, unique: true },
});

/**
 * LiveSession 모델
 * @type {mongoose.Model}
 * @description 라이브 세션 데이터를 데이터베이스에서 조작하기 위한 Mongoose 모델
 */
const LiveSession = mongoose.model('LiveSession', liveSessionSchema);


// --- 모듈 export ---
/**
 * 라이브 세션 모델을 외부로 내보냅니다.
 * @exports {mongoose.Model} LiveSession - 라이브 세션 모델
 */
module.exports = LiveSession;
