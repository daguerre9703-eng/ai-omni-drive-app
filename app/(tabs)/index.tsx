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
  liveRouteSyncEnabled: boolean;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  quickDestinations: string[];
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
const SIGNAL_SEQUENCE: SignalState[] = ["red", "yellow", "green"];
const DIRECTION_SEQUENCE: DirectionState[] = ["left", "straight", "right", "uturn"];

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: DEFAULT_VOICE_ALERT_SETTINGS.enabled,
  voiceAlertLength: DEFAULT_VOICE_ALERT_SETTINGS.length,
  voiceAlertStyle: DEFAULT_VOICE_ALERT_SETTINGS.style,
  liveRouteSyncEnabled: true,
  selectedNavigationProvider: "tmap",
  arrowSize: "huge",
  quickDestinations: ["집", "회사"],
};

const ARROW_FONT_SIZE: Record<ArrowSize, number> = {
  large: 96,
  xlarge: 116,
  huge: 138,
};

const PROVIDER_LABEL: Record<NavigationProvider, string> = {
  kakaomap: "카카오맵 연동",
  inavi: "아이나비 연동",
  tmap: "티맵 연동",
};

const GPS_ROUTE_POINTS: RoutePoint[] = [
  {
    latitude: 37.5665,
    longitude: 126.978,
    signalDistanceMeters: 128,
    signalDistanceLabel: "128m",
    fallbackSpeedLabel: "18 km/h",
    direction: "left",
  },
  {
    latitude: 37.5669,
    longitude: 126.9787,
    signalDistanceMeters: 102,
    signalDistanceLabel: "102m",
    fallbackSpeedLabel: "24 km/h",
    direction: "straight",
  },
  {
    latitude: 37.5672,
    longitude: 126.9796,
    signalDistanceMeters: 76,
    signalDistanceLabel: "76m",
    fallbackSpeedLabel: "31 km/h",
    direction: "right",
  },
  {
    latitude: 37.567,
    longitude: 126.9803,
    signalDistanceMeters: 40,
    signalDistanceLabel: "40m",
    fallbackSpeedLabel: "12 km/h",
    direction: "uturn",
  },
];

const SIGNAL_META: Record<
  SignalState,
  {
    title: string;
    label: string;
    backgroundColor: string;
  }
> = {
  red: {
    title: "STOP",
    label: "정지",
    backgroundColor: "#FF4B2B",
  },
  yellow: {
    title: "SLOW",
    label: "주의",
    backgroundColor: "#FDC830",
  },
  green: {
    title: "GO",
    label: "진행",
    backgroundColor: "#80ff72",
  },
};

const DIRECTION_META: Record<
  DirectionState,
  {
    symbol: string;
    label: string;
    instruction: string;
  }
> = {
  left: {
    symbol: "←",
    label: "좌회전",
    instruction: "다음 교차로에서 좌회전",
  },
  straight: {
    symbol: "↑",
    label: "직진",
    instruction: "현재 차선을 유지하고 직진",
  },
  right: {
    symbol: "→",
    label: "우회전",
    instruction: "다음 교차로에서 우회전",
  },
  uturn: {
    symbol: "↶",
    label: "유턴",
    instruction: "안전 확인 후 유턴",
  },
};

