import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useSettingStore from '@/stores/settingStore'; // store import

// ✅ 1. 디폴트 세팅 정의
const defaultSetting = {
  video: {
    category: {
      smoke: false,
      drink: false,
      sharpObjects: false,
      flammables: false,
      firearms: false,
      exposure: false,
    },
    action: {
      filtering: false,
      alert: false,
      logging: false,
    },
  },
  audio: {
    category: {
      profanity: null,
      hateSpeech: false,
      bannedWords: [],
    },
    action: {
      filtering: false,
      alert: false,
      logging: false,
    },
  },
};

export const useAuthStore = create(
  persist(
    (set) => ({
      isLoggedIn: false,
      isNewUser: true,
      user: null,

      // login 부분 이거 대정씨에게 공유
      login: (userData) => {
        // user setting 데이터
        const userSettings = {
          video: {
            category: {
              ...defaultSetting.video.category,
              ...(userData.result.setting?.video?.category || {}),
            },
            action: {
              ...defaultSetting.video.action,
              ...(userData.result.setting?.video?.action || {}),
            },
          },
          audio: {
            category: {
              ...defaultSetting.audio.category,
              ...(userData.result.setting?.audio?.category || {}),
            },
            action: {
              ...defaultSetting.audio.action,
              ...(userData.result.setting?.audio?.action || {}),
            },
          },
        };
        
        // user 데이터 전체
        const fullUser = {
          ...userData.result,
          access_token: userData.token,
          setting: userSettings,
        };
      
        set({
          isLoggedIn: true,
          isNewUser: userData.is_new_user ?? true,
          user: fullUser,
        });

        // ✅ settingStore 초기화
        const { initializeSetting } = useSettingStore.getState();
        initializeSetting(userSettings);
      },

      logout: () =>
        set({
          isLoggedIn: false,
          isNewUser: false,
          user: null,
        }),

      setIsNewUser: (value) => set({ isNewUser: value }),
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
    },
  ),
);
