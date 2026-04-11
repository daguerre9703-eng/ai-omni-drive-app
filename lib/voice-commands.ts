/**
 * Voice Command System for AI Omni-Drive
 *
 * Provides speech recognition and command processing for:
 * - Traffic signal information queries
 * - Media playback control (YouTube Music, etc.)
 * - Navigation commands
 */

import { Platform } from "react-native";
import * as Speech from "expo-speech";
import {
  normalizeVoiceText,
  validateVoiceConfidence,
  enhanceVoiceCommandWithContext,
  type VoiceRecognitionAttempt,
} from "./voice-recognition-quality";

export type VoiceCommand =
  // 신호등 정보
  | "signal_status"      // "신호등 상태", "빨간불인가", "파란불인가"
  | "signal_distance"    // "신호등 몇 미터", "거리 알려줘"

  // 음악 제어
  | "play_music"         // "음악 재생", "노래 틀어줘"
  | "pause_music"        // "음악 정지", "일시정지"
  | "next_track"         // "다음 곡", "다음 노래"
  | "prev_track"         // "이전 곡", "이전 노래"

  // 카메라 제어
  | "camera_on"          // "카메라 켜", "카메라 시작"
  | "camera_off"         // "카메라 꺼", "카메라 중지"
  | "take_photo"         // "사진 찍어", "신호등 인식"
  | "start_scan"         // "실시간 스캔 시작", "연속 스캔 켜"
  | "stop_scan"          // "실시간 스캔 중지", "연속 스캔 꺼"

  // 설정 제어
  | "lowvision_on"       // "저시력 모드 켜"
  | "lowvision_off"      // "저시력 모드 꺼"
  | "haptic_on"          // "진동 경고 켜", "진동 켜"
  | "haptic_off"         // "진동 경고 꺼", "진동 꺼"
  | "auto_env_on"        // "자동 환경 켜", "환경 자동 전환 켜"
  | "auto_env_off"       // "자동 환경 꺼", "환경 자동 전환 꺼"
  | "brightness_up"      // "밝기 올려", "더 밝게"
  | "brightness_down"    // "밝기 내려", "더 어둡게"
  | "distance_30m"       // "알림 거리 30미터", "전방 30미터"
  | "distance_50m"       // "알림 거리 50미터", "전방 50미터"
  | "distance_100m"      // "알림 거리 100미터", "전방 100미터"
  | "distance_auto"      // "알림 거리 자동", "속도 비례"
  | "distance_status"    // "알림 거리 확인", "현재 알림 거리"
  | "ldw_on"             // "차선 경고 켜", "LDW 켜"
  | "ldw_off"            // "차선 경고 꺼", "LDW 꺼"
  | "turn_signal_left"   // "좌측 방향지시등", "왼쪽 깜빡이"
  | "turn_signal_right"  // "우측 방향지시등", "오른쪽 깜빡이"
  | "turn_signal_off"    // "방향지시등 꺼", "깜빡이 꺼"

  // 정보 조회
  | "current_speed"      // "현재 속도", "몇 킬로미터"
  | "scan_stats"         // "스캔 통계", "인식률"
  | "vehicle_distance"   // "앞차 거리", "전방 차량"
  | "help"               // "도움말", "명령어"

  | "unknown";

export type VoiceCommandResult = {
  command: VoiceCommand;
  confidence: number;
  rawText: string;
};

export type VoiceCommandHandler = (command: VoiceCommand, rawText: string) => void | Promise<void>;

