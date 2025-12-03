"""
물체 감지 모듈
@module object_detector
@author 공경배
@date 2025-08-07
@description YOLO를 사용한 물체 감지 기능을 제공합니다.
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass
from time import time
import logging

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logging.warning("Ultralytics YOLO가 설치되지 않았습니다. 물체 감지 기능을 사용할 수 없습니다.")


@dataclass
class DetectionResult:
    """물체 감지 결과를 저장하는 데이터 클래스"""
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    class_id: int
    class_name: str
    center: Tuple[int, int]  # 중심점 (x, y)
    track_id: Optional[int] = None  # ByteTrack 추적 ID


class BaseObjectDetector:
    """물체 감지기 기본 클래스"""
    
    def __init__(self):
        self.is_initialized = False
        self.processing_stats = {
            'total_detections': 0,
            'processing_time': 0.0,
            'frames_processed': 0
        }
    
    def initialize(self) -> bool:
        """감지기를 초기화합니다."""
        raise NotImplementedError
    
    def detect(self, image: np.ndarray) -> List[DetectionResult]:
        """이미지에서 물체를 감지합니다."""
        raise NotImplementedError
    
    def get_stats(self) -> Dict:
        """처리 통계를 반환합니다."""
        return self.processing_stats.copy()
    
    def reset_stats(self):
        """통계를 초기화합니다."""
        self.processing_stats = {
            'total_detections': 0,
            'processing_time': 0.0,
            'frames_processed': 0
        }


class YOLODetector(BaseObjectDetector):
    """YOLO 기반 물체 감지기"""
    
    def __init__(self, model_path, confidence_threshold):
        """
        YOLO 감지기 초기화
        
        @param {str} model_path - YOLO 모델 경로
        @param {float} confidence_threshold - 신뢰도 임계값
        """
        super().__init__()
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.class_names = {}
        
        # 감지 결과 콜백 함수들
        self.detection_callbacks: List[Callable[[List[DetectionResult]], None]] = []
        
    def initialize(self) -> bool:
        """YOLO 모델을 초기화합니다."""
        if not YOLO_AVAILABLE:
            logging.error("Ultralytics YOLO가 설치되지 않았습니다.")
            return False
        
        try:
            print(f"🔧 YOLO 모델 로딩 시작: {self.model_path}")
            
            # 모델 파일 존재 확인
            import os
            if not os.path.exists(self.model_path):
                logging.error(f"모델 파일이 존재하지 않습니다: {self.model_path}")
                return False
            
            # 파일 크기 확인
            file_size = os.path.getsize(self.model_path)
            print(f"📁 모델 파일 크기: {file_size / (1024*1024):.2f} MB")
            
            if file_size < 1024*1024:  # 1MB 미만이면 의심스러움
                logging.warning(f"모델 파일이 너무 작습니다: {file_size} bytes")
            
            self.model = YOLO(self.model_path)
            # CPU로 실행하도록 설정
            self.model.to('cpu')
            self.class_names = self.model.names
            self.is_initialized = True
            logging.info(f"YOLO 모델이 CPU로 초기화되었습니다: {self.model_path}")
            return True
            
        except Exception as e:
            logging.error(f"YOLO 모델 초기화 실패: {e}")
            print(f"❌ YOLO 모델 초기화 실패: {e}")
            print(f"   모델 경로: {self.model_path}")
            print(f"   오류 타입: {type(e).__name__}")
            
            # 더 자세한 오류 정보 출력
            import traceback
            traceback.print_exc()
            return False
    
    def detect(self, image: np.ndarray) -> List[DetectionResult]:
        """
        이미지에서 물체를 감지합니다.
        
        @param {np.ndarray} image - BGR 형식의 이미지
        @returns {List[DetectionResult]} 감지 결과 목록
        """
        if not self.is_initialized:
            logging.warning("YOLO 모델이 초기화되지 않았습니다.")
            return []
        
        start_time = time()
        
        try:
            # YOLO 추론 실행 (ByteTrack 적용, CPU 사용)
            results = self.model.track(image, conf=self.confidence_threshold, tracker="bytetrack.yaml", verbose=False, device='cpu')
            
            detections = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # 바운딩 박스 좌표
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        
                        # 신뢰도와 클래스 ID
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        # ByteTrack ID (track_id가 있는 경우)
                        track_id = None
                        if hasattr(box, 'id') and box.id is not None:
                            track_id = int(box.id[0].cpu().numpy())
                        
                        # 클래스 이름
                        class_name = self.class_names.get(class_id, f"class_{class_id}")
                        
                        # 중심점 계산
                        center_x = int((x1 + x2) / 2)
                        center_y = int((y1 + y2) / 2)
                        
                        detection = DetectionResult(
                            bbox=(x1, y1, x2, y2),
                            confidence=confidence,
                            class_id=class_id,
                            class_name=class_name,
                            center=(center_x, center_y),
                            track_id=track_id
                        )
                        detections.append(detection)
            
            # 통계 업데이트
            processing_time = time() - start_time
            self.processing_stats['total_detections'] += len(detections)
            self.processing_stats['processing_time'] += processing_time
            self.processing_stats['frames_processed'] += 1
            
            # 콜백 함수 실행
            if detections and self.detection_callbacks:
                for callback in self.detection_callbacks:
                    try:
                        callback(detections)
                    except Exception as e:
                        logging.error(f"감지 콜백 실행 중 오류: {e}")
            
            return detections
            
        except Exception as e:
            logging.error(f"물체 감지 중 오류: {e}")
            return []
    
    def add_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        감지 결과 콜백 함수를 추가합니다.
        
        @param {Callable} callback - 감지 결과를 처리할 콜백 함수
        """
        self.detection_callbacks.append(callback)
    
    def remove_detection_callback(self, callback: Callable[[List[DetectionResult]], None]):
        """
        감지 결과 콜백 함수를 제거합니다.
        
        @param {Callable} callback - 제거할 콜백 함수
        """
        if callback in self.detection_callbacks:
            self.detection_callbacks.remove(callback)
    
    def set_confidence_threshold(self, threshold: float):
        """
        신뢰도 임계값을 설정합니다.
        
        @param {float} threshold - 새로운 신뢰도 임계값 (0.0 ~ 1.0)
        """
        self.confidence_threshold = max(0.0, min(1.0, threshold))
    
    def get_supported_classes(self) -> Dict[int, str]:
        """
        지원하는 클래스 목록을 반환합니다.
        
        @returns {Dict[int, str]} 클래스 ID와 이름 매핑
        """
        return self.class_names.copy()


