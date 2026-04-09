import AsyncStorage from "@react-native-async-storage/async-storage";

export type TrafficSignalState = "red" | "yellow" | "green" | "unknown";
export type LeftTurnSignalState = "go" | "stop" | "unknown";
export type PedestrianSignalState = "walk" | "stop" | "unknown";
export type DetectionRange = "좁게" | "보통" | "넓게";

export type TrafficSignalDetection = {
  state: TrafficSignalState;
  leftTurnState: LeftTurnSignalState;
  pedestrianState: PedestrianSignalState;
  confidence: number;
  source: "camera-ai" | "fallback" | "manual";
  detectedAt: number;
  summary: string;
};

export const TRAFFIC_SIGNAL_STORAGE_KEY = "ai-omni-drive:traffic-signal";

export const DEFAULT_TRAFFIC_SIGNAL_DETECTION: TrafficSignalDetection = {
  state: "yellow",
  leftTurnState: "unknown",
  pedestrianState: "unknown",
  confidence: 0,
  source: "fallback",
  detectedAt: 0,
  summary: "신호 인식 대기",
};

const listeners = new Set<(value: TrafficSignalDetection) => void>();

let currentDetection: TrafficSignalDetection = DEFAULT_TRAFFIC_SIGNAL_DETECTION;

function normalizeTrafficSignalState(value?: string | null): TrafficSignalState {
  if (value === "red" || value === "yellow" || value === "green") {
    return value;
  }

  return "unknown";
}

function normalizeLeftTurnSignalState(value?: string | null): LeftTurnSignalState {
  if (value === "go" || value === "stop") {
    return value;
  }

  return "unknown";
}

function normalizePedestrianSignalState(value?: string | null): PedestrianSignalState {
  if (value === "walk" || value === "stop") {
    return value;
  }

  return "unknown";
}

function normalizeDetection(
  value?: Partial<TrafficSignalDetection> | null,
): TrafficSignalDetection {
  return {
    state: normalizeTrafficSignalState(value?.state),
    leftTurnState: normalizeLeftTurnSignalState(value?.leftTurnState),
    pedestrianState: normalizePedestrianSignalState(value?.pedestrianState),
    confidence:
      typeof value?.confidence === "number" && Number.isFinite(value.confidence)
        ? Math.min(1, Math.max(0, value.confidence))
        : DEFAULT_TRAFFIC_SIGNAL_DETECTION.confidence,
    source: value?.source ?? DEFAULT_TRAFFIC_SIGNAL_DETECTION.source,
    detectedAt:
      typeof value?.detectedAt === "number" && Number.isFinite(value.detectedAt)
        ? value.detectedAt
        : DEFAULT_TRAFFIC_SIGNAL_DETECTION.detectedAt,
    summary: value?.summary?.trim() || DEFAULT_TRAFFIC_SIGNAL_DETECTION.summary,
  };
}

function emit(value: TrafficSignalDetection) {
  listeners.forEach((listener) => listener(value));
}

export function getTrafficSignalDetection() {
  return currentDetection;
}

export async function loadTrafficSignalDetection() {
  try {
    const savedValue = await AsyncStorage.getItem(TRAFFIC_SIGNAL_STORAGE_KEY);
    if (!savedValue) {
      return currentDetection;
    }

    currentDetection = normalizeDetection(JSON.parse(savedValue) as Partial<TrafficSignalDetection>);
    emit(currentDetection);
    return currentDetection;
  } catch (error) {
    console.error("Failed to load traffic signal detection", error);
    return currentDetection;
  }
}

export async function setTrafficSignalDetection(value: Partial<TrafficSignalDetection>) {
  currentDetection = normalizeDetection({
    ...currentDetection,
    ...value,
    detectedAt: value.detectedAt ?? Date.now(),
  });

  emit(currentDetection);

  try {
    await AsyncStorage.setItem(TRAFFIC_SIGNAL_STORAGE_KEY, JSON.stringify(currentDetection));
  } catch (error) {
    console.error("Failed to save traffic signal detection", error);
  }

  return currentDetection;
}

export function subscribeTrafficSignalDetection(
  listener: (value: TrafficSignalDetection) => void,
) {
  listeners.add(listener);
  listener(currentDetection);

  return () => {
    listeners.delete(listener);
  };
}
