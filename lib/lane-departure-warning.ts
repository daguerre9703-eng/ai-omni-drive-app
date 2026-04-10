/**
 * Lane Departure Warning (LDW) System
 *
 * 차선 이탈 경고 시스템
 * - 비전 AI 기반 실시간 차선 인식
 * - 방향지시등 없이 차선 이탈 시 경고
 * - 시각적/청각적 경고 제공
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type LaneDepartureDirection = "left" | "right" | "none";

export type LaneDepartureSeverity = "safe" | "warning" | "danger";

export type LanePosition = "center" | "left_side" | "right_side" | "unknown";

export type LaneDepartureState = {
  ldwEnabled: boolean;
  laneDetected: boolean;
  departureDetected: boolean;
  departureDirection: LaneDepartureDirection;
  severity: LaneDepartureSeverity;
  lanePosition: LanePosition;
  leftLaneVisible: boolean;
  rightLaneVisible: boolean;
  distanceToLeftLane: number | null; // 미터
  distanceToRightLane: number | null; // 미터
  turnSignalActive: boolean; // 방향지시등 활성화 상태
  turnSignalDirection: "left" | "right" | "none";
  lastWarningAt: number;
  confidence: number;
};

const STORAGE_KEY = "@lane_departure_state";
const TURN_SIGNAL_STORAGE_KEY = "@turn_signal_state";

// 기본 상태
const DEFAULT_STATE: LaneDepartureState = {
  ldwEnabled: true,
  laneDetected: false,
  departureDetected: false,
  departureDirection: "none",
  severity: "safe",
  lanePosition: "unknown",
  leftLaneVisible: false,
  rightLaneVisible: false,
  distanceToLeftLane: null,
  distanceToRightLane: null,
  turnSignalActive: false,
  turnSignalDirection: "none",
  lastWarningAt: 0,
  confidence: 0,
};

// 전역 상태 캐시
let cachedState: LaneDepartureState = { ...DEFAULT_STATE };

// 상태 변경 구독자
type StateChangeListener = (state: LaneDepartureState) => void;
const listeners = new Set<StateChangeListener>();

// 방향지시등 타이머
let turnSignalTimerId: NodeJS.Timeout | null = null;

/**
 * LDW 상태 로드
 */
export async function loadLaneDepartureState(): Promise<LaneDepartureState> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      cachedState = { ...DEFAULT_STATE, ...parsed };
    }

    // 방향지시등 상태는 별도 저장소에서 로드
    const turnSignalStored = await AsyncStorage.getItem(TURN_SIGNAL_STORAGE_KEY);
    if (turnSignalStored) {
      const turnSignal = JSON.parse(turnSignalStored);
      cachedState.turnSignalActive = turnSignal.active || false;
      cachedState.turnSignalDirection = turnSignal.direction || "none";
    }
  } catch (error) {
    console.error("[LDW] Failed to load state:", error);
  }
  return { ...cachedState };
}

/**
 * LDW 상태 저장
 */
export async function saveLaneDepartureState(updates: Partial<LaneDepartureState>): Promise<void> {
  try {
    cachedState = { ...cachedState, ...updates };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    notifyListeners();
  } catch (error) {
    console.error("[LDW] Failed to save state:", error);
  }
}

/**
 * 현재 LDW 상태 가져오기 (동기)
 */
export function getLaneDepartureState(): LaneDepartureState {
  return { ...cachedState };
}

/**
 * LDW 활성화/비활성화
 */
export async function setLDWEnabled(enabled: boolean): Promise<void> {
  await saveLaneDepartureState({ ldwEnabled: enabled });
}

/**
 * 방향지시등 켜기 (자동으로 30초 후 꺼짐)
 */
export async function activateTurnSignal(direction: "left" | "right"): Promise<void> {
  // 기존 타이머 취소
  if (turnSignalTimerId) {
    clearTimeout(turnSignalTimerId);
  }

  cachedState.turnSignalActive = true;
  cachedState.turnSignalDirection = direction;

  await AsyncStorage.setItem(
    TURN_SIGNAL_STORAGE_KEY,
    JSON.stringify({ active: true, direction })
  );

  notifyListeners();

  // 30초 후 자동 해제
  turnSignalTimerId = setTimeout(() => {
    deactivateTurnSignal();
  }, 30000);
}

/**
 * 방향지시등 끄기
 */
export async function deactivateTurnSignal(): Promise<void> {
  if (turnSignalTimerId) {
    clearTimeout(turnSignalTimerId);
    turnSignalTimerId = null;
  }

  cachedState.turnSignalActive = false;
  cachedState.turnSignalDirection = "none";

  await AsyncStorage.setItem(
    TURN_SIGNAL_STORAGE_KEY,
    JSON.stringify({ active: false, direction: "none" })
  );

  notifyListeners();
}

/**
 * 차선 감지 결과 업데이트
 */
