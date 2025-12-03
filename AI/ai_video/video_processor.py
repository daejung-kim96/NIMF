"""
비디오 프레임 처리 모듈
@module video_processor
@author joon hyeok
@date 2025-01-08
@description 비디오 프레임을 처리하는 VideoProcessor 클래스입니다.
"""

import asyncio
import numpy as np
import cv2
import json
import threading
import queue
from time import time
from datetime import datetime
from typing import List, Dict, Optional, Callable
from aiortc import MediaStreamTrack
from av import VideoFrame

from .object_detector import (
    YOLODetector,
    DetectionFilter,
    DetectionVisualizer,
    DetectionResult
)
from config import config
from session_state_manager import session_state_manager

# 클래스 이름과 카테고리 매핑
CLASS_CATEGORY_MAPPING = {
    0: '음주',
    1: '음주',
    2: '날카로운 도구',
    3: '흡연',
    4: '날카로운 도구',
    5: '날카로운 도구',
    6: '화기류',
    7: '총기류',
    8: '화기류'
}

# 클래스 이름 매핑 (class_id -> class_name)
CLASS_NAMES = {
    0: '술',
    1: '술잔', 
    2: '드라이버',
    3: '담배',
    4: '커터칼',
    5: '칼',
    6: '불',
    7: '총',
    8: '라이터'
}

# 전역 YOLO 모델 인스턴스 (서버 시작 시 한 번만 로드)
_global_yolo_detector = None
_global_model_path = None

def initialize_global_yolo_model():
    """
    전역 YOLO 모델을 초기화합니다.
    서버 시작 시 한 번만 호출되어야 합니다.
    
    @param {str} model_path - YOLO 모델 경로
    @returns {bool} 초기화 성공 여부
    """
    global _global_yolo_detector, _global_model_path
    
    # 모델 경로 설정에서 가져옴
    model_path = config.get_yolo_model_path()
    
    try:
        print(f"🔧 전역 YOLO 모델 초기화 시작: {model_path}")
        _global_yolo_detector = YOLODetector(model_path=model_path, confidence_threshold=config.OBJECT_DETECTION_CONFIDENCE)
        
        if _global_yolo_detector.initialize():
            _global_model_path = model_path
            print(f"✅ 전역 YOLO 모델 초기화 완료: {model_path}")
            return True
        else:
            print("❌ 전역 YOLO 모델 초기화 실패")
            _global_yolo_detector = None
            return False
            
    except Exception as e:
        print(f"❌ 전역 YOLO 모델 초기화 중 오류: {e}")
        _global_yolo_detector = None
        return False

def get_global_yolo_detector():
    """
    전역 YOLO 모델 인스턴스를 반환합니다.
    
    @returns {YOLODetector|None} 전역 YOLO 모델 인스턴스
    """
    return _global_yolo_detector

def is_global_yolo_initialized():
    """
    전역 YOLO 모델이 초기화되었는지 확인합니다.
    
    @returns {bool} 초기화 여부
    """
    return _global_yolo_detector is not None


def _categories_to_enabled_class_ids(video_category_flags: Dict[str, bool]) -> list:
    """
    세션의 videoFilter.category 플래그를 YOLO 클래스 ID 배열로 변환합니다.
    카테고리 키 예: smoke, drink, sharpObjects, flammables, firearms, exposure
    """
    if not video_category_flags:
        return []

    # 카테고리 → 클래스 ID 매핑 정의
    category_to_class_ids = {
        # 흡연
        'smoke': [3],
        # 음주
        'drink': [0, 1],
        # 날카로운 도구
        'sharpObjects': [2, 4, 5],
        # 인화물/가연물(불, 라이터 포함)
        'flammables': [6, 8],
        # 총기류
        'firearms': [7],
        # 노출(현재 해당 클래스 없음)
        'exposure': [],
    }

    enabled_ids = set()
    for category_key, is_enabled in video_category_flags.items():
        if is_enabled:
            enabled_ids.update(category_to_class_ids.get(category_key, []))
    return sorted(enabled_ids)


