import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
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
  type LeftTurnSignalState,
  type PedestrianSignalState,
  type TrafficSignalState,
} from "@/lib/traffic-signal-store";

type SignalState = "red" | "yellow" | "green";
type LiveSignalState = TrafficSignalState;
type DirectionState = "left" | "straight" | "right" | "uturn";
type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";

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
  const [monitoringActive, setMonitoringActive] = useState(initialDetection.monitoringActive);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(initialDetection.lastAnalyzedAt);
  const [lastDetectedAt, setLastDetectedAt] = useState(initialDetection.detectedAt);
  const [scanIntervalMs, setScanIntervalMs] = useState(initialDetection.scanIntervalMs);
  const [lastSpeedKmh, setLastSpeedKmh] = useState(initialDetection.lastSpeedKmh);
  const [cadenceMode, setCadenceMode] = useState(initialDetection.cadenceMode);
  const [homeMasterSettings, setHomeMasterSettings] = useState<HomeMasterSettings>(DEFAULT_HOME_MASTER_SETTINGS);
  const routeIndexRef = useRef(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

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
      setMonitoringActive(detection.monitoringActive);
      setLastAnalyzedAt(detection.lastAnalyzedAt);
      setLastDetectedAt(detection.detectedAt);
      setScanIntervalMs(detection.scanIntervalMs);
      setLastSpeedKmh(detection.lastSpeedKmh);
      setCadenceMode(detection.cadenceMode);
    });

    loadTrafficSignalDetection().catch((error) => {
      console.error("Failed to hydrate traffic signal detection", error);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const nextSignalState = liveSignalState !== "unknown" ? liveSignalState : SIGNAL_SEQUENCE[signalIndex];
    const isRedSignal = nextSignalState === "red";

    if (!isRedSignal) {
      setRedAlertVisible(false);
      return;
    }

    setRedAlertVisible(true);
    const interval = setInterval(() => {
      setRedAlertVisible((prev) => !prev);
    }, 260);

    return () => clearInterval(interval);
  }, [liveSignalState, signalIndex]);

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

  return (
    <ScreenContainer style={[styles.screenContent, { backgroundColor: dynamicBackgroundColor }]}> 
      <View style={[styles.root, { backgroundColor: dynamicBackgroundColor }]}>
        {isRedSignal ? (
          <View
            pointerEvents="none"
            style={[
              styles.redAlertOverlay,
              redAlertVisible ? styles.redAlertOverlayVisible : styles.redAlertOverlayHidden,
              { opacity: redAlertVisible ? getSignalGlowOpacity(0.54, homeMasterSettings.signalGlow.red) : 0.08 },
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
              <Text
                style={[
                  styles.directionArrow,
                  {
                    fontSize: Math.round(arrowFontSize * 1.56 * homeMasterSettings.sizes.directionArrow),
                    lineHeight: Math.round(arrowFontSize * 1.56 * homeMasterSettings.sizes.directionArrow) + 8,
                    fontFamily: sharedFontFamily,
                    textShadowColor: "rgba(255,255,255,0.28)",
                    transform: [{ scaleX: 1.12 }, { scaleY: 1.02 }],
                  },
                ]}
              >
                {currentDirection.symbol}
              </Text>

            </View>
          </Pressable>
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
    backgroundColor: "#B7BBC2",
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
    backgroundColor: "#B7BBC2",
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 4,
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
  mainStack: {
    flex: 1,
    gap: 8,
    paddingTop: 4,
    paddingBottom: 56,
  },
  cardShell: {
    borderRadius: 22,
    padding: 2,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E8ED",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 244, 0.9)",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  signalTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#F6F8FA",
    letterSpacing: -1,
    textShadowColor: "rgba(103, 109, 118, 0.32)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  signalTitleLowVision: {
    marginTop: 4,
    letterSpacing: -0.6,
  },
  signalDistanceValue: {
    marginTop: 54,
    fontSize: 74,
    lineHeight: 78,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    letterSpacing: -2.6,
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
    borderRadius: 20,
    backgroundColor: "#D0D3D9",
    borderWidth: 1,
    borderColor: "#ECEEF2",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#1C2430",
    textAlign: "center",
    letterSpacing: -1.2,
  },
  speedOnlyValueLowVision: {
    letterSpacing: -0.8,
  },
  directionShell: {
    flex: 1.34,
  },
  directionCard: {
    flex: 1,
    minHeight: 182,
    borderRadius: 20,
    backgroundColor: "#D0D3D9",
    borderWidth: 1,
    borderColor: "#ECEEF2",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 42,
    shadowColor: "#F8FAFC",
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -1 },
  },
  directionArrow: {
    fontWeight: "900",
    color: "#DCE2EA",
    textAlign: "center",
    marginBottom: -4,
    textShadowColor: "rgba(76, 85, 99, 0.45)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4,
    transform: [{ scaleX: 1.18 }, { scaleY: 1.08 }],
  },
  bottomBarShell: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 4,
    marginTop: 0,
    borderRadius: 30,
    padding: 4,
    backgroundColor: "rgba(187, 193, 202, 0.58)",
    borderWidth: 1.2,
    borderColor: "rgba(250, 252, 255, 0.98)",
    shadowColor: "#8D95A0",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bottomBar: {
    minHeight: 64,
    borderRadius: 26,
    backgroundColor: "rgba(229, 234, 240, 0.9)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.99)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 10,
  },
  bottomButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: "rgba(241, 244, 248, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -1 },
  },
  bottomButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
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
});
