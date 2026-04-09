import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  DEFAULT_HOME_MASTER_SETTINGS,
  FONT_PRESET_OPTIONS,
  HOME_MASTER_STORAGE_KEY,
  HOME_MASTER_THEME_SLOT_LABEL,
  LAYOUT_PRESET_OPTIONS,
  clampValue,
  getFontFamilyForPreset,
  getFontWeightForPreset,
  getGrayBackgroundColor,
  getShellOverlayColor,
  mergeHomeMasterSettings,
  type ElementOffset,
  type FontPreset,
  type HomeMasterSettings,
  type HudElementKey,
  type LayoutPresetKey,
} from "@/lib/home-master-settings";
import {
  type RedAlertIntensity,
  type SensitivityMode,
  type SignalPriorityMode,
} from "@/lib/traffic-signal-store";
import {
  DEFAULT_VOICE_ALERT_SETTINGS,
  VOICE_LENGTH_OPTIONS,
  VOICE_STYLE_OPTIONS,
  type VoiceAlertLength,
  type VoiceAlertStyle,
} from "@/lib/voice-alerts";

type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";

type AppSettings = {
  voiceGuideEnabled: boolean;
  voiceAlertLength: VoiceAlertLength;
  voiceAlertStyle: VoiceAlertStyle;
  liveRouteSyncEnabled: boolean;
  adaptiveScanEnabled: boolean;
  hapticAlertsEnabled: boolean;
  lowVisionModeEnabled: boolean;
  redAlertIntensity: RedAlertIntensity;
  signalPriorityMode: SignalPriorityMode;
  sensitivityMode: SensitivityMode;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  quickDestinations: string[];
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const HOME_PREVIEW_WIDTH = 300;
const HOME_PREVIEW_HEIGHT = 320;
const POSITION_LIMIT_X = 46;
const POSITION_LIMIT_Y = 38;

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: DEFAULT_VOICE_ALERT_SETTINGS.enabled,
  voiceAlertLength: DEFAULT_VOICE_ALERT_SETTINGS.length,
  voiceAlertStyle: DEFAULT_VOICE_ALERT_SETTINGS.style,
  liveRouteSyncEnabled: true,
  adaptiveScanEnabled: true,
  hapticAlertsEnabled: true,
  lowVisionModeEnabled: true,
  redAlertIntensity: "balanced",
  signalPriorityMode: "safety-first",
  sensitivityMode: "standard",
  selectedNavigationProvider: "tmap",
  arrowSize: "huge",
  quickDestinations: ["집", "회사"],
};

const PROVIDER_OPTIONS: Array<{
  key: NavigationProvider;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  {
    key: "kakaomap",
    title: "카카오맵",
    description: "카카오내비 중심 연동",
    icon: "map",
  },
  {
    key: "inavi",
    title: "아이나비",
    description: "아이나비 안내 우선",
    icon: "directions-car",
  },
  {
    key: "tmap",
    title: "티맵",
    description: "실시간 길안내 우선",
    icon: "alt-route",
  },
];

const ARROW_SIZE_OPTIONS: Array<{
  key: ArrowSize;
  title: string;
  description: string;
}> = [
  {
    key: "large",
    title: "크게",
    description: "기본보다 더 크게",
  },
  {
    key: "xlarge",
    title: "아주 크게",
    description: "주행 중 빠른 인지",
  },
  {
    key: "huge",
    title: "최대로",
    description: "시야 약해도 선명",
  },
];

const RED_ALERT_INTENSITY_OPTIONS: Array<{
  key: RedAlertIntensity;
  title: string;
  description: string;
}> = [
  {
    key: "off",
    title: "끄기",
    description: "적색 신호여도 전체 화면 점멸 없이 카드 색상만 유지합니다.",
  },
  {
    key: "soft",
    title: "부드럽게",
    description: "점멸 강도를 낮춰 눈부심을 줄입니다.",
  },
  {
    key: "balanced",
    title: "균형형",
    description: "경고성과 시인성의 균형을 맞춥니다.",
  },
  {
    key: "strong",
    title: "강하게",
    description: "적색 신호에서 더 강한 전체 화면 경고를 줍니다.",
  },
];

const SIGNAL_PRIORITY_OPTIONS: Array<{
  key: SignalPriorityMode;
  title: string;
  description: string;
}> = [
  {
    key: "safety-first",
    title: "안전 우선",
    description: "차량 정지나 충돌 가능성을 먼저 경고해 가장 보수적으로 안내합니다.",
  },
  {
    key: "pedestrian-first",
    title: "보행 우선",
    description: "보행 가능 신호를 먼저 읽고 차량 진행 신호는 보조 정보로 정리합니다.",
  },
  {
    key: "vehicle-first",
    title: "차량 우선",
    description: "직진·좌회전 차량 흐름을 먼저 읽고 보행 신호는 보조 정보로 덧붙입니다.",
  },
];

const SENSITIVITY_MODE_OPTIONS: Array<{
  key: SensitivityMode;
  title: string;
  description: string;
}> = [
  {
    key: "standard",
    title: "기본 감도",
    description: "과도한 추정을 줄이고 명확한 점등 위주로 판별합니다.",
  },
  {
    key: "night",
    title: "야간 고감도",
    description: "어두운 배경과 역광 환경에서 작은 점등 차이를 더 세밀하게 읽습니다.",
  },
  {
    key: "rain",
    title: "우천 고감도",
    description: "젖은 노면 반사와 흐린 렌즈 상황에서도 실제 신호 위치를 더 적극적으로 찾습니다.",
  },
  {
    key: "auto",
    title: "자동 환경 적응",
    description: "주변 장면을 보고 야간·우천 성향을 추정해 감도를 자동으로 맞춥니다.",
  },
];

const ELEMENT_LABEL: Record<HudElementKey, string> = {
  signal: "신호등 카드",
  speed: "속도계",
  direction: "화살표",
};

const PREVIEW_BASE_POSITION: Record<HudElementKey, ElementOffset> = {
  signal: { x: 26, y: 20 },
  speed: { x: 28, y: 164 },
  direction: { x: 34, y: 244 },
};

