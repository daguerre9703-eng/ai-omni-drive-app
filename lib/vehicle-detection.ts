/**
 * 전방 차량 감지 및 충돌 방지 시스템
 *
 * 기능:
 * - 전방 차량 감지
 * - 앞차 출발 알림
 * - 충돌 위험 경고
 * - 안전 거리 계산
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type VehicleDetectionState = {
  // 차량 감지 상태
  frontVehicleDetected: boolean;
  vehicleDistance: number | null; // 미터 단위
  vehicleDistanceLabel: string;

  // 앞차 출발 상태
  frontVehicleMoving: boolean;
  frontVehicleStopped: boolean;
  departureAlertActive: boolean;

  // 충돌 위험 경고
  collisionRiskLevel: "safe" | "caution" | "warning" | "danger";
  collisionWarningActive: boolean;
  estimatedTimeToCollision: number | null; // 초 단위

  // 안전 거리
  safeDistanceMeters: number;
  isSafeDistance: boolean;

  // 메타데이터
  lastDetectedAt: number;
  lastAnalyzedAt: number;
  confidence: number;
  summary: string;
};

export type VehicleDetectionSettings = {
  enabled: boolean;
  departureAlertEnabled: boolean;
  collisionWarningEnabled: boolean;
  minSafeDistance: number; // 미터
  sensitivityLevel: "low" | "medium" | "high";
};

const STORAGE_KEY = "ai-omni-drive:vehicle-detection";
const SETTINGS_STORAGE_KEY = "ai-omni-drive:vehicle-detection-settings";

export const DEFAULT_VEHICLE_DETECTION: VehicleDetectionState = {
  frontVehicleDetected: false,
  vehicleDistance: null,
  vehicleDistanceLabel: "차량 없음",
  frontVehicleMoving: false,
  frontVehicleStopped: false,
  departureAlertActive: false,
  collisionRiskLevel: "safe",
  collisionWarningActive: false,
  estimatedTimeToCollision: null,
  safeDistanceMeters: 20,
  isSafeDistance: true,
  lastDetectedAt: 0,
  lastAnalyzedAt: 0,
  confidence: 0,
  summary: "전방 차량 감지 대기",
};

export const DEFAULT_VEHICLE_DETECTION_SETTINGS: VehicleDetectionSettings = {
  enabled: true,
  departureAlertEnabled: true,
  collisionWarningEnabled: true,
  minSafeDistance: 20,
  sensitivityLevel: "medium",
};

let currentVehicleDetection = { ...DEFAULT_VEHICLE_DETECTION };
const listeners = new Set<(state: VehicleDetectionState) => void>();

/**
 * 안전 거리 계산 (속도 기반)
 */
export function calculateSafeDistance(speedKmh: number, sensitivityLevel: "low" | "medium" | "high"): number {
  // 기본 공식: (속도 / 10)^2 미터
  const baseDistance = Math.pow(speedKmh / 10, 2);

  // 감도에 따른 배율
  const multiplier = sensitivityLevel === "high" ? 1.5 : sensitivityLevel === "low" ? 0.7 : 1.0;

  return Math.max(10, Math.round(baseDistance * multiplier));
}

/**
 * 충돌 위험 레벨 계산
 */
export function calculateCollisionRisk(
  distance: number,
  safeDistance: number,
  relativeSpeed: number,
): "safe" | "caution" | "warning" | "danger" {
  const distanceRatio = distance / safeDistance;

  // 상대 속도가 양수면 (앞차가 더 느림) 위험도 증가
  if (relativeSpeed > 10) {
    // 10km/h 이상 빠르게 접근 중
    if (distanceRatio < 0.5) return "danger";
    if (distanceRatio < 0.7) return "warning";
    if (distanceRatio < 1.0) return "caution";
  } else if (relativeSpeed > 0) {
    // 조금씩 접근 중
    if (distanceRatio < 0.4) return "danger";
    if (distanceRatio < 0.6) return "warning";
    if (distanceRatio < 0.9) return "caution";
  }

  // 안전 거리 내
  if (distanceRatio < 0.8) return "caution";

  return "safe";
}

/**
 * 예상 충돌 시간 계산 (TTC - Time To Collision)
 */
export function calculateTimeToCollision(distance: number, relativeSpeedKmh: number): number | null {
  if (relativeSpeedKmh <= 0) {
    // 접근하지 않음
    return null;
  }

  // km/h를 m/s로 변환
  const relativeSpeedMs = relativeSpeedKmh / 3.6;

  // TTC = distance / relative_speed
  const ttc = distance / relativeSpeedMs;

  return ttc;
}

/**
 * 거리 레이블 생성
 */
export function formatVehicleDistance(distance: number | null): string {
  if (distance === null) {
    return "차량 없음";
  }

  if (distance < 5) {
    return `${distance.toFixed(1)}m 매우 가까움`;
  }

  if (distance < 15) {
    return `${Math.round(distance)}m 가까움`;
  }

  if (distance < 50) {
    return `${Math.round(distance)}m`;
  }

  return `${Math.round(distance)}m 멀리`;
}