class VideoProcessor:
    """
    비디오 프레임 처리 클래스
    
    비디오 프레임에 대한 다양한 처리를 수행합니다.
    """
    data_channel = None

    def __init__(self):
        """
        VideoProcessor 초기화
        
        """
        self.frame_count = 0
        self.processing_stats = {
            'total_frames': 0,
            'processed_frames': 0,
            'processing_time': 0.0,
            'detection_time': 0.0,
            'objects_detected': 0,
            'avg_fps': 0.0
        }
        
        # FPS 계산을 위한 간단한 상태
        self._fps_start_time = None
        self._fps_processed_frames = 0
        self._fps_logged_30s = False
        
        # ByteTrack ID 관리
        self.max_track_id = -1  # 지금까지 본 가장 큰 track_id
        
        # 세션 ID (세션별 필터 적용용)
        self.session_id: Optional[str] = None

        # 물체 감지 관련 컴포넌트
        self.enable_object_detection = True
        self.object_detector = None
        self.detection_filter = DetectionFilter()
        self.visualizer = DetectionVisualizer()
        self.current_detections: List[DetectionResult] = []
        # 클래스별로 이미 전송한 ByteTrack ID 집합 저장: { class_id: set(track_ids) }
        self.seen_track_ids_by_class: Dict[int, set] = {}
        
        # 물체 감지 콜백 함수들
        self.detection_callbacks: List[Callable[[List[DetectionResult]], None]] = []
        
        # 별도 스레드 처리를 위한 큐와 스레드
        self.processed_frame_queue = queue.Queue(maxsize=10)  # 처리된 프레임 큐
        self.last_processed_frame = None  # 마지막 처리된 프레임 (복제용)
        self.processing_thread = None
        self.processing_thread_running = False
        
        # 출력 스무딩을 위한 출력 버퍼 큐 (이미지+타이밍 페어로 저장)
        self.output_frame_queue = queue.Queue(maxsize=120)  # (img, pts, time_base)
        self.output_buffer_target = 15  # 정적 구간에서 버퍼 목표 크기
        
        # 감지 주기: N프레임마다 1회 감지, 나머지는 직전 결과 재사용
        self.detection_stride = 3
        self._worker_frame_index = 0
        
        # 모션 기반 스킵 설정
        self.motion_enabled = True
        self.motion_threshold = 0.02  # 변경 픽셀 비율 임계치 (2%)
        self.motion_downscale = (160, 90)  # 모션 계산용 다운스케일 해상도
        self.max_skip_without_detection = self.detection_stride * 3  # 안전 주기
        self._prev_motion_frame_small = None
        self._frames_since_last_detection = self.detection_stride  # 초기 감지 허용을 위해 stride만큼 채움

        # 동적 스트라이드 설정
        self.dynamic_stride_enabled = True
        self.min_detection_stride = 1
        self.max_detection_stride = 10
        # 히스테리시스 임계값(EMA 기준): 높을수록 더 자주 줄이고, 낮을수록 더 자주 늘림
        self.high_motion_threshold = 0.05
        self.low_motion_threshold = 0.01
        # 모션 EMA 설정
        self._ema_motion = 0.0
        self._ema_alpha = 0.3
        # 스트라이드 변경 쿨다운
        self._stride_cooldown_frames = 5
        self._frames_since_last_stride_update = self._stride_cooldown_frames

        # 모션 온셋 버스트 및 모션 중 최소 간격 설정
        self.motion_stride = 1  # 모션 중 최소 감지 간격(프레임)
        self.motion_burst_enabled = True
        self.motion_burst_frames = 3  # 모션 시작 시 연속 감지 프레임 수
        self._motion_burst_remaining = 0
        self._motion_prev_above = False
        
        # 동적 블러 샘플링 상태 변수 초기화
        self._frames_since_last_blur_draw = 0
        self._last_blurred_image = None

        # 물체 감지 초기화
        self._initialize_object_detection()
        
        # 기본: 블러 비활성화 (videofilter.action.filtering=true일 때만 활성화)
        self.visualizer.enable_object_blur(enable=False, blur_classes=None, blur_strength=self.visualizer.blur_strength)
        print("🔓 기본 블러 비활성화 (videofilter.action.filtering=true일 때만 적용)")
        
        # 기본: 클래스 필터 사용 + 허용 집합 비워서(=모두 차단) 시작
        self.detection_filter.use_class_filter = True
        self.detection_filter.set_class_filter([])

        # 별도 스레드 시작
        self._start_processing_thread()
    
    def _start_processing_thread(self):
        """별도 스레드에서 프레임 처리를 시작합니다."""
        if self.processing_thread_running:
            return
        
        self.processing_thread_running = True
        self.processing_thread = threading.Thread(target=self._processing_thread_worker, daemon=True)
        self.processing_thread.start()
        print("🔄 별도 스레드에서 프레임 처리 시작")
    
    def _stop_processing_thread(self):
        """별도 스레드를 중지합니다."""
        self.processing_thread_running = False
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=1.0)
        print("🛑 별도 스레드에서 프레임 처리 중지")
    
    def _processing_thread_worker(self):
        """별도 스레드에서 실행되는 프레임 처리 워커"""
        while self.processing_thread_running:
            try:
                # 큐에서 프레임 가져오기 (1초 타임아웃)
                frame_data = self.processed_frame_queue.get(timeout=1.0)
                if frame_data is None:  # 종료 신호
                    break
                
                img, original_frame = frame_data
                
                # 프레임 인덱스 증가 (워커 기준)
                self._worker_frame_index += 1
                
                # 물체 감지 실행 (별도 스레드에서)
                if self.enable_object_detection:
                    detections = []
                    # 모션 비율 계산
                    motion_ratio = 0.0
                    if self.motion_enabled:
                        try:
                            motion_ratio = self._compute_motion_ratio(img)
                        except Exception as _:
                            motion_ratio = 0.0
                    
                    # 감지 실행 조건
                    allow_window = (self._frames_since_last_detection >= self.detection_stride)
                    safety_due = (self._frames_since_last_detection >= self.max_skip_without_detection)
                    motion_trigger = (motion_ratio >= self.motion_threshold)

                    # 모션 온셋(burst) 감지: 임계치 하->상 교차 시 즉시 몇 프레임 연속 감지
                    if self.motion_burst_enabled:
                        if (not self._motion_prev_above) and motion_trigger:
                            self._motion_burst_remaining = self.motion_burst_frames
                        self._motion_prev_above = motion_trigger

                    in_burst = (self._motion_burst_remaining > 0)

                    # 모션 중 최소 간격 적용: 모션이 계속되는 동안엔 motion_stride 기준 허용
                    motion_window = (self._frames_since_last_detection >= self.motion_stride) if motion_trigger else allow_window

                    run_detection = (motion_trigger and motion_window) or in_burst or safety_due
                    
                    if run_detection:
                        detections = self._detect_objects_thread_safe(img)
                        self._frames_since_last_detection = 0
                        if in_burst:
                            self._motion_burst_remaining = max(0, self._motion_burst_remaining - 1)
                    else:
                        detections = self.current_detections
                        self._frames_since_last_detection += 1
                    
                    # 감지 결과 시각화 (동적 블러 샘플링)
                    if detections:
                        do_draw = True
                        if not motion_trigger:
                            # 정적 구간: 매 N프레임마다 새로 블러 계산하고, 그 외에는 캐시된 블러 이미지 재사용
                            self._frames_since_last_blur_draw = getattr(self, "_frames_since_last_blur_draw", 0) + 1
                            static_n = getattr(self, "blur_sample_static_n", 5)
                            do_draw = (self._frames_since_last_blur_draw >= static_n)

                        if do_draw or motion_trigger:
                            # 동적 구간은 항상 새로 블러, 정적 구간은 샘플링 간격마다 블러 갱신
                            print(f"✅ {len(detections)}개 물체 감지됨 (재사용 포함)")
                            blurred = self.visualizer.draw_detections(img, detections)
                            self._last_blurred_image = blurred
                            img = blurred
                            self._frames_since_last_blur_draw = 0 if not motion_trigger else self._frames_since_last_blur_draw
                        else:
                            # 정적 구간 샘플링 프레임이 아니면 이전 블러 이미지를 재사용하여 항상 블러 상태 유지
                            if self._last_blurred_image is not None:
                                img = self._last_blurred_image
                            else:
                                # 캐시가 없으면 한 번 생성
                                blurred = self.visualizer.draw_detections(img, detections)
                                self._last_blurred_image = blurred
                                img = blurred
                        # img = self.visualizer.draw_detection_count(img, detections)
                    # else:
                    #     print("📭 물체 감지 결과 없음")

                    # 동적 스트라이드 업데이트
                    if self.dynamic_stride_enabled:
                        self._update_dynamic_stride(motion_ratio)
                
                # 표준 해상도(1280x720)로 리사이즈
                try:
                    img = cv2.resize(img, (1280, 720))
                except Exception as e:
                    print(f"리사이즈 중 오류: {e}")
                
                # 처리된 이미지를 VideoFrame으로 변환
                # 출력 스무딩: 처리 이미지와 원본 타임스탬프를 함께 큐에 저장
                try:
                    self.output_frame_queue.put_nowait((img, original_frame.pts, original_frame.time_base))
                except queue.Full:
                    try:
                        _ = self.output_frame_queue.get_nowait()
                        self.output_frame_queue.put_nowait((img, original_frame.pts, original_frame.time_base))
                    except Exception:
                        pass
                
                # 마지막 처리된 프레임 업데이트: 즉시 전송 경로를 위해서도 유지 (fallback)
                try:
                    processed_frame = VideoFrame.from_ndarray(img, format='bgr24')
                    processed_frame.pts = original_frame.pts
                    processed_frame.time_base = original_frame.time_base
                    self.last_processed_frame = processed_frame
                except Exception:
                    pass
                
                # 평균 FPS 업데이트 (처리된 프레임 수 / 경과 시간)
                now = time()
                if self._fps_start_time is None:
                    self._fps_start_time = now
                self._fps_processed_frames += 1
                elapsed = max(now - self._fps_start_time, 1e-6)
                self.processing_stats['avg_fps'] = self._fps_processed_frames / elapsed
                
                # 최초 30초 경과 후 한 번만 평균 FPS 출력
                if not self._fps_logged_30s and elapsed >= 30.0:
                    print(f"📈 평균 처리 FPS(30초): {self.processing_stats['avg_fps']:.2f}")
                    self._fps_logged_30s = True
                
                # print(f"🔄 프레임 처리 완료 (스레드): {self.frame_count}")
                
            except queue.Empty:
                continue  # 타임아웃 시 계속 대기
            except Exception as e:
                print(f"❌ 별도 스레드 처리 중 오류: {e}")
                continue
    
    def _detect_objects_thread_safe(self, img: np.ndarray) -> List[DetectionResult]:
        """스레드 안전한 물체 감지 (별도 스레드에서 호출)"""
        if not self.enable_object_detection:
            return []
        
        if not self.object_detector:
            return []
        
        start_time = time()
        
        try:
            # 물체 감지 실행
            detections = self.object_detector.detect(img)
            
            # 필터링 적용
            filtered_detections = self.detection_filter.filter_detections(detections)
            
            # Data Channel 전송은 JSON 형태로만 가능하므로 여기서는 전송하지 않음
            # 대신 _send_detection_results_via_data_channel에서 처리

            # 통계 업데이트
            detection_time = time() - start_time
            self.processing_stats['detection_time'] += detection_time
            self.processing_stats['objects_detected'] += len(filtered_detections)
            
            # 현재 감지 결과 저장
            self.current_detections = filtered_detections
            
            # Data Channel 전송은 메인 스레드에서 처리하므로 여기서는 건너뜀
            # 대신 감지 결과만 저장하고 메인 스레드에서 처리
            
            return filtered_detections
            
        except Exception as e:
            print(f"물체 감지 중 오류: {e}")
            return []

    def _compute_motion_ratio(self, img: np.ndarray) -> float:
        """저해상도 그레이스케일 차분으로 프레임 간 모션 비율(0~1)을 계산합니다."""
        # 다운스케일 및 그레이스케일 변환
        try:
            small = cv2.resize(img, self.motion_downscale)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        except Exception:
            return 0.0

        # 첫 프레임 처리
        if self._prev_motion_frame_small is None:
            self._prev_motion_frame_small = gray
            return 1.0  # 첫 프레임은 강제 감지 유도

        # 절대 차이 및 이진화
        diff = cv2.absdiff(self._prev_motion_frame_small, gray)
        # 노이즈 억제를 위한 임계값(조정 가능)
        _, thresh = cv2.threshold(diff, 20, 255, cv2.THRESH_BINARY)

        # 변경 픽셀 비율 계산
        changed = int(np.count_nonzero(thresh))
        total = thresh.size
        ratio = changed / max(1, total)

        # 이전 프레임 업데이트
        self._prev_motion_frame_small = gray
        return float(ratio)

    def _update_dynamic_stride(self, motion_ratio: float) -> None:
        """모션 EMA를 기반으로 detection_stride를 동적으로 조절합니다."""
        # EMA 업데이트
        self._ema_motion = (self._ema_alpha * motion_ratio) + ((1.0 - self._ema_alpha) * self._ema_motion)

        # 쿨다운 체크
        if self._frames_since_last_stride_update < self._stride_cooldown_frames:
            self._frames_since_last_stride_update += 1
            return

        # 히스테리시스 기반 조정
        new_stride = self.detection_stride
        if self._ema_motion >= self.high_motion_threshold:
            new_stride = max(self.min_detection_stride, self.detection_stride - 1)
        elif self._ema_motion <= self.low_motion_threshold:
            new_stride = min(self.max_detection_stride, self.detection_stride + 1)

        if new_stride != self.detection_stride:
            self.detection_stride = new_stride
            # 안전 주기도 함께 조정 (비례적으로)
            self.max_skip_without_detection = max(self.detection_stride * 2, min(self.detection_stride * 5, self.max_detection_stride * 3))
            self._frames_since_last_stride_update = 0
    
    def _initialize_object_detection(self):
        """
        물체 감지 모델을 초기화합니다.
        전역 YOLO 모델을 사용합니다.
        """
        if not self.enable_object_detection:
            print("⚠️ 물체 감지가 비활성화되어 있습니다.")
            return
        
        # 전역 YOLO 모델 가져오기
        self.object_detector = get_global_yolo_detector()
        
        if self.object_detector:
            print("✅ 물체 감지 모델 초기화 완료")
            print(f"   모델 경로: {_global_model_path}")
        else:
            print("❌ 물체 감지 모델 초기화 실패")
            print("   전역 YOLO 모델이 초기화되지 않았습니다.")

        # 세션별 기존 설정이 있으면 즉시 반영
        if self.session_id:
            try:
                category_flags = session_state_manager.get_video_filter(self.session_id)
                enabled_ids = _categories_to_enabled_class_ids(category_flags)
                self.detection_filter.use_class_filter = True
                self.detection_filter.set_class_filter(enabled_ids)
                print(f"🎯 세션 {self.session_id} 클래스 필터 초기 적용: {enabled_ids}")
                # 블러 플래그도 적용
                self._apply_blur_flag_from_session(self.session_id)
            except Exception:
                pass
    
    def process_frame(self, frame: VideoFrame) -> VideoFrame:
        """
        비디오 프레임을 처리합니다.
        별도 스레드에 프레임을 전달하고 즉시 반환합니다.
        
        @param {VideoFrame} frame - 처리할 비디오 프레임
        @returns {VideoFrame} 처리된 비디오 프레임 (즉시 반환)
        """
        start_time = time()
        
        try:
            # 프레임을 numpy 배열로 변환
            img = frame.to_ndarray(format='bgr24')
            
            # 프레임 카운터 증가
            self.frame_count += 1
            
            # 별도 스레드에 프레임 전달 (큐가 가득 찬 경우 기존 항목 제거)
            try:
                if self.processed_frame_queue.full():
                    try:
                        self.processed_frame_queue.get_nowait()  # 기존 항목 제거
                    except queue.Empty:
                        pass
                
                self.processed_frame_queue.put_nowait((img, frame))
                # print(f"📤 프레임을 별도 스레드에 전달: {self.frame_count}")
            except queue.Full:
                print(f"⚠️ 프레임 큐가 가득 참, 프레임 스킵: {self.frame_count}")
            
            # 통계 업데이트
            self._update_stats(time() - start_time)
            
            # 즉시 원본 프레임 반환 (처리는 별도 스레드에서)
            return frame
            
        except Exception as e:
            print(f"비디오 프레임 처리 중 오류: {e}")
            return frame
    
    def get_processed_frame(self) -> Optional[VideoFrame]:
        """
        처리된 프레임을 반환합니다.
        출력 버퍼 큐에 프레임이 있으면 타이밍 큐의 PTS/time_base와 매칭하여 생성합니다.
        처리된 프레임이 없으면 이전 프레임을 복제하여 반환합니다.
        
        @returns {VideoFrame|None} 처리된 프레임 또는 이전 프레임 복제본
        """
        # 출력 버퍼 우선 사용 (이미지+타이밍 같이 보관)
        try:
            if not self.output_frame_queue.empty():
                img, pts, time_base = self.output_frame_queue.get_nowait()
                vf = VideoFrame.from_ndarray(img, format='bgr24')
                vf.pts = pts
                vf.time_base = time_base
                # 최신 프레임으로도 보관 (fallback 대비)
                self.last_processed_frame = vf
                return vf
        except Exception:
            pass
        
        if self.last_processed_frame is not None:
            return self.last_processed_frame
        return None
    

    
    def add_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 추가합니다.
        
        @param {Callable} callback - 감지 결과를 처리할 콜백 함수
        """
        self.detection_callbacks.append(callback)
    
    def remove_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 제거합니다.
        
        @param {Callable} callback - 제거할 콜백 함수
        """
        if callback in self.detection_callbacks:
            self.detection_callbacks.remove(callback)
    
    def set_detection_filter(self, enabled_classes: Optional[List[int]] = None, 
                           confidence_range: Optional[tuple] = None,
                           area_range: Optional[tuple] = None):
        """
        감지 필터를 설정합니다.
        
        @param {List[int]} enabled_classes - 활성화할 클래스 ID 목록
        @param {tuple} confidence_range - 신뢰도 범위 (min, max)
        @param {tuple} area_range - 면적 범위 (min, max)
        """
        if enabled_classes is not None:
            self.detection_filter.set_class_filter(enabled_classes)
        
        if confidence_range is not None:
            min_conf, max_conf = confidence_range
            self.detection_filter.set_confidence_range(min_conf, max_conf)
        
        if area_range is not None:
            min_area, max_area = area_range
            self.detection_filter.set_area_range(min_area, max_area)
    
    def get_current_detections(self) -> List[DetectionResult]:
        """
        현재 프레임의 감지 결과를 반환합니다.
        
        @returns {List[DetectionResult]} 현재 감지 결과
        """
        return self.current_detections.copy()
    
    def get_detection_stats(self) -> Dict:
        """
        물체 감지 통계를 반환합니다.
        
        @returns {Dict} 감지 통계
        """
        if not self.object_detector:
            return {}
        
        stats = self.object_detector.get_stats()
        stats.update({
            'detection_time': self.processing_stats['detection_time'],
            'objects_detected': self.processing_stats['objects_detected']
        })
        return stats
    
    def reset_detection_stats(self):
        """
        물체 감지 통계를 초기화합니다.
        """
        if self.object_detector:
            self.object_detector.reset_stats()
        
        self.processing_stats['detection_time'] = 0.0
        self.processing_stats['objects_detected'] = 0
    
    def enable_object_blur(self, enable: bool = True, blur_classes: Optional[List[int]] = None, blur_strength: int = 50):
        """
        물체 블러 기능을 설정합니다.
        
        @param {bool} enable - 블러 기능 활성화 여부
        @param {List[int]} blur_classes - 블러 적용할 클래스 ID 목록 (None이면 모든 클래스)
        @param {int} blur_strength - 블러 강도 (홀수 권장)
        """
        self.visualizer.enable_object_blur(enable, blur_classes, blur_strength)
        if enable:
            print(f"🔒 물체 블러 기능이 활성화되었습니다. (강도: {blur_strength})")
            if blur_classes:
                print(f"   블러 적용 클래스: {blur_classes}")
            else:
                print("   모든 감지된 물체에 블러 적용")
        else:
            print("🔓 물체 블러 기능이 비활성화되었습니다.")
    
    def _apply_basic_processing(self, img: np.ndarray) -> np.ndarray:
        """
        기본 비디오 처리 작업을 적용합니다.
        별도 스레드에서 호출됩니다.
        
        @param {np.ndarray} img - 처리할 이미지
        @returns {np.ndarray} 처리된 이미지
        """
        processed_img = img.copy()
        
        # 물체 감지 실행 (별도 스레드에서 이미 처리됨)
        if self.enable_object_detection:
            print(f"🔍 물체 감지 실행 중... (프레임 {self.frame_count})")
            detections = self._detect_objects_thread_safe(processed_img)
            
            # 감지 결과 시각화 (옵션)
            if detections:
                print(f"✅ {len(detections)}개 물체 감지됨")
                processed_img = self.visualizer.draw_detections(processed_img, detections)
                processed_img = self.visualizer.draw_detection_count(processed_img, detections)
            else:
                print("📭 물체 감지 결과 없음")
        
        # 표준 해상도(1280x720)로 리사이즈하여 스트리밍 서버 raw 파이프 규격에 맞춤
        try:
            processed_img = cv2.resize(processed_img, (1280, 720))
        except Exception as e:
            print(f"리사이즈 중 오류: {e}")
        
        # 여기에 추가적인 비디오 처리 로직을 추가할 수 있습니다
        # 예: 리사이즈, 필터링, 효과 적용 등
        
        return processed_img
    
    def _update_stats(self, processing_time: float):
        """
        처리 통계를 업데이트합니다.
        
        @param {float} processing_time - 처리 시간
        """
        self.processing_stats['total_frames'] += 1
        self.processing_stats['processed_frames'] += 1
        self.processing_stats['processing_time'] += processing_time
    
    def get_stats(self) -> dict:
        """
        처리 통계를 반환합니다.
        
        @returns {dict} 처리 통계
        """
        stats = self.processing_stats.copy()
        if stats['processed_frames'] > 0:
            stats['avg_processing_time'] = (
                stats['processing_time'] / stats['processed_frames']
            )
        return stats
    
    def reset_stats(self):
        """
        처리 통계를 초기화합니다.
        """
        self.processing_stats = {
            'total_frames': 0,
            'processed_frames': 0,
            'processing_time': 0.0,
            'detection_time': 0.0,
            'objects_detected': 0,
            'avg_fps': 0.0
        }
        
        # FPS 상태 초기화
        self._fps_start_time = None
        self._fps_processed_frames = 0
        self._fps_logged_30s = False
    
    def set_data_channel(self, data_channel):
        """
        Data Channel을 설정합니다.
        
        @param {RTCDataChannel} data_channel - 설정할 Data Channel
        """
        self.data_channel = data_channel
        print(f"📡 VideoProcessor에 Data Channel 설정됨: {data_channel.label}")
        
        # 물체 감지기에도 Data Channel 전달
        if hasattr(self, 'object_detector') and self.object_detector:
            if hasattr(self.object_detector, 'set_data_channel'):
                self.object_detector.set_data_channel(data_channel)

    def set_session_id(self, session_id: str) -> None:
        """세션 ID 설정 및 세션 저장소의 필터를 즉시 반영"""
        self.session_id = session_id
        # 세션 변경 시, 클래스별 seen ID 초기화
        self.seen_track_ids_by_class = {}
        try:
            category_flags = session_state_manager.get_video_filter(session_id)
            enabled_ids = _categories_to_enabled_class_ids(category_flags)
            self.detection_filter.use_class_filter = True
            self.detection_filter.set_class_filter(enabled_ids)
            print(f"🎯 세션 {session_id} 클래스 필터 적용: {enabled_ids}")
            # 블러 플래그 적용
            self._apply_blur_flag_from_session(session_id)
        except Exception as e:
            print(f"세션 필터 적용 실패(session {session_id}): {e}")

    def apply_video_filter_for_session(self, session_id: str) -> None:
        """외부에서 호출: 세션의 비디오 카테고리 설정을 읽어 클래스 필터 갱신"""
        try:
            category_flags = session_state_manager.get_video_filter(session_id)
            enabled_ids = _categories_to_enabled_class_ids(category_flags)
            self.detection_filter.use_class_filter = True
            self.detection_filter.set_class_filter(enabled_ids)
            print(f"🎯 세션 {session_id} 클래스 필터 갱신: {enabled_ids}")
            # 블러 플래그도 함께 갱신
            self._apply_blur_flag_from_session(session_id)
        except Exception as e:
            print(f"세션 비디오 필터 갱신 실패(session {session_id}): {e}")

    def _apply_blur_flag_from_session(self, session_id: str) -> None:
        """세션 저장소의 videoFilter.action.filtering 값을 읽어 블러 on/off 설정"""
        try:
            session_filter = session_state_manager.get_session_filter(session_id)
            video_filter = (session_filter or {}).get('videoFilter')
            action = (video_filter or {}).get('action') or {}
            blur_enable = bool(action.get('filtering', False))
            self.visualizer.enable_object_blur(enable=blur_enable, blur_classes=None, blur_strength=self.visualizer.blur_strength)
            if blur_enable:
                print(f"🔒 세션 {session_id} 블러 활성화 (filtering=true)")
            else:
                print(f"🔓 세션 {session_id} 블러 비활성화 (filtering=false)")
        except Exception as e:
            print(f"세션 블러 플래그 적용 실패(session {session_id}): {e}")
    
    def process_detection_results(self):
        """
        메인 스레드에서 감지 결과를 Data Channel로 전송합니다.
        클래스별로 새로운 ByteTrack ID가 등장할 때만 1회 전송합니다.
        """
        if not self.data_channel or not self.current_detections:
            return
        
        try:
            # 현재 감지 결과를 복사하여 처리
            detections = self.current_detections.copy()
            sent_any = False
            # 현재 시간을 HH:MM:SS 형식으로 변환
            current_time = datetime.now()
            time_str = current_time.strftime("%H:%M:%S")
            
            for detection in detections:
                # ByteTrack ID가 없으면 스킵
                if detection.track_id is None:
                    continue
                class_id = detection.class_id
                track_id = detection.track_id
                # 클래스별로 이미 본 ID인지 확인
                seen_set = self.seen_track_ids_by_class.get(class_id)
                if seen_set is None:
                    seen_set = set()
                    self.seen_track_ids_by_class[class_id] = seen_set
                if track_id in seen_set:
                    continue
                # 새로운 ID → 전송하고 기록
                seen_set.add(track_id)
                sent_any = True
                # 클래스 이름과 카테고리 가져오기
                category = CLASS_CATEGORY_MAPPING.get(detection.class_id, '기타')
                detail = CLASS_NAMES.get(detection.class_id, '알 수 없음')
                
                # 각 감지 결과를 개별적으로 전송
                message = {
                    'type': 'video',
                    'category': category,
                    'detail': detail,
                    'time': time_str,
                }
                
                # JSON으로 직렬화하여 전송
                try:
                    json_message = json.dumps(message, ensure_ascii=False)
                    self.data_channel.send(json_message)
                    print(f"📨 신규 ID 감지 전송: class={class_id} id={track_id} category={category} detail={detail}")
                except Exception as json_error:
                    print(f"❌ JSON 직렬화 오류: {json_error}")
                    # 간단한 메시지로 재시도
                    simple_message = {
                        'type': 'video',
                        'category': category,
                        'detail': detail,
                        'time': time_str
                    }
                    try:
                        json_message = json.dumps(simple_message, ensure_ascii=False)
                        self.data_channel.send(json_message)
                        print(f"📨 신규 ID 간단 전송: class={class_id} id={track_id} category={category}")
                    except Exception as retry_error:
                        print(f"❌ 재시도 전송 오류: {retry_error}")
            
            # 전송 완료 후 감지 결과 초기화 (중복 전송 방지)
            if sent_any:
                self.current_detections = []
            
        except Exception as e:
            print(f"❌ Data Channel 전송 중 오류: {e}")
    
    def add_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 추가합니다.
        
        @param {Callable} callback - 감지 결과를 처리할 콜백 함수
        """
        self.detection_callbacks.append(callback)
    
    def remove_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 제거합니다.
        
        @param {Callable} callback - 제거할 콜백 함수
        """
        if callback in self.detection_callbacks:
            self.detection_callbacks.remove(callback)
    
    def set_detection_filter(self, enabled_classes: Optional[List[int]] = None, 
                           confidence_range: Optional[tuple] = None,
                           area_range: Optional[tuple] = None):
        """
        감지 필터를 설정합니다.
        
        @param {List[int]} enabled_classes - 활성화할 클래스 ID 목록
        @param {tuple} confidence_range - 신뢰도 범위 (min, max)
        @param {tuple} area_range - 면적 범위 (min, max)
        """
        if enabled_classes is not None:
            self.detection_filter.set_class_filter(enabled_classes)
        
        if confidence_range is not None:
            min_conf, max_conf = confidence_range
            self.detection_filter.set_confidence_range(min_conf, max_conf)
        
        if area_range is not None:
            min_area, max_area = area_range
            self.detection_filter.set_area_range(min_area, max_area)
    
    def get_current_detections(self) -> List[DetectionResult]:
        """
        현재 프레임의 감지 결과를 반환합니다.
        
        @returns {List[DetectionResult]} 현재 감지 결과
        """
        return self.current_detections.copy()
    
    def get_detection_stats(self) -> Dict:
        """
        물체 감지 통계를 반환합니다.
        
        @returns {Dict} 감지 통계
        """
        if not self.object_detector:
            return {}
        
        stats = self.object_detector.get_stats()
        stats.update({
            'detection_time': self.processing_stats['detection_time'],
            'objects_detected': self.processing_stats['objects_detected']
        })
        return stats
    
    def reset_detection_stats(self):
        """
        물체 감지 통계를 초기화합니다.
        """
        if self.object_detector:
            self.object_detector.reset_stats()
        
        self.processing_stats['detection_time'] = 0.0
        self.processing_stats['objects_detected'] = 0
    
    def enable_object_blur(self, enable: bool = True, blur_classes: Optional[List[int]] = None, blur_strength: int = 15):
        """
        물체 블러 기능을 설정합니다.
        
        @param {bool} enable - 블러 기능 활성화 여부
        @param {List[int]} blur_classes - 블러 적용할 클래스 ID 목록 (None이면 모든 클래스)
        @param {int} blur_strength - 블러 강도 (홀수 권장)
        """
        self.visualizer.enable_object_blur(enable, blur_classes, blur_strength)
        if enable:
            print(f"🔒 물체 블러 기능이 활성화되었습니다. (강도: {blur_strength})")
            if blur_classes:
                print(f"   블러 적용 클래스: {blur_classes}")
            else:
                print("   모든 감지된 물체에 블러 적용")
        else:
            print("🔓 물체 블러 기능이 비활성화되었습니다.")


