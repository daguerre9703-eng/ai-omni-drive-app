/**
 * TLR (Traffic Light Recognition) & SPaT (Signal Phase & Timing) Prediction
 *
 * 신호등 타이밍 예측 시스템:
 * - 신호 변경 잔여 시간 예측
 * - 신호 주기 학습
 * - 다음 신호 예측
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type SignalPhase = "red" | "yellow" | "green" | "unknown";

export type SignalTimingState = {
  // 현재 신호 정보
  currentPhase: SignalPhase;
  currentPhaseStartTime: number; // 현재 신호가 시작된 시간

  // 잔여 시간 예측
  estimatedRemainingSeconds: number | null;
  estimatedNextPhase: SignalPhase;
  estimatedNextPhaseTime: number | null; // 다음 신호로 바뀔 것으로 예상되는 시간

  // OCR로 읽은 실제 카운트다운
  ocrCountdownSeconds: number | null;
  ocrConfidence: number;

  // 신호 주기 학습
  learnedRedDuration: number | null; // 학습된 빨간불 지속 시간 (초)
  learnedYellowDuration: number | null;
  learnedGreenDuration: number | null;
  totalCycleDuration: number | null; // 전체 주기 (초)

  // 예측 신뢰도
  predictionConfidence: number; // 0-1
  predictionMethod: "ocr" | "learned" | "default" | "unknown";

  // 메타데이터
  lastUpdatedAt: number;
  summary: string;
};

export type SignalTimingHistory = {
  phase: SignalPhase;
  startTime: number;
  endTime: number;
  duration: number;
};

const STORAGE_KEY = "ai-omni-drive:signal-timing";
const HISTORY_STORAGE_KEY = "ai-omni-drive:signal-timing-history";
const MAX_HISTORY_SIZE = 50;

// 기본 신호 지속 시간 (초) - 일반적인 교차로 기준
const DEFAULT_RED_DURATION = 45;
const DEFAULT_YELLOW_DURATION = 3;
const DEFAULT_GREEN_DURATION = 35;

export const DEFAULT_SIGNAL_TIMING: SignalTimingState = {
  currentPhase: "unknown",
  currentPhaseStartTime: 0,
  estimatedRemainingSeconds: null,
  estimatedNextPhase: "unknown",
  estimatedNextPhaseTime: null,
  ocrCountdownSeconds: null,
  ocrConfidence: 0,
  learnedRedDuration: null,
  learnedYellowDuration: null,
  learnedGreenDuration: null,
  totalCycleDuration: null,
  predictionConfidence: 0,
  predictionMethod: "unknown",
  lastUpdatedAt: 0,
  summary: "신호 타이밍 대기 중",
};

let currentTimingState = { ...DEFAULT_SIGNAL_TIMING };
let signalHistory: SignalTimingHistory[] = [];
const listeners = new Set<(state: SignalTimingState) => void>();

/**
 * 신호 타이밍 상태 가져오기
 */
export function getSignalTiming(): SignalTimingState {
  return { ...currentTimingState };
}

/**
 * 히스토리 로드
 */
export async function loadSignalTimingHistory(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      signalHistory = JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load signal timing history", error);
  }
}

/**
 * 히스토리 저장
 */
async function saveSignalTimingHistory(): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(signalHistory));
  } catch (error) {
    console.error("Failed to save signal timing history", error);
  }
}

/**
 * 신호 주기 학습 (히스토리 기반)
 */
