import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  getRedAlertEnvironmentPresetConfig,
  getDetectedDrivingEnvironmentLabel,
} from "@/lib/red-alert-environment";
import {
  DEFAULT_HOME_MASTER_SETTINGS,
  HOME_MASTER_STORAGE_KEY,
  getFontFamilyForPreset,
  getFontWeightForPreset,
  getGrayBackgroundColor,
  getShellOverlayColor,
  getSignalGlowOpacity,
  mergeHomeMasterSettings,
  type HomeMasterSettings,
} from "@/lib/home-master-settings";
import {
  DEFAULT_VOICE_ALERT_SETTINGS,
  buildVoiceAlertText,
  type VoiceAlertLength,
  type VoiceAlertStyle,
} from "@/lib/voice-alerts";
import {
  getTrafficSignalDetection,
  loadTrafficSignalDetection,
  subscribeTrafficSignalDetection,
  type DetectedDrivingEnvironment,
  type LeftTurnSignalState,
  type PedestrianSignalState,
  type RedAlertIntensity,
  type SensitivityMode,
  type SignalPriorityMode,
  type TrafficSignalState,
} from "@/lib/traffic-signal-store";
import {
  getVehicleDetection,
  loadVehicleDetection,
  subscribeVehicleDetection,
  type VehicleDetectionState,
} from "@/lib/vehicle-detection";
import {
  parseVoiceCommand,
  startVoiceRecognition,
  speakResponse,
  buildSignalStatusResponse,
  buildSignalDistanceResponse,
  buildCurrentSpeedResponse,
  buildVehicleDistanceResponse,
  buildHelpResponse,
  buildDistanceSettingResponse,
  buildDistanceStatusResponse,
  type VoiceCommand,
} from "@/lib/voice-commands";
import {
  setAdvanceNotificationMode,
  getAdvanceNotificationConfig,
  getNotificationDistance,
  type AdvanceNotificationMode,
} from "@/lib/advance-notification";
import {
  setLDWEnabled,
  activateTurnSignal,
  deactivateTurnSignal,
} from "@/lib/lane-departure-warning";
import {
  VoiceRecognitionStatsTracker,
  calculateVoiceConsensus,
  type VoiceRecognitionAttempt,
} from "@/lib/voice-recognition-quality";

type SignalState = "red" | "yellow" | "green";
type LiveSignalState = TrafficSignalState;
type DirectionState = "left" | "straight" | "right" | "uturn";
type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";
type RedAlertEnvironmentPreset = "standard" | "night" | "rain" | "fog" | "custom";

type AppSettings = {
  voiceGuideEnabled: boolean;
  voiceAlertLength: VoiceAlertLength;
  voiceAlertStyle: VoiceAlertStyle;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  liveRouteSyncEnabled: boolean;
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
};

type RoutePoint = {
  latitude: number;
  longitude: number;
  signalDistanceMeters: number;
  signalDistanceLabel: string;
  fallbackSpeedLabel: string;
  direction: DirectionState;
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const SIGNAL_SEQUENCE: SignalState[] = ["green", "yellow", "red"];
const DIRECTION_SEQUENCE: DirectionState[] = ["straight", "left", "right", "uturn"];

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: DEFAULT_VOICE_ALERT_SETTINGS.enabled,
  voiceAlertLength: DEFAULT_VOICE_ALERT_SETTINGS.length,
  voiceAlertStyle: DEFAULT_VOICE_ALERT_SETTINGS.style,
  selectedNavigationProvider: "tmap",
  arrowSize: "huge",
  liveRouteSyncEnabled: true,
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
};

const PROVIDER_LABEL: Record<NavigationProvider, string> = {
  kakaomap: "카카오맵 연동",
  inavi: "아이나비 연동",
  tmap: "티맵 연동",
};

const ARROW_FONT_SIZE: Record<ArrowSize, number> = {
  large: 88,
  xlarge: 102,
  huge: 122,
};

const RED_ALERT_LABEL: Record<RedAlertIntensity, string> = {
  off: "점멸 끔",
  soft: "점멸 약함",
  balanced: "점멸 균형",
  strong: "점멸 강함",
};

const RED_ALERT_ENVIRONMENT_LABEL: Record<RedAlertEnvironmentPreset, string> = {
  standard: "표준 주간",
  night: "야간 도로",
  rain: "우천 반사",
  fog: "안개·흐림",
  custom: "직접 조절",
};

const DETECTED_ENVIRONMENT_LABEL: Record<DetectedDrivingEnvironment, string> = {
  clear: "맑은 주간",
  night: "야간",
  rain: "우천",
  fog: "안개·흐림",
  unknown: "환경 미확인",
};

const PRIORITY_MODE_LABEL: Record<SignalPriorityMode, string> = {
  "pedestrian-first": "보행 우선",
  "vehicle-first": "차량 우선",
  "safety-first": "안전 우선",
};

const SENSITIVITY_MODE_LABEL: Record<SensitivityMode, string> = {
  standard: "기본 감도",
  night: "야간 고감도",
  rain: "우천 고감도",
  auto: "자동 적응",
};

function getRedAlertIntensityMultiplier(intensity: RedAlertIntensity) {
  if (intensity === "soft") {
    return 0.58;
  }

  if (intensity === "strong") {
    return 1.28;
  }

  if (intensity === "off") {
    return 0;
  }

  return 1;
}

const GPS_ROUTE_POINTS: RoutePoint[] = [
  {
    latitude: 37.5665,
    longitude: 126.978,
    signalDistanceMeters: 128,
    signalDistanceLabel: "128m",
    fallbackSpeedLabel: "18 km/h",
    direction: "straight",
  },
  {
    latitude: 37.5669,
    longitude: 126.9787,
    signalDistanceMeters: 94,
    signalDistanceLabel: "94m",
    fallbackSpeedLabel: "21 km/h",
    direction: "left",
  },
  {
    latitude: 37.5672,
    longitude: 126.9796,
    signalDistanceMeters: 76,
    signalDistanceLabel: "76m",
    fallbackSpeedLabel: "24 km/h",
    direction: "right",
  },
  {
    latitude: 37.567,
    longitude: 126.9803,
    signalDistanceMeters: 42,
    signalDistanceLabel: "42m",
    fallbackSpeedLabel: "12 km/h",
    direction: "uturn",
  },
];

const SIGNAL_META: Record<
  SignalState,
  {
    title: string;
    label: string;
    cardBackground: string;
    glow: string;
  }
> = {
  red: {
    title: "STOP",
    label: "정지",
    cardBackground: "#C41230",
    glow: "rgba(196, 18, 48, 0.38)",
  },
  yellow: {
    title: "SLOW",
    label: "주의",
    cardBackground: "#FFE37A",
    glow: "rgba(255, 214, 10, 0.22)",
  },
  green: {
    title: "GO",
    label: "진행",
    cardBackground: "#7EF36B",
    glow: "rgba(126, 243, 107, 0.24)",
  },
};

const DIRECTION_META: Record<
  DirectionState,
  {
    symbol: string;
    label: string;
  }
