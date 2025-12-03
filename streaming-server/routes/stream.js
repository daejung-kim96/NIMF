// stream.js
// streaming 관련 API 라우터 정의
// Author: Junghyun Park
// Date: 2025-08-07

// TODO(Junghyun Park, 2025-08-08): webRTC로 받은 영상 송출 start router 필요

const express = require('express');
const { spawn } = require('child_process');
const os = require('os');
const router = express.Router();
const path = require('path');
const {
  RTCPeerConnection,
  nonstandard: { RTCAudioSink, RTCVideoSink },
} = require('wrtc');

const { handleStream } = require('../socket/stream-handler');
const { sessionToStream } = require('../socket/handler');

const isWindows = os.platform() === 'win32';

const ffmpegPath = isWindows ? path.resolve(__dirname, '../bin/ffmpeg.exe') : 'ffmpeg'; // ffmpeg를 서버에 다운받지 않아도 exe로 굴러감, linux의 경우 달라져야함

// const ffmpegProcess = spawn(ffmpegPath, [...]);
let ffmpegProcess = null;
const sessions = new Map(); // sessionId -> { pc, audioSink, videoSink, ffmpeg }

router.post('/start', (req, res) => {
  const { sessionId, streamKey, platform } = req.body;
  console.log('🧪 등록된 세션 목록:', [...sessionToStream.keys()]);
  if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });
  if (!streamKey) return res.status(400).json({ success: false, message: 'streamKey is required' });

  console.log(`📡 스트리밍 시작 요청: ${sessionId}, ${platform || 'youtube'}`);

  const result = handleStream(sessionId, streamKey, platform || 'youtube');

  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

// --- POST / stop ---
module.exports = router;

// --- WebRTC 수신 → FFmpeg 파이프 → RTMP 송출 ---
// router.post('/webrtc/init', async (req, res) => {
//   const { streamKey, sessionId } = req.body || {};
//   if (!streamKey) return res.status(400).json({ error: 'streamKey is required' });
//   if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

//   // 기존 세션이 존재하면 정리 후 재수립
//   const existing = sessions.get(sessionId);
//   if (existing) {
//     console.log(`[webrtc][${sessionId}] existing session detected. Recycling...`);
//     try { existing.pc && existing.pc.close(); } catch {}
//     try { existing.ffmpeg && existing.ffmpeg.kill('SIGINT'); } catch {}
//     sessions.delete(sessionId);
//   }

//   const rtmpUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

//   // 1) FFmpeg 프로세스 생성 (stdin으로 raw frames 입력)
//   const args = [
//     '-y',
//     // 비디오 입력 (raw I420)
//     '-f', 'rawvideo',
//     '-pix_fmt', 'yuv420p',
//     '-s', '1280x720',
//     '-r', '30',
//     '-i', 'pipe:3',
//     // 오디오 입력 (s16le)
//     '-f', 's16le',
//     '-ar', '48000',
//     '-ac', '1',
//     '-i', 'pipe:4',
//     // 저지연 인코딩 옵션
//     '-c:v', 'libx264',
//     '-preset', 'ultrafast',  // veryfast -> ultrafast로 변경
//     '-tune', 'zerolatency',   // 지연 최소화
//     '-pix_fmt', 'yuv420p',
//     '-g', '30',              // GOP 크기 줄임 (60 -> 30)
//     '-keyint_min', '30',     // 최소 키프레임 간격
//     '-sc_threshold', '0',    // 장면 변화 감지 비활성화
//     '-bufsize', '512k',      // 버퍼 크기 최소화
//     '-maxrate', '2500k',     // 최대 비트레이트 제한
//     '-b:v', '2000k',         // 비디오 비트레이트 고정
//     '-vsync', 'cfr',         // Constant Frame Rate 강제
//     '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
//     '-f', 'flv', rtmpUrl
//   ];

//   const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] });
//   ff.stdout.on('data', (d) => console.log(`[ffmpeg stdout][${sessionId}] ${d}`));
//   ff.stderr.on('data', (d) => console.error(`[ffmpeg stderr][${sessionId}] ${d}`));
//   ff.on('close', (code) => {
//     console.log(`[ffmpeg][${sessionId}] exited with code ${code}`);
//     const sess = sessions.get(sessionId);
//   });

