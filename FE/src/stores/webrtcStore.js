// stores/webrtcStore.js

import { create } from 'zustand';

export const useWebrtcStore = create((set, get) => ({
  // WebRTC 관련 상태 변수들
  sessionId: null,
  localStream: null,
  remoteStream: null,
  remoteAudioStream: null, // 오디오 스트림 추가
  socket: null,
  peers: {},
  iceServers: [], // ICE 서버 정보 추가

  // log 관련 상태
  logs: [],

  // ✅ 추가
  peerConnection: null,
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  getPeerConnection: () => get().peerConnection,

  // WebRTC 관련 액션들
  setSessionId: (sessionId) => set({ sessionId }),

  setLocalStream: (stream) => set({ localStream: stream }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),

  setRemoteAudioStream: (stream) => set({ remoteAudioStream: stream }), // 오디오 스트림 액션 추가

  setSocket: (socket) => set({ socket }),

  setPeers: (peers) => set({ peers }),

  setIceServers: (iceServers) => set({ iceServers }), // ICE 서버 설정 액션 추가

  // log 관련 액션
  addLog: (log) =>
    set((state) => {
      const newLogs = [...state.logs, log];
      return {
        logs: newLogs,
        lastLogKey: JSON.stringify(log),
      };
    }),
  setLogs: (logs) => set(() => ({ logs })),
  clearLogs: () => set(() => ({ logs: [] })),

  // 스트림 정리
  clearStreams: () =>
    set({
      localStream: null,
      remoteStream: null,
      remoteAudioStream: null, // 오디오 스트림도 정리
    }),

  // 모든 상태 초기화
  reset: () =>
    set({
      sessionId: null,
      localStream: null,
      remoteStream: null,
      remoteAudioStream: null,
      socket: null,
      peers: {},
      iceServers: [],
      logs: [],
    }),
}));