// Command patterns for Korean voice recognition
const COMMAND_PATTERNS: Record<VoiceCommand, RegExp[]> = {
  // 신호등 정보
  signal_status: [
    /신호등?\s*(상태|색|색깔)/,
    /(빨간|파란|초록|노란)불/,
    /지금\s*신호/,
    /무슨\s*신호/,
  ],
  signal_distance: [
    /신호등?\s*(거리|몇\s*미터)/,
    /얼마나\s*남았/,
    /몇\s*미터/,
  ],

  // 음악 제어
  play_music: [
    /음악\s*(재생|틀어|시작)/,
    /노래\s*(재생|틀어|시작)/,
    /(유튜브|유튜브\s*뮤직)\s*(재생|틀어)/,
  ],
  pause_music: [
    /음악\s*(정지|멈춰|일시정지|중지)/,
    /노래\s*(정지|멈춰|일시정지|중지)/,
    /일시정지/,
  ],
  next_track: [
    /다음\s*(곡|노래|음악)/,
    /다음\s*재생/,
    /넘겨/,
  ],
  prev_track: [
    /이전\s*(곡|노래|음악)/,
    /이전\s*재생/,
    /뒤로/,
  ],

  // 카메라 제어
  camera_on: [
    /카메라\s*(켜|시작|on)/,
    /카메라\s*화면/,
  ],
  camera_off: [
    /카메라\s*(꺼|중지|종료|off)/,
    /카메라\s*닫/,
  ],
  take_photo: [
    /(사진|신호등)\s*찍/,
    /신호등\s*인식/,
    /인식\s*시작/,
  ],
  start_scan: [
    /(실시간|연속)\s*스캔\s*(시작|켜)/,
    /실시간\s*(시작|켜)/,
    /자동\s*스캔\s*켜/,
  ],
  stop_scan: [
    /(실시간|연속)\s*스캔\s*(중지|꺼)/,
    /실시간\s*(중지|꺼)/,
    /자동\s*스캔\s*꺼/,
  ],

  // 설정 제어
  lowvision_on: [
    /저시력\s*모드\s*(켜|on)/,
    /저시력\s*켜/,
  ],
  lowvision_off: [
    /저시력\s*모드\s*(꺼|off)/,
    /저시력\s*꺼/,
  ],
  haptic_on: [
    /진동\s*(경고|알림)?\s*(켜|on)/,
    /진동\s*켜/,
    /햅틱\s*켜/,
  ],
  haptic_off: [
    /진동\s*(경고|알림)?\s*(꺼|off)/,
    /진동\s*꺼/,
    /햅틱\s*꺼/,
  ],
  auto_env_on: [
    /(자동|환경)\s*(환경|전환)?\s*(켜|on)/,
    /자동\s*환경\s*켜/,
  ],
  auto_env_off: [
    /(자동|환경)\s*(환경|전환)?\s*(꺼|off)/,
    /자동\s*환경\s*꺼/,
  ],
  brightness_up: [
    /밝기\s*(올|높|증가)/,
    /더\s*밝/,
    /밝게/,
  ],
  brightness_down: [
    /밝기\s*(내|낮|감소)/,
    /더\s*어둡/,
    /어둡게/,
  ],
  distance_30m: [
    /(알림|전방)\s*거리\s*30\s*미터/,
    /전방\s*30/,
    /거리\s*30/,
    /30\s*미터\s*전방/,
  ],
  distance_50m: [
    /(알림|전방)\s*거리\s*50\s*미터/,
    /전방\s*50/,
    /거리\s*50/,
    /50\s*미터\s*전방/,
  ],
  distance_100m: [
    /(알림|전방)\s*거리\s*100\s*미터/,
    /전방\s*100/,
    /거리\s*100/,
    /100\s*미터\s*전방/,
  ],
  distance_auto: [
    /(알림|전방)\s*거리\s*자동/,
    /속도\s*비례/,
    /자동\s*(거리|알림)/,
    /거리\s*자동/,
  ],
  distance_status: [
    /(알림|전방)\s*거리\s*(확인|상태|설정)/,
    /현재\s*(알림|전방)\s*거리/,
    /거리\s*몇\s*미터/,
  ],
  ldw_on: [
    /차선\s*(경고|이탈)\s*(켜|on)/,
    /LDW\s*(켜|on)/,
    /차선\s*켜/,
  ],
  ldw_off: [
    /차선\s*(경고|이탈)\s*(꺼|off)/,
    /LDW\s*(꺼|off)/,
    /차선\s*꺼/,
  ],
  turn_signal_left: [
    /(좌측|왼쪽)\s*방향지시등/,
    /(좌측|왼쪽)\s*깜빡이/,
    /왼쪽\s*신호/,
    /좌회전\s*신호/,
  ],
  turn_signal_right: [
    /(우측|오른쪽)\s*방향지시등/,
    /(우측|오른쪽)\s*깜빡이/,
    /오른쪽\s*신호/,
    /우회전\s*신호/,
  ],
  turn_signal_off: [
    /방향지시등\s*(꺼|off)/,
    /깜빡이\s*(꺼|off)/,
    /신호\s*끄/,
  ],

  // 정보 조회
  current_speed: [
    /현재\s*속도/,
    /몇\s*킬로미터/,
    /속도\s*알려/,
  ],
  scan_stats: [
    /(스캔|인식)\s*통계/,
    /인식률/,
    /성공률/,
  ],
  vehicle_distance: [
    /앞\s*차\s*(거리|몇\s*미터)/,
    /전방\s*차량/,
    /차\s*간\s*거리/,
    /앞차/,
  ],
  help: [
    /도움말/,
    /명령어/,
    /뭐라고\s*말/,
    /어떻게\s*(사용|써)/,
  ],

  unknown: [],
};

