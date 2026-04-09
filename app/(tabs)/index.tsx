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

type SignalState = "inactive" | "red" | "yellow" | "green";
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
const SIGNAL_SEQUENCE: SignalState[] = ["inactive", "green", "yellow", "red"];
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
  inactive: {
    title: "IDLE",
    label: "미감지",
    cardBackground: "#AEB5BE",
    glow: "rgba(116, 126, 138, 0.08)",
  },
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
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
  }
> = {
  left: {
    icon: "west",
    label: "좌회전",
  },
  straight: {
    icon: "north",
    label: "직진",
  },
  right: {
    icon: "east",
    label: "우회전",
  },
  uturn: {
    icon: "u-turn-left",
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
  const [distanceValue, setDistanceValue] = useState("--");
  const [speedValue, setSpeedValue] = useState("0 km/h");
  const [redAlertVisible, setRedAlertVisible] = useState(false);
  const [homeMasterSettings, setHomeMasterSettings] = useState<HomeMasterSettings>(DEFAULT_HOME_MASTER_SETTINGS);
  const [bottomBarVisible, setBottomBarVisible] = useState(false);
  const routeIndexRef = useRef(0);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const bottomBarHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (bottomBarHideTimeoutRef.current) {
        clearTimeout(bottomBarHideTimeoutRef.current);
      }
    };
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
            const routePoint = GPS_ROUTE_POINTS[routeIndexRef.current % GPS_ROUTE_POINTS.length];
            routeIndexRef.current = (routeIndexRef.current + 1) % GPS_ROUTE_POINTS.length;

            setDistanceValue(routePoint.signalDistanceLabel);
            const speedKmh = typeof location.coords.speed === "number" && location.coords.speed > 0
              ? `${Math.round(location.coords.speed * 3.6)} km/h`
              : "0 km/h";
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
  const isSignalInactive = currentSignalState === "inactive";
  const displayedDistanceValue = isSignalInactive ? "--" : distanceValue;
  const isRedSignal = currentSignalState === "red";
  const voicePreviewText = useMemo(() => {
    if (!voiceGuideEnabled) {
      return "음성 안내 꺼짐";
    }

      if (currentSignalState === "inactive") {
        return "신호 미감지";
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
  }, [currentSignalState, signalIndex, voiceGuideEnabled, voiceAlertLength, voiceAlertStyle]);
  const currentDirection = useMemo(
    () => DIRECTION_META[DIRECTION_SEQUENCE[directionIndex] ?? "straight"],
    [directionIndex],
  );
  const revealBottomBar = useCallback(() => {
    if (bottomBarHideTimeoutRef.current) {
      clearTimeout(bottomBarHideTimeoutRef.current);
    }

    setBottomBarVisible(true);
    bottomBarHideTimeoutRef.current = setTimeout(() => {
      setBottomBarVisible(false);
    }, 2200);
  }, []);
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
  const shellTransform = (key: keyof HomeMasterSettings["positions"]) => {
    const rawTranslateY = homeMasterSettings.positions[key].y + homeMasterSettings.verticalBalance;
    const translateY = key === "signal"
      ? Math.min(rawTranslateY, 0)
      : key === "speed"
        ? Math.max(rawTranslateY, 32)
        : rawTranslateY;

    return {
      transform: [
        { translateX: homeMasterSettings.positions[key].x },
        { translateY },
      ],
    };
  };

  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };

  return (
    <ScreenContainer
      onTouchStart={revealBottomBar}
      style={[styles.screenContent, { backgroundColor: dynamicBackgroundColor }]}
    >
      <View style={[styles.root, { backgroundColor: dynamicBackgroundColor }]}>
        {isRedSignal ? (
          <View
            style={[
              styles.redAlertOverlay,
              redAlertVisible ? styles.redAlertOverlayVisible : styles.redAlertOverlayHidden,
              {
                opacity: redAlertVisible ? getSignalGlowOpacity(0.54, homeMasterSettings.signalGlow.red) : 0.08,
                pointerEvents: "none",
              },
            ]}
          />
        ) : null}
        <View style={styles.topBar}>
          <View style={styles.providerPill}>
            <Text style={styles.providerText}>{PROVIDER_LABEL[selectedNavigationProvider]}</Text>
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
                  {
                    fontSize: homeMasterSettings.sizes.signalTitle,
                    lineHeight: homeMasterSettings.sizes.signalTitle + 4,
                    fontFamily: sharedFontFamily,
                    fontWeight: sharedFontWeight,
                  },
                ]}
              >
                {currentSignal.title}
              </Text>
              {isSignalInactive ? <View style={styles.signalDistanceSpacer} /> : (
                <Text
                  style={[
                    styles.signalDistanceValue,
                    {
                      fontSize: homeMasterSettings.sizes.distanceValue,
                      lineHeight: homeMasterSettings.sizes.distanceValue + 4,
                      fontFamily: sharedFontFamily,
                      fontWeight: sharedFontWeight,
                    },
                  ]}
                >
                  {displayedDistanceValue}
                </Text>
              )}
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
                    {
                      fontSize: homeMasterSettings.sizes.speedValue,
                      lineHeight: homeMasterSettings.sizes.speedValue + 4,
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
              <View style={styles.directionArrowWrap}>
                <MaterialIcons
                  name={currentDirection.icon}
                  size={Math.round(arrowFontSize * 2.42 * homeMasterSettings.sizes.directionArrow)}
                  color="#1B2330"
                  style={styles.directionArrowIcon}
                />
              </View>
              <Text
                style={[
                  styles.directionLabel,
                  {
                    fontSize: Math.max(homeMasterSettings.sizes.directionLabel, 34),
                    lineHeight: Math.max(homeMasterSettings.sizes.directionLabel, 34) + 8,
                    fontFamily: sharedFontFamily,
                    fontWeight: sharedFontWeight,
                  },
                ]}
              >
                {currentDirection.label}
              </Text>
            </View>
          </Pressable>
        </View>

        {bottomBarVisible ? (
          <View style={[styles.bottomBarShell, { backgroundColor: dynamicShellColor }]}> 
            <View
              style={[
                styles.bottomBar,
                {
                  backgroundColor: getShellOverlayColor(
                    homeMasterSettings.theme.backgroundGrayLightness,
                    homeMasterSettings.theme.backgroundGraySaturation,
                    0.9,
                  ),
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/camera")}
                style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
              >
                <MaterialIcons name="photo-camera" size={20} color="#1E2630" />
                <Text style={styles.bottomButtonText}>카메라</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
              >
                <MaterialIcons name="home" size={20} color="#1E2630" />
                <Text style={styles.bottomButtonText}>홈</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.bottomButton, pressed && styles.bottomButtonPressed]}
              >
                <MaterialIcons name="settings" size={20} color="#1E2630" />
                <Text style={styles.bottomButtonText}>설정</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
    paddingBottom: 2,
  },
  topBar: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  providerPill: {
    minWidth: 84,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
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
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    color: "#4F5661",
  },
  mainStack: {
    flex: 1,
    gap: 22,
    paddingTop: 10,
    paddingBottom: 20,
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
    flex: 0.5,
  },
  infoShell: {
    flex: 0.28,
    marginTop: 16,
  },
  pressedCardShell: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  signalCard: {
    flex: 1,
    minHeight: 148,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(236, 241, 244, 0.9)",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  signalTitle: {
    fontSize: 35,
    lineHeight: 39,
    fontWeight: "900",
    color: "#F6F8FA",
    letterSpacing: -1,
    textShadowColor: "rgba(103, 109, 118, 0.32)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  signalDistanceValue: {
    marginTop: 24,
    fontSize: 74,
    lineHeight: 78,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    letterSpacing: -2.6,
  },
  signalDistanceSpacer: {
    height: 18,
    marginTop: 8,
  },
  infoCard: {
    flex: 1,
    minHeight: 116,
    borderRadius: 20,
    backgroundColor: "#D0D3D9",
    borderWidth: 1,
    borderColor: "rgba(236, 238, 242, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  speedOnlyColumn: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 14,
    lineHeight: 18,
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
    marginTop: 0,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#1C2430",
    textAlign: "center",
    letterSpacing: -1,
  },
  directionShell: {
    flex: 3.28,
  },
  directionCard: {
    flex: 1,
    minHeight: 428,
    borderRadius: 30,
    backgroundColor: "#D6DAE0",
    borderWidth: 1.5,
    borderColor: "#F7F9FC",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 24,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -1 },
  },
  directionArrowWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  directionArrowIcon: {
    textShadowColor: "rgba(255, 255, 255, 0.34)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  directionLabel: {
    marginTop: 0,
    marginBottom: 6,
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    color: "#18202C",
    textAlign: "center",
    letterSpacing: -0.9,
  },
  bottomBarShell: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 8,
    marginTop: 0,
    borderRadius: 16,
    padding: 1,
    backgroundColor: "rgba(187, 193, 202, 0.14)",
    borderWidth: 0.7,
    borderColor: "rgba(250, 252, 255, 0.72)",
    shadowColor: "#8D95A0",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bottomBar: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "rgba(229, 234, 240, 0.34)",
    borderWidth: 0.75,
    borderColor: "rgba(255, 255, 255, 0.82)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 5,
  },
  bottomButton: {
    flex: 1,
    minHeight: 30,
    borderRadius: 11,
    backgroundColor: "rgba(241, 244, 248, 0.5)",
    borderWidth: 0.9,
    borderColor: "rgba(255, 255, 255, 0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: -1 },
  },
  bottomButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  bottomButtonText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900",
    color: "#27303B",
    letterSpacing: -0.1,
  },
});
