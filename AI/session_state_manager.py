from typing import Dict, Any, Optional
from datetime import datetime
import threading
from pydantic import BaseModel

'''
 audio: {
    category: { profanity: null, hateSpeech: false, bannedWords: [] },
    action: { filtering: false, alert: false, logging: false },
  }

  Ex) audioFilter
   audio: {
    category: { profanity: 'high', hateSpeech: false, bannedWords: ['빨리', '느려'] },
    action: { filtering: false, alert: false, logging: false },
  }

'''

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


class SessionStateManager:
    def __init__(self):
        self._session_filters: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()  # 스레드 안전성을 위한 락
    
    def set_session_filter(self, session_id: str, filter_request):
        """세션별 필터 정보 저장"""
        with self._lock:

            # ✅ 디버깅 로그 추가
            print(f"✅ set_session_filter 호출:")
            print(f"  session_id: {session_id}")
            print(f"  filter_request 타입: {type(filter_request)}")
            print(f"  filter_request 내용: {filter_request}")
            
            if isinstance(filter_request, dict):

                # ✅ dict를 FilterRequest로 변환
                try:
                    filter_request_obj = FilterRequest(
                        videoFilter=VideoFilter(**filter_request['videoFilter']) if filter_request.get('videoFilter') else None,
                        audioFilter=AudioFilter(**filter_request['audioFilter']) if filter_request.get('audioFilter') else None
                    )
                    print(f"✅ FilterRequest 객체 생성 성공")
                except Exception as e:
                    print(f"❌ FilterRequest 객체 생성 실패: {e}")


                    
                # ✅ 변환된 객체로 저장
                self._session_filters[session_id] = {
                    "videoFilter": filter_request_obj.videoFilter.model_dump() if filter_request_obj.videoFilter else None,
                    "audioFilter": filter_request_obj.audioFilter.model_dump() if filter_request_obj.audioFilter else None,
                    "updated_at": datetime.now()
                }
            else:

                self._session_filters[session_id] = {
                    "videoFilter": filter_request.videoFilter.model_dump() if filter_request.videoFilter else None,
                    "audioFilter": filter_request.audioFilter.model_dump() if filter_request.audioFilter else None,
                    "updated_at": datetime.now()
                }
            print(f"🔧 세션 {session_id} 필터 설정 저장됨: {self._session_filters[session_id]}")
    

    def get_audio_filter(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션별 오디오 필터 정보만 조회"""
        with self._lock:
            session_filter = self._session_filters.get(session_id)
            if session_filter and session_filter.get('audioFilter'):
                return session_filter['audioFilter'].get('category')
            return None

    def get_video_filter(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션별 비디오 필터 정보만 조회"""
        with self._lock:
            session_filter = self._session_filters.get(session_id)
            if session_filter and session_filter.get('videoFilter'):
                return session_filter['videoFilter'].get('category')
            return None
    
    def get_session_filter(self, session_id: str) -> Optional[Dict[str, Any]]:
        """세션별 필터 정보 조회"""
        with self._lock:
            return self._session_filters.get(session_id)
    
    def remove_session_filter(self, session_id: str):
        """세션별 필터 정보 삭제"""
        with self._lock:
            self._session_filters.pop(session_id, None)
    
    def get_all_sessions(self) -> Dict[str, Dict[str, Any]]:
        """모든 세션 필터 정보 조회"""
        with self._lock:
            return self._session_filters.copy()
    
    def print_session_info(self, session_id: str):
        """특정 세션의 필터 정보를 콘솔에 출력"""
        with self._lock:
            if session_id in self._session_filters:
                print(f"📋 세션 {session_id} 필터 정보:")
                print(f"  - 비디오 필터: {self._session_filters[session_id].get('videoFilter')}")
                print(f"  - 오디오 필터: {self._session_filters[session_id].get('audioFilter')}")
                print(f"  - 업데이트 시간: {self._session_filters[session_id].get('updated_at')}")
            else:
                print(f"❌ 세션 {session_id}의 필터 정보를 찾을 수 없습니다.")
    
    def print_all_sessions(self):
        """모든 세션의 필터 정보를 콘솔에 출력"""
        with self._lock:
            if not self._session_filters:
                print("📋 등록된 세션이 없습니다.")
                return
            
            print(f"📋 총 {len(self._session_filters)}개 세션의 필터 정보:")
            for session_id, filters in self._session_filters.items():
                print(f"  세션 {session_id}:")
                print(f"    - 비디오 필터: {filters.get('videoFilter')}")
                print(f"    - 오디오 필터: {filters.get('audioFilter')}")
                print(f"    - 업데이트 시간: {filters.get('updated_at')}")
    
    def cleanup_expired_sessions(self, expiry_hours: int = 24):
        """만료된 세션 정리"""
        current_time = datetime.now()
        with self._lock:
            expired_sessions = [
                session_id for session_id, data in self._session_filters.items()
                if (current_time - data["updated_at"]).total_seconds() > expiry_hours * 3600
            ]
            for session_id in expired_sessions:
                self._session_filters.pop(session_id, None)

# 전역 인스턴스 생성
session_state_manager = SessionStateManager()
