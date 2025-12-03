"""
연결 관리 모듈
@module connection_manager
@author joon hyeok
@date 2025-07-29
@description WebSocket 연결과 WebRTC 피어 연결을 관리하는 싱글톤 클래스입니다.
"""

from typing import List
from fastapi import WebSocket

class ConnectionManager:
    """
    연결 관리 클래스 (싱글톤 패턴)
    
    WebSocket 연결과 WebRTC 피어 연결을 중앙에서 관리하는 싱글톤 클래스입니다.
    """
    _instance = None
    
    def __new__(cls):
        """
        싱글톤 인스턴스를 생성하거나 반환합니다.
        
        @returns {ConnectionManager} ConnectionManager 싱글톤 인스턴스
        """
        if cls._instance is None:
            cls._instance = super(ConnectionManager, cls).__new__(cls)
            cls._instance.active_connections: List[WebSocket] = []
            cls._instance.peer_connections = {}  # sessionId -> RTCPeerConnection
            cls._instance.added_tracks = {}     # sessionId -> { videoTrack, audioTrack }
            cls._instance.source_tracks = {}    # sessionId -> { videoTrack, audioTrack } 원본 트랙 저장
            cls._instance.stream_keys = {}      # sessionId -> streamKey 매핑
        return cls._instance
    
    def __init__(self):
        """
        ConnectionManager 초기화
        
        __new__에서 이미 초기화했으므로 여기서는 아무것도 하지 않습니다.
        """
        pass

    async def connect(self, websocket: WebSocket):
        """
        새로운 WebSocket 연결을 추가합니다.
        
        @param {WebSocket} websocket - 연결할 WebSocket 인스턴스
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ 클라이언트 연결됨. 총 연결 수: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """
        WebSocket 연결을 제거합니다.
        
        @param {WebSocket} websocket - 제거할 WebSocket 인스턴스
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"🔌 클라이언트 연결 해제됨. 총 연결 수: {len(self.active_connections)}")
        else:
            print("⚠️ 이미 해제된 WebSocket 연결")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """
        특정 WebSocket 연결에 개인 메시지를 전송합니다.
        
        @param {str} message - 전송할 메시지
        @param {WebSocket} websocket - 메시지를 전송할 WebSocket 인스턴스
        """
        await websocket.send_text(message)