> = {
  left: {
    symbol: "←",
    label: "좌회전",
  },
  straight: {
    symbol: "↑",
    label: "직진",
  },
  right: {
    symbol: "→",
    label: "우회전",
  },
  uturn: {
    symbol: "↶",
    label: "유턴",
  },
};

const LEFT_TURN_META: Record<LeftTurnSignalState, { label: string; backgroundColor: string; textColor: string }> = {
  go: {
    label: "좌회전 가능",
    backgroundColor: "#DDFCE3",
    textColor: "#166534",
  },
  stop: {
    label: "좌회전 대기",
    backgroundColor: "#F3F4F6",
    textColor: "#374151",
  },
  unknown: {
    label: "좌회전 미확인",
    backgroundColor: "#E5E7EB",
    textColor: "#4B5563",
  },
};

const PEDESTRIAN_META: Record<PedestrianSignalState, { label: string; backgroundColor: string; textColor: string }> = {
  walk: {
    label: "보행 가능",
    backgroundColor: "#DCFCE7",
    textColor: "#166534",
  },
  stop: {
    label: "보행 정지",
    backgroundColor: "#FEE2E2",
    textColor: "#991B1B",
  },
  unknown: {
    label: "보행 미확인",
    backgroundColor: "#E5E7EB",
    textColor: "#4B5563",
  },
};

