import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from '@/lib/axios'
import { useWebrtcStore } from '@/stores/webrtcStore';




// 프리셋을 실수로 수정 못 하도록 deepFreeze
function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = obj[ prop ];
    if (value && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

// 프리셋(불변)
export const PRESETS = deepFreeze({
  kids: {
    video: {
      category: { smoke: true, drink: true, sharpObjects: true, flammables: true, firearms: true, exposure: false },
      action: { filtering: true, alert: true, logging: true },
    },
    audio: {
      category: { profanity: 'high', hateSpeech: true, bannedWords: [] },
      action: { filtering: true, alert: true, logging: true },
    },
  },
  mild: {
    video: {
      category: { smoke: true, drink: true, sharpObjects: false, flammables: false, firearms: false, exposure: false },
      action: { filtering: true, alert: true, logging: true },
    },
    audio: {
      category: { profanity: 'mid', hateSpeech: true, bannedWords: [] },
      action: { filtering: true, alert: true, logging: true },
    },
  },
  spicy: {
    video: {
      category: { smoke: false, drink: false, sharpObjects: false, flammables: false, firearms: false, exposure: false },
      action: { filtering: false, alert: false, logging: true },
    },
    audio: {
      category: { profanity: null, hateSpeech: false, bannedWords: [] },
      action: { filtering: false, alert: false, logging: true },
    },
  },
});


// 객체 내에서 특정 key들(경로) 제외하는 함수 (현재는 금지어 제외 하나에만 씀)
export function deepOmit(obj, paths = []) {
  const result = typeof structuredClone === 'function'
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

  for (const path of paths) {
    const keys = path.split('.');
    let temp = result;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!temp[ keys[ i ] ]) break;
      temp = temp[ keys[ i ] ];
    }
    if (temp && typeof temp === 'object') {
      delete temp[ keys[ keys.length - 1 ] ];
    }
  }
  return result;
}

// 스토어 상태 템플릿
const defaultState = {
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
      alert: true,
      logging: false,
    },
  },
  audio: {
    category: { 
      profanity: null, 
      hateSpeech: false, 
      bannedWords: [] 
    },
    action: { 
      filtering: false, 
      alert: false, 
      logging: false 
    },
  },
};


// video, audio 값들 상태 관리
const useSettingStore = create(
  persist(
    (set, get) => ({
      // 초기 상태 주입
      ...defaultState,

      // 초기화함수
      initializeSetting: (setting) => {
        const { video, audio } = setting;
        set({ video, audio });
      },

      updateVideoCategory: (key) =>
        set((state) => ({
          video: {
            ...state.video,
            category: {
              ...state.video.category,
              [ key ]: !state.video.category[ key ],
            },
          },
        })),

      updateVideoAction: (key) =>
        set((state) => ({
          video: {
            ...state.video,
            action: {
              ...state.video.action,
              [ key ]: !state.video.action[ key ],
            },
          },
        })),

      // audio.category 전체 토글 (profanity는 null ⇄ 'low')
      updateAudioCategory: (key) =>
        set((state) => {
          if (key === 'profanity') {
            const cur = state.audio.category.profanity;
            return {
              audio: {
                ...state.audio,
                category: {
                  ...state.audio.category,
                  profanity: cur ? null : 'low',
                },
              },
            };
          }
          return {
            audio: {
              ...state.audio,
              category: {
                ...state.audio.category,
                [ key ]: !state.audio.category[ key ],
              },
            },
          };
        }),

      updateAudioProfanity: (level) =>
        set((state) => ({
          audio: {
            ...state.audio,
            category: {
              ...state.audio.category,
              profanity: level,
            },
          },
        })),

      addBannedWord: (word) => {
        set((state) => {
          const current = state.audio.category.bannedWords || [];
          if (current.includes(word)) return state;
          const updated = [ ...current, word ];
          return {
            audio: {
              ...state.audio,
              category: {
                ...state.audio.category,
                bannedWords: updated,
              },
            },
          };
        });
      },

      removeBannedWord: (word) =>
        set((state) => {
          const current = state.audio.category.bannedWords || [];
          const updated = current.filter((w) => w !== word);
          return {
            audio: {
              ...state.audio,
              category: {
                ...state.audio.category,
                bannedWords: updated,
              },
            },
          };
        }),

      updateAudioAction: (key) =>
        set((state) => ({
          audio: {
            ...state.audio,
            action: {
              ...state.audio.action,
              [ key ]: !state.audio.action[ key ],
            },
          },
        })),


      // Preset 변경 시 store 전체 Preset 세팅값으로 덮어쓰기 (금지어 제외)
      applyPresetSetting: (presetName) => {
        const audio = get().audio;
        if (!presetName || !PRESETS?.[ presetName ]) return;

        const currentBannedWords = audio?.category?.bannedWords || [];

        const presetWithoutBannedWords = deepOmit(PRESETS[ presetName ], [
          'audio.category.bannedWords',
        ]);

        const mergedSetting = {
          ...presetWithoutBannedWords,
          audio: {
            ...presetWithoutBannedWords.audio,
            category: {
              ...presetWithoutBannedWords.audio.category,
              bannedWords: currentBannedWords,
            },
          },
        };

        // 덮어쓰기
        set({
          video: mergedSetting.video,
          audio: mergedSetting.audio,
        });
      },


      // 현재 상태 저장(서버 PUT)
      saveSetting: async (data) => {
        const { sessionId } = useWebrtcStore.getState();
        console.log('✅ 필터링 setting 저장:', data);
        try {

          await axios.put('/user/setting', { ...data, sessionId });  // baseURL과 쿠키는 이미 적용됨!
          console.log('✅ 필터링 setting 저장 성공');
        } catch (error) {
          console.error('❌ 필터링 setting 저장 실패:', error);
        }
      },

      // ✅ 추가: 로그아웃 등 초기화용
      reset: () => set({ ...defaultState }),
    }),
    {
      name: 'setting-store', // ✅ 저장 키
      // ✅ 저장 최소화: presets은 불변 상수이므로 저장 X
      partialize: (s) => ({ video: s.video, audio: s.audio }),
    }
  )
);

export default useSettingStore