function learnSignalCycle(): {
  redDuration: number | null;
  yellowDuration: number | null;
  greenDuration: number | null;
  totalCycle: number | null;
} {
  if (signalHistory.length < 3) {
    return {
      redDuration: null,
      yellowDuration: null,
      greenDuration: null,
      totalCycle: null,
    };
  }

  // 각 신호별 지속 시간 수집
  const redDurations: number[] = [];
  const yellowDurations: number[] = [];
  const greenDurations: number[] = [];

  for (const record of signalHistory) {
    if (record.duration > 0 && record.duration < 300) {
      // 5분 이상은 비정상으로 간주
      if (record.phase === "red") redDurations.push(record.duration);
      else if (record.phase === "yellow") yellowDurations.push(record.duration);
      else if (record.phase === "green") greenDurations.push(record.duration);
    }
  }

  // 평균 계산
  const avgRed = redDurations.length > 0
    ? redDurations.reduce((sum, d) => sum + d, 0) / redDurations.length
    : null;

  const avgYellow = yellowDurations.length > 0
    ? yellowDurations.reduce((sum, d) => sum + d, 0) / yellowDurations.length
    : null;

  const avgGreen = greenDurations.length > 0
    ? greenDurations.reduce((sum, d) => sum + d, 0) / greenDurations.length
    : null;

  const totalCycle =
    avgRed !== null && avgGreen !== null && avgYellow !== null
      ? avgRed + avgGreen + avgYellow
      : null;

  return {
    redDuration: avgRed,
    yellowDuration: avgYellow,
    greenDuration: avgGreen,
    totalCycle,
  };
}

/**
 * 다음 신호 예측
 */
function predictNextPhase(currentPhase: SignalPhase): SignalPhase {
  if (currentPhase === "red") return "green";
  if (currentPhase === "yellow") return "red";
  if (currentPhase === "green") return "yellow";
  return "unknown";
}

/**
 * 잔여 시간 예측
 */
function estimateRemainingTime(
  currentPhase: SignalPhase,
  phaseStartTime: number,
  learnedDuration: number | null,
  defaultDuration: number,
): { remainingSeconds: number; confidence: number; method: "learned" | "default" } {
  const now = Date.now();
  const elapsedSeconds = (now - phaseStartTime) / 1000;

  const duration = learnedDuration ?? defaultDuration;
  const remainingSeconds = Math.max(0, duration - elapsedSeconds);

  return {
    remainingSeconds: Math.round(remainingSeconds),
    confidence: learnedDuration !== null ? 0.8 : 0.5,
    method: learnedDuration !== null ? "learned" : "default",
  };
}

/**
 * 신호 변경 감지 및 히스토리 업데이트
 */
async function recordPhaseChange(
  newPhase: SignalPhase,
  timestamp: number,
): Promise<void> {
  const previousPhase = currentTimingState.currentPhase;
  const previousStartTime = currentTimingState.currentPhaseStartTime;

  if (previousPhase !== "unknown" && previousPhase !== newPhase && previousStartTime > 0) {
    // 이전 신호의 지속 시간 기록
    const duration = (timestamp - previousStartTime) / 1000;

    const record: SignalTimingHistory = {
      phase: previousPhase,
      startTime: previousStartTime,
      endTime: timestamp,
      duration,
    };

    signalHistory.push(record);

    // 히스토리 크기 제한
    if (signalHistory.length > MAX_HISTORY_SIZE) {
      signalHistory = signalHistory.slice(-MAX_HISTORY_SIZE);
    }

    await saveSignalTimingHistory();
  }
}

/**
 * 신호 타이밍 업데이트
 */
