const bindPeerEvents = (peer, sessionId, socket) => {
  // handler.js에서 sessionToStream을 동적으로 가져오기 (순환 참조 해결)
  const { sessionToStream } = require('./handler');
  console.log(`WebRTC 이벤트 바인딩 시작: ${sessionId}`);

  // ICE candidate 이벤트 (AI 서버 형태와 동일)
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`ICE candidate 전송: ${sessionId}`);
      socket.emit('webrtc-signal', {
        sessionId,
        signal: {
          type: 'ice',
          candidate: {
            foundation: event.candidate.foundation,
            priority: event.candidate.priority,
            protocol: event.candidate.protocol,
            type: event.candidate.type,
            address: event.candidate.address,
            port: event.candidate.port,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        },
      });
    }
  };

  // 연결 상태 변경 이벤트
  peer.onconnectionstatechange = () => {
    console.log(`📶 WebRTC 연결 상태: ${sessionId} → ${peer.connectionState}`);
    if (peer.connectionState === 'connected') {
      console.log(`✅ WebRTC 연결 완료: ${sessionId}`);
    } else if (peer.connectionState === 'failed') {
      console.log(`❌ WebRTC 연결 실패: ${sessionId}`);
    }
  };

  // 트랙 수신 이벤트 (스트림 수신)
  let receivedTracks = { video: null, audio: null };

  peer.ontrack = (event) => {
    const track = event.track;
    const stream = event.streams[0];

    console.log(`📹 트랙 수신: ${sessionId}, 종류: ${track.kind}, ID: ${track.id}`);

    if (track.kind === 'video') {
      console.log(`🎥 비디오 트랙 활성화: ${sessionId}, 상태: ${track.readyState}`);
      // receivedTracks.video = new RTCVideoSink(track);
      receivedTracks.video = track;

      // 트랙 종료 이벤트
      track.onended = () => {
        console.log(`❌ 비디오 트랙 종료: ${sessionId}`);
      };
    } else if (track.kind === 'audio') {
      console.log(`🎥 오디오 트랙 활성화: ${sessionId}, 상태: ${track.readyState}`);
      // receivedTracks.audio = new RTCAudioSink(track);
      receivedTracks.audio = track;

      // 트랙 종료 이벤트
      track.onended = () => {
        console.log(`❌ 오디오 트랙 종료: ${sessionId}`);
      };
    }

    // 비디오와 오디오 트랙이 모두 수신되면 스트림 준비 완료 상태로 설정
    if (receivedTracks.video && receivedTracks.audio) {
      console.log(`🎬 모든 트랙 수신 완료 - 송출 준비됨: ${sessionId}`);

      // 세션에 트랙 정보 저장 (기존 정보 병합)
      const streamInfo = sessionToStream.get(sessionId) || {};
      streamInfo.isStreamReady = true;
      streamInfo.videoTrack = receivedTracks.video;
      streamInfo.audioTrack = receivedTracks.audio;
      streamInfo.mediaStream = stream;
      sessionToStream.set(sessionId, streamInfo);
      console.log(`📦 스트림 정보 저장 완료: ${sessionId}`);
    }
  };

  // 데이터 채널 이벤트 (필요시)
  peer.ondatachannel = (event) => {
    console.log(`데이터 채널 수신: ${sessionId}`);
  };

  // 완료 로깅
  console.log(`WebRTC 이벤트 바인딩 완료: ${sessionId}`);
};

module.exports = { bindPeerEvents };
