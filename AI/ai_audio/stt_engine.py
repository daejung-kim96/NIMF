"""
음성 인식 엔진 모듈

@module stt_engine
@author HeeGyeong
@date 2025-08-16
@description Whisper Small + Faster-Whisper를 사용한 실시간 음성 인식 엔진
"""

import asyncio
import threading
import queue
import time
import os
import numpy as np
from typing import Callable, Optional
from collections import deque
import soundfile as sf
from datetime import datetime

# HuggingFace Hub 최적화 설정
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'  # symlink 경고 비활성화

try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
except ImportError:
    print("⚠️ faster-whisper가 설치되지 않았습니다. pip install faster-whisper")
    FASTER_WHISPER_AVAILABLE = False

def check_cuda_compatibility():
    """
    CUDA 호환성을 자세히 확인합니다.
    """
    print("�� CUDA 호환성 상세 확인:")
    print("-" * 40)
    
    # 1. PyTorch CUDA 상태
    try:
        import torch
        print(f"�� PyTorch 버전: {torch.__version__}")
        
        if torch.cuda.is_available():
            print("✅ PyTorch CUDA 사용 가능")
            
            # GPU 상세 정보
            device = torch.cuda.current_device()
            gpu_props = torch.cuda.get_device_properties(device)
            
            print(f"🎮 GPU: {gpu_props.name}")
            print(f"�� CUDA Capability: {gpu_props.major}.{gpu_props.minor}")
            print(f"💾 GPU 메모리: {gpu_props.total_memory / 1024**3:.1f}GB")
            print(f"�� 멀티프로세서: {gpu_props.multi_processor_count}")
            
            # 메모리 테스트
            try:
                test_tensor = torch.randn(1000, 1000).cuda()
                memory_used = torch.cuda.memory_allocated()
                print(f"🧪 GPU 메모리 테스트 성공: {memory_used / 1024**2:.1f}MB 사용")
                del test_tensor
                torch.cuda.empty_cache()
            except Exception as e:
                print(f"❌ GPU 메모리 테스트 실패: {e}")
                
        else:
            print("❌ PyTorch CUDA 사용 불가능")
            
    except ImportError:
        print("❌ PyTorch 설치되지 않음")
    
    # 2. Faster-Whisper CUDA 지원
    print("\n🎤 Faster-Whisper CUDA 지원:")
    try:
        # GPU 모드로 모델 로드 테스트
        print("🔍 GPU 모드 모델 로드 테스트...")
        
        test_model = WhisperModel(
            "tiny",
            device="cuda",
            compute_type="int8",
            download_root="./models"
        )
        
        print("✅ GPU 모드 모델 로드 성공!")
        
        # 간단한 추론 테스트
        try:
            import numpy as np
            test_audio = np.random.randn(16000).astype(np.float32)  # 1초 테스트 오디오
            
            print("🧪 GPU 추론 테스트...")
            segments, _ = test_model.transcribe(test_audio, language="ko")
            print("✅ GPU 추론 테스트 성공!")
            
        except Exception as e:
            print(f"❌ GPU 추론 테스트 실패: {e}")
        
        del test_model
        
    except Exception as e:
        print(f"❌ GPU 모드 모델 로드 실패: {e}")
        print("   → CPU fallback 필요")
    
    print("-" * 40)


