import * as Speech from "expo-speech";

export type VoiceAlertLength = "detailed" | "brief";
export type VoiceAlertStyle = "standard" | "calm" | "urgent";
export type VoiceAlertEvent = "red_signal_ahead" | "green_signal_changed";

export type VoiceAlertSettings = {
  enabled: boolean;
  length: VoiceAlertLength;
  style: VoiceAlertStyle;
};

export type VoiceAlertContext = {
  distanceMeters?: number;
};

export const DEFAULT_VOICE_ALERT_SETTINGS: VoiceAlertSettings = {
  enabled: true,
  length: "detailed",
  style: "standard",
};

export const VOICE_LENGTH_OPTIONS: Array<{
  key: VoiceAlertLength;
  title: string;
  description: string;
}> = [
  {
    key: "detailed",
    title: "상세 안내",
    description: "거리와 주의 문구를 함께 읽습니다.",
  },
  {
    key: "brief",
    title: "간략 안내",
    description: "핵심 단어만 빠르게 읽습니다.",
  },
];

export const VOICE_STYLE_OPTIONS: Array<{
  key: VoiceAlertStyle;
  title: string;
  description: string;
}> = [
  {
    key: "standard",
    title: "기본",
    description: "균형 잡힌 안내 속도와 톤입니다.",
  },
  {
    key: "calm",
    title: "차분",
    description: "조금 더 낮고 안정적인 느낌으로 읽습니다.",
  },
  {
    key: "urgent",
    title: "집중",
    description: "조금 더 또렷하고 빠르게 읽습니다.",
  },
];

const STYLE_SUFFIX: Record<VoiceAlertStyle, string> = {
  standard: "",
  calm: " 천천히 확인해 주세요.",
  urgent: " 즉시 주의해 주세요.",
};

export function buildVoiceAlertText(
  event: VoiceAlertEvent,
  settings: VoiceAlertSettings,
  context: VoiceAlertContext = {},
) {
  const roundedDistance = Math.max(0, Math.round(context.distanceMeters ?? 0));

  if (settings.length === "detailed") {
    if (event === "red_signal_ahead") {
      return `전방 ${roundedDistance}미터 적색 신호입니다. 안전 운행하세요.${STYLE_SUFFIX[settings.style]}`.trim();
    }

    return "신호가 변경되었습니다. 출발하세요.";
  }

  if (event === "red_signal_ahead") {
    return `전방 빨간불.${settings.style === "urgent" ? " 바로 감속." : ""}`.trim();
  }

  return settings.style === "calm" ? "녹색불입니다. 천천히 출발." : "녹색불입니다. 출발.";
}

export function getSpeechOptions(style: VoiceAlertStyle): Speech.SpeechOptions {
  if (style === "calm") {
    return {
      language: "ko-KR",
      pitch: 0.95,
      rate: 0.92,
      volume: 1,
    };
  }

  if (style === "urgent") {
    return {
      language: "ko-KR",
      pitch: 1.08,
      rate: 1.05,
      volume: 1,
    };
  }

  return {
    language: "ko-KR",
    pitch: 1,
    rate: 0.98,
    volume: 1,
  };
}

export async function speakVoiceAlert(
  event: VoiceAlertEvent,
  settings: VoiceAlertSettings,
  context: VoiceAlertContext = {},
) {
  if (!settings.enabled) {
    return;
  }

  const text = buildVoiceAlertText(event, settings, context);
  await Speech.stop();
  Speech.speak(text, getSpeechOptions(settings.style));
}
