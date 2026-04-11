/**
 * Advance Notification Distance System
 *
 * 전방 알림 거리 설정 및 관리 시스템
 * - 신호등 및 위험 요소를 몇 미터 전방에서 알림받을지 설정
 * - 고정 거리 (30m, 50m, 100m) 또는 속도 비례 자동 모드
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type AdvanceNotificationMode = "30m" | "50m" | "100m" | "auto";

export type AdvanceNotificationConfig = {
  mode: AdvanceNotificationMode;
  customDistanceMeters: number | null; // 사용자 정의 거리 (향후 확장용)
  speedMultiplier: number; // 자동 모드에서 속도 배율 (기본 1.0)
};

export type NotificationTriggerResult = {
  shouldNotify: boolean;
  currentDistance: number;
  thresholdDistance: number;
  mode: AdvanceNotificationMode;
};

const STORAGE_KEY = "@advance_notification_config";

// 기본 설정
const DEFAULT_CONFIG: AdvanceNotificationConfig = {
  mode: "auto",
  customDistanceMeters: null,
  speedMultiplier: 1.0,
};

// 전역 설정 캐시
let cachedConfig: AdvanceNotificationConfig = { ...DEFAULT_CONFIG };

// 설정 변경 구독자들
type ConfigChangeListener = (config: AdvanceNotificationConfig) => void;
const listeners = new Set<ConfigChangeListener>();

/**
 * 전방 알림 거리 설정 로드
 */
export async function loadAdvanceNotificationConfig(): Promise<AdvanceNotificationConfig> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedConfig = JSON.parse(stored);
      return cachedConfig;
    }
  } catch (error) {
    console.error("[AdvanceNotification] Failed to load config:", error);
  }
  return cachedConfig;
}

/**
 * 전방 알림 거리 설정 저장
 */
export async function saveAdvanceNotificationConfig(
  config: Partial<AdvanceNotificationConfig>
): Promise<void> {
  try {
    cachedConfig = { ...cachedConfig, ...config };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedConfig));
    notifyListeners();
  } catch (error) {
    console.error("[AdvanceNotification] Failed to save config:", error);
  }
}

/**
 * 전방 알림 모드 변경
 */
export async function setAdvanceNotificationMode(mode: AdvanceNotificationMode): Promise<void> {
  await saveAdvanceNotificationConfig({ mode });
}

/**
 * 현재 설정 가져오기 (동기)
 */
export function getAdvanceNotificationConfig(): AdvanceNotificationConfig {
  return { ...cachedConfig };
}

/**
 * 설정 변경 구독
 */
export function subscribeAdvanceNotificationConfig(listener: ConfigChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 구독자들에게 알림
 */
function notifyListeners(): void {
  listeners.forEach((listener) => listener({ ...cachedConfig }));
}

/**
 * 속도 기반 전방 알림 거리 계산 (자동 모드)
 *
 * 공식: 거리(m) = (속도(km/h) / 10)² × 배율
 * - 30 km/h → 9m × 배율
 * - 60 km/h → 36m × 배율
 * - 80 km/h → 64m × 배율
 * - 100 km/h → 100m × 배율
 *
 * 최소 20m, 최대 150m로 제한
 */
export function calculateAutoDistance(speedKmh: number, multiplier = 1.0): number {
  const baseDistance = Math.pow(speedKmh / 10, 2);
  const distance = baseDistance * multiplier;
  return Math.max(20, Math.min(150, distance));
}

/**
 * 현재 설정에 따른 전방 알림 거리 계산
 */
export function getNotificationDistance(speedKmh: number): number {
  const config = getAdvanceNotificationConfig();

  switch (config.mode) {
    case "30m":
      return 30;
    case "50m":
      return 50;
    case "100m":
      return 100;
    case "auto":
      return calculateAutoDistance(speedKmh, config.speedMultiplier);
    default:
      return 50; // fallback
  }
}

/**
 * 알림 트리거 여부 판단
 *
 * @param currentDistance 현재 대상물까지의 거리 (미터)
 * @param speedKmh 현재 차량 속도 (km/h)
 * @returns 알림 트리거 결과
 */
export function shouldTriggerNotification(
  currentDistance: number,
  speedKmh: number
): NotificationTriggerResult {
  const thresholdDistance = getNotificationDistance(speedKmh);
  const shouldNotify = currentDistance <= thresholdDistance;

  return {
    shouldNotify,
    currentDistance,
    thresholdDistance,
    mode: cachedConfig.mode,
  };
}

/**
 * 모드 레이블 가져오기
 */
export function getAdvanceNotificationModeLabel(mode: AdvanceNotificationMode): string {
  switch (mode) {
    case "30m":
      return "30미터 전방";
    case "50m":
      return "50미터 전방";
    case "100m":
      return "100미터 전방";
    case "auto":
      return "속도 비례 자동";
    default:
      return "알 수 없음";
  }
}

/**
 * 모드별 설명 가져오기
 */
export function getAdvanceNotificationModeDescription(mode: AdvanceNotificationMode): string {
  switch (mode) {
    case "30m":
      return "신호등이나 위험 요소가 30미터 이내에 있을 때 알림";
    case "50m":
      return "신호등이나 위험 요소가 50미터 이내에 있을 때 알림";
    case "100m":
      return "신호등이나 위험 요소가 100미터 이내에 있을 때 알림";
    case "auto":
      return "속도에 비례하여 자동으로 알림 거리 조정 (느릴수록 가까이, 빠를수록 멀리)";
    default:
      return "";
  }
}

/**
 * 모든 모드 목록
 */
export const ALL_MODES: AdvanceNotificationMode[] = ["30m", "50m", "100m", "auto"];

/**
 * 현재 설정 정보를 문자열로 포맷
 */
export function formatCurrentConfig(speedKmh: number): string {
  const config = getAdvanceNotificationConfig();
  const distance = getNotificationDistance(speedKmh);

  if (config.mode === "auto") {
    return `${getAdvanceNotificationModeLabel(config.mode)} (현재: ${Math.round(distance)}m)`;
  }

  return getAdvanceNotificationModeLabel(config.mode);
}
