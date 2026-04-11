/**
 * Traffic Sign Recognition (TSR) System
 *
 * 교통 표지판 인식 및 표시 시스템
 * - 속도 제한 표지판 인식
 * - 어린이 보호구역 (스쿨존) 인식
 * - 일시 정지 표지판 인식
 * - 주의/금지 표지판 인식
 * - 속도 제한 초과 알림
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type TrafficSignType =
  | "speed_limit"           // 속도 제한
  | "school_zone"           // 어린이 보호구역
  | "stop"                  // 일시 정지
  | "warning"               // 주의 표지
  | "prohibition"           // 금지 표지
  | "unknown";

export type TrafficSign = {
  type: TrafficSignType;
  speedLimit: number | null; // 속도 제한 값 (km/h), 속도 제한 표지판만
  description: string;
  confidence: number;
  detectedAt: number;
};

export type SpeedAlertLevel = "safe" | "approaching" | "exceeding" | "severe";

export type TSRState = {
  tsrEnabled: boolean;
  speedLimitAlertEnabled: boolean;
  currentSpeedLimit: number | null; // 현재 적용 중인 속도 제한 (km/h)
  isInSchoolZone: boolean;
  recentSigns: TrafficSign[];
  lastDetectionAt: number;
  navigationSpeedLimit: number | null; // 내비게이션에서 제공하는 제한 속도
  speedAlertLevel: SpeedAlertLevel;
};

const STORAGE_KEY = "@tsr_state";

// 기본 상태
const DEFAULT_STATE: TSRState = {
  tsrEnabled: true,
  speedLimitAlertEnabled: true,
  currentSpeedLimit: null,
  isInSchoolZone: false,
  recentSigns: [],
  lastDetectionAt: 0,
  navigationSpeedLimit: null,
  speedAlertLevel: "safe",
};

// 전역 상태 캐시
let cachedState: TSRState = { ...DEFAULT_STATE };

// 상태 변경 구독자
type StateChangeListener = (state: TSRState) => void;
const listeners = new Set<StateChangeListener>();

// 표지판 유효 기간 (밀리초) - 2분 후 자동 만료
const SIGN_EXPIRY_MS = 120000;

/**
 * TSR 상태 로드
 */
export async function loadTSRState(): Promise<TSRState> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      cachedState = { ...DEFAULT_STATE, ...parsed };

      // 만료된 표지판 제거
      const now = Date.now();
      cachedState.recentSigns = cachedState.recentSigns.filter(
        (sign) => now - sign.detectedAt < SIGN_EXPIRY_MS
      );
    }
  } catch (error) {
    console.error("[TSR] Failed to load state:", error);
  }
  return { ...cachedState };
}

/**
 * TSR 상태 저장
 */
export async function saveTSRState(updates: Partial<TSRState>): Promise<void> {
  try {
    cachedState = { ...cachedState, ...updates };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    notifyListeners();
  } catch (error) {
    console.error("[TSR] Failed to save state:", error);
  }
}

/**
 * 현재 TSR 상태 가져오기 (동기)
 */
export function getTSRState(): TSRState {
  return { ...cachedState };
}

/**
 * TSR 활성화/비활성화
 */
export async function setTSREnabled(enabled: boolean): Promise<void> {
  await saveTSRState({ tsrEnabled: enabled });
}

/**
 * 속도 제한 알림 활성화/비활성화
 */
export async function setSpeedLimitAlertEnabled(enabled: boolean): Promise<void> {
  await saveTSRState({ speedLimitAlertEnabled: enabled });
}

/**
 * 내비게이션 속도 제한 업데이트
 */
export async function updateNavigationSpeedLimit(speedLimit: number | null): Promise<void> {
  await saveTSRState({ navigationSpeedLimit: speedLimit });

  // 현재 속도 제한 재평가
  updateCurrentSpeedLimit();
}

/**
 * 표지판 감지 결과 추가
 */
export async function addDetectedSign(sign: TrafficSign): Promise<void> {
  const now = Date.now();

  // 최근 표지판 목록에 추가 (최대 10개 유지)
  const recentSigns = [sign, ...cachedState.recentSigns].slice(0, 10);

  const updates: Partial<TSRState> = {
    recentSigns,
    lastDetectionAt: now,
  };

  // 속도 제한 표지판인 경우
  if (sign.type === "speed_limit" && sign.speedLimit !== null) {
    updates.currentSpeedLimit = sign.speedLimit;
  }

  // 스쿨존 표지판인 경우
  if (sign.type === "school_zone") {
    updates.isInSchoolZone = true;
    // 스쿨존은 일반적으로 30km/h 제한
    updates.currentSpeedLimit = 30;
  }

  await saveTSRState(updates);
}

/**
 * 현재 속도 제한 결정 (Vision AI vs 내비게이션)
 */
