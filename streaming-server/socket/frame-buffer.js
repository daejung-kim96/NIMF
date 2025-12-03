// socket/frame-buffer.js - 프레임 버퍼링 전용 모듈

class FrameBuffer {
  constructor(ffmpegProcess, options = {}) {
    this.ffmpegProcess = ffmpegProcess;

    // 버퍼 설정 (고정값)
    this.frames = [];
    this.maxSize = options.maxSize || 8;
    this.minFrames = options.minFrames || 3;
    this.isOutputting = false;
    this.outputTimer = null;
    this.ffmpegExited = false;
    this.lastLoggedFps = null; // 로그 중복 방지용
    this.lastFrame = null; // 프레임 복제용

    // 통계
    this.stats = {
      inputCount: 0,
      outputCount: 0,
      droppedCount: 0,
      startTime: Date.now(),
    };
  }

  // 프레임 추가
  addFrame(processedFrame) {
    if (this.frames.length >= this.maxSize) {
      this.frames.shift();
      this.stats.droppedCount++;
      console.warn(
        `[FrameBuffer] Overflow - dropped frame (${this.frames.length}/${this.maxSize})`,
      );
    }

    this.frames.push(processedFrame);
    this.stats.inputCount++;

    if (!this.isOutputting && this.frames.length >= this.minFrames) {
      this.startOutput();
    }
  }

  // ✅ 고정 25fps 출력 간격 계산
  getAdaptiveInterval() {
    return 40; // 25fps 고정 (40ms 간격)
  }

  // 30fps 출력 시작
  startOutput() {
    if (this.isOutputting) return;

    this.isOutputting = true;
    console.log(`🎬 [FrameBuffer] Starting 25fps output`);

    let expectedTime = Date.now();

    // ✅ 적응적 출력 함수
    const adaptiveOutput = () => {
      expectedTime += this.getAdaptiveInterval();

      if (this.frames.length > 0) {
        const frame = this.frames.shift();
        this.lastFrame = frame; // 마지막 프레임 저장
        this._writeFrame(frame);
      } else {
        // Underrun: 마지막 프레임 복제
        if (this.lastFrame) {
          this._writeFrame(this.lastFrame);
          console.warn(`[FrameBuffer] Duplicating last frame (underrun)`);
        } else {
          console.warn(`[FrameBuffer] Underrun - no frames available`);
        }
      }

      // 드리프트 체크 및 필요시 리셋
      if (this._checkDrift(expectedTime)) {
        expectedTime = Date.now(); // 큰 드리프트 발생시 타이머 리셋
      }

      // 다음 실행 예약 (동적 간격)
      if (this.isOutputting) {
        this.outputTimer = setTimeout(adaptiveOutput, this.getAdaptiveInterval());
      }
    };

    this.outputTimer = setTimeout(adaptiveOutput, this.getAdaptiveInterval());
  }

  // 출력 중지
  stopOutput() {
    if (this.outputTimer) {
      clearTimeout(this.outputTimer);
      this.outputTimer = null;
      this.isOutputting = false;
      this.lastLoggedFps = null;
      console.log(`🛑 [FrameBuffer] Output stopped`);
    }
  }

  // FFmpeg에 프레임 전송
  _writeFrame(frame) {
    try {
      if (
        !this.ffmpegExited &&
        this.ffmpegProcess.stdio[3] &&
        !this.ffmpegProcess.stdio[3].destroyed
      ) {
        this.ffmpegProcess.stdio[3].write(frame);
        this.stats.outputCount++;
      }
    } catch (err) {
      if (err.code !== 'EPIPE') {
        console.error(`[FrameBuffer] Write error:`, err);
      }
    }
  }

  // 드리프트 체크 및 리셋
  _checkDrift(expectedTime) {
    const drift = Date.now() - expectedTime;
    if (Math.abs(drift) > 50) {
      console.warn(`[FrameBuffer] Large drift detected: ${drift.toFixed(1)}ms - RESETTING timer`);
      return true; // 리셋 신호
    } else if (Math.abs(drift) > 10) {
      console.warn(`[FrameBuffer] Drift: ${drift.toFixed(1)}ms`);
    }
    return false; // 정상
  }

  // 상태 조회
  getStatus() {
    const runtime = (Date.now() - this.stats.startTime) / 1000;
    return {
      level: `${this.frames.length}/${this.maxSize}`,
      utilization: `${((this.frames.length / this.maxSize) * 100).toFixed(1)}%`,
      inputFps: runtime > 0 ? (this.stats.inputCount / runtime).toFixed(1) : '0',
      outputFps: runtime > 0 ? (this.stats.outputCount / runtime).toFixed(1) : '0',
      dropRate:
        this.stats.inputCount > 0
          ? `${((this.stats.droppedCount / this.stats.inputCount) * 100).toFixed(1)}%`
          : '0%',
    };
  }

  // FFmpeg 종료 알림
  notifyFFmpegExit() {
    this.ffmpegExited = true;
    this.stopOutput();
  }

  // 정리
  cleanup() {
    this.stopOutput();
    this.frames = [];
  }
}

module.exports = FrameBuffer;