//   // 2) WebRTC PeerConnection 생성 (영상/음성 수신)
//   const pc = new RTCPeerConnection({});

//   // --- WebRTC 상태 로깅 ---
//   const logPrefix = `[webrtc][${sessionId}]`;
//   pc.onconnectionstatechange = () => {
//     console.log(`${logPrefix} connection: ${pc.connectionState} | ICE: ${pc.iceConnectionState} | Gathering: ${pc.iceGatheringState}`);
//     if (pc.connectionState === 'failed') {
//       console.error(`${logPrefix} connection failed`);
//     }
//     if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
//       const sess = sessions.get(sessionId);
//     }
//   };
//   pc.oniceconnectionstatechange = () => {
//     console.log(`${logPrefix} ICE connection state: ${pc.iceConnectionState}`);
//   };
//   pc.onicegatheringstatechange = () => {
//     console.log(`${logPrefix} ICE gathering state: ${pc.iceGatheringState}`);
//   };
//   pc.onicecandidate = (event) => {
//     const hasCandidate = !!(event && event.candidate);
//     console.log(`${logPrefix} ICE candidate: ${hasCandidate ? 'received' : 'null (end)'}`);
//   };

//   // 각 트랙에 대해 Sink 생성하여 raw frame을 ffmpeg stdin으로 전달
//   let videoSink = null;
//   let audioSink = null;

//   // 세션 초기 엔트리 준비 (티커/버퍼 포함)
//   sessions.set(sessionId, {
//     pc,
//     audioSink: null,
//     videoSink: null,
//     ffmpeg: ff,
//   });

//   pc.ontrack = (event) => {
//     const [track] = event.streams.length ? event.streams[0].getTracks() : [event.track];
//     const kind = event.track.kind;
//     console.log(`📥 [${sessionId}] track received: ${kind}`);

//     if (kind === 'video') {
//       videoSink = new RTCVideoSink(event.track);
//       const targetFps = 30;  // FFmpeg와 동일하게 30fps로 설정
//       const intervalMs = Math.floor(1000 / targetFps);  // 33.33ms

//       let frameCounter = 0;
//       let lastWriteTime = Date.now();

//       videoSink.onframe = ({ frame }) => {
//         try {
//           const sess = sessions.get(sessionId);
//           if (!sess) return;

//           // Otherwise, compose from planes (y/u/v) with stride
//           const { width, height } = frame || {};
//           const y = frame && (frame.y || frame.Y || frame.planeY);
//           const u = frame && (frame.u || frame.U || frame.planeU);
//           const v = frame && (frame.v || frame.V || frame.planeV);
//           const strideY = frame && (frame.strideY || frame.stride || frame.linesizeY || width);
//           const strideU = frame && (frame.strideU || frame.linesizeU || Math.floor(width / 2));
//           const strideV = frame && (frame.strideV || frame.linesizeV || Math.floor(width / 2));

//           if (!width || !height || !y || !u || !v) {
//             throw new Error('Unsupported frame format from wrtc');
//           }

//           const ySize = width * height;
//           const uvWidth = Math.floor(width / 2);
//           const uvHeight = Math.floor(height / 2);
//           const uSize = uvWidth * uvHeight;
//           const vSize = uvWidth * uvHeight;

