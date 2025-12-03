// stores/broadcastStore.js

import { create } from 'zustand';

export const useBroadcastStore = create((set) => ({
  isLive: false,
  isRecording: false,
  isCameraOn: false,
  isMicOn: false,

  toggleLive: () =>
    set((state) => ({
      isLive: !state.isLive,
      //isCameraOn: !state.isLive ? true : false, // 방송 시작 시 카메라 자동 ON, 종료 시 OFF 뺴말아
    })),

  toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),

  toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),

  toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),
}));