function updateCurrentSpeedLimit(): void {
  const { navigationSpeedLimit, recentSigns } = cachedState;

  // 최근 2분 이내 속도 제한 표지판 찾기
  const now = Date.now();
  const recentSpeedSign = recentSigns.find(
    (sign) =>
      sign.type === "speed_limit" &&
      sign.speedLimit !== null &&
      now - sign.detectedAt < SIGN_EXPIRY_MS
  );

  if (recentSpeedSign && recentSpeedSign.speedLimit !== null) {
    // Vision AI로 감지한 표지판 우선
    cachedState.currentSpeedLimit = recentSpeedSign.speedLimit;
  } else if (navigationSpeedLimit !== null) {
    // 내비게이션 데이터 사용
    cachedState.currentSpeedLimit = navigationSpeedLimit;
  }
}

/**
 * 속도 초과 여부 확인 및 경고 레벨 계산
 */
export function checkSpeedViolation(currentSpeed: number): {
  isViolating: boolean;
  alertLevel: SpeedAlertLevel;
  speedDifference: number;
} {
  if (!cachedState.tsrEnabled || !cachedState.speedLimitAlertEnabled) {
    return { isViolating: false, alertLevel: "safe", speedDifference: 0 };
  }

  const speedLimit = cachedState.currentSpeedLimit;
  if (speedLimit === null) {
    return { isViolating: false, alertLevel: "safe", speedDifference: 0 };
  }

  const speedDifference = currentSpeed - speedLimit;

  // 스쿨존은 더 엄격하게
  const threshold = cachedState.isInSchoolZone ? 0 : 5;

  if (speedDifference <= threshold) {
    return { isViolating: false, alertLevel: "safe", speedDifference };
  }

  // 경고 레벨 결정
  let alertLevel: SpeedAlertLevel = "safe";

  if (speedDifference > threshold && speedDifference <= 10) {
    alertLevel = "approaching"; // 제한 속도에 근접
  } else if (speedDifference > 10 && speedDifference <= 20) {
    alertLevel = "exceeding"; // 제한 속도 초과
  } else {
    alertLevel = "severe"; // 심각한 초과
  }

  return { isViolating: true, alertLevel, speedDifference };
}

/**
 * 속도 경고 레벨 업데이트
 */
export async function updateSpeedAlertLevel(currentSpeed: number): Promise<void> {
  const { alertLevel } = checkSpeedViolation(currentSpeed);

  if (cachedState.speedAlertLevel !== alertLevel) {
    await saveTSRState({ speedAlertLevel: alertLevel });
  }
}

/**
 * 상태 변경 구독
 */
export function subscribeTSRState(listener: StateChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 구독자들에게 알림
 */
function notifyListeners(): void {
  listeners.forEach((listener) => listener({ ...cachedState }));
}

/**
 * 표지판 종류 레이블
 */
export function getTrafficSignLabel(type: TrafficSignType): string {
  switch (type) {
    case "speed_limit":
      return "속도 제한";
    case "school_zone":
      return "어린이 보호구역";
    case "stop":
      return "일시 정지";
    case "warning":
      return "주의";
    case "prohibition":
      return "금지";
    default:
      return "알 수 없음";
  }
}

/**
 * 속도 경고 메시지 생성
 */
export function getSpeedAlertMessage(
  currentSpeed: number,
  speedLimit: number,
  alertLevel: SpeedAlertLevel
): string {
  const diff = currentSpeed - speedLimit;

  if (alertLevel === "approaching") {
    return `제한 속도 ${speedLimit}km/h입니다. 현재 ${Math.round(currentSpeed)}km/h`;
  }

  if (alertLevel === "exceeding") {
    return `⚠️ 속도 ${Math.round(diff)}km/h 초과! 제한 속도 ${speedLimit}km/h`;
  }

  if (alertLevel === "severe") {
    return `⚠️ 위험! 속도 ${Math.round(diff)}km/h 초과! 감속하세요!`;
  }

  return "";
}

/**
 * 스쿨존 상태 초기화 (스쿨존 표지판 만료 시)
 */
export async function clearSchoolZone(): Promise<void> {
  await saveTSRState({
    isInSchoolZone: false,
    currentSpeedLimit: cachedState.navigationSpeedLimit,
  });
}

/**
 * TSR 상태 요약
 */
export function getTSRStatusLabel(): string {
  if (!cachedState.tsrEnabled) {
    return "표지판 인식 꺼짐";
  }

  if (cachedState.currentSpeedLimit !== null) {
    const limitText = `제한 속도 ${cachedState.currentSpeedLimit}km/h`;
    if (cachedState.isInSchoolZone) {
      return `🏫 ${limitText} (스쿨존)`;
    }
    return limitText;
  }

  if (cachedState.recentSigns.length > 0) {
    const latestSign = cachedState.recentSigns[0];
    return `${getTrafficSignLabel(latestSign.type)} 감지`;
  }

  return "표지판 감지 중...";
}

/**
 * 표지판 아이콘 가져오기
 */
export function getTrafficSignIcon(type: TrafficSignType, speedLimit?: number): string {
  switch (type) {
    case "speed_limit":
      return speedLimit ? `${speedLimit}` : "🚦";
    case "school_zone":
      return "🏫";
    case "stop":
      return "🛑";
    case "warning":
      return "⚠️";
    case "prohibition":
      return "🚫";
    default:
      return "❓";
  }
}