//           const out = Buffer.allocUnsafe(ySize + uSize + vSize);
//           // Copy Y plane
//           for (let row = 0; row < height; row++) {
//             const srcStart = row * strideY;
//             const dstStart = row * width;
//             const rowSlice = y.subarray ? y.subarray(srcStart, srcStart + width) : y.slice(srcStart, srcStart + width);
//             out.set(rowSlice, dstStart);
//           }
//           // Copy U plane
//           let offset = ySize;
//           for (let row = 0; row < uvHeight; row++) {
//             const srcStart = row * strideU;
//             const rowSlice = u.subarray ? u.subarray(srcStart, srcStart + uvWidth) : u.slice(srcStart, srcStart + uvWidth);
//             out.set(rowSlice, offset + row * uvWidth);
//           }
//           // Copy V plane
//           offset = ySize + uSize;
//           for (let row = 0; row < uvHeight; row++) {
//             const srcStart = row * strideV;
//             const rowSlice = v.subarray ? v.subarray(srcStart, srcStart + uvWidth) : v.slice(srcStart, srcStart + uvWidth);
//             out.set(rowSlice, offset + row * uvWidth);
//           }
//         } catch (e) {
//           console.error(`[${sessionId}] video frame process error:`, e);
//         }
//       };
//     } else if (kind === 'audio') {
//       audioSink = new RTCAudioSink(event.track);
//       audioSink.ondata = ({ samples }) => {
//         try {
//           const buf = samples.buffer || samples.data;
//           if (buf) {
//             ff.stdio[4].write(Buffer.from(buf));
//           }
//         } catch (e) {
//           console.error(`[${sessionId}] audio write error:`, e);
//         }
//       };
//     }
//   };

//   const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
//   await pc.setLocalDescription(offer);

//   // 세션 엔트리 업데이트
//   const sess0 = sessions.get(sessionId) || {};
//   sessions.set(sessionId, { ...sess0, pc, audioSink, videoSink, ffmpeg: ff });

//   return res.json({ offer: { type: offer.type, sdp: offer.sdp } });
// });

// router.post('/webrtc/answer', async (req, res) => {
//   const { sessionId, answer } = req.body || {};
//   const sess = sessions.get(sessionId);
//   if (!sess) return res.status(404).json({ error: 'session not found' });

//   try {
//     await sess.pc.setRemoteDescription(answer);
//     return res.json({ status: 'ok' });
//   } catch (e) {
//     console.error('setRemoteDescription error:', e);
//     return res.status(500).json({ error: String(e) });
//   }
// });

router.post('/stop', (req, res) => {
  const { sessionId } = req.body;

  console.log(`🛑 스트리밍 종료 요청: ${sessionId}`);

  const streamInfo = sessionToStream.get(sessionId);

  // 1. streamInfo 존재 여부 확인
  if (!streamInfo) {
    console.log(`⚠️ 세션 정보 없음: ${sessionId}`);
    return res.status(400).send('세션 정보를 찾을 수 없음');
  }

  // 2. FFmpeg 프로세스 존재 여부 확인
  if (!streamInfo.ffmpegProcess) {
    console.log(`⚠️ FFmpeg 프로세스 없음: ${sessionId}`);
    return res.status(400).send('송출 중이 아님');
  }

  // 3. 이미 종료된 프로세스인지 확인
  if (streamInfo.ffmpegProcess.killed) {
    console.log(`⚠️ FFmpeg 프로세스 이미 종료됨: ${sessionId}`);
    streamInfo.ffmpegProcess = null;
    return res.send('🛑 송출 이미 종료됨');
  }

  console.log(`🛑 FFmpeg 종료 중: ${sessionId}`);

  // 4. 정상 종료 시도
  streamInfo.ffmpegProcess.kill('SIGTERM');

  // 5. 강제 종료 타이머 설정
  const forceKillTimer = setTimeout(() => {
    if (streamInfo.ffmpegProcess && !streamInfo.ffmpegProcess.killed) {
      console.log(`🔴 FFmpeg 강제 종료: ${sessionId}`);
      streamInfo.ffmpegProcess.kill('SIGKILL');
    }
  }, 5000);

  // 6. 프로세스 종료 이벤트 리스너
  streamInfo.ffmpegProcess.once('exit', (code, signal) => {
    console.log(`✅ FFmpeg 종료 완료: ${sessionId} (코드: ${code}, 시그널: ${signal})`);
    clearTimeout(forceKillTimer); // 타이머 정리
    streamInfo.ffmpegProcess = null;
    streamInfo.streamKey = null;
    streamInfo.platform = null;
    streamInfo.isStreaming = false;
  });

  return res.send('🛑 송출 종료 중...');
});

router.get('/debug/sessions', (req, res) => {
  const { sessionToStream } = require('../socket/session-store');
  res.json([...sessionToStream.keys()]);
});