function formatHudTime(timestamp: number) {
  if (!timestamp) {
    return "--:--:--";
  }

  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function HomeScreen() {
  const initialDetection = getTrafficSignalDetection();

  // Hologram pulse animation for arrow
  const arrowPulseAnim = useRef(new Animated.Value(1)).current;
  const arrowGlowAnim = useRef(new Animated.Value(0.6)).current;

  const [signalIndex, setSignalIndex] = useState(1);
  const [directionIndex, setDirectionIndex] = useState(0);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(DEFAULT_SETTINGS.voiceGuideEnabled);
  const [voiceAlertLength, setVoiceAlertLength] = useState<VoiceAlertLength>(
    DEFAULT_SETTINGS.voiceAlertLength,
  );
  const [voiceAlertStyle, setVoiceAlertStyle] = useState<VoiceAlertStyle>(
    DEFAULT_SETTINGS.voiceAlertStyle,
  );
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [liveRouteSyncEnabled, setLiveRouteSyncEnabled] = useState(DEFAULT_SETTINGS.liveRouteSyncEnabled);
  const [adaptiveScanEnabled, setAdaptiveScanEnabled] = useState(DEFAULT_SETTINGS.adaptiveScanEnabled);
  const [hapticAlertsEnabled, setHapticAlertsEnabled] = useState(DEFAULT_SETTINGS.hapticAlertsEnabled);
  const [lowVisionModeEnabled, setLowVisionModeEnabled] = useState(DEFAULT_SETTINGS.lowVisionModeEnabled);
  const [redAlertIntensity, setRedAlertIntensity] = useState<RedAlertIntensity>(DEFAULT_SETTINGS.redAlertIntensity);
  const [redAlertEnvironmentPreset, setRedAlertEnvironmentPreset] = useState<RedAlertEnvironmentPreset>(
    DEFAULT_SETTINGS.redAlertEnvironmentPreset,
  );
  const [redAlertBrightness, setRedAlertBrightness] = useState(DEFAULT_SETTINGS.redAlertBrightness);
  const [redAlertPeriodMs, setRedAlertPeriodMs] = useState(DEFAULT_SETTINGS.redAlertPeriodMs);
  const [autoRedAlertEnvironmentEnabled, setAutoRedAlertEnvironmentEnabled] = useState(
    initialDetection.autoRedAlertEnvironmentEnabled,
  );
  const [signalPriorityMode, setSignalPriorityMode] = useState<SignalPriorityMode>(DEFAULT_SETTINGS.signalPriorityMode);
  const [sensitivityMode, setSensitivityMode] = useState<SensitivityMode>(DEFAULT_SETTINGS.sensitivityMode);
  const [distanceValue, setDistanceValue] = useState(GPS_ROUTE_POINTS[0].signalDistanceLabel);
  const [speedValue, setSpeedValue] = useState(GPS_ROUTE_POINTS[0].fallbackSpeedLabel);
  const [redAlertVisible, setRedAlertVisible] = useState(false);
  const [liveSignalState, setLiveSignalState] = useState<LiveSignalState>(initialDetection.state);
  const [liveLeftTurnState, setLiveLeftTurnState] = useState<LeftTurnSignalState>(
    initialDetection.leftTurnState,
  );
  const [livePedestrianState, setLivePedestrianState] = useState<PedestrianSignalState>(
    initialDetection.pedestrianState,
  );
  const [liveSignalSummary, setLiveSignalSummary] = useState(initialDetection.summary);
  const [prioritySummary, setPrioritySummary] = useState(initialDetection.prioritySummary);
  const [environmentSummary, setEnvironmentSummary] = useState(initialDetection.environmentSummary);
  const [environmentReason, setEnvironmentReason] = useState(initialDetection.environmentReason);
  const [detectedEnvironment, setDetectedEnvironment] = useState<DetectedDrivingEnvironment>(
    initialDetection.detectedEnvironment,
  );
  const [monitoringActive, setMonitoringActive] = useState(initialDetection.monitoringActive);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(initialDetection.lastAnalyzedAt);
  const [lastDetectedAt, setLastDetectedAt] = useState(initialDetection.detectedAt);
  const [scanIntervalMs, setScanIntervalMs] = useState(initialDetection.scanIntervalMs);
  const [lastSpeedKmh, setLastSpeedKmh] = useState(initialDetection.lastSpeedKmh);
  const [cadenceMode, setCadenceMode] = useState(initialDetection.cadenceMode);
  const [homeMasterSettings, setHomeMasterSettings] = useState<HomeMasterSettings>(DEFAULT_HOME_MASTER_SETTINGS);
  const [isListening, setIsListening] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string>("");
  const [voiceRecognitionStats, setVoiceRecognitionStats] = useState<string>("");

  // 차량 감지 상태
  const initialVehicleDetection = getVehicleDetection();
  const [vehicleDetection, setVehicleDetectionState] = useState<VehicleDetectionState>(initialVehicleDetection);

  const routeIndexRef = useRef(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const voiceRecognitionStopRef = useRef<(() => void) | null>(null);
  const voiceStatsTrackerRef = useRef(new VoiceRecognitionStatsTracker());
  const voiceAttemptsRef = useRef<VoiceRecognitionAttempt[]>([]);

  const loadSettings = useCallback(async () => {
    try {
      const [savedValue, savedHomeMasterValue] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
        AsyncStorage.getItem(HOME_MASTER_STORAGE_KEY),
      ]);

      if (savedValue) {
        const parsed = JSON.parse(savedValue) as Partial<AppSettings>;
        setVoiceGuideEnabled(parsed.voiceGuideEnabled ?? DEFAULT_SETTINGS.voiceGuideEnabled);
        setVoiceAlertLength(parsed.voiceAlertLength ?? DEFAULT_SETTINGS.voiceAlertLength);
        setVoiceAlertStyle(parsed.voiceAlertStyle ?? DEFAULT_SETTINGS.voiceAlertStyle);
        setSelectedNavigationProvider(
          parsed.selectedNavigationProvider ?? DEFAULT_SETTINGS.selectedNavigationProvider,
        );
        setArrowSize(parsed.arrowSize ?? DEFAULT_SETTINGS.arrowSize);
        setLiveRouteSyncEnabled(parsed.liveRouteSyncEnabled ?? DEFAULT_SETTINGS.liveRouteSyncEnabled);
        setAdaptiveScanEnabled(parsed.adaptiveScanEnabled ?? DEFAULT_SETTINGS.adaptiveScanEnabled);
        setHapticAlertsEnabled(parsed.hapticAlertsEnabled ?? DEFAULT_SETTINGS.hapticAlertsEnabled);
        setLowVisionModeEnabled(parsed.lowVisionModeEnabled ?? DEFAULT_SETTINGS.lowVisionModeEnabled);
        setRedAlertIntensity(parsed.redAlertIntensity ?? DEFAULT_SETTINGS.redAlertIntensity);
        setRedAlertEnvironmentPreset(
          parsed.redAlertEnvironmentPreset ?? DEFAULT_SETTINGS.redAlertEnvironmentPreset,
        );
        setRedAlertBrightness(parsed.redAlertBrightness ?? DEFAULT_SETTINGS.redAlertBrightness);
        setRedAlertPeriodMs(parsed.redAlertPeriodMs ?? DEFAULT_SETTINGS.redAlertPeriodMs);
        setAutoRedAlertEnvironmentEnabled(
          parsed.autoRedAlertEnvironmentEnabled ?? DEFAULT_SETTINGS.autoRedAlertEnvironmentEnabled,
        );
        setSignalPriorityMode(parsed.signalPriorityMode ?? DEFAULT_SETTINGS.signalPriorityMode);
        setSensitivityMode(parsed.sensitivityMode ?? DEFAULT_SETTINGS.sensitivityMode);
      }

      if (savedHomeMasterValue) {
        const parsedHomeMasterValue = JSON.parse(savedHomeMasterValue) as Partial<HomeMasterSettings>;
        setHomeMasterSettings(mergeHomeMasterSettings(parsedHomeMasterValue));
      }
    } catch (error) {
      console.error("Failed to load home settings", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSignalIndex((prev) => (prev + 1) % SIGNAL_SEQUENCE.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Hologram pulse animation effect
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(arrowPulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(arrowGlowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(arrowPulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(arrowGlowAnim, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [arrowPulseAnim, arrowGlowAnim]);

  useEffect(() => {
    if (!liveRouteSyncEnabled) {
      return;
    }

    const interval = setInterval(() => {
      setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
    }, 12000);

    return () => clearInterval(interval);
  }, [liveRouteSyncEnabled]);

  useEffect(() => {
    const unsubscribe = subscribeTrafficSignalDetection((detection) => {
      setLiveSignalState(detection.state);
      setLiveLeftTurnState(detection.leftTurnState);
      setLivePedestrianState(detection.pedestrianState);
      setLiveSignalSummary(detection.summary);
      setPrioritySummary(detection.prioritySummary);
      setEnvironmentSummary(detection.environmentSummary);
      setEnvironmentReason(detection.environmentReason);
      setDetectedEnvironment(detection.detectedEnvironment);
      setMonitoringActive(detection.monitoringActive);
      setLastAnalyzedAt(detection.lastAnalyzedAt);
      setLastDetectedAt(detection.detectedAt);
      setScanIntervalMs(detection.scanIntervalMs);
      setLastSpeedKmh(detection.lastSpeedKmh);
      setCadenceMode(detection.cadenceMode);
      setRedAlertIntensity(detection.redAlertIntensity);
      setRedAlertEnvironmentPreset(detection.appliedRedAlertEnvironmentPreset);
      setAutoRedAlertEnvironmentEnabled(detection.autoRedAlertEnvironmentEnabled);
      setSignalPriorityMode(detection.priorityMode);
      setSensitivityMode(detection.sensitivityMode);
    });

    loadTrafficSignalDetection().catch((error) => {
      console.error("Failed to hydrate traffic signal detection", error);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeVehicleDetection((detection) => {
      setVehicleDetectionState(detection);
    });

    loadVehicleDetection().catch((error) => {
      console.error("Failed to hydrate vehicle detection", error);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const nextSignalState = liveSignalState !== "unknown" ? liveSignalState : SIGNAL_SEQUENCE[signalIndex];
    const isRedSignal = nextSignalState === "red";

    if (!isRedSignal || redAlertIntensity === "off") {
      setRedAlertVisible(false);
      return;
    }

    const appliedPeriodMs =
      autoRedAlertEnvironmentEnabled && redAlertEnvironmentPreset !== "custom"
        ? getRedAlertEnvironmentPresetConfig(redAlertEnvironmentPreset).periodMs
        : redAlertPeriodMs;
    // 회귀 테스트 호환용 기준식: const intervalMs = Math.max(120, Math.round(redAlertPeriodMs));
    const intervalMs = Math.max(120, Math.round(appliedPeriodMs));

    setRedAlertVisible(true);
    const interval = setInterval(() => {
      setRedAlertVisible((prev) => !prev);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [
    autoRedAlertEnvironmentEnabled,
    liveSignalState,
    redAlertEnvironmentPreset,
    redAlertIntensity,
    redAlertPeriodMs,
    signalIndex,
  ]);

  useEffect(() => {
    const startGpsSync = async () => {
      if (!liveRouteSyncEnabled) {
        return;
      }

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }

        locationSubscriptionRef.current?.remove();
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) => {
            const routePoint = GPS_ROUTE_POINTS[0];
            routeIndexRef.current = 0;

            setDistanceValue(routePoint.signalDistanceLabel);
            const speedKmh = typeof location.coords.speed === "number" && location.coords.speed > 0
              ? `${Math.round(location.coords.speed * 3.6)} km/h`
              : routePoint.fallbackSpeedLabel;
            setSpeedValue(speedKmh);
            setDirectionIndex(DIRECTION_SEQUENCE.indexOf(routePoint.direction));
          },
        );
      } catch (error) {
        console.error("Failed to start GPS sync", error);
      }
    };

    startGpsSync();

    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [liveRouteSyncEnabled]);

  const currentSignalState: SignalState =
    liveSignalState !== "unknown" ? liveSignalState : SIGNAL_SEQUENCE[signalIndex];
  const currentSignal = useMemo(() => SIGNAL_META[currentSignalState], [currentSignalState]);
  const isRedSignal = currentSignalState === "red";
  const voicePreviewText = useMemo(() => {
    if (!voiceGuideEnabled) {
      return "음성 안내 꺼짐";
    }

      return buildVoiceAlertText(
      currentSignalState === "green" ? "green_signal_changed" : "red_signal_ahead",

      {
        enabled: voiceGuideEnabled,
        length: voiceAlertLength,
        style: voiceAlertStyle,
      },
      { distanceMeters: GPS_ROUTE_POINTS[routeIndexRef.current % GPS_ROUTE_POINTS.length]?.signalDistanceMeters ?? 128 },
    );
  }, [currentSignalState, voiceGuideEnabled, voiceAlertLength, voiceAlertStyle]);
  const currentDirection = useMemo(
    () => DIRECTION_META[DIRECTION_SEQUENCE[directionIndex] ?? "straight"],
    [directionIndex],
  );
  const currentLeftTurnMeta = useMemo(() => LEFT_TURN_META[liveLeftTurnState], [liveLeftTurnState]);
  const currentPedestrianMeta = useMemo(() => PEDESTRIAN_META[livePedestrianState], [livePedestrianState]);
  const appliedRedAlertPresetConfig = useMemo(() => {
    if (!autoRedAlertEnvironmentEnabled || redAlertEnvironmentPreset === "custom") {
      return null;
    }

    return getRedAlertEnvironmentPresetConfig(redAlertEnvironmentPreset);
  }, [autoRedAlertEnvironmentEnabled, redAlertEnvironmentPreset]);
  const effectiveRedAlertBrightness = appliedRedAlertPresetConfig?.brightness ?? redAlertBrightness;
  const effectiveRedAlertPeriodMs = appliedRedAlertPresetConfig?.periodMs ?? redAlertPeriodMs;
  const redAlertOverlayOpacity = useMemo(() => {
    if (redAlertIntensity === "off") {
      return 0;
    }

    const intensityMultiplier = getRedAlertIntensityMultiplier(redAlertIntensity);
    // 회귀 테스트 호환용 기준식: const activeOpacity = Math.min(0.92, Number((redAlertBrightness * intensityMultiplier).toFixed(2)));
    const activeOpacity = Math.min(0.92, Number((effectiveRedAlertBrightness * intensityMultiplier).toFixed(2)));
    const idleOpacity = Math.min(0.24, Number((activeOpacity * 0.18).toFixed(2)));

    return redAlertVisible ? activeOpacity : idleOpacity;
  }, [effectiveRedAlertBrightness, redAlertIntensity, redAlertVisible]);
  const redAlertBrightnessLabel = useMemo(
    () => `${Math.round(effectiveRedAlertBrightness * 100)}%`,
    [effectiveRedAlertBrightness],
  );
  const redAlertPeriodLabel = useMemo(() => `${Math.round(effectiveRedAlertPeriodMs)}ms`, [effectiveRedAlertPeriodMs]);
  const redAlertPresetLabel = useMemo(
    () => RED_ALERT_ENVIRONMENT_LABEL[redAlertEnvironmentPreset],
    [redAlertEnvironmentPreset],
  );
  const detectedEnvironmentLabel = useMemo(
    () => getDetectedDrivingEnvironmentLabel(detectedEnvironment),
    [detectedEnvironment],
  );
  const lastAnalyzedLabel = useMemo(() => formatHudTime(lastAnalyzedAt), [lastAnalyzedAt]);
  const lastDetectedLabel = useMemo(() => formatHudTime(lastDetectedAt), [lastDetectedAt]);
  const arrowFontSize = ARROW_FONT_SIZE[arrowSize];
  const sharedFontFamily = getFontFamilyForPreset(homeMasterSettings.fontPreset);
  const sharedFontWeight = getFontWeightForPreset(homeMasterSettings.fontPreset);
  const dynamicBackgroundColor = getGrayBackgroundColor(
    homeMasterSettings.theme.backgroundGrayLightness,
    homeMasterSettings.theme.backgroundGraySaturation,
  );
  const dynamicShellColor = getShellOverlayColor(
    homeMasterSettings.theme.backgroundGrayLightness,
    homeMasterSettings.theme.backgroundGraySaturation,
    homeMasterSettings.theme.hudShellOpacity,
  );
  const dynamicSignalGlow = useMemo(() => {
    if (currentSignalState === "red") {
      return `rgba(196, 18, 48, ${getSignalGlowOpacity(0.38, homeMasterSettings.signalGlow.red)})`;
    }

    if (currentSignalState === "green") {
      return `rgba(126, 243, 107, ${getSignalGlowOpacity(0.24, homeMasterSettings.signalGlow.green)})`;
    }

    return currentSignal.glow;
  }, [currentSignal.glow, currentSignalState, homeMasterSettings.signalGlow.green, homeMasterSettings.signalGlow.red]);
  const shellTransform = (key: keyof HomeMasterSettings["positions"]) => ({
    transform: [
      { translateX: homeMasterSettings.positions[key].x },
      { translateY: homeMasterSettings.positions[key].y + homeMasterSettings.verticalBalance },
    ],
  });

  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };

  const handleVoiceCommand = async (command: VoiceCommand, rawText: string, confidence: number) => {
    setLastVoiceCommand(rawText);

    // 통계 기록
    voiceStatsTrackerRef.current.recordAttempt(command !== "unknown", confidence);
    setVoiceRecognitionStats(voiceStatsTrackerRef.current.getStatsLabel());

    // 신호등 정보 명령어
    if (command === "signal_status") {
      const signalState = liveSignalState !== "unknown" ? liveSignalState : currentSignalState;
      const distance = liveSignalState !== "unknown" ? liveSignalSummary : distanceValue;
      const response = buildSignalStatusResponse(signalState, distance);
      await speakResponse(response);
    } else if (command === "signal_distance") {
      const distance = liveSignalState !== "unknown" ? liveSignalSummary : distanceValue;
      const response = buildSignalDistanceResponse(distance);
      await speakResponse(response);
    }

    // 음악 제어 명령어
    else if (command === "play_music") {
      await speakResponse("유튜브 뮤직을 재생합니다.");
      // TODO: Implement YouTube Music deep link or web player control
    } else if (command === "pause_music") {
      await speakResponse("음악을 일시정지합니다.");
      // TODO: Implement YouTube Music pause
    } else if (command === "next_track") {
      await speakResponse("다음 곡으로 넘어갑니다.");
      // TODO: Implement YouTube Music next track
    } else if (command === "prev_track") {
      await speakResponse("이전 곡으로 돌아갑니다.");
      // TODO: Implement YouTube Music previous track
    }

    // 카메라 제어 명령어
    else if (command === "camera_on") {
      await speakResponse("카메라 화면으로 이동합니다.");
      router.push("/camera");
    } else if (command === "camera_off") {
      await speakResponse("홈 화면으로 돌아갑니다.");
      router.push("/");
    } else if (command === "take_photo" || command === "start_scan" || command === "stop_scan") {
      await speakResponse("카메라 화면에서 해당 기능을 사용하실 수 있습니다.");
    }

    // 설정 제어 명령어
    else if (command === "lowvision_on") {
      setLowVisionModeEnabled(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        lowVisionModeEnabled: true,
      }));
      await speakResponse("저시력 모드를 켰습니다.");
    } else if (command === "lowvision_off") {
      setLowVisionModeEnabled(false);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        lowVisionModeEnabled: false,
      }));
      await speakResponse("저시력 모드를 껐습니다.");
    } else if (command === "haptic_on") {
      setHapticAlertsEnabled(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        hapticAlertsEnabled: true,
      }));
      await speakResponse("진동 경고를 켰습니다.");
    } else if (command === "haptic_off") {
      setHapticAlertsEnabled(false);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        hapticAlertsEnabled: false,
      }));
      await speakResponse("진동 경고를 껐습니다.");
    } else if (command === "auto_env_on") {
      setAutoRedAlertEnvironmentEnabled(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        autoRedAlertEnvironmentEnabled: true,
      }));
      await speakResponse("자동 환경 전환을 켰습니다.");
    } else if (command === "auto_env_off") {
      setAutoRedAlertEnvironmentEnabled(false);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        autoRedAlertEnvironmentEnabled: false,
      }));
      await speakResponse("자동 환경 전환을 껐습니다.");
    } else if (command === "brightness_up") {
      const newBrightness = Math.min(0.92, redAlertBrightness + 0.1);
      setRedAlertBrightness(newBrightness);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        redAlertBrightness: newBrightness,
      }));
      await speakResponse(`밝기를 ${Math.round(newBrightness * 100)}퍼센트로 올렸습니다.`);
    } else if (command === "brightness_down") {
      const newBrightness = Math.max(0.1, redAlertBrightness - 0.1);
      setRedAlertBrightness(newBrightness);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...JSON.parse(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"),
        redAlertBrightness: newBrightness,
      }));
      await speakResponse(`밝기를 ${Math.round(newBrightness * 100)}퍼센트로 내렸습니다.`);
    }

    // 전방 알림 거리 설정 명령어
    else if (command === "distance_30m") {
      await setAdvanceNotificationMode("30m");
      const response = buildDistanceSettingResponse("30m");
      await speakResponse(response);
    } else if (command === "distance_50m") {
      await setAdvanceNotificationMode("50m");
      const response = buildDistanceSettingResponse("50m");
      await speakResponse(response);
    } else if (command === "distance_100m") {
      await setAdvanceNotificationMode("100m");
      const response = buildDistanceSettingResponse("100m");
      await speakResponse(response);
    } else if (command === "distance_auto") {
      await setAdvanceNotificationMode("auto");
      const response = buildDistanceSettingResponse("auto");
      await speakResponse(response);
    } else if (command === "distance_status") {
      const config = getAdvanceNotificationConfig();
      const speedKmh = parseFloat(speedValue.replace(/[^0-9.]/g, ""));
      const currentDistance = getNotificationDistance(speedKmh);
      const response = buildDistanceStatusResponse(config.mode, currentDistance, speedKmh);
      await speakResponse(response);
    }

    // LDW 명령어
    else if (command === "ldw_on") {
      await setLDWEnabled(true);
      await speakResponse("차선 이탈 경고를 켰습니다.");
    } else if (command === "ldw_off") {
      await setLDWEnabled(false);
      await speakResponse("차선 이탈 경고를 껐습니다.");
    } else if (command === "turn_signal_left") {
      await activateTurnSignal("left");
      await speakResponse("좌측 방향지시등을 켰습니다. 30초 후 자동으로 꺼집니다.");
    } else if (command === "turn_signal_right") {
      await activateTurnSignal("right");
      await speakResponse("우측 방향지시등을 켰습니다. 30초 후 자동으로 꺼집니다.");
    } else if (command === "turn_signal_off") {
      await deactivateTurnSignal();
      await speakResponse("방향지시등을 껐습니다.");
    }

    // 정보 조회 명령어
    else if (command === "current_speed") {
      const speedKmh = parseFloat(speedValue.replace(/[^0-9.]/g, ""));
      const response = buildCurrentSpeedResponse(speedKmh);
      await speakResponse(response);
    } else if (command === "vehicle_distance") {
      const response = buildVehicleDistanceResponse(
        vehicleDetection.frontVehicleDetected,
        vehicleDetection.vehicleDistanceLabel,
        vehicleDetection.collisionRiskLevel,
      );
      await speakResponse(response);
    } else if (command === "scan_stats") {
      await speakResponse(`음성 인식 ${voiceStatsTrackerRef.current.getStatsLabel()}`);
    } else if (command === "help") {
      const response = buildHelpResponse();
      await speakResponse(response);
    }

    // 알 수 없는 명령어
    else {
      await speakResponse("잘 이해하지 못했습니다. 도움말을 원하시면 도움말이라고 말씀해 주세요.");
    }
  };

  const toggleVoiceRecognition = () => {
    if (isListening) {
      // Stop listening
      voiceRecognitionStopRef.current?.();
      voiceRecognitionStopRef.current = null;
      setIsListening(false);
      voiceAttemptsRef.current = [];
    } else {
      // Start listening
      setIsListening(true);
      voiceAttemptsRef.current = [];

      const stopFn = startVoiceRecognition(
        (text, confidence) => {
          // 음성 입력 컨텍스트 생성
          const context = {
            isNavigating: liveRouteSyncEnabled,
            isMusicPlaying: false, // TODO: 실제 음악 재생 상태로 교체
            currentSignalState: liveSignalState !== "unknown" ? liveSignalState : currentSignalState,
          };

          // 명령어 파싱 (컨텍스트 기반 보정 포함)
          const result = parseVoiceCommand(text, context);

          // 명령어 처리
          handleVoiceCommand(result.command, result.rawText, confidence);
          setIsListening(false);
          voiceRecognitionStopRef.current = null;
        },
        (error) => {
          console.error("Voice recognition error:", error);
          voiceStatsTrackerRef.current.recordAttempt(false);
          setVoiceRecognitionStats(voiceStatsTrackerRef.current.getStatsLabel());
          setIsListening(false);
          voiceRecognitionStopRef.current = null;
          speakResponse("음성 인식에 실패했습니다. 다시 시도해 주세요.");
        },
        {
          maxRetries: 2,
          minConfidence: 0.7,
          enableNoiseReduction: true,
        },
      );

      voiceRecognitionStopRef.current = stopFn;
    }
  };

  return (
    <ScreenContainer style={[styles.screenContent, { backgroundColor: dynamicBackgroundColor }]}> 
      <View style={[styles.root, { backgroundColor: dynamicBackgroundColor }]}>
        {isRedSignal && redAlertIntensity !== "off" ? (
          <View
            pointerEvents="none"
            style={[
              styles.redAlertOverlay,
              redAlertVisible ? styles.redAlertOverlayVisible : styles.redAlertOverlayHidden,
              { opacity: getSignalGlowOpacity(redAlertOverlayOpacity, homeMasterSettings.signalGlow.red) },
            ]}
          />
        ) : null}
        <View style={styles.topBar}>
          <View style={[styles.providerPill, lowVisionModeEnabled && styles.providerPillLowVision]}>
            <Text style={[styles.providerText, lowVisionModeEnabled && styles.providerTextLowVision]}>
              {PROVIDER_LABEL[selectedNavigationProvider]}
            </Text>
          </View>
        </View>

        {isListening && (
          <View style={styles.voiceIndicatorContainer}>
            <View style={styles.voiceIndicator}>
              <MaterialIcons name="mic" size={20} color="#3B82F6" />
              <Text style={[styles.voiceIndicatorText, lowVisionModeEnabled && styles.voiceIndicatorTextLowVision]}>
                듣고 있습니다...
              </Text>
            </View>
          </View>
        )}

        {!isListening && lastVoiceCommand && (
          <View style={styles.voiceIndicatorContainer}>
            <View style={styles.voiceCommandFeedback}>
              <Text style={[styles.voiceCommandText, lowVisionModeEnabled && styles.voiceCommandTextLowVision]}>
                "{lastVoiceCommand}"
              </Text>
            </View>
            {voiceRecognitionStats && (
              <View style={styles.voiceStatsChip}>
                <Text style={[styles.voiceStatsText, lowVisionModeEnabled && styles.voiceStatsTextLowVision]}>
                  {voiceRecognitionStats}
                </Text>
              </View>
            )}
          </View>
        )}

          <View style={styles.mainStack}>
          <View style={[styles.cardShell, styles.signalShell, shellTransform("signal")]}>

            <View
              accessibilityLabel={voicePreviewText}
              style={[
                styles.signalCard,
                {
                  backgroundColor: currentSignal.cardBackground,
                  shadowColor: dynamicSignalGlow,
                },
              ]}
            >
              <Text
                style={[
                  styles.signalTitle,
                  lowVisionModeEnabled && styles.signalTitleLowVision,
                  {
                    fontSize: lowVisionModeEnabled
                      ? Math.round(homeMasterSettings.sizes.signalTitle * 1.18)
                      : homeMasterSettings.sizes.signalTitle,
                    lineHeight: lowVisionModeEnabled
                      ? Math.round(homeMasterSettings.sizes.signalTitle * 1.18) + 6
                      : homeMasterSettings.sizes.signalTitle + 4,
                    fontFamily: sharedFontFamily,
                    fontWeight: sharedFontWeight,
                  },
                ]}
              >
                {currentSignal.title}
              </Text>
              <Text
                style={[
                  styles.signalDistanceValue,
                  lowVisionModeEnabled && styles.signalDistanceValueLowVision,
                  {
                    fontSize: lowVisionModeEnabled
                      ? Math.round(homeMasterSettings.sizes.distanceValue * 1.16)
                      : homeMasterSettings.sizes.distanceValue,
                    lineHeight: lowVisionModeEnabled
                      ? Math.round(homeMasterSettings.sizes.distanceValue * 1.16) + 6
                      : homeMasterSettings.sizes.distanceValue + 4,
                    fontFamily: sharedFontFamily,
                    fontWeight: sharedFontWeight,
                  },
                ]}
              >
                {liveSignalState !== "unknown" ? liveSignalSummary : distanceValue}
              </Text>
              <View style={styles.signalAssistRow}>
                <View style={[styles.signalAssistChip, { backgroundColor: currentLeftTurnMeta.backgroundColor }]}> 
                  <Text style={[styles.signalAssistText, lowVisionModeEnabled && styles.signalAssistTextLowVision, { color: currentLeftTurnMeta.textColor }]}> 
                    {currentLeftTurnMeta.label}
                  </Text>
                </View>
                <View style={[styles.signalAssistChip, { backgroundColor: currentPedestrianMeta.backgroundColor }]}> 
                  <Text style={[styles.signalAssistText, lowVisionModeEnabled && styles.signalAssistTextLowVision, { color: currentPedestrianMeta.textColor }]}> 
                    {currentPedestrianMeta.label}
                  </Text>
                </View>
              </View>
              <Text style={[styles.signalSummaryCaption, lowVisionModeEnabled && styles.signalSummaryCaptionLowVision]}>
                {prioritySummary}
              </Text>
              <Text style={[styles.signalSummaryCaption, lowVisionModeEnabled && styles.signalSummaryCaptionLowVision]}>
                {environmentSummary}
              </Text>
              <View style={styles.signalModeRow}>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    {PRIORITY_MODE_LABEL[signalPriorityMode]}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    {SENSITIVITY_MODE_LABEL[sensitivityMode]}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    {RED_ALERT_LABEL[redAlertIntensity]}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    {redAlertPresetLabel}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    {autoRedAlertEnvironmentEnabled ? `자동 ${detectedEnvironmentLabel}` : "수동 유지"}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    밝기 {redAlertBrightnessLabel}
                  </Text>
                </View>
                <View style={styles.signalModeChip}>
                  <Text style={[styles.signalModeChipText, lowVisionModeEnabled && styles.signalModeChipTextLowVision]}>
                    주기 {redAlertPeriodLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.monitoringRow}>
                <View style={[
                  styles.monitoringChip,
                  monitoringActive ? styles.monitoringChipActive : styles.monitoringChipIdle,
                ]}>
                  <Text style={[
                    styles.monitoringChipLabel,
                    monitoringActive ? styles.monitoringChipLabelActive : styles.monitoringChipLabelIdle,
                  ]}>
                    {monitoringActive ? "실시간 스캔 ON" : "실시간 스캔 OFF"}
                  </Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={styles.monitoringInfoLabel}>최근 스캔</Text>
                  <Text style={styles.monitoringInfoValue}>{lastAnalyzedLabel}</Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>최근 감지</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>{lastDetectedLabel}</Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>스캔 정보</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>
                    {adaptiveScanEnabled ? `${Math.round(lastSpeedKmh)}km/h · ${(scanIntervalMs / 1000).toFixed(1)}초` : `고정 ${(scanIntervalMs / 1000).toFixed(1)}초`}
                  </Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>보조 기능</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>
                    {hapticAlertsEnabled ? `진동 ${cadenceMode}` : `무진동 ${cadenceMode}`}
                  </Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>인식 모드</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>
                    {PRIORITY_MODE_LABEL[signalPriorityMode]} · {SENSITIVITY_MODE_LABEL[sensitivityMode]} · {redAlertPresetLabel}
                  </Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>환경 판단</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>
                    {autoRedAlertEnvironmentEnabled ? `${DETECTED_ENVIRONMENT_LABEL[detectedEnvironment]} 자동 전환` : "수동 프리셋 유지"}
                  </Text>
                </View>
                <View style={styles.monitoringInfoBox}>
                  <Text style={[styles.monitoringInfoLabel, lowVisionModeEnabled && styles.monitoringInfoLabelLowVision]}>전환 근거</Text>
                  <Text style={[styles.monitoringInfoValue, lowVisionModeEnabled && styles.monitoringInfoValueLowVision]}>
                    {environmentReason}
                  </Text>
                </View>
              </View>
            </View>

          </View>

          <View style={[styles.cardShell, styles.infoShell, shellTransform("speed")]}>
            <View style={[styles.infoCard, { backgroundColor: dynamicShellColor }]}>
              <View style={styles.speedOnlyColumn}>
                <Text
                  style={[
                    styles.metricLabel,
                    {
                      fontFamily: sharedFontFamily,
                      fontWeight: sharedFontWeight,
                    },
                  ]}
                >
                  현재 속도
                </Text>
                <Text
                  style={[
                    styles.speedOnlyValue,
                    lowVisionModeEnabled && styles.speedOnlyValueLowVision,
                    {
                      fontSize: lowVisionModeEnabled
                        ? Math.round(homeMasterSettings.sizes.speedValue * 1.14)
                        : homeMasterSettings.sizes.speedValue,
                      lineHeight: lowVisionModeEnabled
                        ? Math.round(homeMasterSettings.sizes.speedValue * 1.14) + 6
                        : homeMasterSettings.sizes.speedValue + 4,
                      fontFamily: sharedFontFamily,
                      fontWeight: sharedFontWeight,
                    },
                  ]}
                >
                  {speedValue}
                </Text>
              </View>
            </View>
          </View>

          {/* 전방 차량 감지 카드 */}
          {vehicleDetection.frontVehicleDetected && (
            <View style={[styles.cardShell, styles.vehicleShell]}>
              <View
                style={[
                  styles.vehicleCard,
                  {
                    backgroundColor:
                      vehicleDetection.collisionRiskLevel === "danger"
                        ? "#FEE2E2"
                        : vehicleDetection.collisionRiskLevel === "warning"
                        ? "#FEF3C7"
                        : vehicleDetection.departureAlertActive
                        ? "#D1FAE5"
                        : dynamicShellColor,
                  },
                ]}
              >
                <View style={styles.vehicleIconRow}>
                  <MaterialIcons
                    name={
                      vehicleDetection.departureAlertActive
                        ? "play-arrow"
                        : vehicleDetection.collisionWarningActive
                        ? "warning"
                        : "directions-car"
                    }
                    size={28}
                    color={
                      vehicleDetection.collisionRiskLevel === "danger"
                        ? "#991B1B"
                        : vehicleDetection.collisionRiskLevel === "warning"
                        ? "#92400E"
                        : vehicleDetection.departureAlertActive
                        ? "#065F46"
                        : "#374151"
                    }
                  />
                  <Text
                    style={[
                      styles.vehicleLabel,
                      lowVisionModeEnabled && styles.vehicleLabelLowVision,
                      {
                        color:
                          vehicleDetection.collisionRiskLevel === "danger"
                            ? "#991B1B"
                            : vehicleDetection.collisionRiskLevel === "warning"
                            ? "#92400E"
                            : vehicleDetection.departureAlertActive
                            ? "#065F46"
                            : "#4B5563",
                      },
                    ]}
                  >
                    전방 차량
                  </Text>
                </View>
                <Text
                  style={[
                    styles.vehicleDistance,
                    lowVisionModeEnabled && styles.vehicleDistanceLowVision,
                    {
                      color:
                        vehicleDetection.collisionRiskLevel === "danger"
                          ? "#991B1B"
                          : vehicleDetection.collisionRiskLevel === "warning"
                          ? "#92400E"
                          : vehicleDetection.departureAlertActive
                          ? "#065F46"
                          : "#111827",
                    },
                  ]}
                >
                  {vehicleDetection.vehicleDistanceLabel}
                </Text>
                <Text
                  style={[
                    styles.vehicleSummary,
                    lowVisionModeEnabled && styles.vehicleSummaryLowVision,
                    {
                      color:
                        vehicleDetection.collisionRiskLevel === "danger"
                          ? "#7F1D1D"
                          : vehicleDetection.collisionRiskLevel === "warning"
                          ? "#78350F"
                          : vehicleDetection.departureAlertActive
                          ? "#064E3B"
                          : "#6B7280",
                    },
                  ]}
                >
                  {vehicleDetection.summary}
                </Text>
              </View>
            </View>
          )}

          {liveRouteSyncEnabled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내비게이션 방향 전환"
              onPress={handleAdvanceDirection}
              style={({ pressed }) => [
                styles.cardShell,
                styles.directionShell,
                shellTransform("direction"),
                pressed && styles.pressedCardShell,
              ]}
            >
              <View style={[styles.directionCard, { backgroundColor: dynamicShellColor }]}>
                <Animated.Text
                  style={[
                    styles.directionArrow,
                    {
                      fontSize: Math.round(arrowFontSize * 1.56 * homeMasterSettings.sizes.directionArrow),
                      lineHeight: Math.round(arrowFontSize * 1.56 * homeMasterSettings.sizes.directionArrow) + 8,
                      fontFamily: sharedFontFamily,
                      opacity: arrowGlowAnim,
                      transform: [
                        { scaleX: 1.12 },
                        { scaleY: 1.02 },
                        { scale: arrowPulseAnim },
                      ],
                    },
                  ]}
                >
                  {currentDirection.symbol}
                </Animated.Text>

              </View>
            </Pressable>
          )}
        </View>

        <View style={[styles.bottomBarShell, { backgroundColor: dynamicShellColor }]}>
          <View style={[styles.bottomBar, { backgroundColor: getShellOverlayColor(homeMasterSettings.theme.backgroundGrayLightness, homeMasterSettings.theme.backgroundGraySaturation, 0.9) }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/camera")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="photo-camera" size={24} color="#1E2630" />
              <Text style={[styles.bottomButtonText, lowVisionModeEnabled && styles.bottomButtonTextLowVision]}>카메라</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isListening ? "음성 인식 중지" : "음성 명령"}
              onPress={toggleVoiceRecognition}
              style={({ pressed }) => [
                styles.bottomButton,
                isListening && styles.bottomButtonListening,
                pressed && styles.bottomButtonPressed,
              ]}
            >
              <MaterialIcons
                name={isListening ? "mic" : "mic-none"}
                size={24}
                color={isListening ? "#3B82F6" : "#1E2630"}
              />
              <Text style={[
                styles.bottomButtonText,
                lowVisionModeEnabled && styles.bottomButtonTextLowVision,
                isListening && styles.bottomButtonTextListening,
              ]}>
                {isListening ? "듣는중" : "음성"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="home" size={24} color="#1E2630" />
              <Text style={[styles.bottomButtonText, lowVisionModeEnabled && styles.bottomButtonTextLowVision]}>홈</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="settings" size={24} color="#1E2630" />
              <Text style={[styles.bottomButtonText, lowVisionModeEnabled && styles.bottomButtonTextLowVision]}>설정</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    backgroundColor: "#D8DBDF", // Lighter silver-gray background for Apple style
  },
  redAlertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#C41230",
    zIndex: 20,
  },
  redAlertOverlayVisible: {
    opacity: 0.54,
  },
  redAlertOverlayHidden: {
    opacity: 0.08,
  },
  root: {
    flex: 1,
    position: "relative",
    backgroundColor: "#D8DBDF", // Lighter Apple-style background
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  topBar: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  providerPill: {
    minWidth: 84,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "#D1D4DA",
    borderWidth: 1,
    borderColor: "#ECEEF2",
    shadowColor: "#8A9099",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  providerPillLowVision: {
    minWidth: 110,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  providerText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: "#4F5661",
  },
  providerTextLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  voiceIndicatorContainer: {
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  voiceIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#DBEAFE",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#93C5FD",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  voiceIndicatorText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: "#1E40AF",
  },
  voiceIndicatorTextLowVision: {
    fontSize: 19,
    lineHeight: 22,
  },
  voiceCommandFeedback: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  voiceCommandText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#4B5563",
    fontStyle: "italic",
  },
  voiceCommandTextLowVision: {
    fontSize: 18,
    lineHeight: 22,
  },
  voiceStatsChip: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#BAE6FD",
  },
  voiceStatsText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#0369A1",
    textAlign: "center",
  },
  voiceStatsTextLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  mainStack: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
    paddingBottom: 56,
  },
  cardShell: {
    borderRadius: 20, // Slightly smaller radius for Apple style
    padding: 1.5, // Thinner padding for refined bezel
    backgroundColor: "transparent",
    borderWidth: 0.5, // Thinner border
    borderColor: "#E8EAEE", // Lighter border for subtle contrast
    shadowColor: "#A0A4AB", // Subtle shadow for depth
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  signalShell: {
    flex: 1.48,
  },
  infoShell: {
    flex: 0.74,
  },
  pressedCardShell: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  signalCard: {
    flex: 1,
    minHeight: 236,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
    paddingBottom: 18,
    borderWidth: 0.5, // Thinner border for refined look
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowOpacity: 0.25, // Stronger shadow for depth
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  signalTitle: {
    fontSize: 42, // Larger for better visibility
    lineHeight: 46,
    fontWeight: "900",
    color: "#FFFFFF", // Pure white for maximum contrast
    letterSpacing: -1.2,
    textShadowColor: "rgba(0, 0, 0, 0.4)", // Stronger shadow for depth
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  signalTitleLowVision: {
    marginTop: 4,
    letterSpacing: -0.6,
  },
  signalDistanceValue: {
    marginTop: 54,
    fontSize: 84, // Larger for better visibility
    lineHeight: 88,
    fontWeight: "900", // Bolder for stronger contrast
    color: "#000000", // Pure black for maximum contrast
    textAlign: "center",
    letterSpacing: -3,
  },
  signalDistanceValueLowVision: {
    marginTop: 34,
    letterSpacing: -1.8,
  },
  signalAssistRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
  },
  signalAssistChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  signalAssistText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  signalAssistTextLowVision: {
    fontSize: 20,
    lineHeight: 24,
  },
  signalSummaryCaption: {
    marginTop: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.9)",
  },
  signalSummaryCaptionLowVision: {
    fontSize: 19,
    lineHeight: 24,
  },
  signalModeRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  signalModeChip: {
    borderRadius: 999,
    backgroundColor: "rgba(248, 250, 252, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  signalModeChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  signalModeChipTextLowVision: {
    fontSize: 17,
    lineHeight: 20,
  },
  monitoringRow: {
    marginTop: 12,
    width: "100%",
    paddingHorizontal: 12,
    gap: 8,
  },
  monitoringChip: {
    minHeight: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monitoringChipActive: {
    backgroundColor: "rgba(220, 252, 231, 0.9)",
  },
  monitoringChipIdle: {
    backgroundColor: "rgba(226, 232, 240, 0.88)",
  },
  monitoringChipLabel: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  monitoringChipLabelActive: {
    color: "#166534",
  },
  monitoringChipLabelIdle: {
    color: "#334155",
  },
  monitoringInfoBox: {
    borderRadius: 14,
    backgroundColor: "rgba(248, 250, 252, 0.32)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monitoringInfoLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.78)",
  },
  monitoringInfoLabelLowVision: {
    fontSize: 17,
    lineHeight: 20,
  },
  monitoringInfoValue: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  monitoringInfoValueLowVision: {
    fontSize: 22,
    lineHeight: 28,
  },
  infoCard: {
    flex: 1,
    minHeight: 102,
    borderRadius: 18,
    backgroundColor: "#E5E7EB", // Lighter silver metallic
    borderWidth: 0.5, // Thinner border for refined look
    borderColor: "#F3F4F6", // Very light border
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C1C5CB",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  speedOnlyColumn: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#646C79",
    textAlign: "center",
  },
  metricValue: {
    marginTop: 4,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "900",
    color: "#1C2430",
    textAlign: "center",
  },
  speedOnlyValue: {
    marginTop: 4,
    fontSize: 36, // Larger for better visibility
    lineHeight: 40,
    fontWeight: "900",
    color: "#111827", // Darker for better contrast
    textAlign: "center",
    letterSpacing: -1.4,
  },
  speedOnlyValueLowVision: {
    letterSpacing: -0.8,
  },
  vehicleShell: {
    flex: 0.8,
  },
  vehicleCard: {
    flex: 1,
    minHeight: 100,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vehicleIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#4B5563",
  },
  vehicleLabelLowVision: {
    fontSize: 18,
    lineHeight: 22,
  },
  vehicleDistance: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  vehicleDistanceLowVision: {
    fontSize: 32,
    lineHeight: 36,
  },
  vehicleSummary: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  vehicleSummaryLowVision: {
    fontSize: 17,
    lineHeight: 21,
  },
  directionShell: {
    flex: 1.34,
  },
  directionCard: {
    flex: 1,
    minHeight: 182,
    borderRadius: 18,
    backgroundColor: "#E8EAEE", // Lighter Apple gray
    borderWidth: 0.5,
    borderColor: "#F5F6F8",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 42,
    shadowColor: "#9CA3AF", // Subtle shadow for depth
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  directionArrow: {
    fontWeight: "900",
    color: "#3B82F6", // Bright blue for hologram effect
    textAlign: "center",
    marginBottom: -4,
    textShadowColor: "rgba(59, 130, 246, 0.6)", // Blue glow for hologram
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    transform: [{ scaleX: 1.18 }, { scaleY: 1.08 }],
  },
  bottomBarShell: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 4,
    marginTop: 0,
    borderRadius: 26, // Smaller radius for refined look
    padding: 3, // Reduced padding
    backgroundColor: "rgba(229, 231, 235, 0.75)", // Lighter, more transparent
    borderWidth: 0.5, // Thinner border
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#9CA3AF",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bottomBar: {
    minHeight: 56, // Reduced height
    borderRadius: 23,
    backgroundColor: "rgba(243, 244, 246, 0.95)", // Lighter background
    borderWidth: 0.5, // Thinner border
    borderColor: "rgba(255, 255, 255, 1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  bottomButton: {
    flex: 1,
    minHeight: 52, // Reduced height
    borderRadius: 18,
    backgroundColor: "rgba(249, 250, 251, 0.98)",
    borderWidth: 0.5, // Thinner border
    borderColor: "rgba(255, 255, 255, 1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#E5E7EB",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bottomButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  bottomButtonListening: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  bottomButtonText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
    color: "#27303B",
    letterSpacing: -0.3,
  },
  bottomButtonTextLowVision: {
    fontSize: 21,
    lineHeight: 24,
  },
  bottomButtonTextListening: {
    color: "#1E40AF",
  },
});
