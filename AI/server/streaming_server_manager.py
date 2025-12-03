
import socketio
import asyncio
import os
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate

class StreamingServerManager:
    _instance = None
    _initialized = False
    
    def __new__(cls, manager=None):
        if cls._instance is None:
            cls._instance = super(StreamingServerManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self, manager=None):
        if not StreamingServerManager._initialized:
            self.sio = socketio.AsyncClient()
            self.streaming_peers = {}       # session_id -> RTCPeerConnection
            self.manager = manager
            self.setup_socketio_events()
            StreamingServerManager._initialized = True
    
    @classmethod
    def get_instance(cls, manager=None):
        """싱글톤 인스턴스 반환"""
        if cls._instance is None:
            cls._instance = StreamingServerManager(manager)
        return cls._instance

    def setup_socketio_events(self):
        @self.sio.on('webrtc-signal')
        async def handle_streaming_signal(data):
            session_id = data['sessionId']
            signal = data['signal']
            
            if session_id in self.streaming_peers:
                pc = self.streaming_peers[session_id]
                
                if signal['type'] == 'offer':
                    try:
                        print(f"Received offer SDP for session {session_id}:\n{signal['sdp']}")
                        desc = RTCSessionDescription(sdp=signal['sdp'], type=signal['type'])
                        await pc.setRemoteDescription(desc)
                        print(f"📡 스트리밍 서버 offer 수신: {session_id}")

                        # 트랙 설정 완료까지 대기
                        print("streaming_pc 생성함")
                        
                        # 트랙이 설정될 때까지 대기 (최대 5초)
                        import asyncio
                        max_wait_time = 5.0
                        wait_interval = 0.1
                        elapsed_time = 0.0
                        
                        while elapsed_time < max_wait_time:
                            if (session_id in self.manager.added_tracks and 
                                'audio' in self.manager.added_tracks[session_id] and 
                                'video' in self.manager.added_tracks[session_id] and
                                self.manager.added_tracks[session_id]['audio'] is not None and
                                self.manager.added_tracks[session_id]['video'] is not None):
                                print(f"✅ 트랙 설정 완료! (대기 시간: {elapsed_time:.2f}초)")
                                break
                            
                            print(f"⏳ 트랙 설정 대기 중... ({elapsed_time:.1f}초)")
                            await asyncio.sleep(wait_interval)
                            elapsed_time += wait_interval
                        
                        # 트랙 존재 여부 최종 확인
                        if (session_id not in self.manager.added_tracks or
                            'audio' not in self.manager.added_tracks[session_id] or
                            'video' not in self.manager.added_tracks[session_id] or
                            self.manager.added_tracks[session_id]['audio'] is None or
                            self.manager.added_tracks[session_id]['video'] is None):
                            raise Exception(f"트랙 설정이 완료되지 않음: {session_id}")
                        
                        print(f"audio 트랙 : {self.manager.added_tracks[session_id]['audio']}")
                        print(f"video 트랙 : {self.manager.added_tracks[session_id]['video']}")
                        pc.addTrack(self.manager.added_tracks[session_id]['audio'])
                        pc.addTrack(self.manager.added_tracks[session_id]['video'])
                        
                        # Answer 생성 및 전송
                        answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)
                        
                        await self.sio.emit('webrtc-signal', {
                            'sessionId': session_id,
                            'signal': {
                                'type': 'answer',
                                'sdp': pc.localDescription.sdp
                            }
                        })
                        print(f"📤 스트리밍 서버로 answer 전송: {session_id}")
                    except Exception as e:
                        print(f"❌ Answer 생성/전송 실패: {e}")
                        import traceback
                        traceback.print_exc()
                
                elif signal['type'] == 'ice':
                    candidate = signal['candidate']
                    ice = RTCIceCandidate(
                        component=1,
                        foundation=candidate.get("foundation", "foundation"),
                        ip=candidate["address"],  # 'address' -> 'ip'로 변경
                        port=candidate["port"],
                        priority=candidate["priority"],
                        protocol=candidate["protocol"],
                        type=candidate["type"],
                        sdpMid=candidate["sdpMid"],
                        sdpMLineIndex=candidate["sdpMLineIndex"]
                    )
                    await pc.addIceCandidate(ice)



    async def connect_to_streaming_server(self, manager, session_id, client_pc):
        """스트리밍 서버와 WebRTC 연결 설정"""
        print(f"스트리밍 서버와 연결 시도: {session_id}")
        try:
            # 환경변수에서 스트리밍 서버 URL 가져오기
            streaming_server_url = os.getenv('STREAMING_SERVER_URL', 'http://localhost:5002')

            # Socket.io 연결
            # await self.sio.connect(
            #     streaming_server_url, 
            #     transports=['websocket', 'polling']
            # )
            try:
                print(f"🔌 Socket.IO 연결 시도: {streaming_server_url}")
                await self.sio.connect(
                    streaming_server_url,
                    transports=['polling', 'websocket'],
                    wait_timeout=10  # 타임아웃 늘리기
                )
                print("✅ Socket.IO 연결 성공!")
            except Exception as e:
                print(f"❌ Socket.IO 연결 실패 상세: {e}")
                import traceback
                traceback.print_exc()
            
            # 세션 설정
            await self.sio.emit('set-session', {'sessionId': session_id})
            
            # 스트리밍 서버용 PeerConnection 생성
            streaming_pc = RTCPeerConnection()
            self.streaming_peers[session_id] = streaming_pc
            
            # ICE Candidate 처리 (스트리밍 서버 → AI 서버)
            @streaming_pc.on('icecandidate')
            async def on_ice_candidate(candidate):
                if candidate:
                    await self.sio.emit('webrtc-signal', {
                        'sessionId': session_id,
                        'signal': {
                            'type': 'ice',
                            'candidate': {
                                'foundation': candidate.foundation,
                                'priority': candidate.priority,
                                'protocol': candidate.protocol,
                                'type': candidate.type,
                                'address': candidate.address,
                                'port': candidate.port,
                                'sdpMid': candidate.sdpMid,
                                'sdpMLineIndex': candidate.sdpMLineIndex
                            }
                        }
                    })

            # 연결 상태 모니터링
            @streaming_pc.on('connectionstatechange')
            async def on_connection_state_change():
                print(f"📶 스트리밍 서버 연결 상태: {streaming_pc.connectionState}")
                if streaming_pc.connectionState == "failed":
                    print("❌ 스트리밍 서버 연결 실패")
                elif streaming_pc.connectionState == "connected":
                    print("✅ 스트리밍 서버 연결 성공!")
            
            print(f"✅ 스트리밍 서버 연결 준비 완료: {session_id}")
            
        except Exception as e:
            print(f"❌ 스트리밍 서버 연결 실패: {e}")