class StreamingSpeechRecognizer:
    """
    실시간 스트리밍 음성 인식 클래스
    
    WebRTC 오디오 스트림을 받아서 3초 버퍼링 후 Whisper로 처리합니다.
    """
    
    def __init__(self, 
                 model_size: str = "small",
                 language: str = "ko",
                 buffer_duration: float = 3.0,
                 sample_rate: int = 16000,
                 on_result: Optional[Callable[[str], None]] = None):
        """
        StreamingSpeechRecognizer 초기화
        
        @param model_size: Whisper 모델 크기 ("tiny", "small", "medium")
        @param language: 인식할 언어 코드
        @param buffer_duration: 버퍼링 시간 (초)
        @param sample_rate: 샘플링 레이트
        @param on_result: 인식 결과 콜백 함수
        """
        # cuda 호환성 확인
        # check_cuda_compatibility()


        if not FASTER_WHISPER_AVAILABLE:
            raise ImportError("faster-whisper 패키지가 필요합니다")
        
        self.model_size = model_size
        self.language = language
        self.buffer_duration = buffer_duration
        self.sample_rate = sample_rate
        self.on_result = on_result
        
        # 처리 상태
        self.is_running = False
        self.processing_thread = None
        self.audio_queue = queue.Queue(maxsize=30)  # 큐 사이즈 증가 (10 → 30)
        
        # 통계
        self.stats = {
            'total_processed': 0,
            'total_processing_time': 0.0,
            'last_result': '',
            'buffer_overflow_count': 0
        }

        # Whisper 모델 초기화
        self._initialize_model()
        
        

    
    def _initialize_model(self):
        """
        Whisper 모델을 초기화합니다.
        """
        try:

            # CPU 사용
            self.model = WhisperModel(
                self.model_size,
                device="cpu",
                # device="cuda",
                compute_type="int8",  # CPU 최적화
                cpu_threads=4,
                download_root="./models"
            )                
            print(f"✅ Whisper {self.model_size} 모델 로딩 완료!")
            
            
            # 실제 사용 중인 디바이스 확인
            try:
                # faster-whisper 모델의 실제 디바이스 정보 확인
                if hasattr(self.model, 'model'):
                    print(f"🔍 내부 모델 로드됨")
                    
                # CUDA 사용 가능 여부 및 GPU 정보 확인
                try:
                    import torch
                    if torch.cuda.is_available():
                        print(f"✅ CUDA 사용 가능: {torch.cuda.get_device_name(0)}")
                        print(f"🔍 CUDA 버전: {torch.version.cuda}")
                        print(f"🔍 GPU 메모리: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
                        print(f"🎯 GPU 모드로 실행 중")
                    else:
                        print("❌ CUDA 사용 불가능 - CPU로 fallback됨")
                        print(f"🎯 CPU 모드로 실행 중")
                except ImportError:
                    print("⚠️ PyTorch가 설치되지 않음 - CUDA 상태 확인 불가")
                    print(f"🎯 설정된 디바이스: cuda (실제 상태는 faster-whisper에 의해 결정됨)")
                    
            except Exception as debug_e:
                print(f"⚠️ 디버그 정보 확인 중 오류: {debug_e}")
            
        except Exception as e:
            print(f"❌ Whisper 모델 초기화 실패: {e}")
            raise
    
    def start_recognition(self):
        """
        음성 인식을 시작합니다.
        """
        if self.is_running:
            print("⚠️ 이미 음성 인식이 실행 중입니다")
            return
        
        self.is_running = True
        self.processing_thread = threading.Thread(
            target=self._processing_worker,
            daemon=True
        )
        self.processing_thread.start()
        
        print("🎤 실시간 음성 인식이 시작되었습니다")
    
    def stop_recognition(self):
        """
        음성 인식을 중지합니다.
        """
        if not self.is_running:
            return
        
        self.is_running = False
        
        if self.processing_thread:
            self.processing_thread.join(timeout=2.0)
        
        print("🔇 음성 인식이 중지되었습니다")
    
    def process_audio_chunk(self, audio_data: dict):
        """
        미리 채워진 오디오 청크를 바로 처리합니다.
        
        @param frame_info: 오디오 데이터와 타임스탷프 정보가 포함된 딕셔너리
        """
        if not self.is_running:
            print("⚠️ STT 엔진이 실행 중이 아님")
            return
        
        print(f"📥 STT 엔진 수신: {len(audio_data)} 샘플 (3초 버퍼 완성됨)")
        
        # 3초 버퍼를 바로 처리 큐에 추가 (내부 버퍼링 생략)
        try:
            self.audio_queue.put_nowait(audio_data)
            print(f"✅ 3초 오디오 큐에 바로 추가됨. 큐 크기: {self.audio_queue.qsize()}")
        except queue.Full:
            # 큐가 가득 찬 경우, 가장 오래된 아이템을 제거하고 새 아이템 추가
            try:
                old_data = self.audio_queue.get_nowait()
                self.audio_queue.put_nowait(audio_data)
                print(f"⚠️ 큐 가득참 - 오래된 청크 제거 후 새 청크 추가. 큐 크기: {self.audio_queue.qsize()}")
                self.stats['buffer_overflow_count'] += 1
            except (queue.Empty, queue.Full):
                print("⚠️ 처리 큐가 가득함 - 3초 오디오 청크 드롭")
                self.stats['buffer_overflow_count'] += 1

    
    def _processing_worker(self):
        """
        오디오 처리 워커 스레드
        """
        print("🔄 음성 인식 처리 스레드 시작")
        
        while self.is_running:
            try:
                # print(f"🔍 큐에서 오디오 데이터 대기 중... (큐 크기: {self.audio_queue.qsize()})")
                # 큐에서 오디오 데이터 가져오기 (타임아웃 1초)
                audio_data = self.audio_queue.get(timeout=1.0)
                # print(f"🎵 큐에서 오디오 데이터 받음: {len(audio_data['audio_data'])} 샘플")
                
                # Whisper로 음성 인식 처리
                self._process_with_whisper(audio_data)
                self.audio_queue.task_done()
                
            except queue.Empty:
                # print("⏰ 큐 타임아웃 (1초) - 계속 대기")
                continue
            except Exception as e:
                print(f"❌ 음성 인식 처리 중 오류: {e}")
                import traceback
                traceback.print_exc()
        
        print("🛑 음성 인식 처리 스레드 종료")
    
    def _process_with_whisper(self, audio_data: dict):
        """
        Whisper를 사용해 음성을 인식합니다.
        
        @param audio_data: 처리할 오디오 데이터 (3초)
        """
        start_time = time.time()
        audio_np = audio_data['audio_data']
        timestamp = audio_data.get('timestamp')
        
        try:
            print(f"🎤 Whisper 처리 시작: {len(audio_np)} 샘플, 데이터 타입: {audio_np.dtype}")
            print(f"🔊 오디오 레벨: min={audio_np.min():.3f}, max={audio_np.max():.3f}, rms={np.sqrt(np.mean(audio_np**2)):.3f}")

            # Whisper로 음성 인식 (세그먼트 분할 비활성화)
            segments, _ = self.model.transcribe(
                audio_np,
                language=self.language,
                beam_size=1,  # 속도 우선
                best_of=1,
                vad_filter=False,  # VAD 필터 비활성화 → 세그먼트 분할 최소화
                word_timestamps=False,  # 단어별 타임스탬프 비활성화
                # vad_parameters=dict(
                #     min_silence_duration_ms=500,
                #     speech_pad_ms=400
                # )
            )
            
            # 인식 결과 추출 (이터레이터를 한 번만 사용)
            segments_list = list(segments)  # 이터레이터를 리스트로 변환
            # print(f"🔍 Whisper 세그먼트 수: {len(segments_list)}")
            
            text_result = " ".join(segment.text.strip() for segment in segments_list)
            
            processing_time = time.time() - start_time
            
            print(f"⏱️ Whisper 처리 시간: {processing_time:.2f}초")
            print(f"📝 인식된 텍스트: '{text_result}'")
            
            if text_result and text_result.strip():
                # print(f"🎯 인식 결과 ({processing_time:.2f}s): {text_result}")
                
                # 통계 업데이트
                self.stats['total_processed'] += 1
                self.stats['total_processing_time'] += processing_time
                self.stats['last_result'] = text_result
                
                # 콜백 호출
                if self.on_result:
                    self.on_result(text_result, timestamp)

            else:
                print(f"🔇 음성 없음 또는 빈 결과 ({processing_time:.2f}s)")
            
        except Exception as e:
            print(f"❌ Whisper 처리 중 오류: {e}")
            import traceback
            traceback.print_exc()
    
    def _process_current_buffer(self):
        """
        현재 버퍼의 내용을 강제로 처리합니다. (종료 시 호출)
        """
        if self.current_buffer_size > 0:
            buffer_audio = np.array(list(self.audio_buffer))
            try:
                self.audio_queue.put_nowait(buffer_audio)
            except queue.Full:
                pass

    
    def get_final_result(self) -> str:
        """
        최종 인식 결과를 반환합니다.
        
        @returns: 마지막 인식 결과
        """
        return self.stats.get('last_result', '')
    
    def get_stats(self) -> dict:
        """
        음성 인식 통계를 반환합니다.
        
        @returns: 통계 정보
        """
        stats = self.stats.copy()
        if stats['total_processed'] > 0:
            stats['avg_processing_time'] = (
                stats['total_processing_time'] / stats['total_processed']
            )
        return stats
    
    def reset_stats(self):
        """
        통계를 초기화합니다.
        """
        self.stats = {
            'total_processed': 0,
            'total_processing_time': 0.0,
            'last_result': '',
            'buffer_overflow_count': 0
        }