function SliderControl({
  title,
  description,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
  accentColor = "#111827",
}: {
  title: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
  accentColor?: string;
}) {
  const trackWidthRef = useRef(1);
  const normalized = (value - min) / (max - min);

  const updateFromLocation = useCallback(
    (locationX: number) => {
      const ratio = clampValue(locationX / Math.max(trackWidthRef.current, 1), 0, 1);
      const rawValue = min + ratio * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      onChange(Number(clampValue(steppedValue, min, max).toFixed(2)));
    },
    [max, min, onChange, step],
  );

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  return (
    <View style={styles.sliderCard}>
      <View style={styles.sliderHeaderRow}>
        <View style={styles.sliderTextGroup}>
          <Text style={styles.sliderTitle}>{title}</Text>
          <Text style={styles.sliderDescription}>{description}</Text>
        </View>
        <View style={styles.sliderValueBadge}>
          <Text style={styles.sliderValueBadgeText}>{displayValue}</Text>
        </View>
      </View>

      <View style={styles.sliderControlRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(Number(clampValue(value - step, min, max).toFixed(2)))}
          style={({ pressed }) => [styles.sliderStepButton, pressed && styles.buttonPressed]}
        >
          <MaterialIcons name="remove" size={24} color="#11181c" />
        </Pressable>

        <View
          onLayout={handleTrackLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => updateFromLocation(event.nativeEvent.locationX)}
          onResponderMove={(event) => updateFromLocation(event.nativeEvent.locationX)}
          style={styles.sliderTrack}
        >
          <View style={styles.sliderTrackBase} />
          <View style={[styles.sliderTrackFill, { width: `${Math.max(0, Math.min(100, normalized * 100))}%`, backgroundColor: accentColor }]} />
          <View
            style={[
              styles.sliderThumb,
              {
                left: `${Math.max(0, Math.min(100, normalized * 100))}%`,
                borderColor: accentColor,
              },
            ]}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(Number(clampValue(value + step, min, max).toFixed(2)))}
          style={({ pressed }) => [styles.sliderStepButton, pressed && styles.buttonPressed]}
        >
          <MaterialIcons name="add" size={24} color="#11181c" />
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(DEFAULT_SETTINGS.voiceGuideEnabled);
  const [voiceAlertLength, setVoiceAlertLength] = useState<VoiceAlertLength>(
    DEFAULT_SETTINGS.voiceAlertLength,
  );
  const [voiceAlertStyle, setVoiceAlertStyle] = useState<VoiceAlertStyle>(
    DEFAULT_SETTINGS.voiceAlertStyle,
  );
  const [liveRouteSyncEnabled, setLiveRouteSyncEnabled] = useState(DEFAULT_SETTINGS.liveRouteSyncEnabled);
  const [adaptiveScanEnabled, setAdaptiveScanEnabled] = useState(DEFAULT_SETTINGS.adaptiveScanEnabled);
  const [hapticAlertsEnabled, setHapticAlertsEnabled] = useState(DEFAULT_SETTINGS.hapticAlertsEnabled);
  const [lowVisionModeEnabled, setLowVisionModeEnabled] = useState(DEFAULT_SETTINGS.lowVisionModeEnabled);
  const [redAlertIntensity, setRedAlertIntensity] = useState<RedAlertIntensity>(
    DEFAULT_SETTINGS.redAlertIntensity,
  );
  const [signalPriorityMode, setSignalPriorityMode] = useState<SignalPriorityMode>(
    DEFAULT_SETTINGS.signalPriorityMode,
  );
  const [sensitivityMode, setSensitivityMode] = useState<SensitivityMode>(
    DEFAULT_SETTINGS.sensitivityMode,
  );
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [quickDestinations, setQuickDestinations] = useState<string[]>(DEFAULT_SETTINGS.quickDestinations);
  const [pendingDestination, setPendingDestination] = useState("");
  const [homeMasterSettings, setHomeMasterSettings] = useState<HomeMasterSettings>(
    DEFAULT_HOME_MASTER_SETTINGS,
  );
  const [selectedHudElement, setSelectedHudElement] = useState<HudElementKey>("signal");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const dragStartRef = useRef<Record<HudElementKey, ElementOffset>>({
    signal: { ...DEFAULT_HOME_MASTER_SETTINGS.positions.signal },
    speed: { ...DEFAULT_HOME_MASTER_SETTINGS.positions.speed },
    direction: { ...DEFAULT_HOME_MASTER_SETTINGS.positions.direction },
  });

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const [savedValue, savedHomeMasterValue] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
          AsyncStorage.getItem(HOME_MASTER_STORAGE_KEY),
        ]);

        if (savedValue && isMounted) {
          const parsed = JSON.parse(savedValue) as Partial<AppSettings>;
          setVoiceGuideEnabled(parsed.voiceGuideEnabled ?? DEFAULT_SETTINGS.voiceGuideEnabled);
          setVoiceAlertLength(parsed.voiceAlertLength ?? DEFAULT_SETTINGS.voiceAlertLength);
          setVoiceAlertStyle(parsed.voiceAlertStyle ?? DEFAULT_SETTINGS.voiceAlertStyle);
          setLiveRouteSyncEnabled(parsed.liveRouteSyncEnabled ?? DEFAULT_SETTINGS.liveRouteSyncEnabled);
          setAdaptiveScanEnabled(parsed.adaptiveScanEnabled ?? DEFAULT_SETTINGS.adaptiveScanEnabled);
          setHapticAlertsEnabled(parsed.hapticAlertsEnabled ?? DEFAULT_SETTINGS.hapticAlertsEnabled);
          setLowVisionModeEnabled(parsed.lowVisionModeEnabled ?? DEFAULT_SETTINGS.lowVisionModeEnabled);
          setRedAlertIntensity(parsed.redAlertIntensity ?? DEFAULT_SETTINGS.redAlertIntensity);
          setSignalPriorityMode(parsed.signalPriorityMode ?? DEFAULT_SETTINGS.signalPriorityMode);
          setSensitivityMode(parsed.sensitivityMode ?? DEFAULT_SETTINGS.sensitivityMode);
          setSelectedNavigationProvider(
            parsed.selectedNavigationProvider ?? DEFAULT_SETTINGS.selectedNavigationProvider,
          );
          setArrowSize(parsed.arrowSize ?? DEFAULT_SETTINGS.arrowSize);
          setQuickDestinations(parsed.quickDestinations ?? DEFAULT_SETTINGS.quickDestinations);
        }

        if (savedHomeMasterValue && isMounted) {
          const parsedHomeMaster = JSON.parse(savedHomeMasterValue) as Partial<HomeMasterSettings>;
          setHomeMasterSettings(mergeHomeMasterSettings(parsedHomeMaster));
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const patchHomeMasterSettings = useCallback((partial: Partial<HomeMasterSettings>) => {
    setHomeMasterSettings((prev) =>
      mergeHomeMasterSettings({
        ...prev,
        ...partial,
        positions: {
          ...prev.positions,
          ...partial.positions,
        },
        sizes: {
          ...prev.sizes,
          ...partial.sizes,
        },
        theme: {
          ...prev.theme,
          ...partial.theme,
        },
        signalGlow: {
          ...prev.signalGlow,
          ...partial.signalGlow,
        },
      }),
    );
  }, []);

  const updateElementPosition = useCallback(
    (key: HudElementKey, nextPosition: ElementOffset) => {
      patchHomeMasterSettings({
        positions: {
          [key]: {
            x: clampValue(nextPosition.x, -POSITION_LIMIT_X, POSITION_LIMIT_X),
            y: clampValue(nextPosition.y, -POSITION_LIMIT_Y, POSITION_LIMIT_Y),
          },
        } as Record<HudElementKey, ElementOffset>,
      });
    },
    [patchHomeMasterSettings],
  );

  const updateSizeValue = useCallback(
    (key: keyof HomeMasterSettings["sizes"], value: number) => {
      patchHomeMasterSettings({
        sizes: {
          [key]: value,
        } as HomeMasterSettings["sizes"],
      });
    },
    [patchHomeMasterSettings],
  );

  const currentProviderLabel = useMemo(() => {
    return PROVIDER_OPTIONS.find((option) => option.key === selectedNavigationProvider)?.title ?? "티맵";
  }, [selectedNavigationProvider]);

  const selectedLengthLabel = useMemo(() => {
    return VOICE_LENGTH_OPTIONS.find((option) => option.key === voiceAlertLength)?.title ?? "상세 안내";
  }, [voiceAlertLength]);

  const selectedStyleLabel = useMemo(() => {
    return VOICE_STYLE_OPTIONS.find((option) => option.key === voiceAlertStyle)?.title ?? "기본";
  }, [voiceAlertStyle]);

  const selectedRedAlertLabel = useMemo(() => {
    return RED_ALERT_INTENSITY_OPTIONS.find((option) => option.key === redAlertIntensity)?.title ?? "균형형";
  }, [redAlertIntensity]);

  const selectedPriorityLabel = useMemo(() => {
    return SIGNAL_PRIORITY_OPTIONS.find((option) => option.key === signalPriorityMode)?.title ?? "안전 우선";
  }, [signalPriorityMode]);

  const selectedSensitivityLabel = useMemo(() => {
    return SENSITIVITY_MODE_OPTIONS.find((option) => option.key === sensitivityMode)?.title ?? "기본 감도";
  }, [sensitivityMode]);

  const selectedFontLabel = useMemo(() => {
    return FONT_PRESET_OPTIONS.find((option) => option.key === homeMasterSettings.fontPreset)?.title ?? "애플 Extra Bold";
  }, [homeMasterSettings.fontPreset]);

  const selectedLayoutLabel = useMemo(() => {
    return LAYOUT_PRESET_OPTIONS.find((option) => option.key === homeMasterSettings.layoutPreset)?.title ?? "균형형";
  }, [homeMasterSettings.layoutPreset]);

  const previewBackgroundColor = useMemo(() => {
    return getGrayBackgroundColor(
      homeMasterSettings.theme.backgroundGrayLightness,
      homeMasterSettings.theme.backgroundGraySaturation,
    );
  }, [homeMasterSettings.theme.backgroundGrayLightness, homeMasterSettings.theme.backgroundGraySaturation]);

  const previewShellColor = useMemo(() => {
    return getShellOverlayColor(
      homeMasterSettings.theme.backgroundGrayLightness,
      homeMasterSettings.theme.backgroundGraySaturation,
      homeMasterSettings.theme.hudShellOpacity,
    );
  }, [
    homeMasterSettings.theme.backgroundGrayLightness,
    homeMasterSettings.theme.backgroundGraySaturation,
    homeMasterSettings.theme.hudShellOpacity,
  ]);

  const sharedFontFamily = getFontFamilyForPreset(homeMasterSettings.fontPreset as FontPreset);
  const sharedFontWeight = getFontWeightForPreset(homeMasterSettings.fontPreset as FontPreset);

  const previewPositionStyle = useCallback(
    (key: HudElementKey) => {
      const base = PREVIEW_BASE_POSITION[key];
      const offset = homeMasterSettings.positions[key];
      return {
        left: base.x + offset.x,
        top: base.y + offset.y + homeMasterSettings.verticalBalance,
      };
    },
    [homeMasterSettings.positions, homeMasterSettings.verticalBalance],
  );

  const createDragResponder = useCallback(
    (key: HudElementKey) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setSelectedHudElement(key);
          dragStartRef.current[key] = { ...homeMasterSettings.positions[key] };
        },
        onPanResponderMove: (_, gestureState) => {
          const dragStart = dragStartRef.current[key];
          updateElementPosition(key, {
            x: dragStart.x + gestureState.dx / 2.8,
            y: dragStart.y + gestureState.dy / 2.8,
          });
        },
      }),
    [homeMasterSettings.positions, updateElementPosition],
  );

  const signalPanResponder = createDragResponder("signal");
  const speedPanResponder = createDragResponder("speed");
  const directionPanResponder = createDragResponder("direction");

  const handleAddDestination = () => {
    const trimmed = pendingDestination.trim();

    if (!trimmed) {
      Alert.alert("추가할 목적지", "목적지 이름을 입력해 주세요.");
      return;
    }

    if (quickDestinations.includes(trimmed)) {
      Alert.alert("이미 등록됨", "같은 이름의 목적지가 이미 저장되어 있습니다.");
      return;
    }

    setQuickDestinations((prev) => [...prev, trimmed]);
    setPendingDestination("");
    Alert.alert("추가 완료", `빠른 목적지에 \"${trimmed}\"을 추가했습니다.`);
  };

  const handleRemoveDestination = (target: string) => {
    setQuickDestinations((prev) => prev.filter((item) => item !== target));
  };

  const handleApplyLayoutPreset = (presetKey: LayoutPresetKey) => {
    const preset = LAYOUT_PRESET_OPTIONS.find((option) => option.key === presetKey);

    if (!preset) {
      return;
    }

    patchHomeMasterSettings({
      layoutPreset: preset.key,
      verticalBalance: preset.verticalBalance,
      positions: {
        signal: { ...preset.positions.signal },
        speed: { ...preset.positions.speed },
        direction: { ...preset.positions.direction },
      },
    });
  };

  const handleMoveSelectedElement = (axis: "x" | "y", delta: number) => {
    const currentPosition = homeMasterSettings.positions[selectedHudElement];
    updateElementPosition(selectedHudElement, {
      ...currentPosition,
      [axis]: currentPosition[axis] + delta,
    });
  };

  const handleSaveHomeTheme = async () => {
    const nextSettings = mergeHomeMasterSettings({
      ...homeMasterSettings,
      savedThemeLabel: HOME_MASTER_THEME_SLOT_LABEL["my-theme-1"],
    });

    try {
      await AsyncStorage.setItem(HOME_MASTER_STORAGE_KEY, JSON.stringify(nextSettings));
      setHomeMasterSettings(nextSettings);
      Alert.alert("저장 완료", "홈 화면 전문 설정을 나만의 테마 1로 저장했습니다.");
    } catch (error) {
      console.error("Failed to save home master settings", error);
      Alert.alert("저장 실패", "홈 화면 전문 설정을 저장하지 못했습니다.");
    }
  };

  const handleResetHomeTheme = async () => {
    const nextSettings = mergeHomeMasterSettings(DEFAULT_HOME_MASTER_SETTINGS);

    try {
      await AsyncStorage.setItem(HOME_MASTER_STORAGE_KEY, JSON.stringify(nextSettings));
      setHomeMasterSettings(nextSettings);
      setSelectedHudElement("signal");
      Alert.alert("원상복구 완료", "홈 화면 전문 설정을 기본 균형형 테마로 되돌렸습니다.");
    } catch (error) {
      console.error("Failed to reset home master settings", error);
      Alert.alert("원상복구 실패", "기본 테마로 되돌리지 못했습니다.");
    }
  };

  const handleSave = async () => {
    const nextSettings: AppSettings = {
      voiceGuideEnabled,
      voiceAlertLength,
      voiceAlertStyle,
      liveRouteSyncEnabled,
      adaptiveScanEnabled,
      hapticAlertsEnabled,
      lowVisionModeEnabled,
      redAlertIntensity,
      signalPriorityMode,
      sensitivityMode,
      selectedNavigationProvider,
      arrowSize,
      quickDestinations,
    };

    const nextHomeMasterSettings = mergeHomeMasterSettings({
      ...homeMasterSettings,
      savedThemeLabel: HOME_MASTER_THEME_SLOT_LABEL["my-theme-1"],
    });

    try {
      setIsSaving(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      await AsyncStorage.setItem(HOME_MASTER_STORAGE_KEY, JSON.stringify(nextHomeMasterSettings));
      setHomeMasterSettings(nextHomeMasterSettings);
      Alert.alert(
        "저장 완료",
        `${currentProviderLabel} 연동 설정과 ${selectedLengthLabel} · ${selectedStyleLabel} 음성 스타일을 저장했습니다.`,
        [
          {
            text: "확인",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Failed to save settings", error);
      Alert.alert("저장 실패", "설정을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
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

          <Text style={styles.headerTitle}>설정</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>현재 연동 상태</Text>
            <Text style={styles.summaryValue}>{currentProviderLabel}</Text>
            <Text style={styles.summaryDescription}>
              음성 길이 {selectedLengthLabel} · 음성 스타일 {selectedStyleLabel} · 적색 경고 {selectedRedAlertLabel} · {selectedPriorityLabel} · {selectedSensitivityLabel} 기준으로 안내 문구를 조합합니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>AI 음성 가이드</Text>
              <Switch value={voiceGuideEnabled} onValueChange={setVoiceGuideEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              음성 안내를 끄면 HUD 문구만 갱신하고 소리는 출력하지 않습니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>안내 음성 길이</Text>
            <Text style={styles.sectionDescription}>
              상세 안내 또는 간략 안내 중 하나를 골라 문장 길이를 직접 조절할 수 있습니다.
            </Text>

            <View style={styles.optionList}>
              {VOICE_LENGTH_OPTIONS.map((option) => {
                const selected = option.key === voiceAlertLength;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setVoiceAlertLength(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>안내 음성 스타일</Text>
            <Text style={styles.sectionDescription}>
              같은 문구라도 말하는 속도와 톤을 다르게 적용해 원하는 안내 느낌을 선택할 수 있습니다.
            </Text>

            <View style={styles.optionList}>
              {VOICE_STYLE_OPTIONS.map((option) => {
                const selected = option.key === voiceAlertStyle;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setVoiceAlertStyle(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>실시간 경로 연동</Text>
              <Switch value={liveRouteSyncEnabled} onValueChange={setLiveRouteSyncEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              현재 위치와 외부 내비게이션 경로 흐름을 기준으로 화살표를 전환합니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>속도 적응 스캔</Text>
              <Switch value={adaptiveScanEnabled} onValueChange={setAdaptiveScanEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              차량 속도에 따라 신호 인식 간격을 자동으로 조절해 반응성과 배터리 소모를 함께 맞춥니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>진동 패턴 경고</Text>
              <Switch value={hapticAlertsEnabled} onValueChange={setHapticAlertsEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              적색, 좌회전 가능, 보행 가능 상태를 서로 다른 진동 패턴으로 구분해 화면을 보지 않아도 알 수 있게 합니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>초대형 저시력 모드</Text>
              <Switch value={lowVisionModeEnabled} onValueChange={setLowVisionModeEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              홈 HUD와 카메라 화면의 핵심 신호 문구와 상태 칩을 더 크게 키워 저시력 환경에서도 빠르게 읽도록 돕습니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>적색 점멸 경고 강도</Text>
            <Text style={styles.sectionDescription}>
              적색 신호가 감지되었을 때 전체 화면 점멸 경고를 끄거나 강도를 선택해 시력 피로도에 맞게 조절합니다.
            </Text>

            <View style={styles.optionList}>
              {RED_ALERT_INTENSITY_OPTIONS.map((option) => {
                const selected = option.key === redAlertIntensity;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setRedAlertIntensity(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>신호 우선순위 안내</Text>
            <Text style={styles.sectionDescription}>
              보행 신호와 차량 신호가 동시에 보일 때 어떤 흐름을 먼저 읽어 줄지 선택합니다.
            </Text>

            <View style={styles.optionList}>
              {SIGNAL_PRIORITY_OPTIONS.map((option) => {
                const selected = option.key === signalPriorityMode;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSignalPriorityMode(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>야간·우천 고감도 모드</Text>
            <Text style={styles.sectionDescription}>
              밤길, 빗물 반사, 흐린 렌즈 같은 환경에 맞춰 AI 감도를 야간·우천·자동 적응으로 조절합니다.
            </Text>

            <View style={styles.optionList}>
              {SENSITIVITY_MODE_OPTIONS.map((option) => {
                const selected = option.key === sensitivityMode;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSensitivityMode(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>연동 내비게이션 선택</Text>
            <Text style={styles.sectionDescription}>
              카카오맵, 아이나비, 티맵 중 주로 쓰는 앱을 선택하세요.
            </Text>

            <View style={styles.optionList}>
              {PROVIDER_OPTIONS.map((option) => {
                const selected = option.key === selectedNavigationProvider;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSelectedNavigationProvider(option.key)}
                    style={({ pressed }) => [
                      styles.providerOption,
                      selected && styles.providerOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={28}
                      color={selected ? "#ffffff" : "#11181c"}
                    />
                    <View style={styles.providerTextGroup}>
                      <Text style={[styles.providerTitle, selected && styles.providerTitleSelected]}>
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.providerDescription,
                          selected && styles.providerDescriptionSelected,
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>화살표 크기</Text>
            <Text style={styles.sectionDescription}>
              운전 중 더 잘 보이도록 방향 화살표 크기를 고를 수 있습니다.
            </Text>

            <View style={styles.optionList}>
              {ARROW_SIZE_OPTIONS.map((option) => {
                const selected = option.key === arrowSize;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setArrowSize(option.key)}
                    style={({ pressed }) => [
                      styles.arrowOption,
                      selected && styles.arrowOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.arrowOptionDescription,
                        selected && styles.arrowOptionDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.masterCenterCard}>
            <View style={styles.masterCenterHeader}>
              <Text style={styles.masterCenterEyebrow}>홈 화면 전문 설정 센터</Text>
              <Text style={styles.masterCenterTitle}>운전 HUD 레이아웃 마스터</Text>
              <Text style={styles.masterCenterDescription}>
                홈 화면의 신호 카드, 속도계, 방향 화살표를 직접 움직이고 크기·폰트·그레이 톤·Glow 강도를 조절해 나만의 주행 시야를 만들 수 있습니다.
              </Text>
            </View>

            <View style={styles.masterSummaryRow}>
              <View style={styles.masterSummaryPill}>
                <Text style={styles.masterSummaryLabel}>프리셋</Text>
                <Text style={styles.masterSummaryValue}>{selectedLayoutLabel}</Text>
              </View>
              <View style={styles.masterSummaryPill}>
                <Text style={styles.masterSummaryLabel}>폰트</Text>
                <Text style={styles.masterSummaryValue}>{selectedFontLabel}</Text>
              </View>
              <View style={styles.masterSummaryPill}>
                <Text style={styles.masterSummaryLabel}>저장 슬롯</Text>
                <Text style={styles.masterSummaryValue}>{homeMasterSettings.savedThemeLabel}</Text>
              </View>
            </View>

            <View style={styles.masterPreviewWrap}>
              <View
                style={[
                  styles.homePreviewBoard,
                  {
                    width: HOME_PREVIEW_WIDTH,
                    height: HOME_PREVIEW_HEIGHT,
                    backgroundColor: previewBackgroundColor,
                  },
                ]}
              >
                <Text style={styles.homePreviewCaption}>드래그해서 위치 조절</Text>

                <View
                  {...signalPanResponder.panHandlers}
                  style={[
                    styles.previewSignalBlock,
                    previewPositionStyle("signal"),
                    selectedHudElement === "signal" && styles.previewBlockSelected,
                    {
                      width: 246,
                      shadowColor: `rgba(196,18,48,${0.28 * homeMasterSettings.signalGlow.red})`,
                    },
                  ]}
                >
                  <View style={[styles.previewCardShell, { backgroundColor: previewShellColor }]}>
                    <View style={styles.previewSignalInner}>
                      <Text
                        style={[
                          styles.previewSignalTitle,
                          {
                            fontSize: homeMasterSettings.sizes.signalTitle,
                            lineHeight: homeMasterSettings.sizes.signalTitle + 4,
                            fontFamily: sharedFontFamily,
                            fontWeight: sharedFontWeight,
                          },
                        ]}
                      >
                        STOP
                      </Text>
                      <Text
                        style={[
                          styles.previewSignalDistance,
                          {
                            fontSize: homeMasterSettings.sizes.distanceValue,
                            lineHeight: homeMasterSettings.sizes.distanceValue + 4,
                            fontFamily: sharedFontFamily,
                            fontWeight: sharedFontWeight,
                          },
                        ]}
                      >
                        128m
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  {...speedPanResponder.panHandlers}
                  style={[
                    styles.previewSpeedBlock,
                    previewPositionStyle("speed"),
                    selectedHudElement === "speed" && styles.previewBlockSelected,
                    { width: 242 },
                  ]}
                >
                  <View style={[styles.previewCardShell, { backgroundColor: previewShellColor }]}>
                    <View style={styles.previewSpeedInner}>
                      <Text style={[styles.previewSpeedLabel, { fontFamily: sharedFontFamily, fontWeight: sharedFontWeight }]}>현재 속도</Text>
                      <Text
                        style={[
                          styles.previewSpeedValue,
                          {
                            fontSize: homeMasterSettings.sizes.speedValue,
                            lineHeight: homeMasterSettings.sizes.speedValue + 4,
                            fontFamily: sharedFontFamily,
                            fontWeight: sharedFontWeight,
                          },
                        ]}
                      >
                        18
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  {...directionPanResponder.panHandlers}
                  style={[
                    styles.previewDirectionBlock,
                    previewPositionStyle("direction"),
                    selectedHudElement === "direction" && styles.previewBlockSelected,
                    { width: 234 },
                  ]}
                >
                  <View style={[styles.previewCardShell, { backgroundColor: previewShellColor }]}>
                    <View style={styles.previewDirectionInner}>
                      <Text
                        style={[
                          styles.previewDirectionArrow,
                          {
                            fontSize: Math.round(118 * homeMasterSettings.sizes.directionArrow),
                            lineHeight: Math.round(118 * homeMasterSettings.sizes.directionArrow) + 2,
                            fontFamily: sharedFontFamily,
                            fontWeight: "900",
                            textShadowColor: `rgba(255,255,255,${0.24 * homeMasterSettings.signalGlow.green})`,
                          },
                        ]}
                      >
                        ↑
                      </Text>
                      <Text
                        style={[
                          styles.previewDirectionLabel,
                          {
                            fontSize: homeMasterSettings.sizes.directionLabel,
                            lineHeight: homeMasterSettings.sizes.directionLabel + 2,
                            fontFamily: sharedFontFamily,
                            fontWeight: sharedFontWeight,
                          },
                        ]}
                      >
                        직진
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.masterSectionCard}>
              <Text style={styles.masterSectionTitle}>1. 위치 및 레이아웃 프리셋</Text>
              <Text style={styles.sectionDescription}>
                프리셋을 고른 뒤 미리보기 HUD 요소를 직접 드래그하거나 미세 이동 버튼으로 위치를 잡을 수 있습니다.
              </Text>

              <View style={styles.optionList}>
                {LAYOUT_PRESET_OPTIONS.map((option) => {
                  const selected = option.key === homeMasterSettings.layoutPreset;

                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      onPress={() => handleApplyLayoutPreset(option.key)}
                      style={({ pressed }) => [
                        styles.arrowOption,
                        selected && styles.arrowOptionSelected,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                        {option.title}
                      </Text>
                      <Text
                        style={[
                          styles.arrowOptionDescription,
                          selected && styles.arrowOptionDescriptionSelected,
                        ]}
                      >
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <SliderControl
                title="상하 여백 밸런스"
                description="전체 HUD를 위·아래로 움직이며 황금 비율을 맞춥니다."
                min={-24}
                max={24}
                step={2}
                value={homeMasterSettings.verticalBalance}
                displayValue={`${homeMasterSettings.verticalBalance > 0 ? "+" : ""}${homeMasterSettings.verticalBalance}`}
                onChange={(nextValue) => patchHomeMasterSettings({ verticalBalance: nextValue })}
              />

              <View style={styles.selectionWrap}>
                <Text style={styles.selectionLabel}>선택한 요소</Text>
                <View style={styles.elementChipRow}>
                  {(["signal", "speed", "direction"] as HudElementKey[]).map((elementKey) => {
                    const selected = elementKey === selectedHudElement;

                    return (
                      <Pressable
                        key={elementKey}
                        accessibilityRole="button"
                        onPress={() => setSelectedHudElement(elementKey)}
                        style={({ pressed }) => [
                          styles.elementChip,
                          selected && styles.elementChipSelected,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={[styles.elementChipText, selected && styles.elementChipTextSelected]}>
                          {ELEMENT_LABEL[elementKey]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.nudgeGrid}>
                <View style={styles.nudgeSpacer} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleMoveSelectedElement("y", -4)}
                  style={({ pressed }) => [styles.nudgeButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="keyboard-arrow-up" size={28} color="#11181c" />
                </Pressable>
                <View style={styles.nudgeSpacer} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleMoveSelectedElement("x", -4)}
                  style={({ pressed }) => [styles.nudgeButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="keyboard-arrow-left" size={28} color="#11181c" />
                </Pressable>
                <View style={styles.nudgeCenter}>
                  <Text style={styles.nudgeCenterText}>{ELEMENT_LABEL[selectedHudElement]}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleMoveSelectedElement("x", 4)}
                  style={({ pressed }) => [styles.nudgeButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="keyboard-arrow-right" size={28} color="#11181c" />
                </Pressable>
                <View style={styles.nudgeSpacer} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleMoveSelectedElement("y", 4)}
                  style={({ pressed }) => [styles.nudgeButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={28} color="#11181c" />
                </Pressable>
                <View style={styles.nudgeSpacer} />
              </View>
            </View>

            <View style={styles.masterSectionCard}>
              <Text style={styles.masterSectionTitle}>2. 크기 및 폰트 마스터</Text>
              <Text style={styles.sectionDescription}>
                속도계 숫자, 남은 거리, 화살표 크기를 독립적으로 조절하고 주행용 굵은 서체를 선택할 수 있습니다.
              </Text>

              <SliderControl
                title="속도계 숫자"
                description="중앙 속도계 숫자 크기"
                min={30}
                max={58}
                step={2}
                value={homeMasterSettings.sizes.speedValue}
                displayValue={`${homeMasterSettings.sizes.speedValue}pt`}
                onChange={(nextValue) => updateSizeValue("speedValue", nextValue)}
              />

              <SliderControl
                title="남은 거리 숫자"
                description="상단 신호 카드 거리 숫자 크기"
                min={72}
                max={112}
                step={2}
                value={homeMasterSettings.sizes.distanceValue}
                displayValue={`${homeMasterSettings.sizes.distanceValue}pt`}
                onChange={(nextValue) => updateSizeValue("distanceValue", nextValue)}
                accentColor="#C41230"
              />

              <SliderControl
                title="방향 화살표"
                description="하단 화살표의 크기 배율"
                min={0.9}
                max={1.8}
                step={0.05}
                value={homeMasterSettings.sizes.directionArrow}
                displayValue={`${homeMasterSettings.sizes.directionArrow.toFixed(2)}x`}
                onChange={(nextValue) => updateSizeValue("directionArrow", nextValue)}
                accentColor="#8E96A3"
              />

              <View style={styles.selectionWrap}>
                <Text style={styles.selectionLabel}>폰트 셀렉터</Text>
                <View style={styles.optionList}>
                  {FONT_PRESET_OPTIONS.map((option) => {
                    const selected = option.key === homeMasterSettings.fontPreset;

                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        onPress={() => patchHomeMasterSettings({ fontPreset: option.key as FontPreset })}
                        style={({ pressed }) => [
                          styles.arrowOption,
                          selected && styles.arrowOptionSelected,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={[styles.arrowOptionTitle, selected && styles.arrowOptionTitleSelected]}>
                          {option.title}
                        </Text>
                        <Text
                          style={[
                            styles.arrowOptionDescription,
                            selected && styles.arrowOptionDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.masterSectionCard}>
              <Text style={styles.masterSectionTitle}>3. 컬러 & 테마 믹서</Text>
              <Text style={styles.sectionDescription}>
                배경 그레이 명도·채도와 빨간불·초록불 Glow 강도를 조절해 HUD 대비를 맞춥니다.
              </Text>

              <SliderControl
                title="배경 그레이 명도"
                description="전체 배경 밝기"
                min={50}
                max={86}
                step={2}
                value={homeMasterSettings.theme.backgroundGrayLightness}
                displayValue={`${homeMasterSettings.theme.backgroundGrayLightness}%`}
                onChange={(nextValue) =>
                  patchHomeMasterSettings({
                    theme: {
                      ...homeMasterSettings.theme,
                      backgroundGrayLightness: nextValue,
                    },
                  })
                }
                accentColor="#7B8794"
              />

              <SliderControl
                title="배경 그레이 채도"
                description="메탈릭 톤의 차가운 회색 강도"
                min={0}
                max={20}
                step={1}
                value={homeMasterSettings.theme.backgroundGraySaturation}
                displayValue={`${homeMasterSettings.theme.backgroundGraySaturation}%`}
                onChange={(nextValue) =>
                  patchHomeMasterSettings({
                    theme: {
                      ...homeMasterSettings.theme,
                      backgroundGraySaturation: nextValue,
                    },
                  })
                }
                accentColor="#98A2B3"
              />

              <SliderControl
                title="빨간불 Glow 강도"
                description="정지 경고 빛 번짐 강도"
                min={0.4}
                max={2.2}
                step={0.1}
                value={homeMasterSettings.signalGlow.red}
                displayValue={`${homeMasterSettings.signalGlow.red.toFixed(1)}x`}
                onChange={(nextValue) =>
                  patchHomeMasterSettings({
                    signalGlow: {
                      ...homeMasterSettings.signalGlow,
                      red: nextValue,
                    },
                  })
                }
                accentColor="#C41230"
              />

              <SliderControl
                title="초록불 Glow 강도"
                description="진행 상태 빛 번짐 강도"
                min={0.4}
                max={2.2}
                step={0.1}
                value={homeMasterSettings.signalGlow.green}
                displayValue={`${homeMasterSettings.signalGlow.green.toFixed(1)}x`}
                onChange={(nextValue) =>
                  patchHomeMasterSettings({
                    signalGlow: {
                      ...homeMasterSettings.signalGlow,
                      green: nextValue,
                    },
                  })
                }
                accentColor="#42D64B"
              />
            </View>

            <View style={styles.masterSectionCard}>
              <Text style={styles.masterSectionTitle}>4. 저장 및 원상복구</Text>
              <Text style={styles.sectionDescription}>
                현재 배치를 나만의 테마 1로 저장하거나 기본 균형형 HUD로 즉시 되돌릴 수 있습니다.
              </Text>

              <View style={styles.masterActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSaveHomeTheme}
                  style={({ pressed }) => [styles.goldActionButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="workspace-premium" size={24} color="#3F2A00" />
                  <Text style={styles.goldActionButtonText}>나만의 테마 1 저장</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleResetHomeTheme}
                  style={({ pressed }) => [styles.goldOutlineButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="restart-alt" size={24} color="#7A5300" />
                  <Text style={styles.goldOutlineButtonText}>원상복구</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>빠른 목적지</Text>
            <Text style={styles.sectionDescription}>
              자주 가는 장소를 직접 추가해 두면 이후 내비게이션 연결에 활용할 수 있습니다.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                value={pendingDestination}
                onChangeText={setPendingDestination}
                placeholder="예: 병원, 마트, 부모님 댁"
                placeholderTextColor="#9ca3af"
                style={styles.destinationInput}
                returnKeyType="done"
                onSubmitEditing={handleAddDestination}
              />

              <Pressable
                accessibilityRole="button"
                onPress={handleAddDestination}
                style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.addButtonText}>추가</Text>
              </Pressable>
            </View>

            <View style={styles.destinationList}>
              {quickDestinations.map((destination) => (
                <View key={destination} style={styles.destinationChip}>
                  <Text style={styles.destinationChipText}>{destination}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleRemoveDestination(destination)}
                    style={({ pressed }) => [styles.destinationRemoveButton, pressed && styles.buttonPressed]}
                  >
                    <MaterialIcons name="close" size={22} color="#11181c" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          disabled={isSaving || isLoading}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.confirmButton,
            (isSaving || isLoading) && styles.confirmButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.confirmButtonText}>
            {isSaving ? "저장 중..." : isLoading ? "불러오는 중..." : "확인"}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: "#eef2f7",
  },
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
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
  scrollContent: {
    gap: 14,
    paddingBottom: 18,
  },
  summaryCard: {
    borderRadius: 28,
    backgroundColor: "#111827",
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d1d5db",
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#ffffff",
  },
  summaryDescription: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
    color: "#d1d5db",
  },
  sectionCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
    flex: 1,
  },
  sectionDescription: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
    color: "#4b5563",
  },
  optionList: {
    gap: 10,
  },
  providerOption: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  providerTextGroup: {
    flex: 1,
    gap: 4,
  },
  providerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  providerTitleSelected: {
    color: "#ffffff",
  },
  providerDescription: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  providerDescriptionSelected: {
    color: "#d1d5db",
  },
  arrowOption: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  arrowOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#e5f0ff",
  },
  arrowOptionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  arrowOptionTitleSelected: {
    color: "#111827",
  },
  arrowOptionDescription: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  arrowOptionDescriptionSelected: {
    color: "#334155",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  destinationInput: {
    flex: 1,
    minHeight: 62,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: "600",
    color: "#11181c",
  },
  addButton: {
    minWidth: 96,
    borderRadius: 20,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addButtonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  destinationList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  destinationChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    gap: 8,
  },
  destinationChipText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#11181c",
  },
  destinationRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  confirmButton: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  confirmButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  confirmButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  masterCenterCard: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#202938",
  },
  masterCenterHeader: {
    gap: 8,
  },
  masterCenterEyebrow: {
    fontSize: 16,
    fontWeight: "900",
    color: "#d4af37",
    letterSpacing: 0.4,
  },
  masterCenterTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#ffffff",
  },
  masterCenterDescription: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "600",
    color: "#d1d5db",
  },
  masterSummaryRow: {
    gap: 10,
  },
  masterSummaryPill: {
    borderRadius: 18,
    backgroundColor: "#1d2635",
    borderWidth: 1,
    borderColor: "#2c3749",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  masterSummaryLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#98a2b3",
  },
  masterSummaryValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
  },
  masterPreviewWrap: {
    alignItems: "center",
  },
  homePreviewBoard: {
    borderRadius: 28,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.8)",
    overflow: "hidden",
    position: "relative",
  },
  homePreviewCaption: {
    position: "absolute",
    top: 10,
    right: 12,
    zIndex: 10,
    fontSize: 14,
    fontWeight: "900",
    color: "#4b5563",
  },
  previewCardShell: {
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  previewBlockSelected: {
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d4af37",
  },
  previewSignalBlock: {
    position: "absolute",
  },
  previewSignalInner: {
    minHeight: 124,
    borderRadius: 18,
    backgroundColor: "#C41230",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
    paddingBottom: 14,
  },
  previewSignalTitle: {
    color: "#FDFDFD",
    textAlign: "center",
  },
  previewSignalDistance: {
    marginTop: 20,
    color: "#111111",
    textAlign: "center",
    letterSpacing: -1.4,
  },
  previewSpeedBlock: {
    position: "absolute",
  },
  previewSpeedInner: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#D7DCE3",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  previewSpeedLabel: {
    fontSize: 14,
    lineHeight: 17,
    color: "#6B7280",
    textAlign: "center",
  },
  previewSpeedValue: {
    marginTop: 4,
    color: "#1F2937",
    textAlign: "center",
  },
  previewDirectionBlock: {
    position: "absolute",
  },
  previewDirectionInner: {
    minHeight: 70,
    borderRadius: 18,
    backgroundColor: "#D7DCE3",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 4,
  },
  previewDirectionArrow: {
    color: "#DCE2EA",
    textAlign: "center",
    marginBottom: -14,
    transform: [{ scaleX: 1.2 }, { scaleY: 1.08 }],
  },
  previewDirectionLabel: {
    color: "#27303B",
    textAlign: "center",
  },
  masterSectionCard: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  masterSectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#11181c",
  },
  sliderCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8dee7",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sliderHeaderRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  sliderTextGroup: {
    flex: 1,
    gap: 4,
  },
  sliderTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#11181c",
  },
  sliderDescription: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    color: "#6b7280",
  },
  sliderValueBadge: {
    minWidth: 84,
    borderRadius: 14,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sliderValueBadgeText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#11181c",
  },
  sliderControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sliderStepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  sliderTrack: {
    flex: 1,
    height: 38,
    justifyContent: "center",
  },
  sliderTrackBase: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#d7dde6",
  },
  sliderTrackFill: {
    position: "absolute",
    left: 0,
    height: 8,
    borderRadius: 999,
  },
  sliderThumb: {
    position: "absolute",
    top: 4,
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 3,
  },
  selectionWrap: {
    gap: 10,
  },
  selectionLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: "#11181c",
  },
  elementChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  elementChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  elementChipSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  elementChipText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#11181c",
  },
  elementChipTextSelected: {
    color: "#ffffff",
  },
  nudgeGrid: {
    alignSelf: "center",
    width: 216,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  nudgeButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  nudgeCenter: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 6,
  },
  nudgeCenterText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  nudgeSpacer: {
    width: 58,
    height: 58,
  },
  masterActionRow: {
    gap: 10,
  },
  goldActionButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#D4AF37",
    borderWidth: 1,
    borderColor: "#F8DE84",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  goldActionButtonText: {
    fontSize: 21,
    fontWeight: "900",
    color: "#3F2A00",
  },
  goldOutlineButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#F6E4A3",
    borderWidth: 1,
    borderColor: "#E0BD54",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  goldOutlineButtonText: {
    fontSize: 21,
    fontWeight: "900",
    color: "#7A5300",
  },
});
