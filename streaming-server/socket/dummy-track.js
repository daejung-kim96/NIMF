const wrtc = require('wrtc');

/**
 * 더미 오디오 트랙 생성
 * 빈 오디오 트랙을 생성합니다
 */
const createDummyAudioTrack = () => {
  console.log('더미 오디오 트랙 생성 중...');

  // 임시 PeerConnection 생성하여 transceiver에서 track 추출
  const pc = new wrtc.RTCPeerConnection();
  const transceiver = pc.addTransceiver('audio');
  const track = transceiver.receiver.track;

  // PeerConnection 정리하지 않고 track만 반환
  console.log('더미 오디오 트랙 생성 완료:', track.kind, track.id);
  return track;
};

/**
 * 더미 비디오 트랙 생성
 * 빈 비디오 트랙을 생성합니다
 */
const createDummyVideoTrack = () => {
  console.log('더미 비디오 트랙 생성 중...');

  // 임시 PeerConnection 생성하여 transceiver에서 track 추출
  const pc = new wrtc.RTCPeerConnection();
  const transceiver = pc.addTransceiver('video');
  const track = transceiver.receiver.track;

  // PeerConnection 정리하지 않고 track만 반환
  console.log('더미 비디오 트랙 생성 완료:', track.kind, track.id);
  return track;
};

module.exports = {
  createDummyAudioTrack,
  createDummyVideoTrack,
};