/**
 * Parse voice input and detect command
 */
export function parseVoiceCommand(
  text: string,
  context?: {
    isNavigating?: boolean;
    isMusicPlaying?: boolean;
    currentSignalState?: "red" | "yellow" | "green" | "unknown";
  },
): VoiceCommandResult {
  // 음성 텍스트 정규화
  let normalizedText = normalizeVoiceText(text);

  // 컨텍스트 기반 명령어 보정
  if (context) {
    normalizedText = enhanceVoiceCommandWithContext(normalizedText, context);
  }

  // Check each command pattern
  for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
    if (command === "unknown") continue;

    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        return {
          command: command as VoiceCommand,
          confidence: 0.9,
          rawText: text,
        };
      }
    }
  }

  return {
    command: "unknown",
    confidence: 0,
    rawText: text,
  };
}

/**
 * Start voice recognition with quality enhancements
 */
export function startVoiceRecognition(
  onResult: (text: string, confidence: number) => void,
  onError?: (error: Error) => void,
  options?: {
    maxRetries?: number;
    minConfidence?: number;
    enableNoiseReduction?: boolean;
  },
): (() => void) | null {
  if (Platform.OS !== "web") {
    console.warn("Voice recognition is only supported on web platform");
    return null;
  }

  // @ts-ignore - Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError?.(new Error("Speech recognition not supported in this browser"));
    return null;
  }

  const maxRetries = options?.maxRetries ?? 2;
  const minConfidence = options?.minConfidence ?? 0.7;
  let attemptCount = 0;
  const attempts: VoiceRecognitionAttempt[] = [];

  const recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 3; // 여러 후보 제공

  // 노이즈 감소 설정 (지원되는 브라우저에서만)
  if (options?.enableNoiseReduction !== false) {
    try {
      // @ts-ignore
      if (recognition.audioTrack) {
        // @ts-ignore
        recognition.audioTrack.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
      }
    } catch (error) {
      console.warn("Could not apply audio constraints:", error);
    }
  }

  recognition.onresult = (event: any) => {
    const result = event.results[0];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence || 0.8; // 일부 브라우저는 confidence 제공 안함

    // 현재 시도 기록
    attempts.push({
      transcript,
      confidence,
      timestamp: Date.now(),
    });

    // 신뢰도 검증
    const validation = validateVoiceConfidence(transcript, confidence);

    if (!validation.valid && attemptCount < maxRetries) {
      // 재시도
      attemptCount++;
      console.log(`음성 재인식 시도 ${attemptCount}/${maxRetries}: ${validation.reason}`);

      setTimeout(() => {
        try {
          recognition.start();
        } catch (error) {
          // 이미 시작된 경우 무시
        }
      }, 500);
      return;
    }

    if (validation.valid || attemptCount >= maxRetries) {
      // 성공 또는 최대 재시도 도달
      onResult(transcript, confidence);
    } else {
      onError?.(new Error(validation.reason));
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error === "no-speech" && attemptCount < maxRetries) {
      // 음성이 감지되지 않은 경우 재시도
      attemptCount++;
      console.log(`음성 미감지, 재시도 ${attemptCount}/${maxRetries}`);

      setTimeout(() => {
        try {
          recognition.start();
        } catch (error) {
          // 이미 시작된 경우 무시
        }
      }, 500);
      return;
    }

    onError?.(new Error(event.error));
  };

  recognition.start();

  return () => {
    recognition.stop();
  };
}

