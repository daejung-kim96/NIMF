/**
 * 사용자 관련 라우터
 * @module routes/user
 * @author joon hyeok
 * @date 2025-08-05
 */

// --- 의존성 require ---
const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios');
const router = express.Router();


/**
 * 사용자 정보 조회 API
 * @route GET /user
 * @middleware authMiddleware - 인증된 사용자만 접근 가능
 * @returns {Object} 사용자 정보 (이메일, 이름, 프로필 사진, 프리싱, 설정 등)
 */
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  let userInfo = await User.findById(userId);

  res.json({
    success: true,
    result: {
      email: userInfo.email,
      name: userInfo.name,
      first_name: userInfo.firstName,
      last_name: userInfo.lastName,
      picture: userInfo.picture,
      pricing: userInfo.pricing,
      setting: {
        video: userInfo.videoFilter,
        audio: userInfo.audioFilter,
      }
    }
  })
});


/**
 * 사용자 필터링 설정 업데이트 API
 * @route PUT /user/setting
 */
router.put('/setting', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { video, audio, sessionId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (video) user.videoFilter = video;
    if (audio) user.audioFilter = audio;

    await user.save();

    // DB 저장 성공 후 ->  AI 서버로 설정 전송
    try {
      const aiServerUrl = (process.env.AI_SERVER_URL || 'http://localhost:8000').replace(/\/ws$/, '');

      console.log("session_id: ", sessionId);

      await axios.post(`${aiServerUrl}/sessions/${sessionId}/filter`, {
        videoFilter: user.videoFilter,
        audioFilter: user.audioFilter
      }, {
        timeout: 5000, // 5초 타임아웃
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`AI 서버로 사용자 ${userId}의 설정이 성공적으로 전송되었습니다.`);
    } catch (aiError) {
      // AI 서버 전송 실패는 로그만 남기고 사용자 응답에는 영향 없음
      console.error('AI 서버 설정 전송 실패:', aiError.message);
      console.error('사용자 설정은 DB에 저장되었지만 AI 서버 동기화에 실패했습니다.');
    }

    res.json({
      success: true,
      message: '설정이 성공적으로 저장되었습니다.',
      setting: {
        video: user.videoFilter,
        audio: user.audioFilter
      }
    });
  } catch (err) {
    console.error('설정 저장 오류:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


/**
* 사용자 요금제 변경 API
* @route PUT /user/pricing
*/
router.put('/pricing', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { pricing } = req.body;

  // 허용 가능한 값
  const validPricing = [ 'free', 'pro', 'business' ];

  if (!pricing || !validPricing.includes(pricing)) {
    return res.status(400).json({
      success: false,
      message: '유효한 요금제를 지정해주세요. (free, pro, business)'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.pricing = pricing;
    await user.save();

    res.json({
      success: true,
      message: '요금제가 성공적으로 변경되었습니다.',
      pricing: user.pricing
    });
  } catch (err) {
    console.error('요금제 변경 오류:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});


// --- 모듈 export ---
module.exports = router;