class DetectionFilter:
    """감지 결과 필터링 클래스"""
    
    def __init__(self):
        # 클래스 필터 사용 여부와 허용 클래스 집합
        # 기본값: 필터 사용 + 허용 집합 비어 있음(= 아무 클래스도 통과시키지 않음)
        self.enabled_classes: set = set()
        self.use_class_filter: bool = True
        self.min_confidence: float = 0.0
        self.max_confidence: float = 1.0
        self.min_area: int = 0
        self.max_area: int = float('inf')
    
    def set_class_filter(self, class_ids: List[int]):
        """
        특정 클래스만 필터링하도록 설정합니다.
        
        @param {List[int]} class_ids - 허용할 클래스 ID 목록
        """
        self.enabled_classes = set(class_ids or [])
    
    def set_confidence_range(self, min_conf: float, max_conf: float):
        """
        신뢰도 범위를 설정합니다.
        
        @param {float} min_conf - 최소 신뢰도
        @param {float} max_conf - 최대 신뢰도
        """
        self.min_confidence = max(0.0, min_conf)
        self.max_confidence = min(1.0, max_conf)
    
    def set_area_range(self, min_area: int, max_area: int):
        """
        면적 범위를 설정합니다.
        
        @param {int} min_area - 최소 면적
        @param {int} max_area - 최대 면적
        """
        self.min_area = max(0, min_area)
        self.max_area = max_area
    
    def filter_detections(self, detections: List[DetectionResult]) -> List[DetectionResult]:
        """
        감지 결과를 필터링합니다.
        
        @param {List[DetectionResult]} detections - 원본 감지 결과
        @returns {List[DetectionResult]} 필터링된 감지 결과
        """
        # 클래스 필터가 활성화되어 있고 허용 집합이 비어 있으면 모두 차단
        if self.use_class_filter and not self.enabled_classes:
            return []

        filtered = []
        
        for detection in detections:
            # 클래스 필터
            if self.use_class_filter:
                if detection.class_id not in self.enabled_classes:
                    continue
            
            # 신뢰도 필터
            if not (self.min_confidence <= detection.confidence <= self.max_confidence):
                continue
            
            # 면적 필터
            x1, y1, x2, y2 = detection.bbox
            area = (x2 - x1) * (y2 - y1)
            if not (self.min_area <= area <= self.max_area):
                continue
            
            filtered.append(detection)
        
        return filtered