export async function updateLaneDetection(
  laneDetected: boolean,
  lanePosition: LanePosition,
  leftLaneVisible: boolean,
  rightLaneVisible: boolean,
  distanceToLeftLane: number | null,
  distanceToRightLane: number | null,
  confidence: number
): Promise<void> {
  const updates: Partial<LaneDepartureState> = {
    laneDetected,
    lanePosition,
    leftLaneVisible,
    rightLaneVisible,
    distanceToLeftLane,
    distanceToRightLane,
    confidence,
  };

  // 차선 이탈 감지
  const { departureDetected, departureDirection, severity } = detectDeparture(
    lanePosition,
    distanceToLeftLane,
    distanceToRightLane,
    cachedState.turnSignalActive,
    cachedState.turnSignalDirection
  );

  updates.departureDetected = departureDetected;
  updates.departureDirection = departureDirection;
  updates.severity = severity;

  if (departureDetected && severity !== "safe") {
    updates.lastWarningAt = Date.now();
  }

  await saveLaneDepartureState(updates);
}

/**
 * 차선 이탈 감지 로직
 */
function detectDeparture(
  lanePosition: LanePosition,
  distanceToLeftLane: number | null,
  distanceToRightLane: number | null,
  turnSignalActive: boolean,
  turnSignalDirection: "left" | "right" | "none"
): {
  departureDetected: boolean;
  departureDirection: LaneDepartureDirection;
  severity: LaneDepartureSeverity;
} {
  // LDW가 비활성화된 경우
  if (!cachedState.ldwEnabled) {
    return { departureDetected: false, departureDirection: "none", severity: "safe" };
  }

  // 차선이 감지되지 않은 경우
  if (lanePosition === "unknown") {
    return { departureDetected: false, departureDirection: "none", severity: "safe" };
  }

  // 방향지시등이 켜져 있으면 해당 방향 이탈은 경고하지 않음
  if (turnSignalActive) {
    if (turnSignalDirection === "left" && lanePosition === "left_side") {
      return { departureDetected: false, departureDirection: "none", severity: "safe" };
    }
    if (turnSignalDirection === "right" && lanePosition === "right_side") {
      return { departureDetected: false, departureDirection: "none", severity: "safe" };
    }
  }

  // 좌측 이탈 감지
  if (lanePosition === "left_side") {
    const severity = getSeverityFromDistance(distanceToLeftLane);
    return { departureDetected: true, departureDirection: "left", severity };
  }

  // 우측 이탈 감지
  if (lanePosition === "right_side") {
    const severity = getSeverityFromDistance(distanceToRightLane);
    return { departureDetected: true, departureDirection: "right", severity };
  }

  // 중앙 유지 (안전)
  return { departureDetected: false, departureDirection: "none", severity: "safe" };
}

/**
 * 차선까지 거리로 심각도 판단
 */
function getSeverityFromDistance(distance: number | null): LaneDepartureSeverity {
  if (distance === null) {
    return "warning";
  }

  if (distance < 0.3) {
    // 30cm 미만
    return "danger";
  }

  if (distance < 0.6) {
    // 60cm 미만
    return "warning";
  }

  return "safe";
}

/**
 * 상태 변경 구독
 */
export function subscribeLaneDepartureState(listener: StateChangeListener): () => void {
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
 * 경고 메시지 생성
 */
export function getLDWWarningMessage(
  departureDirection: LaneDepartureDirection,
  severity: LaneDepartureSeverity
): string {
  const directionText = departureDirection === "left" ? "좌측" : "우측";

  if (severity === "danger") {
    return `⚠️ 위험! ${directionText} 차선을 벗어나고 있습니다!`;
  }

  if (severity === "warning") {
    return `⚠️ 주의! ${directionText} 차선 이탈 경고`;
  }

  return "";
}

/**
 * 상태 레이블 생성
 */
export function getLDWStatusLabel(): string {
  if (!cachedState.ldwEnabled) {
    return "차선 이탈 경고 꺼짐";
  }

  if (!cachedState.laneDetected) {
    return "차선 감지 중...";
  }

  if (cachedState.departureDetected) {
    const directionText = cachedState.departureDirection === "left" ? "좌측" : "우측";
    return `⚠️ ${directionText} 차선 이탈`;
  }

  if (cachedState.turnSignalActive) {
    const directionText = cachedState.turnSignalDirection === "left" ? "좌측" : "우측";
    return `${directionText} 방향지시등 켜짐`;
  }

  return "차선 유지 중";
}

/**
 * 차선 위치 레이블
 */
export function getLanePositionLabel(position: LanePosition): string {
  switch (position) {
    case "center":
      return "중앙";
    case "left_side":
      return "좌측";
    case "right_side":
      return "우측";
    case "unknown":
      return "알 수 없음";
    default:
      return "알 수 없음";
  }
}