/**
 * Speak response to user
 */
export async function speakResponse(text: string, options?: Speech.SpeechOptions) {
  await Speech.stop();
  Speech.speak(text, {
    language: "ko-KR",
    pitch: 1,
    rate: 0.98,
    volume: 1,
    ...options,
  });
}

/**
 * Build response for signal status command
 */
export function buildSignalStatusResponse(
  signalState: "red" | "yellow" | "green" | "unknown",
  distance: string,
): string {
  const stateMap = {
    red: "빨간불",
    yellow: "노란불",
    green: "파란불",
    unknown: "신호 확인 중",
  };

  const state = stateMap[signalState];

  if (signalState === "unknown") {
    return "현재 신호등을 확인하고 있습니다.";
  }

  return `전방 ${distance} ${state}입니다.`;
}

/**
 * Build response for signal distance command
 */
export function buildSignalDistanceResponse(distance: string): string {
  return `신호등까지 ${distance} 남았습니다.`;
}

/**
 * Build response for current speed command
 */
export function buildCurrentSpeedResponse(speedKmh: number): string {
  return `현재 속도는 시속 ${Math.round(speedKmh)} 킬로미터입니다.`;
}

/**
 * Build response for vehicle distance command
 */
export function buildVehicleDistanceResponse(
  detected: boolean,
  distance: string,
  collisionRisk: "safe" | "caution" | "warning" | "danger",
): string {
  if (!detected) {
    return "전방에 차량이 감지되지 않습니다.";
  }

  if (collisionRisk === "danger") {
    return `⚠️ 위험! 앞차와 ${distance} 매우 가깝습니다. 즉시 감속하세요.`;
  }

  if (collisionRisk === "warning") {
    return `⚠️ 주의! 앞차와 ${distance} 안전 거리를 확보하세요.`;
  }

  if (collisionRisk === "caution") {
    return `앞차와 ${distance} 거리 주의가 필요합니다.`;
  }

  return `앞차와 ${distance} 안전 거리를 유지 중입니다.`;
}

/**
 * Build response for advance notification distance setting
 */
export function buildDistanceSettingResponse(
  mode: "30m" | "50m" | "100m" | "auto",
): string {
  const modeMap = {
    "30m": "30미터 전방",
    "50m": "50미터 전방",
    "100m": "100미터 전방",
    "auto": "속도 비례 자동",
  };

  return `알림 거리를 ${modeMap[mode]}로 설정했습니다.`;
}

/**
 * Build response for distance status query
 */
export function buildDistanceStatusResponse(
  mode: "30m" | "50m" | "100m" | "auto",
  currentDistance: number,
  speedKmh: number,
): string {
  const modeMap = {
    "30m": "30미터 전방",
    "50m": "50미터 전방",
    "100m": "100미터 전방",
    "auto": "속도 비례 자동",
  };

  if (mode === "auto") {
    return `현재 알림 거리는 ${modeMap[mode]} 모드로, 시속 ${Math.round(speedKmh)} 킬로미터에서 약 ${Math.round(currentDistance)}미터입니다.`;
  }

  return `현재 알림 거리는 ${modeMap[mode]}로 설정되어 있습니다.`;
}

/**
 * Build help response with available commands
 */
export function buildHelpResponse(): string {
  return "신호등 상태, 신호등 거리, 앞차 거리, 음악 재생, 음악 정지, 다음 곡, 카메라 켜기, 실시간 스캔 시작, 저시력 모드 켜기, 진동 켜기, 밝기 올려, 알림 거리 30미터, 알림 거리 자동, 알림 거리 확인, 차선 경고 켜기, 좌측 방향지시등, 우측 방향지시등, 현재 속도, 스캔 통계 등을 말씀하시면 됩니다.";
}
