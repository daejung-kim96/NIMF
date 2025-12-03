"""
통합 미디어 트랙 처리 모듈
@module unified_track
@author joon hyeok
@date 2025-01-08
@description 비디오와 오디오를 통합 처리하는 MediaStreamTrack 구현체입니다.
"""

# 음성 테스트를 위해 비디오 프로세서 import 비활성화
from ai_video.video_processor import VideoEchoTrack
from ai_audio.audio_processor import AudioProcessor

class UnifiedMediaTrack:
    """
    통합 미디어 트랙 관리 클래스
    
    하나의 WebRTC 연결에서 비디오와 오디오 트랙을 관리합니다.
    MediaStreamTrack을 직접 상속받지 않고 관리 역할만 수행합니다.
    """
    
    def __init__(self):
        """
        UnifiedMediaTrack 초기화
        """
        self.audio_track = None
        self.video_track = None
        
    def add_audio_track(self, track):
        """
        오디오 트랙을 추가합니다.
        
        @param {MediaStreamTrack} track - 오디오 트랙
        """
        self.audio_track = AudioProcessor(track)
        print("🎧 오디오 트랙이 통합 처리기에 추가되었습니다.")
        
    def add_video_track(self, track):
        """
        비디오 트랙을 추가합니다.
        
        @param {MediaStreamTrack} track - 비디오 트랙
        """
        # self.video_track = VideoEchoTrack(track)
        
        print("📹 비디오 트랙이 통합 처리기에 추가되었습니다.")
        print("🔍 물체 감지 기능이 활성화되었습니다.")
        
    def get_audio_track(self):
        """
        처리된 오디오 트랙을 반환합니다.
        
        @returns {AudioProcessor} 처리된 오디오 트랙
        """
        return self.audio_track
        
    def get_video_track(self):
        """
        처리된 비디오 트랙을 반환합니다.
        
        @returns {VideoEchoTrack} 처리된 비디오 트랙
        """
        return self.video_track
    
    def start_audio_recognition(self):
        """
        오디오 음성 인식을 시작합니다.
        """
        if self.audio_track:
            self.audio_track.start_speech_recognition()
            print("🎤 통합 트랙에서 음성 인식을 시작했습니다.")
    
    def stop_audio_recognition(self):
        """
        오디오 음성 인식을 중지합니다.
        """
        if self.audio_track:
            self.audio_track.stop_speech_recognition()
            print("🔇 통합 트랙에서 음성 인식을 중지했습니다.")
    
    def get_recognition_results(self):
        """
        음성 인식 결과를 반환합니다.
        
        @returns {list} 인식 결과 목록
        """
        if self.audio_track:
            return self.audio_track.get_recognition_results()
        return []
    
    def get_video_processing_stats(self) -> dict:
        """
        비디오 처리 통계를 반환합니다.
        
        @returns {dict} 비디오 처리 통계
        """
        if self.video_track:
            return self.video_track.get_processing_stats()
        return {}
    
    def reset_video_processing_stats(self):
        """
        비디오 처리 통계를 초기화합니다.
        """
        if self.video_track:
            self.video_track.reset_processing_stats()
    
    def get_audio_processing_stats(self) -> dict:
        """
        오디오 처리 통계를 반환합니다.
        
        @returns {dict} 오디오 처리 통계
        """
        if self.audio_track:
            return self.audio_track.get_processing_stats()
        return {}
    
    def reset_audio_processing_stats(self):
        """
        오디오 처리 통계를 초기화합니다.
        """
        if self.audio_track:
            self.audio_track.reset_processing_stats()
    
    def add_detection_callback(self, callback):
        """
        물체 감지 결과 콜백 함수를 추가합니다.
        
        @param {Callable} callback - 감지 결과를 처리할 콜백 함수
        """
        if self.video_track:
            self.video_track.add_detection_callback(callback)
    
    def remove_detection_callback(self, callback):
        """
        물체 감지 결과 콜백 함수를 제거합니다.
        
        @param {Callable} callback - 제거할 콜백 함수
        """
        if self.video_track:
            self.video_track.remove_detection_callback(callback)
    
    def set_detection_filter(self, enabled_classes=None, confidence_range=None, area_range=None):
        """
        감지 필터를 설정합니다.
        
        @param {List[int]} enabled_classes - 활성화할 클래스 ID 목록
        @param {tuple} confidence_range - 신뢰도 범위 (min, max)
        @param {tuple} area_range - 면적 범위 (min, max)
        """
        if self.video_track:
            self.video_track.set_detection_filter(enabled_classes, confidence_range, area_range)
    
    def get_current_detections(self):
        """
        현재 프레임의 감지 결과를 반환합니다.
        
        @returns {List} 현재 감지 결과
        """
        if self.video_track:
            return self.video_track.get_current_detections()
        return []
    
    def get_detection_stats(self):
        """
        물체 감지 통계를 반환합니다.
        
        @returns {dict} 감지 통계
        """
        if self.video_track:
            return self.video_track.get_detection_stats()
        return {}
    
    def reset_detection_stats(self):
        """
        물체 감지 통계를 초기화합니다.
        """
        if self.video_track:
            self.video_track.reset_detection_stats()
    
    def enable_object_blur(self, enable: bool = True, blur_classes=None, blur_strength: int = 15):
        """
        물체 블러 기능을 설정합니다.
        
        @param {bool} enable - 블러 기능 활성화 여부
        @param {List[int]} blur_classes - 블러 적용할 클래스 ID 목록 (None이면 모든 클래스)
        @param {int} blur_strength - 블러 강도 (홀수 권장)
        """
        if self.video_track:
            self.video_track.enable_object_blur(enable, blur_classes, blur_strength)