/**
 * 차량 감지 상태 가져오기
 */
export function getVehicleDetection(): VehicleDetectionState {
  return { ...currentVehicleDetection };
}

/**
 * 차량 감지 상태 업데이트
 */
export async function setVehicleDetection(update: Partial<VehicleDetectionState>): Promise<void> {
  currentVehicleDetection = {
    ...currentVehicleDetection,
    ...update,
  };

  // 저장
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentVehicleDetection));

  // 리스너에게 알림
  listeners.forEach((listener) => listener(currentVehicleDetection));
}

/**
 * 차량 감지 상태 구독
 */
export function subscribeVehicleDetection(
  listener: (state: VehicleDetectionState) => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * 차량 감지 상태 로드
 */
export async function loadVehicleDetection(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentVehicleDetection = { ...DEFAULT_VEHICLE_DETECTION, ...JSON.parse(stored) };
      listeners.forEach((listener) => listener(currentVehicleDetection));
    }
  } catch (error) {
    console.error("Failed to load vehicle detection state", error);
  }
}

/**
 * 설정 로드
 */
export async function loadVehicleDetectionSettings(): Promise<VehicleDetectionSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_VEHICLE_DETECTION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load vehicle detection settings", error);
  }

  return DEFAULT_VEHICLE_DETECTION_SETTINGS;
}

/**
 * 설정 저장
 */
export async function saveVehicleDetectionSettings(settings: VehicleDetectionSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save vehicle detection settings", error);
  }
}

/**
 * 차량 감지 데이터 처리
 */
export async function processVehicleDetection(
  detected: boolean,
  distance: number | null,
  confidence: number,
  mySpeedKmh: number,
  frontVehicleSpeedKmh: number | null,
  settings: VehicleDetectionSettings,
): Promise<void> {
  const now = Date.now();

  // 안전 거리 계산
  const safeDistance = calculateSafeDistance(mySpeedKmh, settings.sensitivityLevel);

  // 이전 상태
  const previousState = getVehicleDetection();

  if (!detected || distance === null) {
    // 차량 감지 안됨
    await setVehicleDetection({
      frontVehicleDetected: false,
      vehicleDistance: null,
      vehicleDistanceLabel: "차량 없음",
      frontVehicleMoving: false,
      frontVehicleStopped: false,
      departureAlertActive: false,
      collisionRiskLevel: "safe",
      collisionWarningActive: false,
      estimatedTimeToCollision: null,
      safeDistanceMeters: safeDistance,
      isSafeDistance: true,
      lastAnalyzedAt: now,
      confidence,
      summary: "전방 차량 없음",
    });
    return;
  }

  // 상대 속도 계산
  const relativeSpeed = frontVehicleSpeedKmh !== null ? mySpeedKmh - frontVehicleSpeedKmh : 0;

  // 충돌 위험 레벨
  const riskLevel = calculateCollisionRisk(distance, safeDistance, relativeSpeed);

  // 예상 충돌 시간
  const ttc = calculateTimeToCollision(distance, relativeSpeed);

  // 앞차 움직임 판단
  const frontVehicleMoving = frontVehicleSpeedKmh !== null && frontVehicleSpeedKmh > 5;
  const frontVehicleStopped = frontVehicleSpeedKmh !== null && frontVehicleSpeedKmh < 2;

  // 앞차 출발 알림 판단
  const departureAlert =
    settings.departureAlertEnabled &&
    previousState.frontVehicleStopped &&
    frontVehicleMoving &&
    mySpeedKmh < 5; // 내가 정지 중일 때

  // 충돌 경고 판단
  const collisionWarning =
    settings.collisionWarningEnabled &&
    (riskLevel === "danger" || riskLevel === "warning");

  // 요약 메시지
  let summary = `전방 ${formatVehicleDistance(distance)}`;
  if (departureAlert) {
    summary = "🚦 앞차 출발! 출발하세요";
  } else if (riskLevel === "danger") {
    summary = `⚠️ 충돌 위험! ${formatVehicleDistance(distance)}`;
  } else if (riskLevel === "warning") {
    summary = `⚠️ 거리 주의 ${formatVehicleDistance(distance)}`;
  } else if (riskLevel === "caution") {
    summary = `⚡ 안전 거리 확보 필요 ${formatVehicleDistance(distance)}`;
  }

  await setVehicleDetection({
    frontVehicleDetected: true,
    vehicleDistance: distance,
    vehicleDistanceLabel: formatVehicleDistance(distance),
    frontVehicleMoving,
    frontVehicleStopped,
    departureAlertActive: departureAlert,
    collisionRiskLevel: riskLevel,
    collisionWarningActive: collisionWarning,
    estimatedTimeToCollision: ttc,
    safeDistanceMeters: safeDistance,
    isSafeDistance: distance >= safeDistance,
    lastDetectedAt: now,
    lastAnalyzedAt: now,
    confidence,
    summary,
  });
}
