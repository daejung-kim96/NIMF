"""
AI 서버 설정 관리 모듈
@module config
@author joon hyeok
@date 2025-01-08
@description AI 서버의 다양한 설정을 중앙에서 관리합니다.
"""

import os
from typing import Optional
import dotenv
dotenv.load_dotenv()

class Config:
    """
    AI 서버 설정 클래스
    """
    
    # YOLO 모델 설정
    YOLO_MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "best.pt")
    YOLO_DEVICE: str = os.getenv("YOLO_DEVICE", "cpu")  # cpu 또는 cuda
    
    # 서버 설정
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    STREAMING_SERVER_URL: str = os.getenv("STREAMING_SERVER_URL", "http://localhost:5002")
    
    # Twilio 설정 (TURN 서버용)
    TWILIO_ACCOUNT_SID: str = os.getenv("ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("AUTH_TOKEN", "")
    
    # WebRTC 설정
    ICE_SERVERS = [
        {"urls": ["stun:stun.l.google.com:19302"]},
        {"urls": ["stun:stun1.l.google.com:19302"]},
    ]
    
    # 물체 감지 설정
    OBJECT_DETECTION_ENABLED: bool = os.getenv("OBJECT_DETECTION_ENABLED", "true").lower() == "true"
    OBJECT_DETECTION_CONFIDENCE: float = float(os.getenv("OBJECT_DETECTION_CONFIDENCE", "0.5"))
    
    # 오디오 처리 설정
    AUDIO_RECOGNITION_ENABLED: bool = os.getenv("AUDIO_RECOGNITION_ENABLED", "true").lower() == "true"
    
    @classmethod
    def get_yolo_model_path(cls) -> str:
        """
        YOLO 모델 경로를 반환합니다.
        
        @returns {str} YOLO 모델 경로
        """
        return cls.YOLO_MODEL_PATH
    
    @classmethod
    def get_yolo_device(cls) -> str:
        """
        YOLO 디바이스를 반환합니다.
        
        @returns {str} YOLO 디바이스 (cpu 또는 cuda)
        """
        return cls.YOLO_DEVICE
    
    @classmethod
    def get_twilio_credentials(cls) -> tuple:
        """
        Twilio 인증 정보를 반환합니다.
        
        @returns {tuple} (account_sid, auth_token)
        """
        return cls.TWILIO_ACCOUNT_SID, cls.TWILIO_AUTH_TOKEN
    
    @classmethod
    def set_yolo_model_path(cls, model_path: str):
        """
        YOLO 모델 경로를 설정합니다.
        
        @param {str} model_path - 새로운 모델 경로
        """
        cls.YOLO_MODEL_PATH = model_path
        print(f"🔧 YOLO 모델 경로가 변경되었습니다: {model_path}")
    
    @classmethod
    def print_config(cls):
        """
        현재 설정을 출력합니다.
        """
        print("📋 AI 서버 설정:")
        print(f"   YOLO 모델: {cls.YOLO_MODEL_PATH}")
        print(f"   YOLO 디바이스: {cls.YOLO_DEVICE}")
        print(f"   서버 주소: {cls.HOST}:{cls.PORT}")
        print(f"   스트리밍 서버: {cls.STREAMING_SERVER_URL}")
        print(f"   Twilio Account SID: {'설정됨' if cls.TWILIO_ACCOUNT_SID else '설정되지 않음'}")
        print(f"   Twilio Auth Token: {'설정됨' if cls.TWILIO_AUTH_TOKEN else '설정되지 않음'}")
        print(f"   물체 감지: {'활성화' if cls.OBJECT_DETECTION_ENABLED else '비활성화'}")
        print(f"   음성 인식: {'활성화' if cls.AUDIO_RECOGNITION_ENABLED else '비활성화'}")
        print(f"   감지 신뢰도: {cls.OBJECT_DETECTION_CONFIDENCE}")

# 전역 설정 인스턴스
config = Config()