export default function HomeScreen() {
  const [signalIndex, setSignalIndex] = useState(0);
  const [directionIndex, setDirectionIndex] = useState(0);
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(DEFAULT_SETTINGS.voiceGuideEnabled);
  const [voiceAlertLength, setVoiceAlertLength] = useState<VoiceAlertLength>(
    DEFAULT_SETTINGS.voiceAlertLength,
  );
  const [voiceAlertStyle, setVoiceAlertStyle] = useState<VoiceAlertStyle>(
    DEFAULT_SETTINGS.voiceAlertStyle,
  );
  const [liveRouteSyncEnabled, setLiveRouteSyncEnabled] = useState(
    DEFAULT_SETTINGS.liveRouteSyncEnabled,
  );
  const [quickDestinationCount, setQuickDestinationCount] = useState(
    DEFAULT_SETTINGS.quickDestinations.length,
  );
  const [locationStatus, setLocationStatus] = useState("GPS 대기");
  const [locationCoordsText, setLocationCoordsText] = useState("위치 미확인");
  const [distanceValue, setDistanceValue] = useState(GPS_ROUTE_POINTS[0].signalDistanceLabel);
  const [distanceMeters, setDistanceMeters] = useState(GPS_ROUTE_POINTS[0].signalDistanceMeters);
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
      setSelectedNavigationProvider(
        parsed.selectedNavigationProvider ?? DEFAULT_SETTINGS.selectedNavigationProvider,
      );
      setArrowSize(parsed.arrowSize ?? DEFAULT_SETTINGS.arrowSize);
      setVoiceGuideEnabled(parsed.voiceGuideEnabled ?? DEFAULT_SETTINGS.voiceGuideEnabled);
      setVoiceAlertLength(parsed.voiceAlertLength ?? DEFAULT_SETTINGS.voiceAlertLength);
      setVoiceAlertStyle(parsed.voiceAlertStyle ?? DEFAULT_SETTINGS.voiceAlertStyle);
      setLiveRouteSyncEnabled(parsed.liveRouteSyncEnabled ?? DEFAULT_SETTINGS.liveRouteSyncEnabled);
      setQuickDestinationCount((parsed.quickDestinations ?? DEFAULT_SETTINGS.quickDestinations).length);
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
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!liveRouteSyncEnabled) {
      return;
    }

    const interval = setInterval(() => {
      setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [liveRouteSyncEnabled]);

  useEffect(() => {
    const startGpsSync = async () => {
      if (!liveRouteSyncEnabled) {
        setLocationStatus("수동 방향 전환 모드");
        return;
      }

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setLocationStatus("GPS 비활성화");
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationStatus("GPS 권한 필요");
          return;
        }

        setLocationStatus("GPS 실시간 추적 중");

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

            setLocationCoordsText(
              `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`,
            );
            setDistanceMeters(routePoint.signalDistanceMeters);
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
        setLocationStatus("GPS 연결 실패");
      }
    };

    startGpsSync();

    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [liveRouteSyncEnabled]);

  const signalState = SIGNAL_SEQUENCE[signalIndex];
  const currentSignal = useMemo(() => SIGNAL_META[signalState], [signalState]);
  const currentDirectionKey = DIRECTION_SEQUENCE[directionIndex] ?? "straight";
  const currentDirection = useMemo(() => DIRECTION_META[currentDirectionKey], [currentDirectionKey]);
  const arrowFontSize = ARROW_FONT_SIZE[arrowSize];
  const displayedArrowFontSize = Math.min(arrowFontSize, 120);
  const voiceLengthLabel = voiceAlertLength === "detailed" ? "상세" : "간략";
  const voiceStyleLabel = voiceAlertStyle === "standard" ? "기본" : voiceAlertStyle === "calm" ? "차분" : "집중";
  const voiceSettings = useMemo(
    () => ({
      enabled: voiceGuideEnabled,
      length: voiceAlertLength,
      style: voiceAlertStyle,
    }),
    [voiceGuideEnabled, voiceAlertLength, voiceAlertStyle],
  );
  const voicePreviewText = useMemo(() => {
    return buildVoiceAlertText("red_signal_ahead", voiceSettings, { distanceMeters });
  }, [distanceMeters, voiceSettings]);

  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerZone}>
          <Text style={styles.headerText}>AI Omni-Drive</Text>
          <Text style={styles.headerSubText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
        </View>

        <View style={styles.mainColumn}>
          <View style={styles.visualZone}>
            <View style={styles.cardShell}>
              <View style={[styles.signalCard, { backgroundColor: currentSignal.backgroundColor }]}>
                <View style={styles.signalHighlight} />
                <Text style={styles.signalCardText}>{currentSignal.title}</Text>
                <Text style={styles.signalCardSubText}>{currentSignal.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoZone}>
            <View style={styles.cardShell}>
              <View style={styles.infoCard}>
                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>남은 거리</Text>
                  <Text style={styles.infoValue}>{distanceValue}</Text>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>현재 속도</Text>
                  <Text style={styles.infoValue}>{speedValue}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.naviZone}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내비게이션 방향 전환"
              onPress={handleAdvanceDirection}
              style={({ pressed }) => [styles.cardShell, styles.naviShell, pressed && styles.controlButtonPressed]}
            >
              <View style={styles.naviCard}>
                <Text
                  style={[
                    styles.naviArrowText,
                    { fontSize: displayedArrowFontSize, lineHeight: displayedArrowFontSize + 2 },
                  ]}
                >
                  {currentDirection.symbol}
                </Text>
                <Text numberOfLines={1} style={styles.naviText}>{currentDirection.label}</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.bottomBarZone}>
            <View style={styles.bottomBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/camera")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="photo-camera" size={22} color="#11161d" />
                <Text numberOfLines={1} style={styles.controlText}>카메라</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="home" size={22} color="#11161d" />
                <Text numberOfLines={1} style={styles.controlText}>홈</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="settings" size={22} color="#11161d" />
                <Text numberOfLines={1} style={styles.controlText}>설정</Text>
              </Pressable>
            </View>
          </View>

        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    backgroundColor: "#05070b",
  },
  root: {
    flex: 1,
    backgroundColor: "#05070b",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerZone: {
    paddingBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#717887",
    letterSpacing: 0.2,
  },
  headerSubText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8f98a4",
  },
  mainColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 10,
  },
  visualZone: {
    flex: 2.12,
    justifyContent: "center",
  },
  cardShell: {
    flex: 1,
    padding: 2,
    borderRadius: 30,
    backgroundColor: "#9098a3",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  signalCard: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
  },
  signalHighlight: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  signalCardText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#f8fbff",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.12)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  signalCardSubText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fbff",
  },
  infoZone: {
    flex: 1.28,
    justifyContent: "center",
  },
  infoCard: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: "#d9dbe0",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    columnGap: 10,
  },
  infoBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#b6bcc5",
    marginVertical: 22,
  },
  infoLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5f6672",
    textAlign: "center",
    lineHeight: 21,
  },
  infoValue: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "900",
    color: "#161b22",
    textAlign: "center",
    lineHeight: 24,
  },
  naviZone: {
    flex: 1.1,
    justifyContent: "center",
  },
  naviShell: {
    padding: 2,
  },
  naviCard: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: "#d7d9df",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  naviArrowText: {
    marginTop: -4,
    fontWeight: "800",
    color: "#2b3240",
    textAlign: "center",
  },
  naviText: {
    marginTop: -12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1e2430",
  },
  bottomBarZone: {
    flex: 0.46,
    justifyContent: "center",
  },
  bottomBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    backgroundColor: "#cfd3da",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 10,
    columnGap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  controlButton: {
    width: "31%",
    flexBasis: "31%",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: "#eef1f5",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    shadowColor: "#6b7280",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: -2 },
    elevation: 3,
  },
  controlButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  controlText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800",
    color: "#11161d",
    textAlign: "center",
    flexShrink: 1,
  },
});
