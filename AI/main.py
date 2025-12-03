"""
통합 미디어 서버 메인 모듈
@module main
@author joon hyeok
@date 2025-01-08
@description 비디오와 오디오를 통합 처리하는 FastAPI 서버의 메인 엔트리 포인트입니다.
"""

import sys
import os

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, WebSocket, Depends, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from server.dependencies import get_connection_manager
from server.websocket_handler import handle_webrtc_message
from session_state_manager import session_state_manager
# 음성 테스트를 위해 비디오 프로세서 import 비활성화
from ai_video.video_processor import initialize_global_yolo_model, is_global_yolo_initialized

from config import config
import json
import asyncio
import httpx
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaRelay
from typing import Optional, Dict, Any
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    서버 생명주기 관리
    """
    # 서버 시작 시 실행
    print("🚀 서버 시작 중...")
    
    # 설정 출력
    config.print_config()
    
    # 전역 YOLO 모델 초기화
    if initialize_global_yolo_model():
        print(f"✅ 전역 YOLO 모델 초기화 완료: {config.get_yolo_model_path()}")
    else:
        print(f"❌ 전역 YOLO 모델 초기화 실패: {config.get_yolo_model_path()}")
        print("⚠️ 물체 감지 기능이 비활성화됩니다.")
    
    yield
    
    # 서버 종료 시 실행
    print("🛑 서버 종료 중...")

app = FastAPI(title="FastAPI Unified Media Server", version="1.0.0", lifespan=lifespan)
# FastAPI 상태로 등록
app.state.session_manager = session_state_manager

# Pydantic 모델 정의
class VideoFilter(BaseModel):
    category: Dict[str, bool]
    action: Dict[str, bool]

class AudioFilter(BaseModel):
    category: Dict[str, Any]
    action: Dict[str, bool]

class FilterRequest(BaseModel):
    videoFilter: Optional[VideoFilter] = None
    audioFilter: Optional[AudioFilter] = None

class FilterResponse(BaseModel):
    success: bool
    message: str
    session_id: str

@app.on_event("startup")
async def startup_event():
    """
    서버 시작 시 실행되는 이벤트
    전역 YOLO 모델을 초기화합니다.
    """
    print("🚀 서버 시작 중...")
    
    # 설정 출력
    config.print_config()
    
    # 전역 YOLO 모델 초기화 (음성 테스트를 위해 비활성화)
    print("🔇 비디오 처리가 비활성화되었습니다 (음성 테스트 모드)")
    print("⚠️ 물체 감지 기능이 비활성화됩니다.")
    # if initialize_global_yolo_model():
    #     print(f"✅ 전역 YOLO 모델 초기화 완료: {config.get_yolo_model_path()}")
    # else:
    #     print(f"❌ 전역 YOLO 모델 초기화 실패: {config.get_yolo_model_path()}")
    #     print("⚠️ 물체 감지 기능이 비활성화됩니다.")

@app.get("/")
async def root():
    """
    서버 상태 확인 엔드포인트
    
    @returns {dict} 서버 실행 상태 메시지
    """
    yolo_status = "활성화" if is_global_yolo_initialized() else "비활성화"
    return {
        "message": "통합 미디어 서버 (비디오 + 오디오) 실행중",
        "yolo_model": yolo_status,
        "model_path": config.get_yolo_model_path()
    }

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    manager = Depends(get_connection_manager)
):
    """
    WebSocket 연결 엔드포인트
    
    클라이언트와의 WebSocket 연결을 처리하고 통합 WebRTC 시그널링을 관리합니다.
    비디오와 오디오 스트림을 하나의 연결로 처리합니다.
    
    @param {WebSocket} websocket - 클라이언트 WebSocket 연결
    @param {ConnectionManager} manager - 연결 관리자 인스턴스
    """
    await manager.connect(websocket)
    session_id = None

    try:
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)

                # 세션 ID 설정 처리
                if data['type'] == 'session_id':
                    session_id = data['sessionId']
                    filters = data['filters']

                    # 세션 상태 관리자에 필터 설정 저장
                    session_state_manager.set_session_filter(session_id, filters)

                    manager.peer_connections[session_id] = {}
                    manager.added_tracks[session_id] = {}
                    print(f"📝 세션 ID 설정: {session_id}")
                    continue

                # WebRTC 시그널링 메시지 처리
                elif data['type'] == 'webrtc':
                    await handle_webrtc_message(data, websocket, manager)

            except Exception as e:
                print(f"❌ 내부 처리 에러: {e}")
                print(f"   세션 ID: {session_id}")
                print(f"   메시지 타입: {data.get('type', 'unknown')}")
                print(f"   시그널 타입: {data.get('signal', {}).get('type', 'unknown')}")
                print(f"   에러 타입: {type(e).__name__}")
                import traceback
                print(f"   스택 트레이스:")
                traceback.print_exc()
                manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WebSocket 종료 에러: {e}")


@app.post("/stream/{session_id}/start")
async def start_stream(session_id: str, body: dict, manager = Depends(get_connection_manager)):
    """
    특정 세션의 처리된 오디오/비디오 트랙을 스트리밍 서버로 WebRTC로 전송 시작.
    body: { "streamKey": "..." }
    """
    stream_key = body.get("streamKey")
    if not stream_key:
        raise HTTPException(status_code=400, detail="streamKey is required")

    # 소스 트랙 확인 (unified_peer에서 저장됨)
    tracks = manager.source_tracks.get(session_id)
    if not tracks or ("audio" not in tracks and "video" not in tracks):
        raise HTTPException(status_code=400, detail="No media tracks for this session")

    manager.stream_keys[session_id] = stream_key

    # 스트리밍 서버에 FFmpeg 시작 요청 (streamKey 전달)
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            start_resp = await client.post(f"{config.STREAMING_SERVER_URL}/stream/webrtc/init", json={"streamKey": stream_key, "sessionId": session_id})
            start_resp.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Streaming server init failed: {e}")

    # 스트리밍 서버에서 SDP offer 수신 → 여기서 answer 생성해서 전송
    offer = start_resp.json().get("offer")
    if not offer:
        raise HTTPException(status_code=502, detail="Streaming server did not return offer")

    # WebRTC 클라이언트 생성 (AI 서버 -> Streaming 서버)
    ice_servers = [RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
    
    # Twilio TURN 서버 추가 (환경변수가 설정된 경우)
    account_sid, auth_token = config.config.get_twilio_credentials()
    if account_sid and auth_token:
        try:
            # Twilio TURN 서버 정보 추가
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
            print(f"✅ [streaming-webrtc][{session_id}] Twilio TURN 서버가 ICE 서버에 추가되었습니다.")
        except Exception as e:
            print(f"⚠️ [streaming-webrtc][{session_id}] Twilio TURN 서버 추가 실패: {e}")
    else:
        print(f"⚠️ [streaming-webrtc][{session_id}] Twilio 인증 정보가 설정되지 않아 TURN 서버를 사용할 수 없습니다.")
    
    pc = RTCPeerConnection(RTCConfiguration(iceServers=ice_servers))

    # Streaming 서버와의 WebRTC 상태 로깅
    def _log_streaming_webrtc(prefix: str) -> None:
        print(f"{prefix} connection: {pc.connectionState} | ICE: {pc.iceConnectionState} | Gathering: {pc.iceGatheringState}")

    @pc.on("connectionstatechange")
    def _on_connection_state_change():
        _log_streaming_webrtc(f"📡 [streaming-webrtc][{session_id}]")

    @pc.on("icegatheringstatechange")
    def _on_ice_gathering_change():
        print(f"🧊 [streaming-webrtc][{session_id}] ICE gathering: {pc.iceGatheringState}")

    @pc.on("iceconnectionstatechange")
    def _on_ice_conn_change():
        print(f"🧊 [streaming-webrtc][{session_id}] ICE connection: {pc.iceConnectionState}")

    @pc.on("icecandidate")
    async def _on_ice_candidate(candidate):
        print(f"🧊 [streaming-webrtc][{session_id}] ICE candidate: {'present' if candidate else 'null (end)'}")

    # 처리된 트랙을 addTrack (VideoEchoTrack, AudioEchoTrack 자체가 MediaStreamTrack)
    relay = MediaRelay()
    if "video" in tracks and tracks["video"] is not None:
        pc.addTrack(relay.subscribe(tracks["video"]))
    if "audio" in tracks and tracks["audio"] is not None:
        pc.addTrack(relay.subscribe(tracks["audio"]))

    await pc.setRemoteDescription(RTCSessionDescription(sdp=offer["sdp"], type=offer["type"]))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    # ICE gathering complete 대기 (no-trickle 방식)
    async def wait_ice_complete(connection: RTCPeerConnection, timeout: float = 5.0):
        elapsed = 0.0
        while connection.iceGatheringState != 'complete' and elapsed < timeout:
            await asyncio.sleep(0.05)
            elapsed += 0.05
    await wait_ice_complete(pc)

    # 스트리밍 서버로 answer 전송
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.post(f"{config.STREAMING_SERVER_URL}/stream/webrtc/answer", json={
                "sessionId": session_id,
                "answer": {"type": pc.localDescription.type, "sdp": pc.localDescription.sdp}
            })
            res.raise_for_status()
        except Exception as e:
            await pc.close()
            raise HTTPException(status_code=502, detail=f"Streaming server answer failed: {e}")

    manager.streaming_peer_connections[session_id] = pc

    # 연결 상태 감시 및 자동 재시도 (AI -> Streaming 서버)
    async def _streaming_watchdog():
        try:
            while True:
                await asyncio.sleep(3.0)
                state = pc.connectionState
                if state in ("failed", "closed"):
                    print(f"♻️ [streaming-webrtc][{session_id}] 상태 {state} → 재연결 시도")
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            await client.post(
                                f"http://127.0.0.1:{config.PORT}/stream/{session_id}/start",
                                json={"streamKey": stream_key},
                            )
                    except Exception as e:
                        print(f"❌ [streaming-webrtc][{session_id}] 재연결 실패: {e}")
                    break
        except Exception as e:
            print(f"⚠️ [streaming-webrtc][{session_id}] watchdog error: {e}")

    asyncio.create_task(_streaming_watchdog())

    return {"status": "started"}


@app.post("/stream/{session_id}/stop")
async def stop_stream(session_id: str, manager = Depends(get_connection_manager)):
    pc: Optional[RTCPeerConnection] = manager.streaming_peer_connections.get(session_id)
    if pc:
        await pc.close()
        manager.streaming_peer_connections.pop(session_id, None)

    # 스트리밍 서버 FFmpeg 종료
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(f"{config.STREAMING_SERVER_URL}/stream/stop", json={"sessionId": session_id})
        except Exception:
            pass

    # 필요시 세션 정리 로직
    app.state.session_manager.cleanup_expired_sessions()

    return {"status": "stopped"}



# 세션별 필터 설정 저장소 (실제 운영에서는 Redis나 DB 사용 권장)
session_filters = {}


@app.post("/sessions/{session_id}/filter")
async def update_session_filters(session_id: str, filter_request: FilterRequest, manager = Depends(get_connection_manager)):
    """
    세션별 필터 설정을 업데이트합니다.
    
    Args:
        session_id: 세션 식별자
        filter_request: 비디오/오디오 필터 설정
    
    Returns:
        FilterResponse: 업데이트 결과
    """
    try:
        logger.info(f"세션 {session_id}의 필터 설정 업데이트 요청 받음")
        
        # 필터 설정 저장
        session_state_manager.set_session_filter(session_id, filter_request)

        # 비디오 클래스 필터를 활성 비디오 트랙에 즉시 반영
        try:
            track = manager.added_tracks.get(session_id, {}).get('video')
            if track and hasattr(track, 'set_detection_filter'):
                # VideoEchoTrack → VideoProcessor에 위임된 헬퍼 호출
                if hasattr(track, 'video_processor') and hasattr(track.video_processor, 'apply_video_filter_for_session'):
                    track.video_processor.apply_video_filter_for_session(session_id)
        except Exception:
            pass

        
        # 로그 출력
        logger.info(f"세션 {session_id} 필터 설정:")
        if filter_request.videoFilter:
            logger.info(f"  비디오 필터: {filter_request.videoFilter.model_dump()}")
        if filter_request.audioFilter:
            logger.info(f"  오디오 필터: {filter_request.audioFilter.model_dump()}")
        
        return FilterResponse(
            success=True,
            message=f"세션 {session_id}의 필터 설정이 성공적으로 업데이트되었습니다.",
            session_id=session_id,
        )
        
    except Exception as e:
        logger.error(f"세션 {session_id} 필터 설정 업데이트 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"필터 설정 업데이트 실패: {str(e)}")





if __name__ == "__main__":
    """
    통합 미디어 서버 실행 엔트리 포인트
    """
    import uvicorn
    print("🚀 통합 미디어 서버 (비디오 + 오디오) 시작...")
    uvicorn.run(app, host=config.HOST, port=config.PORT)
