"""
통합 WebRTC 피어 연결 생성 모듈
@module unified_peer
@author joon hyeok
@date 2025-01-08
@description 비디오와 오디오를 함께 처리하는 통합 WebRTC 피어 연결을 생성하고 관리합니다.
"""

import sys
import os

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from aiortc import RTCPeerConnection, RTCIceServer, RTCConfiguration
from aiortc.contrib.media import MediaRelay
from unified_track import UnifiedMediaTrack, VideoEchoTrack
from ai_audio.audio_processor import AudioProcessor
import config

from aiortc.contrib.media import MediaRelay

def create_unified_peer_connection(websocket, manager, session_id):
    """
    비디오와 오디오를 함께 처리하는 통합 WebRTC 피어 연결을 생성하고 설정합니다.
    
    @function create_unified_peer_connection
    @param {WebSocket} websocket - 클라이언트와의 WebSocket 연결
    @returns {RTCPeerConnection} 설정된 WebRTC 피어 연결 객체
    """
    # STUN/TURN 서버 설정 (NAT 트래버설용)
    ice_servers = [
        RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
        RTCIceServer(urls=["stun:stun1.l.google.com:19302"]),
        RTCIceServer(urls=["stun:stun2.l.google.com:19302"]),  # 추가 STUN 서버
    ]
    
    # Twilio TURN 서버 추가 (환경변수가 설정된 경우)
    account_sid, auth_token = config.config.get_twilio_credentials()
    if account_sid and auth_token:
        try:
            # Twilio TURN 서버 정보 추가
            # 실제 구현에서는 Twilio API를 호출하여 토큰을 생성해야 하지만,
            # 여기서는 기본 TURN 서버 URL을 사용
            ice_servers.extend([
                RTCIceServer(
                    urls=["turn:global.turn.twilio.com:3478?transport=udp"],
                    username=account_sid,
                    credential=auth_token
                ),
                RTCIceServer(
                    urls=["turn:global.turn.twilio.com:3478?transport=tcp"],
                    username=account_sid,
                    credential=auth_token
                ),
                RTCIceServer(
                    urls=["turn:global.turn.twilio.com:443?transport=tcp"],
                    username=account_sid,
                    credential=auth_token
                )
            ])
            print("✅ Twilio TURN 서버가 ICE 서버에 추가되었습니다.")
        except Exception as e:
            print(f"⚠️ Twilio TURN 서버 추가 실패: {e}")
    else:
        print("⚠️ Twilio 인증 정보가 설정되지 않아 TURN 서버를 사용할 수 없습니다.")
    
    configuration = RTCConfiguration(
        iceServers=ice_servers
        # bundlePolicy와 rtcpMuxPolicy는 aiortc에서 지원하지 않음
    )
    pc = RTCPeerConnection(configuration)

    # 사전 트랜시버 추가로 초기 SDP 방향성 안정화 (브라우저 offer의 sendrecv 대응)
    try:
        pc.addTransceiver("audio", direction="sendrecv")
    except Exception as e:
        print(f"transceiver(audio) 추가 실패: {e}")
    try:
        pc.addTransceiver("video", direction="sendrecv")
    except Exception as e:
        print(f"transceiver(video) 추가 실패: {e}")

    # 통합 미디어 트랙 처리기 생성
    unified_processor = UnifiedMediaTrack()
    
    # MediaRelay 생성 (안정적인 미디어 전송을 위해)
    relay = MediaRelay()
    
    @pc.on("track")
    def on_track(track):
        """
        미디어 트랙 수신 시 호출되는 이벤트 핸들러
        
        @param {MediaStreamTrack} track - 수신된 미디어 트랙
        """
        print(f"📥 통합 서버에서 수신된 트랙: {track.kind}")
        
        if track.kind == "audio":
            # print("🎧 오디오 트랙 수신: ", track)
            echo_track = AudioProcessor(track, session_id)

            # 음성 인식 시작
            echo_track.start_speech_recognition()

            # 클라이언트와 스트리밍 서버의 트랙 분리
            client_track = relay.subscribe(echo_track)
            streaming_track = relay.subscribe(echo_track)

            # 클라이언트 pc트랙 추가
            pc.addTrack(client_track)

            # 같은 트랙 저장 -> 스트리밍 서버에도 추가하기
            manager.added_tracks[session_id]['audio'] = streaming_track

            # source_tracks에도 저장 (main.py에서 사용)
            if session_id not in manager.source_tracks:
                manager.source_tracks[session_id] = {}
            # manager.source_tracks[session_id]['audio'] = client_track
            manager.source_tracks[session_id]['audio'] = echo_track
            
        elif track.kind == "video":
            print("📹 비디오 트랙 수신: ", track)
            echo_track = VideoEchoTrack(track)
            # 세션 ID를 비디오 처리기로 전달하여 세션별 필터 적용
            try:
                if hasattr(echo_track, 'video_processor') and hasattr(echo_track.video_processor, 'set_session_id'):
                    echo_track.video_processor.set_session_id(session_id)
            except Exception:
                pass
            
            pc.addTrack(echo_track)

            # 트랙 저장 -> 스트리밍 서버에도 추가하기
            manager.added_tracks[session_id]['video'] = echo_track
            
            # source_tracks에도 저장 (main.py에서 사용)
            if session_id not in manager.source_tracks:
                manager.source_tracks[session_id] = {}
            manager.source_tracks[session_id]['video'] = echo_track
            
        else:
            print(f"🚨 알 수 없는 트랙 타입: {track.kind}")

    @pc.on("datachannel")
    def on_datachannel(channel):
        """
        Data Channel 수신 시 호출되는 이벤트 핸들러
        """
        print(f"📡 Data Channel 수신: {channel}")
        print(f"📡 Data Channel 상태: {channel.readyState}")
        print(f"📡 Data Channel 라벨: {channel.label}")
        print(f"📡 Data Channel ID: {channel.id}")
        # channel.send("Hello from server")
        print(pc.getSenders())
        print(pc.getReceivers())
        print(pc.getTransceivers())

        # 현재 송신 트랙이 없을 수 있음. 필요시 저장된 처리 트랙에 데이터채널 전달
        try:
            if manager is not None and session_id is not None:
                st = manager.source_tracks.get(session_id, {})
                for t in [st.get("audio"), st.get("video")]:
                    if t and hasattr(t, "set_data_channel"):
                        t.set_data_channel(channel)
            #     Data Channel 연결 확인 로그             
            #     print(f"🔍 source_tracks에서 가져온 데이터: {st}")
            #     print(f"🔍 source_tracks 키들: {list(st.keys()) if st else '빈 딕셔너리'}")
                
            #     audio_track = st.get("audio")
            #     video_track = st.get("video")
                
            #     print(f"🔍 오디오 트랙: {audio_track}")
            #     print(f"🔍 비디오 트랙: {video_track}")
            #     print(f"🔍 오디오 트랙 타입: {type(audio_track) if audio_track else 'None'}")
            #     print(f"🔍 비디오 트랙 타입: {type(video_track) if video_track else 'None'}")
                
            #     for track_type, t in [("audio", audio_track), ("video", video_track)]:
            #         print(f"🔍 {track_type} 트랙 처리 중...")
            #         if t:
            #             print(f"🔍 {track_type} 트랙 존재함: {t}")
            #             print(f"🔍 {track_type} 트랙의 속성들: {dir(t)}")
            #             print(f"🔍 {track_type} 트랙에 set_data_channel 메서드 존재: {hasattr(t, 'set_data_channel')}")
                        
            #             if not hasattr(t, "set_data_channel"):
            #                 print(f"❌ {track_type} 트랙에 set_data_channel 메서드가 없음")
            #         else:
            #             print(f"❌ {track_type} 트랙이 None임")
            # else:
            #     print(f"❌ manager 또는 session_id가 None: manager={manager}, session_id={session_id}")
        except Exception as e:
            print(f"DataChannel 설정 중 오류: {e}")
        

    @pc.on("icecandidate")
    async def on_icecandidate(candidate):
        """
        ICE 후보 생성 시 호출되는 이벤트 핸들러
        SimplePeer(trickle=false) 환경에서는 별도 전송하지 않습니다.
        """
        print(f"❄️ ICE candidate 생성: {candidate}")
        return

    @pc.on("connectionstatechange")
    def on_connectionstatechange():
        """
        WebRTC 연결 상태 변경 시 호출되는 이벤트 핸들러
        """
        print(f"📶 통합 서버 연결 상태: {pc.connectionState} | ICE: {pc.iceConnectionState} | Gathering: {pc.iceGatheringState}")
        if pc.connectionState == "failed":
            print("❌ WebRTC 연결 실패 - ICE 후보 확인 필요")
        elif pc.connectionState == "connected":
            print("✅ WebRTC 연결 성공!")
            
            # 송신자/수신자 정보 출력
            print(f"📤 Senders: {len(pc.getSenders())}")
            print(f"📥 Receivers: {len(pc.getReceivers())}")
            for i, transceiver in enumerate(pc.getTransceivers()):
                print(f"🔄 Transceiver {i}: {transceiver.direction} - {transceiver.kind}")

    return pc
