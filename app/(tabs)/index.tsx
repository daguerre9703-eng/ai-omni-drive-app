import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  quickDestinations: ["인천공항", "서울역"],
};

const ARROW_FONT_SIZE: Record<ArrowSize, number> = {
  large: 118,
  xlarge: 138,
  huge: 164,
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
    accent: string;
    glow: string;
  }
> = {
  red: {
    title: "STOP",
    label: "정지",
    accent: "#FF3B30",
    glow: "rgba(255,59,48,0.34)",
  },
  yellow: {
    title: "SLOW",
    label: "주의",
    accent: "#FFCC00",
    glow: "rgba(255,204,0,0.28)",
  },
  green: {
    title: "GO",
    label: "진행",
    accent: "#34C759",
    glow: "rgba(52,199,89,0.30)",
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

const LANGUAGE_SAMPLES = [
  { code: "KO", label: "안녕하세요" },
  { code: "EN", label: "Hello" },
  { code: "JA", label: "こんにちは" },
  { code: "ZH", label: "你好" },
  { code: "TH", label: "สวัสดี" },
  { code: "VI", label: "Xin chào" },
  { code: "MN", label: "Сайн байна уу" },
  { code: "RU", label: "Здравствуйте" },
  { code: "ES", label: "Hola" },
  { code: "AR", label: "مرحبا" },
  { code: "FR", label: "Bonjour" },
];

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
  const displayedArrowFontSize = Math.min(arrowFontSize, 164);
  const voiceLengthLabel = voiceAlertLength === "detailed" ? "상세" : "간략";
  const voiceStyleLabel = voiceAlertStyle === "calm" ? "차분형" : "집중형";
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.root}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>WHITE APPLE STANDARD</Text>
              <Text style={styles.heroTitle}>AI Omni-Drive</Text>
              <Text style={styles.heroSubtitle}>11개국어 스캔과 AI 운전 보조를 한 화면에서 바로 확인</Text>
            </View>
            <View style={styles.providerPill}>
              <Text style={styles.providerPillText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
            </View>
          </View>

          <View style={styles.heroGrid}>
            <View style={styles.heroLeftColumn}>
              <View style={[styles.liquidShell, styles.signalShell, { shadowColor: currentSignal.accent }]}> 
                <View style={styles.signalCard}>
                  <View style={[styles.signalHalo, { backgroundColor: currentSignal.glow }]} />
                  <View style={[styles.signalBadge, { backgroundColor: currentSignal.accent, shadowColor: currentSignal.accent }]}> 
                    <Text style={styles.signalBadgeLabel}>실시간 신호</Text>
                  </View>
                  <Text style={styles.signalCardText}>{currentSignal.title}</Text>
                  <Text style={styles.signalCardSubText}>{currentSignal.label}</Text>
                </View>
              </View>

              <View style={[styles.liquidShell, styles.metricsShell]}>
                <View style={styles.metricsCard}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>남은 거리</Text>
                    <Text style={styles.metricValue}>{distanceValue}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>현재 속도</Text>
                    <Text style={styles.metricValue}>{speedValue}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내비게이션 방향 전환"
              onPress={handleAdvanceDirection}
              style={({ pressed }) => [styles.liquidShell, styles.directionShell, pressed && styles.controlButtonPressed]}
            >
              <View style={styles.directionCard}>
                <Text
                  style={[
                    styles.naviArrowText,
                    { fontSize: displayedArrowFontSize, lineHeight: displayedArrowFontSize + 8 },
                  ]}
                >
                  {currentDirection.symbol}
                </Text>
                <Text style={styles.naviText}>{currentDirection.label}</Text>
                <Text style={styles.directionInstruction}>{currentDirection.instruction}</Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.liquidShell, styles.showcaseShell]}>
            <View style={styles.showcaseHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>SAMPLE SHOWCASE</Text>
                <Text style={styles.sectionTitle}>11개국어 스캔</Text>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>OCR LIVE</Text>
              </View>
            </View>

            <Text style={styles.sectionSummary}>
              메뉴, 표지판, 계약서 핵심 문장을 Vision AI로 즉시 읽고 큰 글씨로 번역해 보여주는 샘플입니다.
            </Text>

            <View style={styles.languageGrid}>
              {LANGUAGE_SAMPLES.map((item) => (
                <View key={item.code} style={styles.languageChip}>
                  <Text style={styles.languageCode}>{item.code}</Text>
                  <Text numberOfLines={1} style={styles.languageLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.liquidShell, styles.driveShowcaseShell]}>
            <View style={styles.showcaseHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>AI DRIVE ASSIST</Text>
                <Text style={styles.sectionTitle}>AI 운전 보조 실시간 디스플레이</Text>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>GPS 상태</Text>
                <Text style={styles.statusValue}>{locationStatus}</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>좌표</Text>
                <Text numberOfLines={1} style={styles.statusValue}>{locationCoordsText}</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>음성 가이드</Text>
                <Text style={styles.statusValue}>{voiceGuideEnabled ? "활성" : "비활성"}</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>알림 모드</Text>
                <Text style={styles.statusValue}>{`${voiceLengthLabel} · ${voiceStyleLabel}`}</Text>
              </View>
            </View>

            <View style={styles.voicePreviewCard}>
              <Text style={styles.voicePreviewLabel}>AI 음성 예고</Text>
              <Text style={styles.voicePreviewText}>{voicePreviewText}</Text>
            </View>

            <View style={styles.quickInfoRow}>
              <View style={styles.quickInfoCard}>
                <Text style={styles.quickInfoLabel}>빠른 목적지</Text>
                <Text style={styles.quickInfoValue}>{`${quickDestinationCount}개 준비`}</Text>
              </View>
              <View style={styles.quickInfoCard}>
                <Text style={styles.quickInfoLabel}>실시간 경로 동기화</Text>
                <Text style={styles.quickInfoValue}>{liveRouteSyncEnabled ? "자동" : "수동"}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.liquidShell, styles.bottomBarShell]}>
            <View style={styles.bottomBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/camera")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="photo-camera" size={28} color="#1F2937" />
                <Text style={styles.controlText}>카메라</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="home" size={28} color="#1F2937" />
                <Text style={styles.controlText}>홈</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="settings" size={28} color="#1F2937" />
                <Text style={styles.controlText}>설정</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  scrollContent: {
    flexGrow: 1,
  },
  root: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A93A5",
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#121826",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#556070",
    maxWidth: 250,
  },
  providerPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#B9C2D0",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: -4, height: -4 },
    elevation: 3,
  },
  providerPillText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#475467",
  },
  heroGrid: {
    flexDirection: "row",
    gap: 14,
  },
  heroLeftColumn: {
    flex: 1.05,
    gap: 14,
  },
  liquidShell: {
    padding: 2,
    borderRadius: 32,
    backgroundColor: "#D9DEE7",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    shadowColor: "#B9C2D0",
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: -6, height: -6 },
    elevation: 5,
  },
  signalShell: {
    minHeight: 232,
  },
  signalCard: {
    minHeight: 228,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    overflow: "hidden",
  },
  signalHalo: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    height: 86,
    borderRadius: 999,
  },
  signalBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  signalBadgeLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  signalCardText: {
    marginTop: 18,
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  signalCardSubText: {
    marginTop: 10,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#364152",
    textAlign: "center",
  },
  metricsShell: {
    minHeight: 134,
  },
  metricsCard: {
    minHeight: 130,
    borderRadius: 30,
    backgroundColor: "#FDFEFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  metricBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#D5DBE5",
    marginVertical: 18,
  },
  metricLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#6B7280",
    textAlign: "center",
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  directionShell: {
    flex: 0.95,
    minHeight: 382,
  },
  directionCard: {
    flex: 1,
    minHeight: 378,
    borderRadius: 30,
    backgroundColor: "#FBFCFE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  naviArrowText: {
    marginTop: -6,
    fontWeight: "900",
    color: "#E5E7EB",
    textAlign: "center",
    textShadowColor: "rgba(17,24,39,0.28)",
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 10,
  },
  naviText: {
    marginTop: -10,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  directionInstruction: {
    marginTop: 12,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#5B6472",
    textAlign: "center",
  },
  showcaseShell: {
    minHeight: 250,
  },
  driveShowcaseShell: {
    minHeight: 286,
  },
  showcaseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A93A5",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#121826",
  },
  liveBadge: {
    borderRadius: 999,
    backgroundColor: "#EDF2FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D6E4FF",
  },
  liveBadgeText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2855CC",
  },
  sectionSummary: {
    marginTop: 12,
    paddingHorizontal: 18,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#556070",
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  languageChip: {
    width: "31%",
    minWidth: 98,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E6EBF2",
    shadowColor: "#C4CCD8",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  languageCode: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#2855CC",
  },
  languageLabel: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#1F2937",
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  statusCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E7ECF3",
  },
  statusLabel: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: "#7A8394",
  },
  statusValue: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: "#111827",
  },
  voicePreviewCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E6EBF2",
  },
  voicePreviewLabel: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: "#7A8394",
  },
  voicePreviewText: {
    marginTop: 8,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
    color: "#111827",
  },
  quickInfoRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  quickInfoCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E7ECF3",
  },
  quickInfoLabel: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: "#7A8394",
  },
  quickInfoValue: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: "#111827",
  },
  bottomBarShell: {
    borderRadius: 28,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 26,
    backgroundColor: "#FDFEFF",
  },
  controlButton: {
    flex: 1,
    minHeight: 68,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EBF2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#C4CCD8",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  controlButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  controlText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#111827",
  },
});
