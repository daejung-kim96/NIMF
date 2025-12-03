const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = path.resolve(__dirname, '../bin/ffmpeg.exe');

/**
 * 시스템 기본 영상/오디오 장치를 자동 선택해서 반환
 * @returns {Promise<{video: string|null, audio: string|null}>}
 */
function getDefaultDevices() {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', () => {
      const lines = stderr.split('\n');
      const videoDevices = [];
      const audioDevices = [];

      let currentType = null;

      for (const line of lines) {
        const match = line.match(/"(.+?)"\s+\((video|audio)\)/);
        if (match) {
        const name = match[1];
        const type = match[2];
        if (type === 'video') videoDevices.push(name);
        else if (type === 'audio') audioDevices.push(name);
        }
      }

      console.log('[파싱 결과]', {videoDevices, audioDevices});

      resolve({
        video: videoDevices[0] || null,
        audio: audioDevices[0] || null,
      });
    });

    proc.on('error', reject);
  });
}

module.exports = { getDefaultDevices };
