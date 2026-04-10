/**
 * 핸즈프리 상시 음성 인식 (Wake Word) + 자연어 명령 처리
 *
 * - 호출어: "옴니야" / "AI야"
 * - Web Speech API (SpeechRecognition) 기반 연속 인식
 * - Expo 환경에서는 expo-audio로 녹음 → 서버 Whisper STT 전사 → LLM 파싱
 * - 설정 > 마이크 상시 켜기 토글로만 통제
 */

// ── 타입 정의 ──
export type VoiceCommandIntent =
  | "set_alert_distance"
  | "set_sensitivity"
  | "set_preset"
  | "set_priority"
  | "set_voice_style"
  | "set_voice_length"
  | "toggle_voice_guide"
  | "toggle_red_alert"
  | "set_red_alert_brightness"
  | "set_red_alert_period"
  | "unknown";

export type VoiceCommandResult = {
  intent: VoiceCommandIntent;
  rawText: string;
  confidence: number;
  params: Record<string, string | number | boolean>;
};

export type VoiceCommandCallback = (result: VoiceCommandResult) => void;
export type WakeWordCallback = () => void;
export type ListeningStateCallback = (state: VoiceListeningState) => void;

export type VoiceListeningState =
  | "idle"           // 마이크 꺼짐
  | "waiting"        // 호출어 대기 중
  | "activated"      // 호출어 감지됨, 명령 대기 중
  | "processing"     // 명령 처리 중
  | "error";         // 에러 상태

// ── 호출어 매칭 ──
const WAKE_WORDS = ["옴니야", "옴니아", "omni야", "ai야", "AI야", "에이아이야", "아이야"];

export function containsWakeWord(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  return WAKE_WORDS.some((w) => normalized.includes(w.toLowerCase().replace(/\s+/g, "")));
}

/**
 * 호출어 이후의 명령 텍스트를 추출한다.
 * 예: "옴니야 알림 거리 20미터로 설정해줘" → "알림 거리 20미터로 설정해줘"
 */
export function extractCommandAfterWakeWord(text: string): string {
  const normalized = text.toLowerCase();
  for (const w of WAKE_WORDS) {
    const idx = normalized.indexOf(w.toLowerCase());
    if (idx !== -1) {
      return text.slice(idx + w.length).trim();
    }
  }
  return text.trim();
}

// ── 로컬 의도 분석 (LLM 호출 전 빠른 매칭) ──
const LOCAL_PATTERNS: Array<{
  intent: VoiceCommandIntent;
  patterns: RegExp[];
  extractParams: (match: string) => Record<string, string | number | boolean>;
}> = [
  {
    intent: "set_alert_distance",
    patterns: [
      /(\d+)\s*(?:미터|m|M)\s*(?:전방|앞|거리|에서)?\s*(?:알[려림]|알림|설정|변경|켜|바꿔)/,
      /(?:알림|알려|경고)\s*(?:거리|위치)?\s*(\d+)\s*(?:미터|m|M)/,
      /(?:전방|앞)\s*(\d+)\s*(?:미터|m|M)/,
    ],
    extractParams: (text) => {
      const match = text.match(/(\d+)\s*(?:미터|m|M)/i);
      return { distanceMeters: match ? parseInt(match[1], 10) : 0 };
    },
  },
  {
    intent: "set_preset",
    patterns: [
      /(?:프리셋|환경|모드)\s*(?:을|를)?\s*(표준|야간|우천|안개)/,
      /(표준|야간|우천|안개)\s*(?:프리셋|환경|모드)\s*(?:으로|로)?\s*(?:변경|설정|바꿔|전환)/,
    ],
    extractParams: (text) => {
      const presetMap: Record<string, string> = {
        표준: "standard",
        야간: "night",
        우천: "rain",
        안개: "fog",
      };
      for (const [kr, en] of Object.entries(presetMap)) {
        if (text.includes(kr)) return { preset: en };
      }
      return {};
    },
  },
  {
    intent: "set_sensitivity",
    patterns: [
      /(?:감도|민감도)\s*(?:을|를)?\s*(기본|야간|우천|자동)/,
      /(기본|야간|우천|자동)\s*(?:감도|민감도|고감도)/,
    ],
    extractParams: (text) => {
      const modeMap: Record<string, string> = {
        기본: "standard",
        야간: "night",
        우천: "rain",
        자동: "auto",
      };
      for (const [kr, en] of Object.entries(modeMap)) {
        if (text.includes(kr)) return { mode: en };
      }
      return {};
    },
  },
  {
    intent: "set_priority",
    patterns: [
      /(?:우선순위|우선|모드)\s*(?:을|를)?\s*(보행|차량|안전)/,
      /(보행|차량|안전)\s*우선/,
    ],
    extractParams: (text) => {
      const modeMap: Record<string, string> = {
        보행: "pedestrian-first",
        차량: "vehicle-first",
        안전: "safety-first",
      };
      for (const [kr, en] of Object.entries(modeMap)) {
        if (text.includes(kr)) return { mode: en };
      }
      return {};
    },
  },
  {
    intent: "toggle_voice_guide",
    patterns: [
      /음성\s*(?:안내|가이드)\s*(켜|꺼|끄|on|off)/i,
    ],
    extractParams: (text) => {
      const isOn = /켜|on/i.test(text);
      return { enabled: isOn };
    },
  },
  {
    intent: "set_voice_style",
    patterns: [
      /(?:음성|목소리|안내)\s*(?:스타일|톤)\s*(?:을|를)?\s*(기본|차분|집중)/,
      /(기본|차분|집중)\s*(?:스타일|톤|모드)/,
    ],
    extractParams: (text) => {
      const styleMap: Record<string, string> = {
        기본: "default",
        차분: "calm",
        집중: "focus",
      };
      for (const [kr, en] of Object.entries(styleMap)) {
        if (text.includes(kr)) return { style: en };
      }
      return {};
    },
  },
  {
    intent: "set_voice_length",
    patterns: [
      /(?:음성|안내)\s*(?:길이)?\s*(상세|간략|짧게|길게)/,
    ],
    extractParams: (text) => {
      if (/상세|길게/.test(text)) return { length: "detailed" };
      if (/간략|짧게/.test(text)) return { length: "brief" };
      return {};
    },
  },
];

/**
 * 로컬 패턴 매칭으로 빠르게 의도를 분석한다.
 * 매칭 실패 시 null을 반환하여 서버 LLM 파싱으로 폴백한다.
 */
export function parseCommandLocally(text: string): VoiceCommandResult | null {
  const commandText = extractCommandAfterWakeWord(text);

  for (const rule of LOCAL_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(commandText)) {
        return {
          intent: rule.intent,
          rawText: text,
          confidence: 0.85,
          params: rule.extractParams(commandText),
        };
      }
    }
  }

  return null;
}

// ── 상수 ──
export const VOICE_COMMAND_STORAGE_KEY = "ai-omni-drive:voice-command-settings";

export type VoiceCommandSettings = {
  alwaysListening: boolean; // 마이크 상시 켜기
};

export const DEFAULT_VOICE_COMMAND_SETTINGS: VoiceCommandSettings = {
  alwaysListening: false,
};
