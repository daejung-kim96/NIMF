
"""
오디오 프레임 처리 모듈
@module audio_processor
@author HeeGyeong
@date 2025-08-16
@description 오디오 프레임을 처리하는 AudioProcessor 클래스입니다.
"""

import queue
import asyncio
import numpy as np
import sys
import os
import json
from aiortc import MediaStreamTrack
from av import AudioFrame
from scipy import signal
import soundfile as sf
from datetime import datetime
import time as pytime

# AI 루트 디렉토리를 Python 경로에 추가 (한 단계 위로)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# curse_words_severity.json 파일 경로
curse_file_path = os.path.join(os.path.dirname(__file__), 'data', 'curse_words_severity.json')

from ai_audio.stt_engine import StreamingSpeechRecognizer
from session_state_manager import session_state_manager

# 욕설 수위 한글 카테고리 매핑
CATEGORY_KOREAN_MAP = {
    'high': '욕설-수위 높음',
    'mid': '욕설-수위 중간',
    'low': '욕설-수위 낮음'
}

# 욕설 필터링 수준에 따라 허용되는 카테고리 매핑
PROFANITY_LEVEL_MAPPING = {
    'high': ['high', 'mid', 'low'],
    'mid': ['high', 'mid'],
    'low': ['high'],
}

# 욕설 수위 우선순위 매핑
PROFANITY_LEVEL_PRIORITY_MAP = {
    'high': 3,
    'mid': 2,
    'low': 1
}


