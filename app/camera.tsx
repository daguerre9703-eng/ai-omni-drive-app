import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  buildAutoRedAlertEnvironmentState,
  getDetectedDrivingEnvironmentLabel,
  type RedAlertEnvironmentPreset,
} from "@/lib/red-alert-environment";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_TRAFFIC_SIGNAL_DETECTION,
  getTrafficSignalDetection,
  type DetectionRange,
  type DetectedDrivingEnvironment,
  type RedAlertIntensity,
  type SensitivityMode,
  type SignalPriorityMode,
  setTrafficSignalDetection,
} from "@/lib/traffic-signal-store";
import {
  DEFAULT_VOICE_ALERT_SETTINGS,
  speakVoiceAlert,
} from "@/lib/voice-alerts";
import {
  evaluateFrameQuality,
  validateRecognitionConfidence,
  calculateConsensus,
  checkResultStability,
  RecognitionStatsTracker,
  addToHistory,
  shouldRetry,
  type RecognitionHistory,
  type QualityMetrics,
} from "@/lib/camera-quality";
import {
  updateSignalTiming,
  subscribeSignalTiming,
  loadSignalTiming,
  formatRemainingTime,
  type SignalTimingState,
} from "@/lib/signal-timing-prediction";
import {
  loadAdvanceNotificationConfig,
  subscribeAdvanceNotificationConfig,
  setAdvanceNotificationMode,
  getNotificationDistance,
  shouldTriggerNotification,
  getAdvanceNotificationModeLabel,
  getAdvanceNotificationModeDescription,
  ALL_MODES,
  type AdvanceNotificationMode,
  type AdvanceNotificationConfig,
} from "@/lib/advance-notification";
import {
  loadLaneDepartureState,
  subscribeLaneDepartureState,
  updateLaneDetection,
  setLDWEnabled,
  activateTurnSignal,
  deactivateTurnSignal,
  getLDWWarningMessage,
  getLDWStatusLabel,
  getLanePositionLabel,
  type LaneDepartureState,
  type LaneDepartureDirection,
} from "@/lib/lane-departure-warning";
import {
  loadTSRState,
  subscribeTSRState,
  addDetectedSign,
  setTSREnabled,
  setSpeedLimitAlertEnabled,
  updateSpeedAlertLevel,
  checkSpeedViolation,
  getSpeedAlertMessage,
  getTSRStatusLabel,
  getTrafficSignIcon,
  getTrafficSignLabel,
  type TSRState,
  type TrafficSign,
  type TrafficSignType,
} from "@/lib/traffic-sign-recognition";

type DetectionRangeOption = {
  key: DetectionRange;
  title: string;
  description: string;
  frameWidth: number;
  frameHeight: number;
};

type CameraSettings = {
  adaptiveScanEnabled: boolean;
  hapticAlertsEnabled: boolean;
  lowVisionModeEnabled: boolean;
  redAlertIntensity: RedAlertIntensity;
  redAlertEnvironmentPreset: RedAlertEnvironmentPreset;
  redAlertBrightness: number;
  redAlertPeriodMs: number;
  autoRedAlertEnvironmentEnabled: boolean;
  signalPriorityMode: SignalPriorityMode;
  sensitivityMode: SensitivityMode;
  ldwEnabled: boolean;
  tsrEnabled: boolean;
};

type ScanProfile = {
  intervalMs: number;
  cadenceMode: "slow" | "normal" | "fast";
  label: string;
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  adaptiveScanEnabled: true,
  hapticAlertsEnabled: true,
  lowVisionModeEnabled: true,
  redAlertIntensity: "balanced",
  redAlertEnvironmentPreset: "standard",
  redAlertBrightness: 0.42,
  redAlertPeriodMs: 260,
  autoRedAlertEnvironmentEnabled: true,
  signalPriorityMode: "safety-first",
  sensitivityMode: "standard",
  ldwEnabled: true,
  tsrEnabled: true,
};

const RANGE_OPTIONS: DetectionRangeOption[] = [
  {
    key: "좁게",
    title: "좁게",
    description: "신호등 한 개를 크게 인식",
    frameWidth: 112,
    frameHeight: 112,
  },
  {
    key: "보통",
    title: "보통",
    description: "일반 도심 주행 기본값",
    frameWidth: 160,
    frameHeight: 132,
  },
  {
    key: "넓게",
    title: "넓게",
    description: "여러 차선과 표지판까지 함께 확인",
    frameWidth: 214,
    frameHeight: 156,
  },
];

const RANGE_FOCUS_HINT: Record<DetectionRange, string> = {
  좁게: "정면 한 개 신호등에 초점을 맞춥니다",
  보통: "교차로 전방 신호등을 균형 있게 확인합니다",
  넓게: "여러 차선과 복수 신호등을 함께 살핍니다",
};

const RANGE_CROP: Record<DetectionRange, { widthRatio: number; heightRatio: number }> = {
  좁게: { widthRatio: 0.28, heightRatio: 0.28 },
  보통: { widthRatio: 0.4, heightRatio: 0.34 },
  넓게: { widthRatio: 0.56, heightRatio: 0.4 },
};

const RED_ALERT_LABELS: Record<RedAlertIntensity, string> = {
  off: "점멸 끔",
  soft: "점멸 약함",
  balanced: "점멸 균형",
  strong: "점멸 강함",
};

const PRIORITY_LABELS: Record<SignalPriorityMode, string> = {
  "pedestrian-first": "보행 우선",
  "vehicle-first": "차량 우선",
  "safety-first": "안전 우선",
};

const SENSITIVITY_LABELS: Record<SensitivityMode, string> = {
  standard: "기본 감도",
  night: "야간 고감도",
  rain: "우천 고감도",
  auto: "자동 적응",
};

function resolveScanProfile(speedKmh: number): ScanProfile {
  if (speedKmh >= 55) {
    return { intervalMs: 900, cadenceMode: "fast", label: "고속 연속 스캔" };
  }

  if (speedKmh >= 24) {
    return { intervalMs: 1500, cadenceMode: "normal", label: "도심 기본 스캔" };
  }

  return { intervalMs: 2300, cadenceMode: "slow", label: "저속 절전 스캔" };
}

async function playSignalHapticAlert(
  enabled: boolean,
  previousSignal: "red" | "yellow" | "green" | "unknown" | null,
  nextSignal: "red" | "yellow" | "green" | "unknown",
  previousLeftTurn: "go" | "stop" | "unknown" | null,
  nextLeftTurn: "go" | "stop" | "unknown",
  previousPedestrian: "walk" | "stop" | "unknown" | null,
  nextPedestrian: "walk" | "stop" | "unknown",
) {
  if (!enabled || Platform.OS === "web") {
    return;
  }

  if (nextSignal !== previousSignal) {
    if (nextSignal === "red") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (nextSignal === "green") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (nextSignal === "yellow") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
  }

  if (nextLeftTurn === "go" && nextLeftTurn !== previousLeftTurn) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }

  if (nextPedestrian === "walk" && nextPedestrian !== previousPedestrian) {
    await Haptics.selectionAsync();
  }
}