export async function updateSignalTiming(
  currentPhase: SignalPhase,
  ocrCountdownSeconds: number | null,
  ocrConfidence: number,
): Promise<void> {
  const now = Date.now();

  // 신호 변경 감지
  if (currentPhase !== currentTimingState.currentPhase && currentPhase !== "unknown") {
    await recordPhaseChange(currentPhase, now);
  }

  // 신호 주기 학습
  const learned = learnSignalCycle();

  // 현재 신호 시작 시간 업데이트
  const phaseStartTime =
    currentPhase !== currentTimingState.currentPhase
      ? now
      : currentTimingState.currentPhaseStartTime || now;

  // 잔여 시간 예측
  let estimatedRemaining: number | null = null;
  let predictionConfidence = 0;
  let predictionMethod: "ocr" | "learned" | "default" | "unknown" = "unknown";

  if (ocrCountdownSeconds !== null && ocrConfidence > 0.7) {
    // OCR로 읽은 카운트다운이 신뢰할 만하면 우선 사용
    estimatedRemaining = ocrCountdownSeconds;
    predictionConfidence = ocrConfidence;
    predictionMethod = "ocr";
  } else if (currentPhase !== "unknown") {
    // 학습된 데이터 또는 기본값으로 예측
    const learnedDuration =
      currentPhase === "red"
        ? learned.redDuration
        : currentPhase === "yellow"
        ? learned.yellowDuration
        : currentPhase === "green"
        ? learned.greenDuration
        : null;

    const defaultDuration =
      currentPhase === "red"
        ? DEFAULT_RED_DURATION
        : currentPhase === "yellow"
        ? DEFAULT_YELLOW_DURATION
        : DEFAULT_GREEN_DURATION;

    const estimate = estimateRemainingTime(
      currentPhase,
      phaseStartTime,
      learnedDuration,
      defaultDuration,
    );

    estimatedRemaining = estimate.remainingSeconds;
    predictionConfidence = estimate.confidence;
    predictionMethod = estimate.method;
  }

  // 다음 신호 예측
  const estimatedNextPhase = predictNextPhase(currentPhase);
  const estimatedNextPhaseTime =
    estimatedRemaining !== null ? now + estimatedRemaining * 1000 : null;

  // 요약 메시지
  let summary = "신호 타이밍 대기 중";
  if (currentPhase !== "unknown" && estimatedRemaining !== null) {
    const phaseLabel =
      currentPhase === "red" ? "빨간불" : currentPhase === "yellow" ? "노란불" : "파란불";
    const nextPhaseLabel =
      estimatedNextPhase === "red"
        ? "빨간불"
        : estimatedNextPhase === "yellow"
        ? "노란불"
        : "파란불";

    if (predictionMethod === "ocr") {
      summary = `${phaseLabel} ${estimatedRemaining}초 남음 (실제 표시)`;
    } else if (predictionMethod === "learned") {
      summary = `${phaseLabel} 약 ${estimatedRemaining}초 남음 → ${nextPhaseLabel}`;
    } else {
      summary = `${phaseLabel} 예상 ${estimatedRemaining}초 남음 → ${nextPhaseLabel}`;
    }
  }

  // 상태 업데이트
  currentTimingState = {
    currentPhase,
    currentPhaseStartTime: phaseStartTime,
    estimatedRemainingSeconds: estimatedRemaining,
    estimatedNextPhase,
    estimatedNextPhaseTime,
    ocrCountdownSeconds,
    ocrConfidence,
    learnedRedDuration: learned.redDuration,
    learnedYellowDuration: learned.yellowDuration,
    learnedGreenDuration: learned.greenDuration,
    totalCycleDuration: learned.totalCycle,
    predictionConfidence,
    predictionMethod,
    lastUpdatedAt: now,
    summary,
  };

  // 저장
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentTimingState));

  // 리스너에게 알림
  listeners.forEach((listener) => listener(currentTimingState));
}

/**
 * 신호 타이밍 구독
 */
export function subscribeSignalTiming(
  listener: (state: SignalTimingState) => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * 신호 타이밍 로드
 */
export async function loadSignalTiming(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentTimingState = { ...DEFAULT_SIGNAL_TIMING, ...JSON.parse(stored) };
      listeners.forEach((listener) => listener(currentTimingState));
    }
    await loadSignalTimingHistory();
  } catch (error) {
    console.error("Failed to load signal timing state", error);
  }
}

/**
 * 타이밍 레이블 포맷
 */
export function formatRemainingTime(seconds: number | null): string {
  if (seconds === null) {
    return "예측 불가";
  }

  if (seconds < 10) {
    return `${seconds}초`;
  }

  if (seconds < 60) {
    return `${seconds}초`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds}초`;
}

/**
 * 히스토리 초기화
 */
export async function resetSignalTimingHistory(): Promise<void> {
  signalHistory = [];
  await saveSignalTimingHistory();

  currentTimingState = {
    ...currentTimingState,
    learnedRedDuration: null,
    learnedYellowDuration: null,
    learnedGreenDuration: null,
    totalCycleDuration: null,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentTimingState));
  listeners.forEach((listener) => listener(currentTimingState));
}