class DetectionVisualizer:
    """감지 결과 시각화 클래스"""
    
    def __init__(self):
        self.colors = self._generate_colors()
        self.font = cv2.FONT_HERSHEY_SIMPLEX
        self.font_scale = 0.6
        self.thickness = 2
        
        # 블러 설정 (기본적으로 활성화)
        self.enable_blur = True
        self.blur_strength = 35# 블러 강도 (홀수)
        self.blur_classes = set()  # 블러 적용할 클래스 ID들 (빈 집합 = 모든 클래스)
        print("🔒 블러 기능이 기본적으로 활성화되었습니다.")
    
    def _generate_colors(self) -> Dict[int, Tuple[int, int, int]]:
        """클래스별 색상을 생성합니다."""
        colors = {}
        for i in range(1000):  # 충분한 색상 생성
            colors[i] = tuple(np.random.randint(0, 255, 3).tolist())
        return colors
    
    def enable_object_blur(self, enable: bool = True, blur_classes: Optional[List[int]] = None, blur_strength: int = 50):
        """
        물체 블러 기능을 설정합니다.
        
        @param {bool} enable - 블러 기능 활성화 여부
        @param {List[int]} blur_classes - 블러 적용할 클래스 ID 목록 (None이면 모든 클래스)
        @param {int} blur_strength - 블러 강도 (홀수 권장)
        """
        self.enable_blur = enable
        self.blur_strength = max(1, blur_strength) if blur_strength % 2 == 1 else max(1, blur_strength + 1)
        
        if blur_classes is not None:
            self.blur_classes = set(blur_classes)
        else:
            self.blur_classes = set()  # 빈 집합이면 모든 클래스에 적용
    
    def _apply_blur_to_detection(self, image: np.ndarray, detection: DetectionResult) -> np.ndarray:
        """
        특정 감지 결과에 블러를 적용합니다.
        
        @param {np.ndarray} image - 원본 이미지
        @param {DetectionResult} detection - 감지 결과
        @returns {np.ndarray} 블러가 적용된 이미지
        """
        if not self.enable_blur:
            print("⚠️ 블러가 비활성화되어 있습니다.")
            return image
        
        # 블러 적용할 클래스인지 확인
        if self.blur_classes and detection.class_id not in self.blur_classes:
            print(f"⚠️ 클래스 {detection.class_id} ({detection.class_name})는 블러 대상이 아닙니다.")
            return image
        
        print(f"🔒 블러 적용 중: {detection.class_name} (클래스 {detection.class_id})")
        
        x1, y1, x2, y2 = detection.bbox
        
        # 이미지 경계 확인
        height, width = image.shape[:2]
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(width, x2)
        y2 = min(height, y2)
        
        # 유효한 영역인지 확인
        if x1 >= x2 or y1 >= y2:
            return image
        
        try:
            # 해당 영역 추출
            roi = image[y1:y2, x1:x2]
            
            # 블러 적용 (가우시안 → 박스 블러로 교체: 성능 우선)
            blurred_roi = cv2.blur(roi, (self.blur_strength, self.blur_strength))
            
            # 블러된 영역을 원본 이미지에 복사
            image[y1:y2, x1:x2] = blurred_roi
            
            print(f"✅ 블러 적용 완료: {detection.class_name} ({x1},{y1})~({x2},{y2})")
            
        except Exception as e:
            print(f"블러 적용 중 오류: {e}")
        
        return image
    
    def draw_detections(self, image: np.ndarray, detections: List[DetectionResult]) -> np.ndarray:
        """
        감지 결과를 이미지에 그립니다.
        
        @param {np.ndarray} image - 원본 이미지
        @param {List[DetectionResult]} detections - 감지 결과
        @returns {np.ndarray} 시각화된 이미지
        """
        result_image = image.copy()
        
        # 먼저 블러 적용
        if self.enable_blur:
            print(f"🔒 {len(detections)}개 감지 결과에 블러 적용 시작...")
            for detection in detections:
                result_image = self._apply_blur_to_detection(result_image, detection)
        else:
            print("⚠️ 블러 기능이 비활성화되어 있습니다.")
        
        # 그 다음 바운딩 박스와 라벨 그리기
        # for detection in detections:
        #     x1, y1, x2, y2 = detection.bbox
            
        #     # 색상 가져오기
        #     color = self.colors.get(detection.class_id, (0, 255, 0))
            
        #     # 바운딩 박스 그리기
        #     cv2.rectangle(result_image, (x1, y1), (x2, y2), color, self.thickness)
            
        #     # 라벨 텍스트 (track_id 포함)
        #     if detection.track_id is not None:
        #         label = f"{detection.class_name} ID:{detection.track_id}: {detection.confidence:.2f}"
        #     else:
        #         label = f"{detection.class_name}: {detection.confidence:.2f}"
            
        #     # 텍스트 크기 계산
        #     (text_width, text_height), baseline = cv2.getTextSize(
        #         label, self.font, self.font_scale, self.thickness
        #     )
            
        #     # 라벨 배경 그리기
        #     cv2.rectangle(
        #         result_image,
        #         (x1, y1 - text_height - baseline - 5),
        #         (x1 + text_width, y1),
        #         color,
        #         -1
        #     )
            
        #     # 라벨 텍스트 그리기
        #     cv2.putText(
        #         result_image,
        #         label,
        #         (x1, y1 - baseline - 5),
        #         self.font,
        #         self.font_scale,
        #         (255, 255, 255),
        #         self.thickness
        #     )
            
        #     # 중심점 그리기
        #     center_x, center_y = detection.center
        #     cv2.circle(result_image, (center_x, center_y), 3, color, -1)
        
        return result_image
    
    def draw_detection_count(self, image: np.ndarray, detections: List[DetectionResult]) -> np.ndarray:
        """
        감지된 물체 개수를 이미지에 표시합니다.
        
        @param {np.ndarray} image - 원본 이미지
        @param {List[DetectionResult]} detections - 감지 결과
        @returns {np.ndarray} 개수가 표시된 이미지
        """
        result_image = image.copy()
        
        # 클래스별 개수 계산
        class_counts = {}
        for detection in detections:
            class_name = detection.class_name
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
        
        # 개수 정보 표시
        y_offset = 30
        for class_name, count in class_counts.items():
            text = f"{class_name}: {count}"
            cv2.putText(
                result_image,
                text,
                (10, y_offset),
                self.font,
                0.7,
                (255, 255, 255),
                2
            )
            y_offset += 25
        
        return result_image
