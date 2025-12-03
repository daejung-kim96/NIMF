const wrtc = require('wrtc');
const {
  nonstandard: { RTCVideoSink, RTCAudioSink },
} = require('wrtc');
const { spawn } = require('child_process');

const { sessionToPeers, sessionToStream } = require('./handler');
const FrameBuffer = require('./frame-buffer');
const FrameProcessor = require('./frame-processor');

const handleStream = (sessionId, streamKey, platform) => {
  console.log(`📡 스트리밍 요청 수신: ${sessionId} → ${platform}`);

  const streamInfo = sessionToStream.get(sessionId);

  if (!streamInfo) {
    console.error(`❌ 세션 정보 없음: ${sessionId}`);
    return { success: false, message: '세션을 찾을 수 없습니다' };
  }

  if (!streamInfo.isStreamReady) {
    console.error(`❌ 스트림 준비 안됨: ${sessionId}`);
    return { success: false, message: 'WebRTC 스트림이 준비되지 않았습니다' };
  }

  if (streamInfo.isStreaming) {
    console.warn(`⚠️  이미 스트리밍 중: ${sessionId}`);
    return { success: false, message: '이미 스트리밍 중입니다' };
  }

  // FFmpeg 스트리밍 시작 (실제 프레임 크기 사용)
  console.log(`🚀 FFmpeg 스트리밍 시작: ${sessionId}`);
  const ffmpegProcess = startFFmpegStreaming(sessionId, streamKey, 640, 360);

  if (ffmpegProcess) {
    // 저장된 트랙을 사용하여 FFmpeg와 연결
    handleTracks(ffmpegProcess, streamInfo.videoTrack, streamInfo.audioTrack);

    // 스트림 정보 업데이트
    streamInfo.streamKey = streamKey;
    streamInfo.platform = platform;
    streamInfo.ffmpegProcess = ffmpegProcess;
    streamInfo.isStreaming = true;
    sessionToStream.set(sessionId, streamInfo);

    console.log(`✅ 스트리밍 시작 완료: ${sessionId} → ${platform}`);
    return { success: true, message: '스트리밍이 시작되었습니다' };
  } else {
    console.error(`❌ FFmpeg 시작 실패: ${sessionId}`);
    return { success: false, message: 'FFmpeg 시작에 실패했습니다' };
  }
};

function startFFmpegStreaming(sessionId, streamKey, width, height) {
  const rtmpUrl = `rtmps://a.rtmp.youtube.com/live2/${streamKey}`;

    const ffmpegProcess = spawn('ffmpeg', [
        '-y',
        // 비디오 입력 (raw I420)
        '-f', 'rawvideo',
        '-pix_fmt', 'yuv420p',
                 '-s', '1280x720',  // 실제 입력 해상도와 일치
         '-r', '30',        // 프레임레이트 30fps로 증가
        '-i', 'pipe:3',
        // 오디오 입력 (s16le)
        '-f', 's16le',
                 '-ar', '48000',    // 샘플레이트 48kHz로 복원
        '-ac', '1',        // 모노로 변경 (처리 부담 감소)
        '-i', 'pipe:4',
                 // YouTube 스트리밍 최적화 인코딩 옵션
         '-c:v', 'libx264', 
         '-preset', 'ultrafast',  // 최대 속도 우선
         '-tune', 'zerolatency',  // 실시간 스트리밍 최적화
         '-pix_fmt', 'yuv420p', 
         '-g', '30',  // GOP 크기 증가 (1초)
         '-keyint_min', '30',  // 키프레임 간격 증가
         '-sc_threshold', '0',  // 씬 변화 감지 비활성화
         '-x264-params', 'nal-hrd=cbr:force-cfr=1:no-scenecut=1:ref=1:bframes=0:me=dia:subme=0:trellis=0',  // 극한 속도 최적화
         '-b:v', '2000k',  // 비트레이트 증가
         '-minrate', '1500k',  // 최소 비트레이트 증가
         '-maxrate', '2500k',  // 최대 비트레이트 증가
         '-bufsize', '5000k',  // 버퍼 크기 대폭 증가
        '-c:a', 'aac', 
        '-b:a', '128k',   // YouTube 권장 오디오 비트레이트
        '-ar', '48000',
        '-f', 'flv', rtmpUrl
      ]
    , {
        stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe']
    });

  return ffmpegProcess;
}