class AudioProcessor(MediaStreamTrack):
    """
    오디오 프레임 처리 클래스
    
    클라이언트로부터 받은 오디오 프레임을 처리하고 다시 전송하는 역할을 담당합니다.
    """
    kind = "audio"
    data_channel = None

    def __init__(self, track=None, session_id: str = None):  # ← track과 session_id 매개변수
        """
        AudioProcessor 초기화
        
        @param {MediaStreamTrack} track - 원본 오디오 트랙
        @param {str} session_id - 세션 ID
        """
        super().__init__()
        self.track = track  # ← 원본 트랙 저장
        self.session_id = session_id  # ← 인스턴스 변수로 저장
        print(f"🎧 AudioProcessor 생성됨 (세션: {session_id})")
        
        # 오디오 버퍼링 관련
        self.audio_buffer = []
        self.buffer_start_time = None
        self.buffer_sample_rate = None
        self.buffer_channels = 1
        self.buffer_duration = 3.0 # 3초 버퍼링
        self.target_sample_rate = 16000  # STT 엔진 요구사항
        
        # 프레임 분석 관련
        self.last_pts = None
        self.expected_pts_increment = None
        self.is_first_frame = True
        self.frame_count = 0
        self.total_frames_received = 0
        self.last_frame_time = None
        self.frame_intervals = []
        self.expected_frame_interval = None
        self.pts_gaps = []
        
        # 처리 통계
        self.processing_stats = {
            'total_frames': 0,
            'processed_frames': 0,
            'processing_time': 0.0,
            'audio_level': 0.0
        }
        
        # 음성 인식기 초기화
        self.speech_recognizer = None
        self.recognition_results = []
        self._initialize_speech_recognition()

        # 스레드 안전한 큐 (asyncio가 아닌 threading 큐 사용)
        self.stt_result_queue = queue.Queue()


        # 욕설 단어 사전 로드 
        try:
            curse_file_path = os.path.join(os.path.dirname(__file__), 'data', 'curse_words_severity.json')
            with open(curse_file_path, 'r', encoding='utf-8') as f:
                self.curse_words = json.load(f)
            print(f"✅ 욕설 단어 사전 로드 완료: {len(self.curse_words)}개 카테고리")
        except Exception as e:
            print(f"❌ 욕설 단어 사전 로드 실패: {e}")


    
    def _initialize_speech_recognition(self):
        """
        음성 인식기를 초기화합니다.
        """
        def on_recognition_result(text: str, timestamp: float):
            """음성 인식 결과 콜백"""
            if text.strip():
                self.recognition_results.append(text)
                print(f"🎯 음성 인식 결과: {text}")

                # 🔥 스레드 안전한 큐에 결과 추가
                try:
                    self.stt_result_queue.put({'text': text, 'timestamp': timestamp}, block=False)
                    print(f"📥 STT 결과 큐에 추가됨: {text}")
                except queue.Full:
                    print("⚠️ STT 결과 큐가 가득참")
                except Exception as e:
                    print(f"❌ STT 결과 큐 추가 실패: {e}")
        
        try:
            self.speech_recognizer = StreamingSpeechRecognizer(
                model_size="small",  
                language="ko",
                on_result=on_recognition_result
            )
            print("✅ Whisper 음성 인식기가 초기화되었습니다.")
        except Exception as e:
            print(f"❌ 음성 인식기 초기화 실패: {e}")
            self.speech_recognizer = None
    


    def _resample_audio(self, audio_data: np.ndarray, original_rate: int, target_rate: int) -> np.ndarray:
        """
        오디오 데이터를 리샘플링합니다.
        
        @param audio_data: 원본 오디오 데이터
        @param original_rate: 원본 샘플링 레이트
        @param target_rate: 목표 샘플링 레이트
        @returns: 리샘플링된 오디오 데이터
        """
        if original_rate == target_rate:
            return audio_data
        
        target_length = int(len(audio_data) * target_rate / original_rate)
        resampled_audio = signal.resample(audio_data, target_length)
        
        return resampled_audio.astype(audio_data.dtype)



    async def recv(self):
        """
        오디오 프레임을 수신하고 처리합니다.
        
        @returns {AudioFrame} 처리된 오디오 프레임
        """
        # STT 결과 처리 (논블로킹)
        self._process_stt_results_sync()
        frame = await self.track.recv()

        try:

            # ====================== 로깅 시작 ======================

            # 0. 프레임 카운팅 및 시간 측정
            self.frame_count += 1
            self.total_frames_received += 1
            current_time = pytime.time()
            
            # 1. 프레임 간격 모니터링
            if self.last_frame_time is not None:
                interval = current_time - self.last_frame_time
                self.frame_intervals.append(interval)
                
                if len(self.frame_intervals) == 10:
                    self.expected_frame_interval = sum(self.frame_intervals) / len(self.frame_intervals)
                    # print(f"📊 예상 프레임 간격: {self.expected_frame_interval*1000:.1f}ms")
                
                if self.total_frames_received % 100 == 0:
                    recent_intervals = self.frame_intervals[-20:]
                    avg_interval = sum(recent_intervals) / len(recent_intervals)
                    max_interval = max(recent_intervals)
                    min_interval = min(recent_intervals)
                    # print(f"🕐 프레임 간격 분석 (최근 20개): 평균={avg_interval*1000:.1f}ms, 최대={max_interval*1000:.1f}ms, 최소={min_interval*1000:.1f}ms")
                    
                    if self.expected_frame_interval:
                        long_gaps = [i for i in recent_intervals if i > self.expected_frame_interval * 2]
                        if long_gaps:
                            print(f"⚠️ 긴 간격 감지: {len(long_gaps)}개, 최대 {max(long_gaps)*1000:.1f}ms")
            
            self.last_frame_time = current_time
            
            # 오디오 프레임의 원시 바이트 데이터를 numpy 배열로 변환
            audio_data = np.frombuffer(frame.planes[0], dtype=np.int16)
            
            # 2. PTS 분석
            if hasattr(frame, 'pts') and frame.pts is not None:
                current_pts = frame.pts
                
                if self.last_pts is not None:
                    pts_diff = current_pts - self.last_pts
                    self.pts_gaps.append(pts_diff)
                    
                    if len(self.pts_gaps) == 10:
                        self.expected_pts_increment = sum(self.pts_gaps) / len(self.pts_gaps)
                        print(f"📊 예상 PTS 증가량: {self.expected_pts_increment}")
                    
                    if self.frame_count % 5000 == 0:
                        recent_gaps = self.pts_gaps[-10:] if len(self.pts_gaps) >= 10 else self.pts_gaps
                        avg_gap = sum(recent_gaps) / len(recent_gaps) if recent_gaps else 0
                        print(f"📈 PTS: {current_pts}, 평균 갭: {avg_gap:.0f}, 프레임 크기: {len(audio_data)}")
                        
                        if self.expected_pts_increment and pts_diff > self.expected_pts_increment * 1.5:
                            missing_duration = (pts_diff - self.expected_pts_increment) / self.expected_pts_increment
                            print(f"⚠️ PTS 갭 감지! 예상: {self.expected_pts_increment:.0f}, 실제: {pts_diff:.0f} (약 {missing_duration:.1f}프레임 누락)")
                
                self.last_pts = current_pts
            


            # 3. 프레임 정보 로깅 (첫 프레임에서만)
            if self.is_first_frame:
                print(f"🔊 오디오 데이터 통계: min={audio_data.min()}, max={audio_data.max()}, mean={audio_data.mean():.1f}, rms={np.sqrt(np.mean(audio_data.astype(np.float32)**2)):.1f}")
                # min=-1859, max=1958, mean=33.3, rms=830.3
                print(f"🔍 프레임 포맷: {frame.format}") # <av.AudioFormat s16>
                print(f"🔍 프레임 샘플 레이트: {frame.sample_rate}Hz") # 48000Hz
                print(f"🔍 프레임 채널 수: {frame.layout}") #  <av.AudioLayout 'stereo'>
                print(f"🔍 프레임 데이터 크기: {len(audio_data)}") # 1920
                print(f"🔍 프레임 데이터 타입: {audio_data.dtype}") # int16
                print(f"🔍 프레임 데이터 형태: {audio_data.shape}") # (1920,)
                print(f"🔍 프레임 데이터 포맷: {frame.format}") #  <av.AudioFormat s16>
                self.is_first_frame = False



            #매 125 프레임마다 = 5초 가량
            if self.frame_count % 125 == 0:
                # 4. 오디오 레벨 분석
                if len(audio_data.shape) > 1:
                    audio_data_1d = audio_data.flatten()
                else:
                    audio_data_1d = audio_data
                    
                rms = np.sqrt(np.mean(audio_data_1d.astype(np.float32) ** 2))
                is_silence = rms < 100
                print(f"🔊 오디오 레벨: RMS={rms:.1f}, 무음={'예' if is_silence else '아니오'}")

                # 5. 버퍼링 진행 상황
                elapsed = current_time - self.buffer_start_time
                buffer_samples = len(self.audio_buffer)
                expected_samples = int(self.buffer_sample_rate * elapsed)
                print(f"📊 버퍼링 진행 [{self.frame_count}프레임]: {elapsed:.1f}초 경과, 버퍼 샘플={buffer_samples}, 예상 샘플={expected_samples}")

                

            # ====================== 로깅 끝 ======================
 

            # 🔥 스테레오 → 모노 변환 
            if hasattr(frame, 'layout') and 'stereo' in str(frame.layout).lower():
                if self.buffer_start_time is None:  # 첫 프레임에서만 로그
                    print("🔍 스테레오 프레임 감지됨 – 모노로 변환")
                # 스테레오를 모노로 변환
                audio_data = audio_data.reshape(-1, 2).mean(axis=1).astype(np.int16)
            

            # 버퍼 초기화 (첫 프레임에서만)
            if self.buffer_start_time is None:
                self.buffer_start_time = current_time
                self.buffer_sample_rate = frame.sample_rate
                self.buffer_channels = 1  # 모노로 고정
                
            self.audio_buffer.extend(audio_data)
        

            # 3초 경과 시 버퍼에 저장
            if current_time - self.buffer_start_time >= self.buffer_duration:
                print(f"🎉 3초 버퍼 완성! 경과시간: {current_time - self.buffer_start_time:.2f}초, 버퍼 크기: {len(self.audio_buffer)} 샘플")
                try:
                    audio_np = np.array(self.audio_buffer[:int(self.buffer_sample_rate * self.buffer_duration)], dtype=np.int16)
                    print(f"🔢 numpy 배열 생성됨: {len(audio_np)} 샘플, dtype={audio_np.dtype}")

                    # 정규화 개선 (클리핑 방지만)
                    max_val = np.abs(audio_np).max()
                    if max_val > 32767:  # 클리핑이 발생할 경우만
                        audio_np = (audio_np / max_val * 32767 * 0.95).astype(np.int16)
                        print(f"⚠️ 클리핑 방지 정규화: {max_val} → 32767")


                    # 16kHz로 리샘플링 및 STT 처리
                    resampled_audio = self._resample_audio(audio_np, self.buffer_sample_rate, 16000)
                    
                    # float32로 정규화 (Whisper 요구사항: -1.0 ~ 1.0 범위)
                    audio_float = resampled_audio.astype(np.float32) / 32767.0
                    
                    # STT 엔진으로 전송 (3초 간격)                    
                    if self.speech_recognizer and self.speech_recognizer.is_running:
                        try:
                            self.speech_recognizer.process_audio_chunk({'audio_data': audio_float,'timestamp': float(current_time)})
                        except Exception as e:
                            print(f"❌ STT 처리 중 오류: {e}")
                            print(f"❌ 오류 타입: {type(e).__name__}")
                            import traceback
                            print(f"❌ 상세 오류: {traceback.format_exc()}")
                    else:
                        print("⚠️ STT 엔진이 실행되지 않음")
                        if not self.speech_recognizer:
                            print("   → speech_recognizer가 None입니다")
                        elif not self.speech_recognizer.is_running:
                            print("   → speech_recognizer.is_running이 False입니다")

                    # 3초 간격으로 자르기 (겹치는 부분 없이)
                    self.audio_buffer = []  # 버퍼 완전히 비우기
                    self.buffer_start_time += self.buffer_duration  # 정확한 3초 간격 유지

                except Exception as e:
                    print(f"❌ 오디오 저장 실패: {e}")

        except Exception as e:
            print(f"❌ 오디오 버퍼링/저장 처리 중 오류: {e}")

        # return processed_frame
        return frame



    def _process_stt_results_sync(self):
        """큐에서 STT 결과를 동기적으로 처리"""
        try:
            while True:
                try:
                    # 논블로킹으로 큐에서 결과 가져오기
                    result = self.stt_result_queue.get(block=False)
                    self._send_text_via_datachannel(result['text'], result['timestamp'])
                    self.stt_result_queue.task_done()
                except queue.Empty:
                    break  # 큐가 비어있음
        except Exception as e:
            print(f"❌ STT 결과 처리 중 오류: {e}")
    

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
            'audio_level': 0.0
        }
    
    def set_data_channel(self, data_channel):
        """
        Data Channel을 설정합니다.
        
        @param {RTCDataChannel} data_channel - 설정할 Data Channel
        """
        self.data_channel = data_channel
        print(f"📡 AudioProcessor에 Data Channel 설정됨: {data_channel.label}")
        

    def _send_text_via_datachannel(self, text: str, timestamp: float):
        """
        Data Channel을 통해 텍스트를 전송합니다.
        
        @param {str} text - 전송할 텍스트
        @param {float} timestamp - 타임스탬프
        """
        if self.data_channel and self.data_channel.readyState == "open":
            try:
                # 욕설 단어 감지 및 카테고리 할당
                curse_info = self._detect_curse_words(text)
                
                # 욕설/금지어가 감지된 경우 -> STT 결과를 JSON 형태로 구성 -> Data Channel로 전송
                if curse_info['detected']:
                    message = {
                        "type": "voice",
                        "category": curse_info['category'], # '욕설-수위 중간' or '금지어'
                        "detail": curse_info['detail'], # '개새끼'
                        "time": datetime.fromtimestamp(timestamp).strftime("%H:%M:%S"),
                    }
                    # JSON으로 직렬화하여 전송
                    json_message = json.dumps(message, ensure_ascii=False)
                    self.data_channel.send(json_message)
                    print(f"🚨 욕설/금지어 감지: {curse_info['category']} - {curse_info['detail']}")
                    print(f"📤 Data Channel로 STT 결과 전송: {text}")
            except Exception as e:
                print(f"❌ Data Channel 전송 실패: {e}")
        else:
            print("⚠️ Data Channel이 사용 불가능함")


                
    def send_custom_message(self, message_type: str, data: dict):
        """
        Data Channel을 통해 커스텀 메시지를 전송합니다.
        
        @param {str} message_type - 메시지 타입
        @param {dict} data - 전송할 데이터
        """
        if self.data_channel and self.data_channel.readyState == "open":
            try:
                message = {
                    "type": message_type,
                    "data": data,
                    "timestamp": pytime.time(),
                    "source": "audio_processor"
                }
                message_json = json.dumps(message, ensure_ascii=False)
                self.data_channel.send(message_json)
                print(f"📤 Data Channel로 커스텀 메시지 전송: {message_type}")
            except Exception as e:
                print(f"❌ Data Channel 전송 실패: {e}")
        else:
            print("⚠️ Data Channel이 사용 불가능함")
    
    def start_speech_recognition(self):
        """
        음성 인식을 시작합니다.
        """
        print(f"🎤 AudioProcessor.start_speech_recognition() 호출됨")
        if self.speech_recognizer:
            self.speech_recognizer.start_recognition()
            print("✅ AudioProcessor: 음성 인식이 시작되었습니다.")
        else:
            print("❌ AudioProcessor: speech_recognizer가 None입니다!")
    
    def stop_speech_recognition(self):
        """
        음성 인식을 중지합니다.
        """
        if self.speech_recognizer:
            self.speech_recognizer.stop_recognition()
            final_result = self.speech_recognizer.get_final_result()
            if final_result:
                print(f"최종 인식 결과: {final_result}")
            print("음성 인식이 중지되었습니다.")
    

    def get_recognition_results(self) -> list:
        """
        인식 결과 목록을 반환합니다.
        
        @returns {list} 인식 결과 목록
        """
        return self.recognition_results.copy()


    def _detect_curse_words(self, text: str) -> dict:
        """
        텍스트에서 욕설 단어를 감지하고 카테고리를 할당합니다.
        
        @param text: 검사할 텍스트
        @returns: 욕설 감지 정보가 포함된 딕셔너리

        # 현재 category_info 구조 (get_audio_filter 반환값)
        {
            "profanity": "mid",
            "hateSpeech": false,
            "bannedWords": ["빨리", "느려"]
        }
        """     
        try:
            # session_id가 있는 경우 해당 세션의 필터 설정 확인
            if self.session_id:
                category_info = session_state_manager.get_audio_filter(self.session_id)
                if category_info:
                    print(f"🔧 세션 {self.session_id} 카테고리 정보: {category_info}")

                    # ✅ 금지어 감지 추가
                    banned_words = category_info.get('bannedWords', []) # 금지어 목록 없으면 빈 리스트 반환
                    for banned_word in banned_words:
                        if banned_word in text.replace(' ', ''):
                            print(f"🚨 금지어 감지: {banned_word}")
                            return {
                                'detected': True,
                                'category': '금지어',
                                'detail': banned_word,
                            }
                    
                    # profanity 수위 레벨 확인
                    profanity_level = category_info.get('profanity')
                    if profanity_level:
                        print(f"🔍 세션 {self.session_id}: 욕설 수위 레벨 - {profanity_level}")
                else:
                    print(f"⚠️ 세션 {self.session_id}: 카테고리 정보 없음, 기본 필터링 적용")
                    profanity_level = None
            else:
                print("⚠️ session_id 없음, 기본 필터링 적용")
                profanity_level = None
            
            # profanity 수위에 따라 감지할 카테고리 결정
            allowed_categories = PROFANITY_LEVEL_MAPPING.get(profanity_level, ['high', 'mid', 'low'])
            print(f"🔍 감지 허용 카테고리: {allowed_categories}")
            
            detected_words = []
            detected_category = None
            
            # 허용된 카테고리만 검사
            for category in allowed_categories:
                if category in self.curse_words:
                    for word in self.curse_words[category]:  # curse_words[category]로 수정
                        if word in text:
                            detected_words.append({
                                'word': word,
                                'category': category
                            })
                            # 가장 높은 우선순위 카테고리 선택 (high > mid > low)
                            if detected_category is None or PROFANITY_LEVEL_PRIORITY_MAP.get(category, 0) > PROFANITY_LEVEL_PRIORITY_MAP.get(detected_category, 0):
                                detected_category = category
            
            if detected_words:
                # 가장 높은 우선순위의 단어 선택
                highest_priority_word = max(detected_words, key=lambda x: PROFANITY_LEVEL_PRIORITY_MAP.get(x['category'], 0))
                return {
                    'detected': True,
                    'category': CATEGORY_KOREAN_MAP.get(highest_priority_word['category'], '알 수 없음'),
                    'detail': highest_priority_word['word'],
                }
            else:
                return {
                    'detected': False,
                    'category': None,
                    'detail': None,
                }
                
        except Exception as e:
            print(f"⚠️ 욕설 단어 감지 중 오류: {e}")
            return {
                'detected': False,
                'category': None,
                'detail': None,
            }

       
    
    # def _get_category_priority(self, category: str) -> int:
    #     """
    #     카테고리의 우선순위를 반환합니다.
        
    #     @param category: 카테고리 ('high', 'mid', 'low')
    #     @returns: 우선순위 (높을수록 우선순위 높음)
    #     """
    #     priority_map = {
    #         'high': 3,
    #         'mid': 2,
    #         'low': 1
    #     }
    #     return priority_map.get(category, 0)
    
    # def _get_category_korean(self, category: str) -> str:
    #     """
    #     카테고리를 한글로 변환합니다.
        
    #     @param category: 카테고리 ('high', 'mid', 'low')
    #     @returns: 한글 카테고리
    #     """
    #     korean_map = {
    #         'high': '욕설-수위 높음',
    #         'mid': '욕설-수위 중간',
    #         'low': '욕설-수위 낮음'
    #     }
    #     return korean_map.get(category, '알 수 없음')




    # def _get_allowed_categories_by_profanity_level(self, profanity_level: str) -> list:
    #     """
    #     profanity 수위 레벨에 따라 감지할 카테고리 목록 반환
        
    #     @param profanity_level: 'high', 'mid', 'low' 또는 None
    #     @returns: 감지할 카테고리 목록
    #     """
    #     if not profanity_level:
    #         return ['high', 'mid', 'low']  # 기본값: 모든 카테고리
        
    #     level_mapping = {
    #         'high': ['high', 'mid', 'low'], # high, mid, low 모두 감지
    #         'mid': ['high', 'mid'],     # high, mid 감지
    #         'low': ['high'],  # high만 감지
    #     }
        
    #     return level_mapping.get(profanity_level, ['high', 'mid', 'low'])