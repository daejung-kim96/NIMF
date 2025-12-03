"""
WebSocket WebRTC 메시지 처리 모듈
@module websocket_handler
@author joon hyeok
@date 2025-07-29
@description WebSocket을 통해 전달되는 WebRTC 시그널링 메시지를 처리하는 모듈입니다.
"""

import sys
import os

# AI 루트 디렉토리를 Python 경로에 추가 (한 단계 위로)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import asyncio
from webrtc.unified_peer import create_unified_peer_connection
from aiortc import RTCSessionDescription, RTCIceCandidate
from streaming_server_manager import StreamingServerManager

async def handle_webrtc_message(data, websocket, manager):
    """
    WebRTC 시그널링 메시지를 처리합니다.
    
    @function handle_webrtc_message
    @param {dict} data - WebRTC 메시지 데이터
    @param {WebSocket} websocket - 클라이언트 WebSocket 연결
    @param {ConnectionManager} manager - 연결 관리자 인스턴스
    """
    session_id = data['sessionId']
    target = data.get('target', 'unified')  # target 정보 추출 (하위 호환성)
    signal = data['signal']

    # breakpoint()

    # WebRTC Offer 처리
    if isinstance(signal, dict) and signal.get("type") == "offer":
        if session_id not in manager.peer_connections:
            manager.peer_connections[session_id] = {"audio": None, "video": None}
            manager.added_tracks[session_id] = {"audio": None, "video": None}
        
        # 모든 요청을 통합 피어로 처리
        pc = create_unified_peer_connection(websocket, manager, session_id)
        print(f"📡 통합 서버 offer 수신 (target: {target}) → answer 생성")
            
        manager.peer_connections[session_id] = {target: pc}

        # SDP munging: force H264 (drop VP8/VP9) in VIDEO section only
        def _prefer_h264_in_sdp(sdp: str) -> str:
            lines = sdp.splitlines()
            # locate video m= section range
            video_start = next((i for i, l in enumerate(lines) if l.startswith('m=video ')), None)
            if video_start is None:
                return sdp
            video_end = next((i for i in range(video_start + 1, len(lines)) if lines[i].startswith('m=')), len(lines))

            # Within video section, collect rtpmap payload types
            pt_codec = {}
            for i in range(video_start, video_end):
                l = lines[i]
                if l.startswith('a=rtpmap:'):
                    try:
                        pt, rest = l[len('a=rtpmap:'):].split(' ', 1)
                        codec = rest.split('/')[0].upper()
                        pt_codec[pt] = codec
                    except Exception:
                        continue

            allowed_pts = {pt for pt, codec in pt_codec.items() if codec == 'H264'}
            # Map fmtp apt only within video section
            apt_map = {}
            for i in range(video_start, video_end):
                l = lines[i]
                if l.startswith('a=fmtp:'):
                    try:
                        pt, params = l[len('a=fmtp:'):].split(' ', 1)
                        for token in params.split(';'):
                            token = token.strip()
                            if token.startswith('apt='):
                                apt_map[pt] = token.split('=')[1]
                    except Exception:
                        continue
            for rtx_pt, apt_pt in apt_map.items():
                if apt_pt in allowed_pts:
                    allowed_pts.add(rtx_pt)

            # Rebuild only the video m= line
            parts = lines[video_start].split(' ')
            header = parts[:3]
            payloads = parts[3:]
            new_payloads = [pt for pt in payloads if pt in allowed_pts]
            if not new_payloads:
                return sdp
            lines[video_start] = ' '.join(header + new_payloads)

            # Filter a= lines in video section only, keep others intact
            filtered_section = []
            for i in range(video_start, video_end):
                l = lines[i]
                if l.startswith('a=rtpmap:') or l.startswith('a=rtcp-fb:') or l.startswith('a=fmtp:'):
                    try:
                        after = l.split(':', 1)[1]
                        pt = after.split(' ', 1)[0]
                        if pt in allowed_pts:
                            filtered_section.append(l)
                    except Exception:
                        filtered_section.append(l)
                else:
                    filtered_section.append(l)
            new_lines = lines[:video_start] + filtered_section + lines[video_end:]
            out = '\n'.join(new_lines)
            return out + ('\n' if not out.endswith('\n') else '')

        original_sdp = signal["sdp"]
        munged_sdp = _prefer_h264_in_sdp(original_sdp)
        # 우선 H264 우선 SDP로 시도, 실패 시 원본 SDP로 재시도 (호환성 보장)
        try:
            desc = RTCSessionDescription(sdp=munged_sdp, type=signal["type"])
            await pc.setRemoteDescription(desc)
        except Exception as e:
            print(f"⚠️ H264 우선 SDP 적용 실패, 원본 SDP로 재시도: {e}")
            desc_fallback = RTCSessionDescription(sdp=original_sdp, type=signal["type"])
            await pc.setRemoteDescription(desc_fallback)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # wait ICE gathering complete for trickle=false client
        async def _wait_ice_complete(connection, timeout: float = 5.0):
            elapsed = 0.0
            while connection.iceGatheringState != 'complete' and elapsed < timeout:
                await asyncio.sleep(0.05)
                elapsed += 0.05
        await _wait_ice_complete(pc)

        # Answer를 클라이언트에 전송 (BE signal-handler.js 형식에 맞춤)
        await websocket.send_text(json.dumps({
            "signal": {
                "type": pc.localDescription.type,
                "sdp": pc.localDescription.sdp
            }
        }))

        # 스트리밍 서버와의 WebRTC 연결 시작
        try:
            streaming_manager = StreamingServerManager.get_instance(manager)
            await streaming_manager.connect_to_streaming_server(manager, session_id, pc)
        except Exception as e:
            print(f"❌ 스트리밍 서버 연결 실패: {e}")
            # 스트리밍 서버 연결 실패해도 클라이언트 연결은 유지




    # ICE Candidate 처리
    elif signal["type"] == "ice":
        session_peers = manager.peer_connections.get(session_id)
        if not session_peers or target not in session_peers:
            return
        pc = session_peers[target]
        if not pc:
            return
        await pc.addIceCandidate({
            "candidate": signal["candidate"],
            "sdpMid": signal["sdpMid"],
            "sdpMLineIndex": signal["sdpMLineIndex"],
        })