class VideoEchoTrack(MediaStreamTrack):
    """
    비디오 에코 트랙 클래스
    
    클라이언트로부터 받은 비디오 프레임을 처리하고 다시 전송하는 역할을 담당합니다.
    """
    kind = "video"
    data_channel = None
    
    def __init__(self, track):
        """
        VideoEchoTrack 초기화
        
        @param {MediaStreamTrack} track - 원본 비디오 트랙
        """
        super().__init__()
        self.track = track
        self.video_processor = VideoProcessor()
        
        # 프레임 전송을 위한 상태 관리
        self._last_sent_frame = None  # 마지막으로 전송한 프레임
        self._frame_interval = 1.0 / 30.0  # 30fps 기준 (약 33ms)
        self._last_send_time = 0.0
        self._processing_task: Optional[asyncio.Task] = None
        self._closed: bool = False
        # PTS 기반 재생 타임라인 상태
        self._playout_start_pts: Optional[int] = None
        self._playout_start_time: float = 0.0
        # 보류 중인 프레임(시간 도래 전 미리 꺼낸 프레임 보관)
        self._pending_frame: Optional[VideoFrame] = None
        self._pending_target_time: float = 0.0
        
        # 백그라운드 처리 루프 시작
        loop = asyncio.get_event_loop()
        self._processing_task = loop.create_task(self._processing_loop())
    
    async def recv(self):
        """
        처리된 비디오 프레임을 반환합니다.
        별도 스레드에서 처리된 프레임이 있으면 사용하고, 없으면 이전 프레임을 복제하여 전송합니다.
        """
        current_time = time()
        
        # 프레임 전송 간격 체크 (30fps 제한)
        if current_time - self._last_send_time < self._frame_interval:
            # 이전 프레임을 복제하여 전송
            if self._last_sent_frame is not None:
                return self._last_sent_frame
        
        # 보류 프레임이 있고 아직 재생 시각이 아니면 이전 프레임 유지
        if self._pending_frame is not None:
            if current_time + 0.0005 < self._pending_target_time and self._last_sent_frame is not None:
                return self._last_sent_frame
            else:
                # 시각 도래 → 보류 프레임 송출
                processed_frame = self._pending_frame
                self._pending_frame = None
                self._pending_target_time = 0.0
                self._last_sent_frame = processed_frame
                self._last_send_time = current_time
                self.video_processor.process_detection_results()
                return processed_frame

        # VideoProcessor에서 처리된 프레임 가져오기
        processed_frame = self.video_processor.get_processed_frame()
        
        if processed_frame is not None:
            # PTS 기반 재생 타임라인 매핑
            try:
                frame_pts = processed_frame.pts
                frame_tb = processed_frame.time_base
                if frame_pts is not None and frame_tb is not None:
                    if self._playout_start_pts is None:
                        self._playout_start_pts = frame_pts
                        self._playout_start_time = current_time
                    delta_pts = frame_pts - self._playout_start_pts
                    target_time = self._playout_start_time + (delta_pts * float(frame_tb))
                    if current_time + 0.0005 < target_time and self._last_sent_frame is not None:
                        # 아직 재생 시각이 아니면 보류 후 직전 프레임 유지
                        self._pending_frame = processed_frame
                        self._pending_target_time = target_time
                        return self._last_sent_frame
                # 즉시 송출
            except Exception:
                pass

            self._last_sent_frame = processed_frame
            self._last_send_time = current_time
            
            # 메인 스레드에서 감지 결과 처리
            self.video_processor.process_detection_results()
            
            # print(f"📤 처리된 프레임 전송: {self.video_processor.frame_count}")
            return processed_frame
        else:
            # 처리된 프레임이 없으면 원본 프레임 사용
            original_frame = await self.track.recv()
            
            # PTS 문제 해결: 프레임 복제 시 올바른 PTS 설정
            if self._last_sent_frame is None:
                # 첫 번째 프레임인 경우 원본 사용
                self._last_sent_frame = original_frame
                self._last_send_time = current_time
                print(f"📤 원본 프레임 전송 (처리된 프레임 없음)")
                return original_frame
            else:
                                 # 이전 프레임을 복제하여 전송하되, 올바른 PTS 설정
                 # VideoFrame을 numpy 배열로 변환 후 다시 VideoFrame으로 생성
                 img_array = self._last_sent_frame.to_ndarray(format='bgr24')
                 cloned_frame = VideoFrame.from_ndarray(img_array, format='bgr24')
                 cloned_frame.pts = original_frame.pts
                 cloned_frame.time_base = original_frame.time_base
                 # rate 속성은 VideoFrame에 없으므로 제거
                 self._last_send_time = current_time
                 print(f"📤 이전 프레임 복제 전송 (처리된 프레임 없음)")
                 return cloned_frame

    async def _processing_loop(self) -> None:
        """원본 트랙에서 프레임을 지속적으로 읽어 별도 스레드에 전달."""
        try:
            while not self._closed:
                frame = await self.track.recv()
                try:
                    # VideoProcessor에 프레임 전달 (별도 스레드에서 처리)
                    self.video_processor.process_frame(frame)
                except Exception as e:
                    print(f"⚠️ 비디오 프레임 처리 오류: {e}")
        except asyncio.CancelledError:
            # 정상적인 취소 흐름
            return
        except Exception as loop_error:
            if not self._closed:
                print(f"⚠️ 비디오 처리 루프 오류: {loop_error}")

    def stop(self) -> None:
        """트랙 중지 시 백그라운드 태스크 종료 및 자원 정리."""
        if self._closed:
            return
        self._closed = True
        
        # VideoProcessor의 별도 스레드 중지
        if hasattr(self.video_processor, '_stop_processing_thread'):
            self.video_processor._stop_processing_thread()
        
        try:
            if self._processing_task:
                self._processing_task.cancel()
                self._processing_task = None
        except Exception:
            pass
        try:
            super().stop()
        except Exception:
            pass
    
    def get_processing_stats(self) -> dict:
        """
        비디오 처리 통계를 반환합니다.
        
        @returns {dict} 처리 통계
        """
        return self.video_processor.get_stats()
    
    def reset_processing_stats(self):
        """
        비디오 처리 통계를 초기화합니다.
        """
        self.video_processor.reset_stats()
    
    def add_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 추가합니다.
        
        @param {Callable} callback - 감지 결과를 처리할 콜백 함수
        """
        self.video_processor.add_detection_callback(callback)
    
    def remove_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        물체 감지 결과 콜백 함수를 제거합니다.
        
        @param {Callable} callback - 제거할 콜백 함수
        """
        self.video_processor.remove_detection_callback(callback)
    
    def set_detection_filter(self, enabled_classes: Optional[List[int]] = None, 
                           confidence_range: Optional[tuple] = None,
                           area_range: Optional[tuple] = None):
        """
        감지 필터를 설정합니다.
        
        @param {List[int]} enabled_classes - 활성화할 클래스 ID 목록
        @param {tuple} confidence_range - 신뢰도 범위 (min, max)
        @param {tuple} area_range - 면적 범위 (min, max)
        """
        self.video_processor.set_detection_filter(enabled_classes, confidence_range, area_range)
    
    def get_current_detections(self) -> List[DetectionResult]:
        """
        현재 프레임의 감지 결과를 반환합니다.
        
        @returns {List[DetectionResult]} 현재 감지 결과
        """
        return self.video_processor.get_current_detections()
    
    def get_detection_stats(self) -> Dict:
        """
        물체 감지 통계를 반환합니다.
        
        @returns {Dict} 감지 통계
        """
        return self.video_processor.get_detection_stats()
    
    def reset_detection_stats(self):
        """
        물체 감지 통계를 초기화합니다.
        """
        self.video_processor.reset_detection_stats()
    
    def enable_object_blur(self, enable: bool = True, blur_classes: Optional[List[int]] = None, blur_strength: int = 15):
        """
        물체 블러 기능을 설정합니다.
        
        @param {bool} enable - 블러 기능 활성화 여부
        @param {List[int]} blur_classes - 블러 적용할 클래스 ID 목록 (None이면 모든 클래스)
        @param {int} blur_strength - 블러 강도 (홀수 권장)
        """
        self.video_processor.enable_object_blur(enable, blur_classes, blur_strength)
    
    def set_data_channel(self, data_channel):
        """
        Data Channel을 설정합니다.
        
        @param {RTCDataChannel} data_channel - 설정할 Data Channel
        """
        self.data_channel = data_channel
        print(f"📡 VideoEchoTrack에 Data Channel 설정됨: {data_channel.label}")
        
        # VideoProcessor에도 Data Channel 전달
        if hasattr(self.video_processor, 'set_data_channel'):
            self.video_processor.set_data_channel(data_channel)