function formatClockLabel(timestamp: number) {
  if (!timestamp) {
    return "아직 없음";
  }

  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function CameraScreen() {
  const initialDetection = getTrafficSignalDetection();
  const [selectedRange, setSelectedRange] = useState<DetectionRange>("보통");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(initialDetection.monitoringActive);
  const [liveStatusText, setLiveStatusText] = useState(
    initialDetection.monitoringActive ? "실시간 스캔 준비 중" : "AI 인식 대기",
  );
  const [latestResultText, setLatestResultText] = useState(
    initialDetection.summary === "신호 인식 대기"
      ? "아직 인식된 신호가 없습니다."
      : initialDetection.summary,
  );
  const [latestDetailText, setLatestDetailText] = useState(
    initialDetection.prioritySummary === "우선순위 안내 대기"
      ? "좌회전·보행 신호 대기"
      : initialDetection.prioritySummary,
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(initialDetection.lastAnalyzedAt);
  const [lastDetectedAt, setLastDetectedAt] = useState(initialDetection.detectedAt);
  const [scanIntervalMs, setScanIntervalMs] = useState(initialDetection.scanIntervalMs);
  const [lastSpeedKmh, setLastSpeedKmh] = useState(initialDetection.lastSpeedKmh);
  const [cadenceMode, setCadenceMode] = useState(initialDetection.cadenceMode);
  const [adaptiveScanEnabled, setAdaptiveScanEnabled] = useState(DEFAULT_CAMERA_SETTINGS.adaptiveScanEnabled);
  const [hapticAlertsEnabled, setHapticAlertsEnabled] = useState(DEFAULT_CAMERA_SETTINGS.hapticAlertsEnabled);
  const [lowVisionModeEnabled, setLowVisionModeEnabled] = useState(DEFAULT_CAMERA_SETTINGS.lowVisionModeEnabled);
  const [redAlertIntensity, setRedAlertIntensity] = useState<RedAlertIntensity>(
    DEFAULT_CAMERA_SETTINGS.redAlertIntensity,
  );
  const [redAlertEnvironmentPreset, setRedAlertEnvironmentPreset] = useState<RedAlertEnvironmentPreset>(
    initialDetection.appliedRedAlertEnvironmentPreset,
  );
  const [redAlertBrightness, setRedAlertBrightness] = useState(DEFAULT_CAMERA_SETTINGS.redAlertBrightness);
  const [redAlertPeriodMs, setRedAlertPeriodMs] = useState(DEFAULT_CAMERA_SETTINGS.redAlertPeriodMs);
  const [autoRedAlertEnvironmentEnabled, setAutoRedAlertEnvironmentEnabled] = useState(
    initialDetection.autoRedAlertEnvironmentEnabled,
  );
  const [signalPriorityMode, setSignalPriorityMode] = useState<SignalPriorityMode>(
    DEFAULT_CAMERA_SETTINGS.signalPriorityMode,
  );
  const [sensitivityMode, setSensitivityMode] = useState<SensitivityMode>(
    DEFAULT_CAMERA_SETTINGS.sensitivityMode,
  );
  const [detectedEnvironment, setDetectedEnvironment] = useState<DetectedDrivingEnvironment>(
    initialDetection.detectedEnvironment,
  );
  const [environmentReason, setEnvironmentReason] = useState(initialDetection.environmentReason);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionHistory[]>([]);
  const [currentQuality, setCurrentQuality] = useState<QualityMetrics | null>(null);
  const [consensusEnabled, setConsensusEnabled] = useState(true);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [recognitionStats, setRecognitionStats] = useState("통계 없음");
  const [signalTiming, setSignalTiming] = useState<SignalTimingState | null>(null);
  const [advanceNotificationConfig, setAdvanceNotificationConfig] = useState<AdvanceNotificationConfig>({
    mode: "auto",
    customDistanceMeters: null,
    speedMultiplier: 1.0,
  });
  const [laneDepartureState, setLaneDepartureState] = useState<LaneDepartureState | null>(null);
  const [tsrState, setTsrState] = useState<TSRState | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const isAnalyzingRef = useRef(false);
  const monitoringActiveRef = useRef(initialDetection.monitoringActive);
  const scanIntervalRef = useRef(initialDetection.scanIntervalMs);
  const speedRef = useRef(initialDetection.lastSpeedKmh);
  const cadenceModeRef = useRef(initialDetection.cadenceMode);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastDetectedStateRef = useRef<"red" | "yellow" | "green" | "unknown" | null>(
    initialDetection.state,
  );
  const lastLeftTurnStateRef = useRef<"go" | "stop" | "unknown" | null>(initialDetection.leftTurnState);
  const lastPedestrianStateRef = useRef<"walk" | "stop" | "unknown" | null>(
    initialDetection.pedestrianState,
  );
  const statsTrackerRef = useRef(new RecognitionStatsTracker());
  const previousFrameHashRef = useRef<string>("");
  const retryCountRef = useRef(0);
  const lastLaneDetectionRef = useRef(0); // 마지막 차선 감지 시간
  const lastSignDetectionRef = useRef(0); // 마지막 표지판 감지 시간

  const detectSignal = trpc.trafficSignal.detect.useMutation();
  const detectLane = trpc.laneDetection.detect.useMutation();
  const detectTrafficSign = trpc.trafficSignDetection.detect.useMutation();

  const currentRange = useMemo(() => {
    return RANGE_OPTIONS.find((option) => option.key === selectedRange) ?? RANGE_OPTIONS[1];
  }, [selectedRange]);

  const lastAnalyzedLabel = useMemo(() => formatClockLabel(lastAnalyzedAt), [lastAnalyzedAt]);
  const lastDetectedLabel = useMemo(() => formatClockLabel(lastDetectedAt), [lastDetectedAt]);

  useEffect(() => {
    const loadCameraSettings = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!savedValue) {
          return;
        }

        const parsed = JSON.parse(savedValue) as Partial<CameraSettings>;
        setAdaptiveScanEnabled(parsed.adaptiveScanEnabled ?? DEFAULT_CAMERA_SETTINGS.adaptiveScanEnabled);
        setHapticAlertsEnabled(parsed.hapticAlertsEnabled ?? DEFAULT_CAMERA_SETTINGS.hapticAlertsEnabled);
        setLowVisionModeEnabled(parsed.lowVisionModeEnabled ?? DEFAULT_CAMERA_SETTINGS.lowVisionModeEnabled);
        setRedAlertIntensity(parsed.redAlertIntensity ?? DEFAULT_CAMERA_SETTINGS.redAlertIntensity);
        setRedAlertEnvironmentPreset(
          parsed.redAlertEnvironmentPreset ?? DEFAULT_CAMERA_SETTINGS.redAlertEnvironmentPreset,
        );
        setRedAlertBrightness(parsed.redAlertBrightness ?? DEFAULT_CAMERA_SETTINGS.redAlertBrightness);
        setRedAlertPeriodMs(parsed.redAlertPeriodMs ?? DEFAULT_CAMERA_SETTINGS.redAlertPeriodMs);
        setAutoRedAlertEnvironmentEnabled(
          parsed.autoRedAlertEnvironmentEnabled ?? DEFAULT_CAMERA_SETTINGS.autoRedAlertEnvironmentEnabled,
        );
        setSignalPriorityMode(parsed.signalPriorityMode ?? DEFAULT_CAMERA_SETTINGS.signalPriorityMode);
        setSensitivityMode(parsed.sensitivityMode ?? DEFAULT_CAMERA_SETTINGS.sensitivityMode);
      } catch (error) {
        console.error("Failed to load camera settings", error);
      }
    };

    void loadCameraSettings();

    // 신호 타이밍 구독
    const unsubscribeSignalTiming = subscribeSignalTiming((timing) => {
      setSignalTiming(timing);
    });

    loadSignalTiming().catch((error) => {
      console.error("Failed to load signal timing", error);
    });

    // 전방 알림 거리 구독
    const unsubscribeAdvanceNotification = subscribeAdvanceNotificationConfig((config) => {
      setAdvanceNotificationConfig(config);
    });

    loadAdvanceNotificationConfig().then((config) => {
      setAdvanceNotificationConfig(config);
    }).catch((error) => {
      console.error("Failed to load advance notification config", error);
    });

    // LDW 구독
    const unsubscribeLDW = subscribeLaneDepartureState((state) => {
      setLaneDepartureState(state);
    });

    loadLaneDepartureState().then((state) => {
      setLaneDepartureState(state);
    }).catch((error) => {
      console.error("Failed to load lane departure state", error);
    });

    // TSR 구독
    const unsubscribeTSR = subscribeTSRState((state) => {
      setTsrState(state);
    });

    loadTSRState().then((state) => {
      setTsrState(state);
    }).catch((error) => {
      console.error("Failed to load TSR state", error);
    });

    return () => {
      cameraRef.current = null;
      monitoringActiveRef.current = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      unsubscribeSignalTiming();
      unsubscribeAdvanceNotification();
      unsubscribeLDW();
      unsubscribeTSR();
      void setTrafficSignalDetection({ monitoringActive: false });
    };
  }, []);

  const ensurePermission = useCallback(async () => {
    if (!permission) {
      return false;
    }

    if (permission.granted) {
      return true;
    }

    const nextPermission = await requestPermission();
    return nextPermission.granted;
  }, [permission, requestPermission]);

  const runSignalAnalysis = useCallback(
    async (trigger: "manual" | "auto") => {
      if (Platform.OS === "web") {
        if (trigger === "manual") {
          Alert.alert("웹 미리보기 제한", "실제 카메라 인식은 모바일 기기에서 확인해 주세요.");
        }
        return false;
      }

      const granted = await ensurePermission();
      if (!granted) {
        if (trigger === "manual") {
          Alert.alert("카메라 권한 필요", "신호등 인식을 위해 카메라 권한을 허용해 주세요.");
        }
        return false;
      }

      if (!cameraRef.current || !cameraReady || isAnalyzingRef.current) {
        return false;
      }

      const analysisStartedAt = Date.now();

      try {
        isAnalyzingRef.current = true;
        setIsAnalyzing(true);
        setLastAnalyzedAt(analysisStartedAt);
        setLiveStatusText(
          monitoringActiveRef.current ? "실시간 스캔 중 · 전방 신호 확인" : "AI 신호등 판별 중",
        );

        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.45,
          skipProcessing: true,
        });

        if (!photo?.base64) {
          throw new Error("카메라 프레임을 가져오지 못했습니다.");
        }

        // 프레임 품질 평가
        const quality = evaluateFrameQuality(photo.base64, previousFrameHashRef.current);
        setCurrentQuality(quality);
        previousFrameHashRef.current = photo.base64.slice(0, 1000);

        const crop = RANGE_CROP[selectedRange];
        const result = await detectSignal.mutateAsync({
          base64Image: photo.base64,
          detectionRange: selectedRange,
          priorityMode: signalPriorityMode,
          sensitivityMode,
          cropHint: crop,
        });

        // 신호 타이밍 업데이트 (TLR & SPaT)
        await updateSignalTiming(
          result.signalState as "red" | "yellow" | "green" | "unknown",
          result.countdownSeconds,
          result.countdownConfidence,
        );

        // 신뢰도 검증
        const confidenceValidation = validateRecognitionConfidence(result.signalState, result.confidence);

        // 재시도 필요 여부 판단
        const retryDecision = shouldRetry(result.confidence, quality, retryCountRef.current);

        if (!confidenceValidation.valid && autoRetryEnabled && retryDecision.shouldRetry && trigger === "auto") {
          retryCountRef.current++;
          statsTrackerRef.current.recordAttempt(false);
          setRecognitionStats(statsTrackerRef.current.getStatsLabel());
          setLiveStatusText(`재시도 중 (${retryCountRef.current}/3) · ${retryDecision.reason}`);

          // 짧은 지연 후 재시도
          await new Promise(resolve => setTimeout(resolve, 200));
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          return await runSignalAnalysis("auto");
        }

        // 재시도 카운터 초기화 (성공 또는 재시도 포기)
        retryCountRef.current = 0;

        // 히스토리에 추가
        const newHistory = addToHistory(recognitionHistory, {
          signalState: result.signalState,
          confidence: result.confidence,
          timestamp: Date.now(),
        });
        setRecognitionHistory(newHistory);

        // 합의 알고리즘 적용 (활성화된 경우)
        let finalState = result.signalState;
        let finalConfidence = result.confidence;
        let consensusWarning = "";

        if (consensusEnabled && trigger === "auto") {
          const consensus = calculateConsensus(newHistory);
          if (!consensus.agreed) {
            setLiveStatusText(`다중 프레임 검증 중 · ${consensus.reasonIfRejected}`);
            statsTrackerRef.current.recordAttempt(false);
            setRecognitionStats(statsTrackerRef.current.getStatsLabel());
            isAnalyzingRef.current = false;
            setIsAnalyzing(false);
            return false;
          }
          finalState = consensus.finalState;
          finalConfidence = consensus.consensusConfidence;
          consensusWarning = " · 다중 프레임 합의";
        }

        // 결과 안정성 검증
        const stabilityCheck = checkResultStability(
          finalState,
          lastDetectedStateRef.current,
          finalConfidence,
        );

        if (!stabilityCheck.stable && trigger === "auto") {
          setLiveStatusText(`결과 재확인 중 · ${stabilityCheck.warning}`);
          // 안정성 경고는 기록하지만 계속 진행
        }

        // 통계 기록
        statsTrackerRef.current.recordAttempt(true, finalConfidence);
        setRecognitionStats(statsTrackerRef.current.getStatsLabel());

        const detectedAt = Date.now();
        const autoEnvironmentState = buildAutoRedAlertEnvironmentState(result.drivingEnvironment);
        const appliedRedAlertEnvironmentPreset = autoRedAlertEnvironmentEnabled
          ? autoEnvironmentState.preset
          : redAlertEnvironmentPreset;
        const environmentSummary = autoRedAlertEnvironmentEnabled
          ? `${autoEnvironmentState.detectedEnvironmentLabel} 감지 · ${autoEnvironmentState.presetLabel} 자동 적용`
          : `${getDetectedDrivingEnvironmentLabel(result.drivingEnvironment)} 감지 · 수동 프리셋 유지`;
        const nextEnvironmentReason = autoRedAlertEnvironmentEnabled
          ? `${result.environmentSummary} · ${autoEnvironmentState.environmentReason}`
          : `${result.environmentSummary} · 자동 전환이 꺼져 있어 ${redAlertEnvironmentPreset} 프리셋을 유지합니다.`;

        await setTrafficSignalDetection({
          state: finalState,
          leftTurnState: result.leftTurnState,
          pedestrianState: result.pedestrianState,
          confidence: finalConfidence,
          source: "camera-ai",
          detectedAt,
          lastAnalyzedAt: detectedAt,
          monitoringActive: monitoringActiveRef.current,
          summary: result.summary,
          prioritySummary: result.prioritySummary,
          scanIntervalMs: scanIntervalRef.current,
          lastSpeedKmh: speedRef.current,
          cadenceMode: cadenceModeRef.current,
          redAlertIntensity,
          priorityMode: signalPriorityMode,
          sensitivityMode,
          autoRedAlertEnvironmentEnabled,
          detectedEnvironment: result.drivingEnvironment,
          appliedRedAlertEnvironmentPreset,
          environmentSummary,
          environmentReason: nextEnvironmentReason,
        });

        setDetectedEnvironment(result.drivingEnvironment);
        setEnvironmentReason(nextEnvironmentReason);
        setRedAlertEnvironmentPreset(appliedRedAlertEnvironmentPreset);
        if (autoRedAlertEnvironmentEnabled) {
          setRedAlertBrightness(autoEnvironmentState.brightness);
          setRedAlertPeriodMs(autoEnvironmentState.periodMs);
        }
        setLastAnalyzedAt(detectedAt);
        setLastDetectedAt(detectedAt);
        setLatestResultText(`${result.displayLabel} · 신뢰도 ${Math.round(finalConfidence * 100)}%${consensusWarning} · 품질 ${quality.qualityLabel}`);
        setLatestDetailText(
          `${result.prioritySummary} · ${result.leftTurnLabel} · ${result.pedestrianLabel} · ${environmentSummary}`,
        );
        setLiveStatusText(
          monitoringActiveRef.current
            ? `${resolveScanProfile(speedRef.current).label} · ${result.displayLabel} · 품질 ${quality.qualityLabel}`
            : `수동 인식 완료 · ${result.displayLabel} · 품질 ${quality.qualityLabel}`,
        );

        const previousState = lastDetectedStateRef.current;
        const previousLeftTurnState = lastLeftTurnStateRef.current;
        const previousPedestrianState = lastPedestrianStateRef.current;
        lastDetectedStateRef.current = finalState;
        lastLeftTurnStateRef.current = result.leftTurnState;
        lastPedestrianStateRef.current = result.pedestrianState;

        if (finalState !== previousState) {
          const supplementalText = result.prioritySummary;

          if (finalState === "red") {
            await speakVoiceAlert("red_signal_ahead", DEFAULT_VOICE_ALERT_SETTINGS, {
              distanceMeters: 128,
              supplementalText,
            });
          } else if (finalState === "green") {
            await speakVoiceAlert("green_signal_changed", DEFAULT_VOICE_ALERT_SETTINGS, {
              distanceMeters: 128,
              supplementalText,
            });
          }
        }

        await playSignalHapticAlert(
          hapticAlertsEnabled,
          previousState,
          finalState,
          previousLeftTurnState,
          result.leftTurnState,
          previousPedestrianState,
          result.pedestrianState,
        );

        return true;
      } catch (error) {
        console.error("Failed to analyze traffic signal", error);
        setLastAnalyzedAt(analysisStartedAt);
        setLiveStatusText(monitoringActiveRef.current ? "실시간 스캔 재시도 중" : "AI 인식 실패");

        // 실패 통계 기록
        statsTrackerRef.current.recordAttempt(false);
        setRecognitionStats(statsTrackerRef.current.getStatsLabel());

        await setTrafficSignalDetection({
          lastAnalyzedAt: analysisStartedAt,
          monitoringActive: monitoringActiveRef.current,
          summary: monitoringActiveRef.current ? "실시간 스캔 재시도 중" : "AI 인식 실패",
          prioritySummary: `${PRIORITY_LABELS[signalPriorityMode]} 기준으로 재시도 중`,
          scanIntervalMs: scanIntervalRef.current,
          lastSpeedKmh: speedRef.current,
          cadenceMode: cadenceModeRef.current,
          redAlertIntensity,
          priorityMode: signalPriorityMode,
          sensitivityMode,
          autoRedAlertEnvironmentEnabled,
          detectedEnvironment,
          appliedRedAlertEnvironmentPreset: redAlertEnvironmentPreset,
          environmentSummary: autoRedAlertEnvironmentEnabled ? "자동 환경 전환 대기" : "수동 프리셋 유지 중",
          environmentReason,
        });

        if (trigger === "manual") {
          Alert.alert("신호등 인식 실패", "카메라 프레임 분석 중 문제가 발생했습니다. 다시 시도해 주세요.");
        }

        return false;
      } finally {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [
      cameraReady,
      detectSignal,
      ensurePermission,
      autoRedAlertEnvironmentEnabled,
      detectedEnvironment,
      environmentReason,
      hapticAlertsEnabled,
      redAlertEnvironmentPreset,
      redAlertIntensity,
      selectedRange,
      sensitivityMode,
      signalPriorityMode,
      recognitionHistory,
      consensusEnabled,
      autoRetryEnabled,
    ],
  );

  const runLaneDetection = useCallback(
    async () => {
      // LDW가 비활성화된 경우 건너뛰기
      if (!laneDepartureState?.ldwEnabled) {
        return;
      }

      if (Platform.OS === "web") {
        return;
      }

      const granted = await ensurePermission();
      if (!granted || !cameraRef.current || !cameraReady) {
        return;
      }

      // 마지막 감지로부터 2초 이상 경과했는지 확인
      const now = Date.now();
      if (now - lastLaneDetectionRef.current < 2000) {
        return;
      }

      lastLaneDetectionRef.current = now;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.6,
          skipProcessing: true,
        });

        if (!photo || !photo.base64) {
          return;
        }

        const result = await detectLane.mutateAsync({
          base64Image: photo.base64,
        });

        // LDW 상태 업데이트
        await updateLaneDetection(
          result.laneDetected,
          result.lanePosition as "center" | "left_side" | "right_side" | "unknown",
          result.leftLaneVisible,
          result.rightLaneVisible,
          result.distanceToLeftLane,
          result.distanceToRightLane,
          result.confidence
        );

        // 차선 이탈 경고
        if (result.laneDetected && laneDepartureState?.departureDetected) {
          const warningMessage = getLDWWarningMessage(
            laneDepartureState.departureDirection,
            laneDepartureState.severity
          );

          if (warningMessage && laneDepartureState.severity !== "safe") {
            await speakVoiceAlert("lane_departure", DEFAULT_VOICE_ALERT_SETTINGS, {
              supplementalText: warningMessage,
            });

            if (hapticAlertsEnabled) {
              if (laneDepartureState.severity === "danger") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              } else {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to detect lane", error);
      }
    },
    [
      laneDepartureState,
      cameraReady,
      detectLane,
      ensurePermission,
      hapticAlertsEnabled,
    ]
  );

  const runTrafficSignDetection = useCallback(
    async () => {
      // TSR이 비활성화된 경우 건너뛰기
      if (!tsrState?.tsrEnabled) {
        return;
      }

      if (Platform.OS === "web") {
        return;
      }

      const granted = await ensurePermission();
      if (!granted || !cameraRef.current || !cameraReady) {
        return;
      }

      // 마지막 감지로부터 5초 이상 경과했는지 확인 (표지판은 자주 바뀌지 않음)
      const now = Date.now();
      if (now - lastSignDetectionRef.current < 5000) {
        return;
      }

      lastSignDetectionRef.current = now;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
        });

        if (!photo || !photo.base64) {
          return;
        }

        const result = await detectTrafficSign.mutateAsync({
          base64Image: photo.base64,
        });

        // 표지판 감지됨
        if (result.signDetected && result.confidence > 0.6) {
          const sign: TrafficSign = {
            type: result.signType as TrafficSignType,
            speedLimit: result.speedLimit,
            description: result.description,
            confidence: result.confidence,
            detectedAt: now,
          };

          await addDetectedSign(sign);

          // 속도 제한 경고 체크
          if (tsrState.speedLimitAlertEnabled) {
            await updateSpeedAlertLevel(lastSpeedKmh);

            const { isViolating, alertLevel } = checkSpeedViolation(lastSpeedKmh);

            if (isViolating && alertLevel !== "safe") {
              const message = getSpeedAlertMessage(
                lastSpeedKmh,
                tsrState.currentSpeedLimit || 0,
                alertLevel
              );

              if (message) {
                await speakVoiceAlert("speed_violation", DEFAULT_VOICE_ALERT_SETTINGS, {
                  supplementalText: message,
                });

                if (hapticAlertsEnabled) {
                  if (alertLevel === "severe") {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  } else if (alertLevel === "exceeding") {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  } else {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to detect traffic sign", error);
      }
    },
    [
      tsrState,
      cameraReady,
      detectTrafficSign,
      ensurePermission,
      hapticAlertsEnabled,
      lastSpeedKmh,
    ]
  );

  useEffect(() => {
    monitoringActiveRef.current = isMonitoring;
    void setTrafficSignalDetection({
      monitoringActive: isMonitoring,
      scanIntervalMs: scanIntervalRef.current,
      lastSpeedKmh: speedRef.current,
      cadenceMode: cadenceModeRef.current,
      redAlertIntensity,
      priorityMode: signalPriorityMode,
      sensitivityMode,
    });

    if (!isMonitoring) {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      setLiveStatusText((current) =>
        current.startsWith("실시간") || current.includes("스캔") ? "실시간 스캔 중지" : current,
      );
      return;
    }

    setLiveStatusText(`${resolveScanProfile(speedRef.current).label} 준비 중`);
  }, [isMonitoring, redAlertIntensity, sensitivityMode, signalPriorityMode]);

  useEffect(() => {
    if (!isMonitoring || !cameraReady || Platform.OS === "web" || !permission?.granted) {
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const runLoop = async () => {
      if (!active) {
        return;
      }

      await runSignalAnalysis("auto");

      if (!active) {
        return;
      }

      timerId = setTimeout(() => {
        void runLoop();
      }, adaptiveScanEnabled ? scanIntervalRef.current : DEFAULT_TRAFFIC_SIGNAL_DETECTION.scanIntervalMs);
    };

    void runLoop();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [adaptiveScanEnabled, cameraReady, isMonitoring, permission?.granted, runSignalAnalysis]);

  // 차선 감지 루프 (2초마다)
  useEffect(() => {
    if (!isMonitoring || !cameraReady || Platform.OS === "web" || !permission?.granted) {
      return;
    }

    if (!laneDepartureState?.ldwEnabled) {
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const runLaneLoop = async () => {
      if (!active) {
        return;
      }

      await runLaneDetection();

      if (!active) {
        return;
      }

      timerId = setTimeout(() => {
        void runLaneLoop();
      }, 2000); // 2초마다
    };

    void runLaneLoop();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [cameraReady, isMonitoring, permission?.granted, laneDepartureState?.ldwEnabled, runLaneDetection]);

  // 표지판 감지 루프 (5초마다)
  useEffect(() => {
    if (!isMonitoring || !cameraReady || Platform.OS === "web" || !permission?.granted) {
      return;
    }

    if (!tsrState?.tsrEnabled) {
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const runSignLoop = async () => {
      if (!active) {
        return;
      }

      await runTrafficSignDetection();

      if (!active) {
        return;
      }

      timerId = setTimeout(() => {
        void runSignLoop();
      }, 5000); // 5초마다
    };

    void runSignLoop();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [cameraReady, isMonitoring, permission?.granted, tsrState?.tsrEnabled, runTrafficSignDetection]);

  useEffect(() => {
    const syncAdaptiveScan = async () => {
      if (!isMonitoring || !adaptiveScanEnabled || Platform.OS === "web") {
        scanIntervalRef.current = DEFAULT_TRAFFIC_SIGNAL_DETECTION.scanIntervalMs;
        cadenceModeRef.current = DEFAULT_TRAFFIC_SIGNAL_DETECTION.cadenceMode;
        setScanIntervalMs(DEFAULT_TRAFFIC_SIGNAL_DETECTION.scanIntervalMs);
        setCadenceMode(DEFAULT_TRAFFIC_SIGNAL_DETECTION.cadenceMode);
        return;
      }

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          return;
        }

        const permissionResult = await Location.requestForegroundPermissionsAsync();
        if (permissionResult.status !== "granted") {
          return;
        }

        locationSubscriptionRef.current?.remove();
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          async (location) => {
            const rawSpeed = typeof location.coords.speed === "number" ? location.coords.speed : 0;
            const speedKmh = rawSpeed > 0 ? rawSpeed * 3.6 : 0;
            const profile = resolveScanProfile(speedKmh);

            speedRef.current = speedKmh;
            scanIntervalRef.current = profile.intervalMs;
            cadenceModeRef.current = profile.cadenceMode;
            setLastSpeedKmh(Number(speedKmh.toFixed(1)));
            setScanIntervalMs(profile.intervalMs);
            setCadenceMode(profile.cadenceMode);
            setLiveStatusText((current) =>
              monitoringActiveRef.current && current.includes("실시간")
                ? `${profile.label} · ${Math.round(speedKmh)} km/h`
                : current,
            );

            await setTrafficSignalDetection({
              monitoringActive: monitoringActiveRef.current,
              scanIntervalMs: profile.intervalMs,
              lastSpeedKmh: speedKmh,
              cadenceMode: profile.cadenceMode,
            });
          },
        );
      } catch (error) {
        console.error("Failed to start adaptive scan sync", error);
      }
    };

    void syncAdaptiveScan();

    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [adaptiveScanEnabled, isMonitoring]);

  const handleAnalyzeFrame = async () => {
    await runSignalAnalysis("manual");
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("웹 미리보기 제한", "실시간 카메라 스캔은 모바일 기기에서 확인해 주세요.");
      return;
    }

    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert("카메라 권한 필요", "실시간 스캔을 위해 카메라 권한을 허용해 주세요.");
      return;
    }

    setIsMonitoring(true);
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          >
            <MaterialIcons name="arrow-back" size={28} color="#11181c" />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>

          <Text style={styles.headerTitle}>카메라</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.previewCard, lowVisionModeEnabled && styles.previewCardLowVision]}>
          <View style={styles.previewTopRow}>
            <View style={styles.topBadgeRow}>
              <View style={styles.liveBadge}>
                <Text style={[styles.liveBadgeText, lowVisionModeEnabled && styles.liveBadgeTextLowVision]}>
                  {liveStatusText}
                </Text>
              </View>
              <View style={[styles.scanStateBadge, isMonitoring && styles.scanStateBadgeActive]}>
                <Text
                  style={[
                    styles.scanStateBadgeText,
                    isMonitoring && styles.scanStateBadgeTextActive,
                    lowVisionModeEnabled && styles.scanStateBadgeTextLowVision,
                  ]}
                >
                  {isMonitoring ? "연속 스캔 켜짐" : "연속 스캔 꺼짐"}
                </Text>
              </View>
            </View>

            <View style={styles.featureBadgeRow}>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  속도 적응 {adaptiveScanEnabled ? "ON" : "OFF"}
                </Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  진동 경고 {hapticAlertsEnabled ? "ON" : "OFF"}
                </Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  저시력 모드 {lowVisionModeEnabled ? "ON" : "OFF"}
                </Text>
              </View>
              <View style={[styles.featureBadge, styles.featureBadgeQuality]}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  다중 프레임 합의 {consensusEnabled ? "ON" : "OFF"}
                </Text>
              </View>
              <View style={[styles.featureBadge, styles.featureBadgeQuality]}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  자동 재시도 {autoRetryEnabled ? "ON" : "OFF"}
                </Text>
              </View>
              {currentQuality && (
                <View style={[styles.featureBadge, styles.featureBadgeQuality]}>
                  <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                    프레임 품질 {currentQuality.qualityLabel}
                  </Text>
                </View>
              )}
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  {RED_ALERT_LABELS[redAlertIntensity]}
                </Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  {autoRedAlertEnvironmentEnabled ? `환경 자동 ${getDetectedDrivingEnvironmentLabel(detectedEnvironment)}` : "환경 수동 유지"}
                </Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  {PRIORITY_LABELS[signalPriorityMode]}
                </Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={[styles.featureBadgeText, lowVisionModeEnabled && styles.featureBadgeTextLowVision]}>
                  {SENSITIVITY_LABELS[sensitivityMode]}
                </Text>
              </View>
            </View>

            <Text style={[styles.previewHint, lowVisionModeEnabled && styles.previewHintLowVision]}>
              전방 신호등 중심으로 맞춰 주세요
            </Text>
          </View>

          <View style={[styles.cameraStage, lowVisionModeEnabled && styles.cameraStageLowVision]}>
            {permission?.granted && Platform.OS !== "web" ? (
              <CameraView
                ref={(instance) => {
                  cameraRef.current = instance;
                }}
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
              />
            ) : (
              <View style={styles.cameraFallbackLayer}>
                <MaterialIcons name="photo-camera" size={42} color="#cbd5e1" />
                <Text style={[styles.cameraFallbackText, lowVisionModeEnabled && styles.cameraFallbackTextLowVision]}>
                  {Platform.OS === "web"
                    ? "웹 미리보기에서는 카메라 대신 안내 화면을 표시합니다"
                    : "카메라 권한을 허용하면 실제 프리뷰가 시작됩니다"}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.detectionFrame,
                {
                  width: currentRange.frameWidth,
                  height: currentRange.frameHeight,
                },
              ]}
            >
              <View style={styles.frameCornerTopLeft} />
              <View style={styles.frameCornerTopRight} />
              <View style={styles.frameCornerBottomLeft} />
              <View style={styles.frameCornerBottomRight} />
            </View>

            <View style={styles.cameraCenterChip}>
              <MaterialIcons name="center-focus-strong" size={28} color="#ffffff" />
              <Text style={[styles.cameraCenterChipText, lowVisionModeEnabled && styles.cameraCenterChipTextLowVision]}>
                {currentRange.title} 인식 범위
              </Text>
            </View>
          </View>

          <View style={styles.rangeCard}>
            <Text style={[styles.sectionTitle, lowVisionModeEnabled && styles.sectionTitleLowVision]}>
              인식 범위 조절
            </Text>
            <Text style={[styles.sectionBody, lowVisionModeEnabled && styles.sectionBodyLowVision]}>
              슬라이더 대신 큰 단계 버튼으로 조절할 수 있게 구성했습니다. 연속 스캔 중에도 범위를 바꾸면 다음 프레임부터 바로 반영됩니다.
            </Text>

            <View style={styles.rangeButtonRow}>
              {RANGE_OPTIONS.map((option) => {
                const selected = option.key === selectedRange;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSelectedRange(option.key)}
                    style={({ pressed }) => [
                      styles.rangeButton,
                      selected && styles.rangeButtonSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeButtonTitle,
                        selected && styles.rangeButtonTitleSelected,
                        lowVisionModeEnabled && styles.rangeButtonTitleLowVision,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.rangeButtonDescription,
                        selected && styles.rangeButtonDescriptionSelected,
                        lowVisionModeEnabled && styles.rangeButtonDescriptionLowVision,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, lowVisionModeEnabled && styles.summaryTitleLowVision]}>
              현재 선택
            </Text>
            <Text style={[styles.summaryValue, lowVisionModeEnabled && styles.summaryValueLowVision]}>
              {currentRange.title}
            </Text>
            <Text
              style={[
                styles.summaryDescription,
                lowVisionModeEnabled && styles.summaryDescriptionLowVision,
              ]}
            >
              {RANGE_FOCUS_HINT[currentRange.key]}
            </Text>
            <Text style={[styles.summaryMeta, lowVisionModeEnabled && styles.summaryMetaLowVision]}>
              {latestResultText}
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision]}>
              {latestDetailText}
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision]}>
              {PRIORITY_LABELS[signalPriorityMode]} · {SENSITIVITY_LABELS[sensitivityMode]} · {RED_ALERT_LABELS[redAlertIntensity]}
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision]}>
              {autoRedAlertEnvironmentEnabled ? `${getDetectedDrivingEnvironmentLabel(detectedEnvironment)} 감지 시 ${redAlertEnvironmentPreset} 프리셋 자동 적용` : `${redAlertEnvironmentPreset} 프리셋 수동 유지`} · 밝기 {Math.round(redAlertBrightness * 100)}% · 주기 {Math.round(redAlertPeriodMs)}ms
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision]}>
              {environmentReason}
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision]}>
              {adaptiveScanEnabled ? "속도 적응 스캔" : "고정 주기 스캔"} · {Math.round(lastSpeedKmh)} km/h · {(scanIntervalMs / 1000).toFixed(1)}초 · {cadenceMode}
            </Text>
            <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision, styles.summaryQualityText]}>
              🎯 인식 통계: {recognitionStats}
            </Text>
            {currentQuality && (
              <Text style={[styles.summarySubMeta, lowVisionModeEnabled && styles.summarySubMetaLowVision, styles.summaryQualityText]}>
                📊 프레임 품질: 밝기 {Math.round(currentQuality.brightness * 100)}% · 선명도 {Math.round(currentQuality.sharpness * 100)}% · 안정성 {Math.round(currentQuality.stability * 100)}%
              </Text>
            )}
            {signalTiming && signalTiming.currentPhase !== "unknown" && (
              <View style={styles.timingCard}>
                <View
                  style={[
                    styles.timingPhaseIndicator,
                    signalTiming.currentPhase === "red" && styles.timingPhaseRed,
                    signalTiming.currentPhase === "yellow" && styles.timingPhaseYellow,
                    signalTiming.currentPhase === "green" && styles.timingPhaseGreen,
                  ]}
                >
                  <Text style={styles.timingPhaseLabel}>
                    {signalTiming.currentPhase === "red" ? "🔴 빨간불" : signalTiming.currentPhase === "yellow" ? "🟡 노란불" : "🟢 파란불"}
                  </Text>
                </View>
                {signalTiming.estimatedRemainingSeconds !== null && (
                  <View style={styles.timingCountdown}>
                    <Text style={[styles.timingCountdownNumber, lowVisionModeEnabled && styles.timingCountdownNumberLowVision]}>
                      {signalTiming.estimatedRemainingSeconds}
                    </Text>
                    <Text style={[styles.timingCountdownLabel, lowVisionModeEnabled && styles.timingCountdownLabelLowVision]}>
                      초 남음
                    </Text>
                  </View>
                )}
                <View style={styles.timingMetaRow}>
                  <Text style={[styles.timingMeta, lowVisionModeEnabled && styles.timingMetaLowVision]}>
                    {signalTiming.predictionMethod === "ocr" ? "🎯 실제 표시" : signalTiming.predictionMethod === "learned" ? "📊 학습 예측" : "📋 기본 예측"}
                  </Text>
                  <Text style={[styles.timingMeta, lowVisionModeEnabled && styles.timingMetaLowVision]}>
                    신뢰도 {Math.round(signalTiming.predictionConfidence * 100)}%
                  </Text>
                </View>
                {signalTiming.estimatedNextPhase !== "unknown" && (
                  <Text style={[styles.timingNextPhase, lowVisionModeEnabled && styles.timingNextPhaseLowVision]}>
                    다음: {signalTiming.estimatedNextPhase === "red" ? "빨간불" : signalTiming.estimatedNextPhase === "yellow" ? "노란불" : "파란불"}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.summaryInfoRow}>
              <View style={styles.summaryInfoChip}>
                <Text style={[styles.summaryInfoLabel, lowVisionModeEnabled && styles.summaryInfoLabelLowVision]}>
                  마지막 스캔
                </Text>
                <Text style={[styles.summaryInfoValue, lowVisionModeEnabled && styles.summaryInfoValueLowVision]}>
                  {lastAnalyzedLabel}
                </Text>
              </View>
              <View style={styles.summaryInfoChip}>
                <Text style={[styles.summaryInfoLabel, lowVisionModeEnabled && styles.summaryInfoLabelLowVision]}>
                  마지막 감지
                </Text>
                <Text style={[styles.summaryInfoValue, lowVisionModeEnabled && styles.summaryInfoValueLowVision]}>
                  {lastDetectedLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {laneDepartureState && (
          <View style={styles.ldwSection}>
            <View style={styles.ldwHeader}>
              <Text style={[styles.ldwTitle, lowVisionModeEnabled && styles.ldwTitleLowVision]}>
                차선 이탈 경고 (LDW)
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await setLDWEnabled(!laneDepartureState.ldwEnabled);
                }}
                style={({ pressed }) => [
                  styles.ldwToggle,
                  laneDepartureState.ldwEnabled && styles.ldwToggleActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.ldwToggleText,
                    laneDepartureState.ldwEnabled && styles.ldwToggleTextActive,
                    lowVisionModeEnabled && styles.ldwToggleTextLowVision,
                  ]}
                >
                  {laneDepartureState.ldwEnabled ? "켜짐" : "꺼짐"}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.ldwStatus, lowVisionModeEnabled && styles.ldwStatusLowVision]}>
              {getLDWStatusLabel()}
            </Text>
            {laneDepartureState.laneDetected && (
              <>
                <View style={styles.ldwInfoRow}>
                  <Text style={[styles.ldwInfoLabel, lowVisionModeEnabled && styles.ldwInfoLabelLowVision]}>
                    차선 위치:
                  </Text>
                  <Text style={[styles.ldwInfoValue, lowVisionModeEnabled && styles.ldwInfoValueLowVision]}>
                    {getLanePositionLabel(laneDepartureState.lanePosition)}
                  </Text>
                </View>
                <View style={styles.ldwInfoRow}>
                  <Text style={[styles.ldwInfoLabel, lowVisionModeEnabled && styles.ldwInfoLabelLowVision]}>
                    차선 가시성:
                  </Text>
                  <Text style={[styles.ldwInfoValue, lowVisionModeEnabled && styles.ldwInfoValueLowVision]}>
                    {laneDepartureState.leftLaneVisible ? "좌✓" : "좌✗"}{" "}
                    {laneDepartureState.rightLaneVisible ? "우✓" : "우✗"}
                  </Text>
                </View>
              </>
            )}
            {laneDepartureState.departureDetected && (
              <View
                style={[
                  styles.ldwWarning,
                  laneDepartureState.severity === "danger" && styles.ldwWarningDanger,
                ]}
              >
                <Text style={[styles.ldwWarningText, lowVisionModeEnabled && styles.ldwWarningTextLowVision]}>
                  {getLDWWarningMessage(laneDepartureState.departureDirection, laneDepartureState.severity)}
                </Text>
              </View>
            )}
            <View style={styles.turnSignalRow}>
              <Text style={[styles.turnSignalLabel, lowVisionModeEnabled && styles.turnSignalLabelLowVision]}>
                방향지시등:
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  if (laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "left") {
                    await deactivateTurnSignal();
                  } else {
                    await activateTurnSignal("left");
                  }
                }}
                style={({ pressed }) => [
                  styles.turnSignalButton,
                  laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "left" && styles.turnSignalButtonActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.turnSignalButtonText,
                    laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "left" && styles.turnSignalButtonTextActive,
                    lowVisionModeEnabled && styles.turnSignalButtonTextLowVision,
                  ]}
                >
                  ← 좌측
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  if (laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "right") {
                    await deactivateTurnSignal();
                  } else {
                    await activateTurnSignal("right");
                  }
                }}
                style={({ pressed }) => [
                  styles.turnSignalButton,
                  laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "right" && styles.turnSignalButtonActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.turnSignalButtonText,
                    laneDepartureState.turnSignalActive && laneDepartureState.turnSignalDirection === "right" && styles.turnSignalButtonTextActive,
                    lowVisionModeEnabled && styles.turnSignalButtonTextLowVision,
                  ]}
                >
                  우측 →
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {tsrState && (
          <View style={styles.tsrSection}>
            <View style={styles.tsrHeader}>
              <Text style={[styles.tsrTitle, lowVisionModeEnabled && styles.tsrTitleLowVision]}>
                교통 표지판 인식 (TSR)
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await setTSREnabled(!tsrState.tsrEnabled);
                }}
                style={({ pressed }) => [
                  styles.tsrToggle,
                  tsrState.tsrEnabled && styles.tsrToggleActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.tsrToggleText,
                    tsrState.tsrEnabled && styles.tsrToggleTextActive,
                    lowVisionModeEnabled && styles.tsrToggleTextLowVision,
                  ]}
                >
                  {tsrState.tsrEnabled ? "켜짐" : "꺼짐"}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.tsrStatus, lowVisionModeEnabled && styles.tsrStatusLowVision]}>
              {getTSRStatusLabel()}
            </Text>
            {tsrState.currentSpeedLimit !== null && (
              <View style={styles.speedLimitCard}>
                <Text style={[styles.speedLimitIcon, lowVisionModeEnabled && styles.speedLimitIconLowVision]}>
                  {tsrState.currentSpeedLimit}
                </Text>
                <Text style={[styles.speedLimitLabel, lowVisionModeEnabled && styles.speedLimitLabelLowVision]}>
                  km/h
                </Text>
                {tsrState.isInSchoolZone && (
                  <View style={styles.schoolZoneBadge}>
                    <Text style={styles.schoolZoneBadgeText}>🏫 스쿨존</Text>
                  </View>
                )}
              </View>
            )}
            {tsrState.speedAlertLevel !== "safe" && tsrState.currentSpeedLimit !== null && (
              <View
                style={[
                  styles.speedAlert,
                  tsrState.speedAlertLevel === "severe" && styles.speedAlertSevere,
                  tsrState.speedAlertLevel === "exceeding" && styles.speedAlertExceeding,
                ]}
              >
                <Text style={[styles.speedAlertText, lowVisionModeEnabled && styles.speedAlertTextLowVision]}>
                  {getSpeedAlertMessage(lastSpeedKmh, tsrState.currentSpeedLimit, tsrState.speedAlertLevel)}
                </Text>
              </View>
            )}
            {tsrState.recentSigns.length > 0 && (
              <View style={styles.recentSignsContainer}>
                <Text style={[styles.recentSignsTitle, lowVisionModeEnabled && styles.recentSignsTitleLowVision]}>
                  최근 감지된 표지판:
                </Text>
                {tsrState.recentSigns.slice(0, 3).map((sign, index) => (
                  <View key={index} style={styles.signItem}>
                    <Text style={styles.signIcon}>{getTrafficSignIcon(sign.type, sign.speedLimit || undefined)}</Text>
                    <Text style={[styles.signDescription, lowVisionModeEnabled && styles.signDescriptionLowVision]}>
                      {sign.description}
                    </Text>
                    <Text style={[styles.signConfidence, lowVisionModeEnabled && styles.signConfidenceLowVision]}>
                      {Math.round(sign.confidence * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!permission?.granted && Platform.OS !== "web" ? (
          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
          </Pressable>
        ) : null}

        <View style={styles.qualityControlRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConsensusEnabled(!consensusEnabled)}
            style={({ pressed }) => [
              styles.qualityToggleButton,
              consensusEnabled && styles.qualityToggleButtonActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.qualityToggleButtonText,
                consensusEnabled && styles.qualityToggleButtonTextActive,
                lowVisionModeEnabled && styles.qualityToggleButtonTextLowVision,
              ]}
            >
              다중 프레임 {consensusEnabled ? "켜짐" : "꺼짐"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setAutoRetryEnabled(!autoRetryEnabled)}
            style={({ pressed }) => [
              styles.qualityToggleButton,
              autoRetryEnabled && styles.qualityToggleButtonActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.qualityToggleButtonText,
                autoRetryEnabled && styles.qualityToggleButtonTextActive,
                lowVisionModeEnabled && styles.qualityToggleButtonTextLowVision,
              ]}
            >
              자동 재시도 {autoRetryEnabled ? "켜짐" : "꺼짐"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              statsTrackerRef.current.reset();
              setRecognitionStats(statsTrackerRef.current.getStatsLabel());
              setRecognitionHistory([]);
            }}
            style={({ pressed }) => [
              styles.qualityResetButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.qualityResetButtonText,
                lowVisionModeEnabled && styles.qualityToggleButtonTextLowVision,
              ]}
            >
              통계 초기화
            </Text>
          </Pressable>
        </View>

        <View style={styles.distanceSettingSection}>
          <Text style={[styles.distanceSettingTitle, lowVisionModeEnabled && styles.distanceSettingTitleLowVision]}>
            전방 알림 거리 설정
          </Text>
          <Text style={[styles.distanceSettingSubtitle, lowVisionModeEnabled && styles.distanceSettingSubtitleLowVision]}>
            {getAdvanceNotificationModeDescription(advanceNotificationConfig.mode)}
          </Text>
          <View style={styles.distanceControlRow}>
            {ALL_MODES.map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                onPress={async () => {
                  await setAdvanceNotificationMode(mode);
                }}
                style={({ pressed }) => [
                  styles.distanceButton,
                  advanceNotificationConfig.mode === mode && styles.distanceButtonActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.distanceButtonText,
                    advanceNotificationConfig.mode === mode && styles.distanceButtonTextActive,
                    lowVisionModeEnabled && styles.distanceButtonTextLowVision,
                  ]}
                >
                  {getAdvanceNotificationModeLabel(mode)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.distanceCurrentValue, lowVisionModeEnabled && styles.distanceCurrentValueLowVision]}>
            현재: {Math.round(getNotificationDistance(lastSpeedKmh))}m{" "}
            {advanceNotificationConfig.mode === "auto" && `(${Math.round(lastSpeedKmh)} km/h 기준)`}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleToggleMonitoring}
            style={({ pressed }) => [
              styles.secondaryButton,
              isMonitoring && styles.secondaryButtonActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                isMonitoring && styles.secondaryButtonTextActive,
                lowVisionModeEnabled && styles.actionButtonTextLowVision,
              ]}
            >
              {isMonitoring ? "실시간 중지" : "실시간 시작"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleAnalyzeFrame}
            disabled={isAnalyzing}
            style={({ pressed }) => [
              styles.confirmButton,
              isAnalyzing && styles.confirmButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isAnalyzing ? <ActivityIndicator color="#ffffff" /> : null}
            <Text style={[styles.confirmButtonText, lowVisionModeEnabled && styles.actionButtonTextLowVision]}>
              {isAnalyzing ? "인식 중" : "신호등 인식"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    backgroundColor: "#D8DBDF", // Apple gray background to match home screen
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    minWidth: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  backText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#11181c",
  },
  headerSpacer: {
    width: 88,
  },
  previewCard: {
    flex: 1,
    borderRadius: 24, // Smaller radius for refined Apple look
    borderWidth: 0.5, // Thinner border
    borderColor: "#E8EAEE",
    backgroundColor: "#F3F4F6", // Lighter background
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  previewCardLowVision: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  previewTopRow: {
    gap: 10,
  },
  topBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  liveBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#1F2937", // Darker for better contrast
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  liveBadgeText: {
    fontSize: 20, // Larger for better visibility
    fontWeight: "900", // Bolder
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  liveBadgeTextLowVision: {
    fontSize: 26, // Even larger for low vision
    lineHeight: 32,
  },
  scanStateBadge: {
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: "#D1D5DB",
  },
  scanStateBadgeActive: {
    backgroundColor: "#D1FAE5", // Brighter green for active state
    borderColor: "#86EFAC",
  },
  scanStateBadgeText: {
    fontSize: 18, // Larger font
    fontWeight: "900", // Bolder
    color: "#374151",
    letterSpacing: -0.2,
  },
  scanStateBadgeTextActive: {
    color: "#065F46", // Darker green for better contrast
  },
  scanStateBadgeTextLowVision: {
    fontSize: 20,
    lineHeight: 24,
  },
  featureBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureBadge: {
    borderRadius: 999,
    backgroundColor: "#DBEAFE", // Light blue for environment detection
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: "#93C5FD",
  },
  featureBadgeText: {
    fontSize: 16, // Larger for better readability
    fontWeight: "900", // Bolder
    color: "#1E40AF", // Darker blue for contrast
    letterSpacing: -0.2,
  },
  featureBadgeTextLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  featureBadgeQuality: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  previewHint: {
    fontSize: 22, // Larger hint text
    fontWeight: "900", // Bolder
    color: "#374151", // Darker for better contrast
    letterSpacing: -0.3,
  },
  previewHintLowVision: {
    fontSize: 28,
    lineHeight: 34,
  },
  cameraStage: {
    height: 230,
    borderRadius: 26,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  cameraStageLowVision: {
    height: 248,
  },
  cameraFallbackLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: "#111827",
  },
  cameraFallbackText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    color: "#e2e8f0",
    textAlign: "center",
  },
  cameraFallbackTextLowVision: {
    fontSize: 21,
    lineHeight: 30,
  },
  detectionFrame: {
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: 22,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  frameCornerTopLeft: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderTopLeftRadius: 20,
  },
  frameCornerTopRight: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderTopRightRadius: 20,
  },
  frameCornerBottomLeft: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderBottomLeftRadius: 20,
  },
  frameCornerBottomRight: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderBottomRightRadius: 20,
  },
  cameraCenterChip: {
    position: "absolute",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraCenterChipText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  cameraCenterChipTextLowVision: {
    fontSize: 22,
    lineHeight: 28,
  },
  rangeCard: {
    borderRadius: 20, // Smaller radius
    backgroundColor: "#F9FAFB", // Lighter background
    borderWidth: 0.5, // Thinner border
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  sectionTitleLowVision: {
    fontSize: 30,
    lineHeight: 36,
  },
  sectionBody: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
    color: "#4b5563",
  },
  sectionBodyLowVision: {
    fontSize: 22,
    lineHeight: 32,
  },
  rangeButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  rangeButton: {
    flex: 1,
    borderRadius: 18, // Smaller radius
    borderWidth: 0.5, // Thinner border
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  rangeButtonSelected: {
    borderColor: "#1F2937", // Darker for better contrast
    backgroundColor: "#1F2937",
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  rangeButtonTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  rangeButtonTitleSelected: {
    color: "#ffffff",
  },
  rangeButtonTitleLowVision: {
    fontSize: 30,
    lineHeight: 36,
  },
  rangeButtonDescription: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6b7280",
  },
  rangeButtonDescriptionSelected: {
    color: "#cbd5e1",
  },
  rangeButtonDescriptionLowVision: {
    fontSize: 20,
    lineHeight: 28,
  },
  summaryCard: {
    borderRadius: 20, // Smaller radius
    backgroundColor: "#1F2937", // Slightly lighter dark
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 6,
    borderWidth: 0.5,
    borderColor: "#374151",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#cbd5e1",
  },
  summaryTitleLowVision: {
    fontSize: 24,
    lineHeight: 30,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
  },
  summaryValueLowVision: {
    fontSize: 42,
    lineHeight: 48,
  },
  summaryDescription: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: "#d1d5db",
  },
  summaryDescriptionLowVision: {
    fontSize: 22,
    lineHeight: 30,
  },
  summaryMeta: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "700",
    color: "#93c5fd",
  },
  summaryMetaLowVision: {
    fontSize: 22,
    lineHeight: 28,
  },
  summarySubMeta: {
    fontSize: 16,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  summarySubMetaLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  summaryQualityText: {
    color: "#93C5FD",
    fontWeight: "900",
  },
  summaryInfoRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  summaryInfoChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  summaryInfoLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#94a3b8",
  },
  summaryInfoLabelLowVision: {
    fontSize: 18,
    lineHeight: 22,
  },
  summaryInfoValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  summaryInfoValueLowVision: {
    fontSize: 24,
    lineHeight: 30,
  },
  permissionButton: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  permissionButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  qualityControlRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  qualityToggleButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityToggleButtonActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  qualityToggleButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4b5563",
  },
  qualityToggleButtonTextActive: {
    color: "#1E40AF",
  },
  qualityToggleButtonTextLowVision: {
    fontSize: 19,
    lineHeight: 24,
  },
  timingCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  timingPhaseIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  timingPhaseRed: {
    backgroundColor: "#fee2e2",
  },
  timingPhaseYellow: {
    backgroundColor: "#fef3c7",
  },
  timingPhaseGreen: {
    backgroundColor: "#d1fae5",
  },
  timingPhaseLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  timingCountdown: {
    alignItems: "center",
    marginBottom: 12,
  },
  timingCountdownNumber: {
    fontSize: 56,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 64,
  },
  timingCountdownNumberLowVision: {
    fontSize: 68,
    lineHeight: 76,
  },
  timingCountdownLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 4,
  },
  timingCountdownLabelLowVision: {
    fontSize: 22,
    lineHeight: 28,
  },
  timingMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timingMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  timingMetaLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  timingNextPhase: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
    textAlign: "center",
    marginTop: 4,
  },
  timingNextPhaseLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  qualityResetButton: {
    flex: 1,
    minWidth: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityResetButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#dc2626",
  },
  distanceSettingSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  distanceSettingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 4,
  },
  distanceSettingTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  distanceSettingSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 12,
  },
  distanceSettingSubtitleLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  distanceControlRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  distanceButton: {
    flex: 1,
    minWidth: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  distanceButtonActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#3B82F6",
    borderWidth: 2,
  },
  distanceButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
  },
  distanceButtonTextActive: {
    color: "#1E40AF",
    fontWeight: "800",
  },
  distanceButtonTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  distanceCurrentValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  distanceCurrentValueLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 20, // Smaller radius
    borderWidth: 0.5, // Thinner border
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB", // Lighter background
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  secondaryButtonActive: {
    backgroundColor: "#D1FAE5", // Brighter green
    borderColor: "#6EE7B7",
    shadowOpacity: 0.12,
  },
  secondaryButtonText: {
    fontSize: 24, // Larger for better visibility
    fontWeight: "900", // Bolder
    color: "#111827",
    letterSpacing: -0.3,
  },
  secondaryButtonTextActive: {
    color: "#065F46", // Darker green
  },
  confirmButton: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#1F2937", // Slightly lighter dark
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.05,
  },
  confirmButtonText: {
    fontSize: 26, // Larger for better visibility
    fontWeight: "900", // Bolder
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  actionButtonTextLowVision: {
    fontSize: 28,
    lineHeight: 34,
  },
  ldwSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  ldwHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ldwTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  ldwTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  ldwToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  ldwToggleActive: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  ldwToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
  },
  ldwToggleTextActive: {
    color: "#166534",
  },
  ldwToggleTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  ldwStatus: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  ldwStatusLowVision: {
    fontSize: 18,
    lineHeight: 24,
  },
  ldwInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ldwInfoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  ldwInfoLabelLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  ldwInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  ldwInfoValueLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  ldwWarning: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  ldwWarningDanger: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  ldwWarningText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
    textAlign: "center",
  },
  ldwWarningTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  turnSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  turnSignalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
  turnSignalLabelLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  turnSignalButton: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  turnSignalButtonActive: {
    backgroundColor: "#fef3c7",
    borderColor: "#fbbf24",
    borderWidth: 2,
  },
  turnSignalButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
  },
  turnSignalButtonTextActive: {
    color: "#92400e",
  },
  turnSignalButtonTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  tsrSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tsrHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tsrTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  tsrTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  tsrToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  tsrToggleActive: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  tsrToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
  },
  tsrToggleTextActive: {
    color: "#166534",
  },
  tsrToggleTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  tsrStatus: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  tsrStatusLowVision: {
    fontSize: 18,
    lineHeight: 24,
  },
  speedLimitCard: {
    backgroundColor: "#fee2e2",
    borderRadius: 100,
    width: 120,
    height: 120,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#dc2626",
    marginVertical: 12,
  },
  speedLimitIcon: {
    fontSize: 48,
    fontWeight: "900",
    color: "#000000",
  },
  speedLimitIconLowVision: {
    fontSize: 56,
  },
  speedLimitLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    marginTop: 4,
  },
  speedLimitLabelLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  schoolZoneBadge: {
    position: "absolute",
    bottom: -10,
    backgroundColor: "#fbbf24",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#92400e",
  },
  schoolZoneBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#78350f",
  },
  speedAlert: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  speedAlertExceeding: {
    backgroundColor: "#fed7aa",
    borderColor: "#f97316",
  },
  speedAlertSevere: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  speedAlertText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
    textAlign: "center",
  },
  speedAlertTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  recentSignsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  recentSignsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
    marginBottom: 8,
  },
  recentSignsTitleLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  signItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    marginBottom: 6,
  },
  signIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  signDescription: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  signDescriptionLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  signConfidence: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginLeft: 8,
  },
  signConfidenceLowVision: {
    fontSize: 15,
    lineHeight: 20,
  },
});
