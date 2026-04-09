import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  DEFAULT_VOICE_ALERT_SETTINGS,
  buildVoiceAlertText,
  type VoiceAlertLength,
  type VoiceAlertStyle,
} from "@/lib/voice-alerts";

type SignalState = "red" | "yellow" | "green";
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

export default function HomeScreen() {
  const [signalIndex, setSignalIndex] = useState(0);
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
  const [distanceValue, setDistanceValue] = useState(GPS_ROUTE_POINTS[0].signalDistanceLabel);
  const [speedValue, setSpeedValue] = useState(GPS_ROUTE_POINTS[0].fallbackSpeedLabel);
  const [redAlertVisible, setRedAlertVisible] = useState(false);
  const routeIndexRef = useRef(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const savedValue = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!savedValue) {
        return;
      }

      const parsed = JSON.parse(savedValue) as Partial<AppSettings>;
      setVoiceGuideEnabled(parsed.voiceGuideEnabled ?? DEFAULT_SETTINGS.voiceGuideEnabled);
      setVoiceAlertLength(parsed.voiceAlertLength ?? DEFAULT_SETTINGS.voiceAlertLength);
      setVoiceAlertStyle(parsed.voiceAlertStyle ?? DEFAULT_SETTINGS.voiceAlertStyle);
      setSelectedNavigationProvider(
        parsed.selectedNavigationProvider ?? DEFAULT_SETTINGS.selectedNavigationProvider,
      );
      setArrowSize(parsed.arrowSize ?? DEFAULT_SETTINGS.arrowSize);
      setLiveRouteSyncEnabled(parsed.liveRouteSyncEnabled ?? DEFAULT_SETTINGS.liveRouteSyncEnabled);
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
    const isRedSignal = SIGNAL_SEQUENCE[signalIndex] === "red";

    if (!isRedSignal) {
      setRedAlertVisible(false);
      return;
    }

    setRedAlertVisible(true);
    const interval = setInterval(() => {
      setRedAlertVisible((prev) => !prev);
    }, 260);

    return () => clearInterval(interval);
  }, [signalIndex]);

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

  const currentSignalState = SIGNAL_SEQUENCE[signalIndex];
  const currentSignal = useMemo(() => SIGNAL_META[currentSignalState], [currentSignalState]);
  const isRedSignal = currentSignalState === "red";
  const voicePreviewText = useMemo(() => {
    if (!voiceGuideEnabled) {
      return "음성 안내 꺼짐";
    }

    return buildVoiceAlertText(
      SIGNAL_SEQUENCE[signalIndex] === "green" ? "green_signal_changed" : "red_signal_ahead",
      {
        enabled: voiceGuideEnabled,
        length: voiceAlertLength,
        style: voiceAlertStyle,
      },
      { distanceMeters: GPS_ROUTE_POINTS[routeIndexRef.current % GPS_ROUTE_POINTS.length]?.signalDistanceMeters ?? 128 },
    );
  }, [signalIndex, voiceGuideEnabled, voiceAlertLength, voiceAlertStyle]);
  const currentDirection = useMemo(
    () => DIRECTION_META[DIRECTION_SEQUENCE[directionIndex] ?? "straight"],
    [directionIndex],
  );
  const arrowFontSize = ARROW_FONT_SIZE[arrowSize];

  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        {isRedSignal ? (
          <View
            pointerEvents="none"
            style={[
              styles.redAlertOverlay,
              redAlertVisible ? styles.redAlertOverlayVisible : styles.redAlertOverlayHidden,
            ]}
          />
        ) : null}
        <View style={styles.topBar}>
          <View style={styles.providerPill}>
            <Text style={styles.providerText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
          </View>
        </View>

        <View style={styles.mainStack}>
          <View style={[styles.cardShell, styles.signalShell]}>
            <View
              accessibilityLabel={voicePreviewText}
              style={[
                styles.signalCard,
                {
                  backgroundColor: currentSignal.cardBackground,
                  shadowColor: currentSignal.glow,
                },
              ]}
            >
              <Text style={styles.signalTitle}>{currentSignal.title}</Text>
              <Text style={styles.signalDistanceValue}>{distanceValue}</Text>
            </View>
          </View>

          <View style={[styles.cardShell, styles.infoShell]}>
            <View style={styles.infoCard}>
              <View style={styles.speedOnlyColumn}>
                <Text style={styles.metricLabel}>현재 속도</Text>
                <Text style={styles.speedOnlyValue}>{speedValue}</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내비게이션 방향 전환"
            onPress={handleAdvanceDirection}
            style={({ pressed }) => [styles.cardShell, styles.directionShell, pressed && styles.pressedCardShell]}
          >
            <View style={styles.directionCard}>
              <Text
                style={[
                  styles.directionArrow,
                  { fontSize: Math.round(arrowFontSize * 2.35), lineHeight: Math.round(arrowFontSize * 2.35) + 10 },
                ]}
              >
                {currentDirection.symbol}
              </Text>
              <Text style={styles.directionLabel}>{currentDirection.label}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.bottomBarShell}>
          <View style={styles.bottomBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/camera")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="photo-camera" size={24} color="#1E2630" />
              <Text style={styles.bottomButtonText}>카메라</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="home" size={24} color="#1E2630" />
              <Text style={styles.bottomButtonText}>홈</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="settings" size={24} color="#1E2630" />
              <Text style={styles.bottomButtonText}>설정</Text>
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
  providerText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: "#4F5661",
  },
  mainStack: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
    paddingBottom: 42,
  },
  cardShell: {
    borderRadius: 22,
    padding: 2,
    backgroundColor: "#A8ADB6",
    borderWidth: 1,
    borderColor: "#E5E8ED",
    shadowColor: "#7F8690",
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  signalShell: {
    flex: 1.72,
  },
  infoShell: {
    flex: 0.68,
  },
  pressedCardShell: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  signalCard: {
    flex: 1,
    minHeight: 272,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 24,
    paddingBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 244, 0.9)",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  signalTitle: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "900",
    color: "#F6F8FA",
    letterSpacing: -1,
    textShadowColor: "rgba(103, 109, 118, 0.32)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  signalDistanceValue: {
    marginTop: 74,
    fontSize: 88,
    lineHeight: 92,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    letterSpacing: -2.6,
  },
  infoCard: {
    flex: 1,
    minHeight: 110,
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
    fontSize: 17,
    lineHeight: 20,
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
    marginTop: 6,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    color: "#1C2430",
    textAlign: "center",
    letterSpacing: -1.2,
  },
  directionShell: {
    flex: 1.08,
  },
  directionCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 20,
    backgroundColor: "#D0D3D9",
    borderWidth: 1,
    borderColor: "#ECEEF2",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 10,
    shadowColor: "#F8FAFC",
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -1 },
  },
  directionArrow: {
    fontWeight: "900",
    color: "#DCE2EA",
    textAlign: "center",
    marginBottom: -18,
    textShadowColor: "rgba(76, 85, 99, 0.45)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4,
    transform: [{ scaleX: 1.18 }, { scaleY: 1.08 }],
  },
  directionLabel: {
    marginTop: -2,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    color: "#2A313D",
    textAlign: "center",
    letterSpacing: -1.2,
  },
  bottomBarShell: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 2,
    marginTop: 0,
    borderRadius: 26,
    padding: 3,
    backgroundColor: "rgba(173, 180, 191, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(244, 247, 251, 0.95)",
    shadowColor: "#7F8690",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bottomBar: {
    minHeight: 62,
    borderRadius: 23,
    backgroundColor: "rgba(224, 229, 236, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(248, 250, 252, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
  },
  bottomButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "rgba(239, 242, 246, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -1 },
  },
  bottomButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  bottomButtonText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900",
    color: "#27303B",
    letterSpacing: -0.3,
  },
});
