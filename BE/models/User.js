/**
 * 사용자 모델
 * @module models/User
 * @author joon hyeok
 * @date 2025-07-24
 */

// --- 의존성 require ---
const mongoose = require('mongoose');


// --- 사용자 스키마 정의 ---

/**
 * 사용자 스키마
 * @type {mongoose.Schema}
 * @description 사용자의 기본 정보와 필터 설정을 정의합니다.
 */
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  provider: { type: String },
  providerId: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  picture: { type: String },
  pricing: { type: String, enum: ['free', 'pro', 'business'], default: 'free' },

  videoFilter: {
    category: {
      smoke: { type: Boolean, default: false },
      drink: { type: Boolean, default: false },
      sharpObjects: { type: Boolean, default: false },
      flammables: { type: Boolean, default: false },
      firearms: { type: Boolean, default: false },
      exposure: { type: Boolean, default: false }
    },
    action: {
      filtering: { type: Boolean, default: false },
      alert: { type: Boolean, default: false },
      logging: { type: Boolean, default: false }
    }
  },

  audioFilter: {
    category: {
      profanity: {
        type: String,
        enum: ['low', 'mid', 'high'],
        default: null
      },
      hateSpeech: { type: Boolean, default: false },
      bannedWords: { type: [String], default: [] }
    },
    action: {
      filtering: { type: Boolean, default: false },
      alert: { type: Boolean, default: false },
      logging: { type: Boolean, default: false }
    }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  lastLoginAt: { type: Date },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false }
}, {
  timestamps: true
});


// provider, providerId 복합 유니크 인덱스 설정
userSchema.index({
  provider: 1,
  providerId: 1       
}, {
  unique: true,
  sparse: true,
});


/**
 * User 모델
 * @type {mongoose.Model}
 * @description 사용자 데이터를 데이터베이스에서 조작하기 위한 Mongoose 모델
 */
const User = mongoose.model('User', userSchema);


// --- 모듈 export ---

/**
 * 사용자 모델을 외부로 내보냅니다.
 * @exports {mongoose.Model} User - 사용자 모델
 */
module.exports = User;
