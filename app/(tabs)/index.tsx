import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

type SignalState = "red" | "yellow" | "green";
type DirectionState = "left" | "straight" | "right" | "uturn";
type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";

type AppSettings = {
  voiceGuideEnabled: boolean;
  liveRouteSyncEnabled: boolean;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  quickDestinations: string[];
};

type RoutePoint = {
  latitude: number;
  longitude: number;
  signalDistance: string;
  speed: string;
  direction: DirectionState;
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const SIGNAL_SEQUENCE: SignalState[] = ["red", "yellow", "green"];
const DIRECTION_SEQUENCE: DirectionState[] = ["left", "straight", "right", "uturn"];

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: true,
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
    signalDistance: "128m",
    speed: "18 km/h",
    direction: "left",
  },
  {
    latitude: 37.5669,
    longitude: 126.9787,
    signalDistance: "102m",
    speed: "24 km/h",
    direction: "straight",
  },
  {
    latitude: 37.5672,
    longitude: 126.9796,
    signalDistance: "76m",
    speed: "31 km/h",
    direction: "right",
  },
  {
    latitude: 37.567,
    longitude: 126.9803,
    signalDistance: "40m",
    speed: "12 km/h",
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

function getProviderLink(provider: NavigationProvider, point: RoutePoint) {
  const destinationName = encodeURIComponent("AI Omni Drive 목적지");

  if (provider === "kakaomap") {
    return {
      primary: `kakaomap://route?ep=${point.latitude},${point.longitude}&by=car`,
      fallback: `https://m.map.kakao.com/scheme/route?ep=${point.latitude},${point.longitude}&by=car`,
    };
  }

  if (provider === "inavi") {
    return {
      primary: `inavi://route?name=${destinationName}&lat=${point.latitude}&lng=${point.longitude}`,
      fallback: `https://www.inavi.com/`,
    };
  }

  return {
    primary: `tmap://route?goalx=${point.longitude}&goaly=${point.latitude}&goalname=${destinationName}`,
    fallback: `https://apis.openapi.sk.com/tmap/app/routes?appKey=&name=${destinationName}&lon=${point.longitude}&lat=${point.latitude}`,
  };
}

export default function HomeScreen() {
  const [signalIndex, setSignalIndex] = useState(0);
  const [directionIndex, setDirectionIndex] = useState(0);
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [liveRouteSyncEnabled, setLiveRouteSyncEnabled] = useState(
    DEFAULT_SETTINGS.liveRouteSyncEnabled,
  );
  const [quickDestinationCount, setQuickDestinationCount] = useState(
    DEFAULT_SETTINGS.quickDestinations.length,
  );
  const [locationStatus, setLocationStatus] = useState("GPS 대기");
  const [locationCoordsText, setLocationCoordsText] = useState("위치 미확인");
  const [distanceValue, setDistanceValue] = useState(GPS_ROUTE_POINTS[0].signalDistance);
  const [speedValue, setSpeedValue] = useState(GPS_ROUTE_POINTS[0].speed);
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
            setDistanceValue(routePoint.signalDistance);
            const speedKmh = typeof location.coords.speed === "number" && location.coords.speed > 0
              ? `${Math.round(location.coords.speed * 3.6)} km/h`
              : routePoint.speed;
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
  const routePoint = GPS_ROUTE_POINTS[routeIndexRef.current % GPS_ROUTE_POINTS.length];

  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };


  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerZone}>
          <Text style={styles.headerText}>AI Omni Code Sync</Text>
          <Text style={styles.headerSubText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
        </View>

        <View style={styles.mainColumn}>
          <View style={styles.visualZone}>
            <View style={[styles.signalCard, { backgroundColor: currentSignal.backgroundColor }]}>
              <Text style={styles.signalCardText}>{currentSignal.title}</Text>
              <Text style={styles.signalCardSubText}>{currentSignal.label}</Text>
            </View>
          </View>

          <View style={styles.infoZone}>
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

          <View style={styles.naviZone}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내비게이션 방향 전환"
              onPress={handleAdvanceDirection}
              style={({ pressed }) => [styles.naviCard, pressed && styles.controlButtonPressed]}
            >
              <View style={styles.naviHeaderRow}>
                <MaterialIcons name="near-me" size={28} color="#ffffff" />
                <Text style={styles.naviProviderText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
              </View>
              <Text style={[styles.naviArrowText, { fontSize: arrowFontSize, lineHeight: arrowFontSize + 8 }]}>
                {currentDirection.symbol}
              </Text>
              <Text style={styles.naviText}>{currentDirection.label}</Text>
              <Text style={styles.naviInstruction}>{currentDirection.instruction}</Text>
              <Text style={styles.naviMetaText}>{locationStatus}</Text>
              <Text style={styles.naviMetaText}>{locationCoordsText}</Text>
            </Pressable>
          </View>

          <View style={styles.bottomBarZone}>
            <View style={styles.bottomBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/camera")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="photo-camera" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>카메라</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="home" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>홈</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="settings" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>설정</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footerStatusRow}>
            <Text style={styles.footerStatusText}>
              빠른 목적지 {quickDestinationCount}개 · 탭하면 방향 수동 전환
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  root: {
    flex: 1,
  },
  headerZone: {
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
    letterSpacing: -0.3,
  },
  headerSubText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4b5563",
  },
  mainColumn: {
    flex: 1,
    flexDirection: "column",
  },
  visualZone: {
    flex: 2,
    justifyContent: "center",
  },
  signalCard: {
    flex: 1,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  signalCardText: {
    fontSize: 52,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  signalCardSubText: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  infoZone: {
    flex: 1.5,
    justifyContent: "center",
    paddingTop: 14,
    paddingBottom: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  infoBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#d1d5db",
    marginVertical: 18,
  },
  infoLabel: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4b5563",
    textAlign: "center",
  },
  infoValue: {
    marginTop: 12,
    fontSize: 34,
    fontWeight: "bold",
    color: "#11181c",
    textAlign: "center",
  },
  naviZone: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 10,
  },
  naviCard: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  naviHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  naviProviderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  naviArrowText: {
    marginTop: 4,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  naviText: {
    marginTop: 2,
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
  },
  naviInstruction: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "bold",
    color: "#d1d5db",
    textAlign: "center",
  },
  naviMetaText: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "bold",
    color: "#9ca3af",
    textAlign: "center",
  },
  bottomBarZone: {
    flex: 0.5,
    justifyContent: "center",
  },
  bottomBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 8,
    columnGap: 6,
  },
  controlButton: {
    width: "31%",
    flexBasis: "31%",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
  },
  controlButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  controlText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "bold",
    color: "#11181c",
    textAlign: "center",
    flexShrink: 0,
  },
  footerStatusRow: {
    paddingTop: 6,
    alignItems: "center",
  },
  footerStatusText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4b5563",
    textAlign: "center",
  },
});
