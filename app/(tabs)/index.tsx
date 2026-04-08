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
  large: 112,
  xlarge: 126,
  huge: 140,
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
    cardBackground: "#FF8F8A",
    glow: "rgba(255, 107, 107, 0.24)",
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
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!liveRouteSyncEnabled) {
      return;
    }

    const interval = setInterval(() => {
      setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
    }, 2600);

    return () => clearInterval(interval);
  }, [liveRouteSyncEnabled]);

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
            const routePoint = GPS_ROUTE_POINTS[routeIndexRef.current % GPS_ROUTE_POINTS.length];
            routeIndexRef.current += 1;

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

  const currentSignal = useMemo(() => SIGNAL_META[SIGNAL_SEQUENCE[signalIndex]], [signalIndex]);
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
        <View style={styles.topBar}>
          <View style={styles.providerPill}>
            <Text style={styles.providerText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
          </View>
        </View>

        <View style={styles.mainStack}>
          <View style={styles.cardShell}>
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
              <Text style={styles.signalLabel}>{currentSignal.label}</Text>
            </View>
          </View>

          <View style={styles.cardShell}>
            <View style={styles.infoCard}>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>남은 거리</Text>
                <Text style={styles.metricValue}>{distanceValue}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>현재 속도</Text>
                <Text style={styles.metricValue}>{speedValue}</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내비게이션 방향 전환"
            onPress={handleAdvanceDirection}
            style={({ pressed }) => [styles.cardShell, pressed && styles.pressedCardShell]}
          >
            <View style={styles.directionCard}>
              <Text style={[styles.directionArrow, { fontSize: arrowFontSize, lineHeight: arrowFontSize + 6 }]}>
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
              <MaterialIcons name="photo-camera" size={18} color="#1F2937" />
              <Text style={styles.bottomButtonText}>카메라</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="home" size={18} color="#1F2937" />
              <Text style={styles.bottomButtonText}>홈</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
            >
              <MaterialIcons name="settings" size={18} color="#1F2937" />
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
    backgroundColor: "#BFC3C9",
  },
  root: {
    flex: 1,
    backgroundColor: "#BFC3C9",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  topBar: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  providerPill: {
    minWidth: 84,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "#D8DBE0",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#8D929B",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  providerText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: "#49515D",
  },
  mainStack: {
    flex: 1,
    gap: 10,
    paddingTop: 6,
  },
  cardShell: {
    borderRadius: 22,
    padding: 2,
    backgroundColor: "#AEB3BB",
    borderWidth: 1,
    borderColor: "#E6E9EE",
    shadowColor: "#8C929A",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressedCardShell: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  signalCard: {
    minHeight: 180,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  signalTitle: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "900",
    color: "#F7FAFC",
    textShadowColor: "rgba(95, 103, 112, 0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  signalLabel: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#F7FAFC",
    textShadowColor: "rgba(95, 103, 112, 0.32)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoCard: {
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: "#D4D7DD",
    flexDirection: "row",
    alignItems: "center",
  },
  metricColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  metricDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#B5BBC4",
    marginVertical: 18,
  },
  metricLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: "#5A6270",
    textAlign: "center",
  },
  metricValue: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#161C27",
    textAlign: "center",
  },
  directionCard: {
    minHeight: 168,
    borderRadius: 20,
    backgroundColor: "#D4D7DD",
    alignItems: "center",
    justifyContent: "center",
  },
  directionArrow: {
    fontWeight: "900",
    color: "#343C49",
    textAlign: "center",
  },
  directionLabel: {
    marginTop: -6,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#202733",
    textAlign: "center",
  },
  bottomBarShell: {
    marginTop: 10,
    borderRadius: 18,
    padding: 2,
    backgroundColor: "#AEB3BB",
    borderWidth: 1,
    borderColor: "#E6E9EE",
    shadowColor: "#8C929A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bottomBar: {
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "#D4D7DD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    gap: 8,
  },
  bottomButton: {
    flex: 1,
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: "#E6E9EE",
    borderWidth: 1,
    borderColor: "#F4F6F8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  bottomButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    color: "#1F2937",
  },
});