function handleTracks(ffmpegProcess, videoTrack, audioTrack) {
    const videoSink = new RTCVideoSink(videoTrack);
    const audioSink = new RTCAudioSink(audioTrack);
    
    // FFmpeg 프로세스 상태 및 에러 모니터링
    let logCount = 0;
    let ffmpegExited = false;
    
    ffmpegProcess.stderr.on('data', (data) => {
        const logStr = data.toString();
        
        // 에러 메시지 체크
        if (logStr.toLowerCase().includes('error') || logStr.toLowerCase().includes('failed')) {
            console.error(`❌ FFmpeg 에러 로그: ${logStr.trim()}`);
        }
        
        // 성능 지표 주기적 로깅
        if (logStr.includes('fps=') && logCount % 3 === 0) {
            console.log(`📊 FFmpeg 성능: ${logStr.trim()}`);
        }
        logCount++;
    });
    
    ffmpegProcess.on('close', (code, signal) => {
        ffmpegExited = true;
        console.log(`🛑 FFmpeg 종료: 코드 ${code}, 시그널: ${signal}`);
        if (code !== 0 && code !== null) {
            console.error(`❌ FFmpeg 비정상 종료: 코드 ${code}`);
        }
    });
    
    ffmpegProcess.on('error', (err) => {
        ffmpegExited = true;
        console.error(`❌ FFmpeg 프로세스 에러:`, err);
    });
    
    // 파이프 에러 핸들링
    const handlePipeError = (err, pipeName) => {
        if (err.code === 'EPIPE' && ffmpegExited) {
            console.log(`📡 ${pipeName} 파이프 정상 종료 (FFmpeg 종료됨)`);
        } else {
            console.error(`❌ ${pipeName} 파이프 에러:`, err);
        }
    };
    
    ffmpegProcess.stdio[3].on('error', (err) => handlePipeError(err, '비디오'));
    ffmpegProcess.stdio[4].on('error', (err) => handlePipeError(err, '오디오'));

         // 안정적인 30fps 스트림을 위한 프레임 패딩 시스템
     let frameCount = 0;
     let processedFrames = 0;
     let lastValidFrame = null;
     let lastSendTime = Date.now();
     
     // 30fps 안정적 전송을 위한 타이머 (33ms 간격)
     const frameTimer = setInterval(() => {
         if (ffmpegExited || !ffmpegProcess.stdio[3] || ffmpegProcess.stdio[3].destroyed) {
             clearInterval(frameTimer);
             return;
         }
         
         // 유효한 프레임이 있으면 전송 (새 프레임이거나 마지막 프레임 반복)
         if (lastValidFrame) {
             try {
                 // 동기 쓰기로 복원하여 안정성 확보
                 ffmpegProcess.stdio[3].write(lastValidFrame);
                 processedFrames++;
                 
                 // 상태 로깅 (300프레임마다 = 10초)
                 if (processedFrames % 300 === 0) {
                     console.log(`📊 프레임 전송: 수신=${frameCount}, 전송=${processedFrames}, 패딩률=${((processedFrames - frameCount) / processedFrames * 100).toFixed(1)}%`);
                 }
             } catch (err) {
                 if (err.code !== 'EPIPE') {
                     console.error(`❌ 프레임 전송 에러:`, err);
                 }
             }
         }
     }, Math.floor(1000/30)); // 정확히 30fps
    
    videoSink.onframe = ({frame}) => {
        frameCount++;
        
        try {
            // 프레임 데이터 검증
            if (!frame.data || frame.data.length === 0) {
                console.warn(`⚠️ 빈 프레임 데이터 (프레임 #${frameCount})`);
                return;
            }
            
            const videoBuffer = Buffer.isBuffer(frame.data) ? frame.data : Buffer.from(frame.data);
            
            // 예상 크기 검증 (1280x720 YUV420P = 1382400 bytes)
            const expectedSize = 1280 * 720 * 1.5;
            if (videoBuffer.length !== expectedSize) {
                console.warn(`⚠️ 비정상 프레임 크기: ${videoBuffer.length}, 예상: ${expectedSize}`);
                return;
            }
            
            // 새로운 유효 프레임을 버퍼에 저장
            lastValidFrame = videoBuffer;
            
            // 처음 3프레임만 정보 로깅
            if (frameCount <= 3) {
                console.log(`📹 프레임 #${frameCount} 수신:`, {
                    width: frame.width,
                    height: frame.height,
                    format: frame.format,
                    dataLength: videoBuffer.length
                });
            }
            
        } catch (err) {
            console.error(`❌ 프레임 처리 에러:`, err);
        }
    }
    
    // 정리 함수
    const cleanup = () => {
        if (frameTimer) {
            clearInterval(frameTimer);
        }
    };
    
    // FFmpeg 종료 시 타이머 정리
    ffmpegProcess.on('close', cleanup);
    ffmpegProcess.on('error', cleanup);
    
    // 정리는 기본 이벤트 핸들러에서 처리

    // 오디오 데이터 처리 - 직접 전송
    audioSink.ondata = (data) => {
        // FFmpeg 프로세스와 파이프가 살아있는지 확인
        if (!ffmpegExited && ffmpegProcess.stdio[4] && !ffmpegProcess.stdio[4].destroyed) {
            try {
                const audioBuffer = Buffer.from(data.samples.buffer, data.samples.byteOffset, data.samples.byteLength);
                // 동기 쓰기로 복원하여 안정성 확보
                ffmpegProcess.stdio[4].write(audioBuffer);
            } catch (err) {
                if (err.code !== 'EPIPE') {
                    console.error(`❌ 오디오 데이터 쓰기 에러:`, err);
                }
            }
        }
    }
    
    // 트랙 종료 이벤트
    videoTrack.onended = () => {
        videoSink.stop();
        if (ffmpegProcess) ffmpegProcess.stdio[3].end();
    };
    
    audioTrack.onended = () => {
        audioSink.stop();
        if (ffmpegProcess) ffmpegProcess.stdio[4].end();
    };
}

module.exports = { handleStream, startFFmpegStreaming };
