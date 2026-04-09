import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutChangeEvent,
  Modal,
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
  DEFAULT_VOICE_ALERT_SETTINGS,
  VOICE_LENGTH_OPTIONS,
  VOICE_STYLE_OPTIONS,
  type VoiceAlertLength,
  type VoiceAlertStyle,
} from "@/lib/voice-alerts";

type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";
type SettingsModalKey =
  | "voice"
  | "navigation"
  | "display"
  | "layout"
  | "font"
  | "destinations";

type AppSettings = {
  voiceGuideEnabled: boolean;
  voiceAlertLength: VoiceAlertLength;
  voiceAlertStyle: VoiceAlertStyle;
  liveRouteSyncEnabled: boolean;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  quickDestinations: string[];
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const HOME_PREVIEW_WIDTH = 296;
const HOME_PREVIEW_HEIGHT = 326;
const POSITION_LIMIT_X = 46;
const POSITION_LIMIT_Y = 38;

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: DEFAULT_VOICE_ALERT_SETTINGS.enabled,
  voiceAlertLength: DEFAULT_VOICE_ALERT_SETTINGS.length,
  voiceAlertStyle: DEFAULT_VOICE_ALERT_SETTINGS.style,
  liveRouteSyncEnabled: true,
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

const ELEMENT_LABEL: Record<HudElementKey, string> = {
  signal: "신호 카드",
  speed: "속도계",
  direction: "화살표",
};

const PREVIEW_BASE_POSITION: Record<HudElementKey, ElementOffset> = {
  signal: { x: 24, y: 16 },
  speed: { x: 28, y: 146 },
  direction: { x: 26, y: 216 },
};

const DIRECTION_ICON_BY_ARROW_SIZE: Record<ArrowSize, number> = {
  large: 94,
  xlarge: 116,
  huge: 136,
};

const GRID_CARDS: Array<{
  key: SettingsModalKey;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
}> = [
  {
    key: "voice",
    title: "음성 안내",
    subtitle: "말투와 길이",
    icon: "campaign",
    tint: "#EEF3FF",
  },
  {
    key: "navigation",
    title: "내비 연동",
    subtitle: "티맵·카카오·아이나비",
    icon: "near-me",
    tint: "#EEF8F1",
  },
  {
    key: "display",
    title: "시인성",
    subtitle: "크기와 명도",
    icon: "visibility",
    tint: "#FFF6E8",
  },
  {
    key: "layout",
    title: "배치",
    subtitle: "위치·프리셋",
    icon: "dashboard-customize",
    tint: "#F2EEFF",
  },
  {
    key: "font",
    title: "폰트",
    subtitle: "굵기와 스타일",
    icon: "text-fields",
    tint: "#F1F5F9",
  },
  {
    key: "destinations",
    title: "빠른 목적지",
    subtitle: "자주 가는 곳",
    icon: "bookmark",
    tint: "#FFF1F2",
  },
];

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
          <MaterialIcons name="remove" size={22} color="#0f172a" />
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
          <View
            style={[
              styles.sliderTrackFill,
              {
                width: `${Math.max(0, Math.min(100, normalized * 100))}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
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
          <MaterialIcons name="add" size={22} color="#0f172a" />
        </Pressable>
      </View>
    </View>
  );
}

function OptionChip({
  title,
  description,
  selected,
  onPress,
  icon,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionChip,
        selected && styles.optionChipSelected,
        pressed && styles.buttonPressed,
      ]}
    >
      <View style={styles.optionChipHeader}>
        {icon ? (
          <MaterialIcons name={icon} size={20} color={selected ? "#0f172a" : "#475569"} />
        ) : null}
        <Text style={[styles.optionChipTitle, selected && styles.optionChipTitleSelected]}>{title}</Text>
      </View>
      <Text style={[styles.optionChipDescription, selected && styles.optionChipDescriptionSelected]}>
        {description}
      </Text>
    </Pressable>
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
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [quickDestinations, setQuickDestinations] = useState<string[]>(DEFAULT_SETTINGS.quickDestinations);
  const [pendingDestination, setPendingDestination] = useState("");
  const [homeMasterSettings, setHomeMasterSettings] = useState<HomeMasterSettings>(
    DEFAULT_HOME_MASTER_SETTINGS,
  );
  const [selectedHudElement, setSelectedHudElement] = useState<HudElementKey>("direction");
  const [activeModal, setActiveModal] = useState<SettingsModalKey | null>(null);
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

  const selectedFontLabel = useMemo(() => {
    return FONT_PRESET_OPTIONS.find((option) => option.key === homeMasterSettings.fontPreset)?.title ?? "애플 Extra Bold";
  }, [homeMasterSettings.fontPreset]);

  const selectedLayoutLabel = useMemo(() => {
    return LAYOUT_PRESET_OPTIONS.find((option) => option.key === homeMasterSettings.layoutPreset)?.title ?? "균형형";
  }, [homeMasterSettings.layoutPreset]);

  const selectedArrowLabel = useMemo(() => {
    return ARROW_SIZE_OPTIONS.find((option) => option.key === arrowSize)?.title ?? "최대로";
  }, [arrowSize]);

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
      setSelectedHudElement("direction");
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
      );
    } catch (error) {
      console.error("Failed to save settings", error);
      Alert.alert("저장 실패", "설정을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = (key: SettingsModalKey) => setActiveModal(key);
  const closeModal = () => setActiveModal(null);

  const modalTitle = useMemo(() => {
    return GRID_CARDS.find((item) => item.key === activeModal)?.title ?? "설정";
  }, [activeModal]);

  const modalSubtitle = useMemo(() => {
    return GRID_CARDS.find((item) => item.key === activeModal)?.subtitle ?? "상세 조정";
  }, [activeModal]);

  const renderModalContent = () => {
    if (!activeModal) {
      return null;
    }

    if (activeModal === "voice") {
      return (
        <View style={styles.modalSectionStack}>
          <View style={styles.modalInlineCard}>
            <View style={styles.modalInlineHeader}>
              <View>
                <Text style={styles.modalInlineTitle}>AI 음성 가이드</Text>
                <Text style={styles.modalInlineDescription}>안내 멘트와 음성 출력을 함께 제어합니다.</Text>
              </View>
              <Switch value={voiceGuideEnabled} onValueChange={setVoiceGuideEnabled} />
            </View>
          </View>

          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>안내 길이</Text>
            <View style={styles.optionWrap}>
              {VOICE_LENGTH_OPTIONS.map((option) => (
                <OptionChip
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  selected={voiceAlertLength === option.key}
                  onPress={() => setVoiceAlertLength(option.key)}
                />
              ))}
            </View>
          </View>

          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>말투 스타일</Text>
            <View style={styles.optionWrap}>
              {VOICE_STYLE_OPTIONS.map((option) => (
                <OptionChip
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  selected={voiceAlertStyle === option.key}
                  onPress={() => setVoiceAlertStyle(option.key)}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    if (activeModal === "navigation") {
      return (
        <View style={styles.modalSectionStack}>
          <View style={styles.modalInlineCard}>
            <View style={styles.modalInlineHeader}>
              <View>
                <Text style={styles.modalInlineTitle}>실시간 길안내 연동</Text>
                <Text style={styles.modalInlineDescription}>외부 내비 앱 연결 상태를 기본값으로 저장합니다.</Text>
              </View>
              <Switch value={liveRouteSyncEnabled} onValueChange={setLiveRouteSyncEnabled} />
            </View>
          </View>

          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>기본 내비게이션</Text>
            <View style={styles.optionWrap}>
              {PROVIDER_OPTIONS.map((option) => (
                <OptionChip
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  selected={selectedNavigationProvider === option.key}
                  onPress={() => setSelectedNavigationProvider(option.key)}
                  icon={option.icon}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    if (activeModal === "display") {
      return (
        <View style={styles.modalSectionStack}>
          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>화살표 크기</Text>
            <View style={styles.optionWrap}>
              {ARROW_SIZE_OPTIONS.map((option) => (
                <OptionChip
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  selected={arrowSize === option.key}
                  onPress={() => setArrowSize(option.key)}
                />
              ))}
            </View>
          </View>

          <SliderControl
            title="배경 그레이 명도"
            description="눈부심 없이 편안한 밝기를 직접 찾습니다."
            min={72}
            max={96}
            step={1}
            value={homeMasterSettings.theme.backgroundGrayLightness}
            displayValue={`${Math.round(homeMasterSettings.theme.backgroundGrayLightness)}%`}
            onChange={(value) =>
              patchHomeMasterSettings({
                theme: {
                  ...homeMasterSettings.theme,
                  backgroundGrayLightness: value,
                },
              })
            }
            accentColor="#475569"
          />

          <SliderControl
            title="배경 그레이 채도"
            description="색 기운을 줄이거나 조금 남겨 화면 대비를 조절합니다."
            min={0}
            max={20}
            step={1}
            value={homeMasterSettings.theme.backgroundGraySaturation}
            displayValue={`${Math.round(homeMasterSettings.theme.backgroundGraySaturation)}%`}
            onChange={(value) =>
              patchHomeMasterSettings({
                theme: {
                  ...homeMasterSettings.theme,
                  backgroundGraySaturation: value,
                },
              })
            }
            accentColor="#64748b"
          />

          <SliderControl
            title="화살표 카드 크기"
            description="길안내 카드의 시인성을 우선으로 키웁니다."
            min={1}
            max={1.7}
            step={0.05}
            value={homeMasterSettings.sizes.directionArrow}
            displayValue={`${Math.round(homeMasterSettings.sizes.directionArrow * 100)}%`}
            onChange={(value) => updateSizeValue("directionArrow", value)}
            accentColor="#0f172a"
          />

          <SliderControl
            title="방향 라벨 크기"
            description="좌회전·직진 문구를 크게 읽히게 조절합니다."
            min={24}
            max={44}
            step={1}
            value={homeMasterSettings.sizes.directionLabel}
            displayValue={`${Math.round(homeMasterSettings.sizes.directionLabel)}pt`}
            onChange={(value) => updateSizeValue("directionLabel", value)}
            accentColor="#1d4ed8"
          />

          <SliderControl
            title="속도 숫자 크기"
            description="속도계 숫자를 멀리서도 알아볼 수 있게 키웁니다."
            min={22}
            max={44}
            step={1}
            value={homeMasterSettings.sizes.speedValue}
            displayValue={`${Math.round(homeMasterSettings.sizes.speedValue)}pt`}
            onChange={(value) => updateSizeValue("speedValue", value)}
            accentColor="#0f766e"
          />

          <SliderControl
            title="거리 숫자 크기"
            description="신호 카드의 남은 거리 숫자를 또렷하게 조절합니다."
            min={28}
            max={54}
            step={1}
            value={homeMasterSettings.sizes.distanceValue}
            displayValue={`${Math.round(homeMasterSettings.sizes.distanceValue)}pt`}
            onChange={(value) => updateSizeValue("distanceValue", value)}
            accentColor="#16a34a"
          />
        </View>
      );
    }

    if (activeModal === "layout") {
      return (
        <View style={styles.modalSectionStack}>
          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>위치 프리셋</Text>
            <View style={styles.optionWrap}>
              {LAYOUT_PRESET_OPTIONS.map((preset) => (
                <OptionChip
                  key={preset.key}
                  title={preset.title}
                  description={preset.description}
                  selected={homeMasterSettings.layoutPreset === preset.key}
                  onPress={() => handleApplyLayoutPreset(preset.key as LayoutPresetKey)}
                />
              ))}
            </View>
          </View>

          <SliderControl
            title="상하 밸런스"
            description="HUD 전체의 위아래 여백을 한 번에 맞춥니다."
            min={-30}
            max={30}
            step={1}
            value={homeMasterSettings.verticalBalance}
            displayValue={`${homeMasterSettings.verticalBalance > 0 ? "+" : ""}${Math.round(homeMasterSettings.verticalBalance)}`}
            onChange={(value) => patchHomeMasterSettings({ verticalBalance: value })}
            accentColor="#7c3aed"
          />

          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>선택 요소 미세 이동</Text>
            <Text style={styles.groupHelper}>{ELEMENT_LABEL[selectedHudElement]} 기준으로 한 칸씩 이동합니다.</Text>
            <View style={styles.selectorRow}>
              {(["signal", "speed", "direction"] as HudElementKey[]).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  onPress={() => setSelectedHudElement(key)}
                  style={({ pressed }) => [
                    styles.selectorButton,
                    selectedHudElement === key && styles.selectorButtonSelected,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorButtonText,
                      selectedHudElement === key && styles.selectorButtonTextSelected,
                    ]}
                  >
                    {ELEMENT_LABEL[key]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.directionPadRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMoveSelectedElement("y", -4)}
                style={({ pressed }) => [styles.padButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons name="keyboard-arrow-up" size={28} color="#0f172a" />
              </Pressable>
            </View>
            <View style={styles.directionPadMiddleRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMoveSelectedElement("x", -4)}
                style={({ pressed }) => [styles.padButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons name="keyboard-arrow-left" size={28} color="#0f172a" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMoveSelectedElement("x", 4)}
                style={({ pressed }) => [styles.padButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons name="keyboard-arrow-right" size={28} color="#0f172a" />
              </Pressable>
            </View>
            <View style={styles.directionPadRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleMoveSelectedElement("y", 4)}
                style={({ pressed }) => [styles.padButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons name="keyboard-arrow-down" size={28} color="#0f172a" />
              </Pressable>
            </View>
          </View>

          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>HUD 미리보기</Text>
            <Text style={styles.groupHelper}>카드를 직접 끌어서 위치를 조절한 뒤 확인만 누르면 됩니다.</Text>
            <View style={[styles.previewFrame, { backgroundColor: previewBackgroundColor }]}> 
              <View style={[styles.previewGhostCard, styles.previewSignalGhost, { backgroundColor: previewShellColor }]} />
              <View style={[styles.previewGhostCard, styles.previewSpeedGhost, { backgroundColor: previewShellColor }]} />
              <View style={[styles.previewGhostCard, styles.previewDirectionGhost, { backgroundColor: previewShellColor }]} />

              <View
                style={[
                  styles.previewCard,
                  styles.previewSignalCard,
                  previewPositionStyle("signal"),
                  selectedHudElement === "signal" && styles.previewCardSelected,
                  { backgroundColor: previewShellColor },
                ]}
                {...signalPanResponder.panHandlers}
              >
                <Text style={[styles.previewSignalText, { fontFamily: sharedFontFamily, fontWeight: sharedFontWeight }]}>GO</Text>
              </View>

              <View
                style={[
                  styles.previewCard,
                  styles.previewSpeedCard,
                  previewPositionStyle("speed"),
                  selectedHudElement === "speed" && styles.previewCardSelected,
                  { backgroundColor: previewShellColor },
                ]}
                {...speedPanResponder.panHandlers}
              >
                <Text style={[styles.previewSpeedLabel, { fontFamily: sharedFontFamily, fontWeight: sharedFontWeight }]}>현재 속도</Text>
                <Text style={[styles.previewSpeedValue, { fontFamily: sharedFontFamily, fontWeight: sharedFontWeight }]}>18 km/h</Text>
              </View>

              <View
                style={[
                  styles.previewCard,
                  styles.previewDirectionCard,
                  previewPositionStyle("direction"),
                  selectedHudElement === "direction" && styles.previewCardSelected,
                  { backgroundColor: previewShellColor },
                ]}
                {...directionPanResponder.panHandlers}
              >
                <MaterialIcons name="west" size={DIRECTION_ICON_BY_ARROW_SIZE[arrowSize]} color="#1e293b" />
                <Text style={[styles.previewDirectionText, { fontFamily: sharedFontFamily, fontWeight: sharedFontWeight }]}>좌회전</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (activeModal === "font") {
      return (
        <View style={styles.modalSectionStack}>
          <View style={styles.modalInlineCard}>
            <Text style={styles.groupTitle}>폰트 스타일</Text>
            <View style={styles.optionWrap}>
              {FONT_PRESET_OPTIONS.map((option) => (
                <OptionChip
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  selected={homeMasterSettings.fontPreset === option.key}
                  onPress={() => patchHomeMasterSettings({ fontPreset: option.key as FontPreset })}
                />
              ))}
            </View>
          </View>

          <SliderControl
            title="신호 카드 제목 크기"
            description="GO, STOP 같은 신호 제목을 더 강하게 보이게 조절합니다."
            min={24}
            max={46}
            step={1}
            value={homeMasterSettings.sizes.signalTitle}
            displayValue={`${Math.round(homeMasterSettings.sizes.signalTitle)}pt`}
            onChange={(value) => updateSizeValue("signalTitle", value)}
            accentColor="#dc2626"
          />

          <SliderControl
            title="HUD 쉘 투명도"
            description="카드 배경의 존재감을 줄이거나 더 또렷하게 올립니다."
            min={0.25}
            max={0.9}
            step={0.05}
            value={homeMasterSettings.theme.hudShellOpacity}
            displayValue={`${Math.round(homeMasterSettings.theme.hudShellOpacity * 100)}%`}
            onChange={(value) =>
              patchHomeMasterSettings({
                theme: {
                  ...homeMasterSettings.theme,
                  hudShellOpacity: value,
                },
              })
            }
            accentColor="#f97316"
          />
        </View>
      );
    }

    return (
      <View style={styles.modalSectionStack}>
        <View style={styles.modalInlineCard}>
          <Text style={styles.groupTitle}>빠른 목적지</Text>
          <Text style={styles.groupHelper}>자주 가는 곳을 한 번에 저장하고 필요 없는 항목은 바로 정리합니다.</Text>
          <View style={styles.destinationInputRow}>
            <TextInput
              value={pendingDestination}
              onChangeText={setPendingDestination}
              placeholder="예: 병원, 충전소"
              placeholderTextColor="#94a3b8"
              style={styles.destinationInput}
              returnKeyType="done"
              onSubmitEditing={handleAddDestination}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleAddDestination}
              style={({ pressed }) => [styles.destinationAddButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.destinationAddButtonText}>추가</Text>
            </Pressable>
          </View>
          <View style={styles.destinationWrap}>
            {quickDestinations.map((destination) => (
              <View key={destination} style={styles.destinationChip}>
                <Text style={styles.destinationChipText}>{destination}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleRemoveDestination(destination)}
                  style={({ pressed }) => [styles.destinationRemoveButton, pressed && styles.buttonPressed]}
                >
                  <MaterialIcons name="close" size={16} color="#475569" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.modalInlineCard}>
          <Text style={styles.groupTitle}>나만의 테마 1</Text>
          <Text style={styles.groupHelper}>대표님이 맞춘 HUD 조합을 저장하거나 즉시 기본값으로 되돌릴 수 있습니다.</Text>
          <View style={styles.modalActionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={handleSaveHomeTheme}
              style={({ pressed }) => [styles.secondaryActionButton, pressed && styles.buttonPressed]}
            >
              <MaterialIcons name="bookmark-added" size={20} color="#0f172a" />
              <Text style={styles.secondaryActionText}>테마 저장</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleResetHomeTheme}
              style={({ pressed }) => [styles.goldActionButton, pressed && styles.buttonPressed]}
            >
              <MaterialIcons name="restart-alt" size={20} color="#5b4100" />
              <Text style={styles.goldActionText}>원상복구</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer style={styles.screenContent}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingTitle}>설정 불러오는 중</Text>
          <Text style={styles.loadingDescription}>그리드 설정 센터를 준비하고 있습니다.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          >
            <MaterialIcons name="arrow-back" size={22} color="#11181c" />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerEyebrow}>Home-Master Custom</Text>
            <Text style={styles.headerTitle}>설정 센터</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.headerSaveButton,
              isSaving && styles.headerSaveButtonDisabled,
              pressed && !isSaving && styles.buttonPressed,
            ]}
          >
            <Text style={styles.headerSaveText}>{isSaving ? "저장 중" : "저장"}</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>한 화면에서 바로 조정</Text>
            <Text style={styles.heroDescription}>
              길안내 시인성, 음성, 배치, 폰트, 빠른 목적지를 큰 아이콘 카드로 묶고 상세 조정은 중앙 팝업에서 끝냅니다.
            </Text>
          </View>
          <View style={styles.heroPillWrap}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>현재 내비</Text>
              <Text style={styles.heroPillValue}>{currentProviderLabel}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>화살표</Text>
              <Text style={styles.heroPillValue}>{selectedArrowLabel}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>폰트</Text>
              <Text style={styles.heroPillValue}>{selectedFontLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.gridWrap}>
          {GRID_CARDS.map((card) => (
            <Pressable
              key={card.key}
              accessibilityRole="button"
              onPress={() => openModal(card.key)}
              style={({ pressed }) => [styles.gridCard, { backgroundColor: card.tint }, pressed && styles.buttonPressed]}
            >
              <View style={styles.gridIconCircle}>
                <MaterialIcons name={card.icon} size={28} color="#0f172a" />
              </View>
              <Text style={styles.gridCardTitle}>{card.title}</Text>
              <Text style={styles.gridCardSubtitle}>{card.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerSummaryCard}>
            <Text style={styles.footerSummaryLabel}>길안내 카드</Text>
            <Text style={styles.footerSummaryValue}>{selectedLayoutLabel}</Text>
          </View>
          <View style={styles.footerSummaryCard}>
            <Text style={styles.footerSummaryLabel}>음성 스타일</Text>
            <Text style={styles.footerSummaryValue}>{selectedStyleLabel}</Text>
          </View>
          <View style={styles.footerSummaryCard}>
            <Text style={styles.footerSummaryLabel}>테마 슬롯</Text>
            <Text style={styles.footerSummaryValue}>{homeMasterSettings.savedThemeLabel}</Text>
          </View>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={activeModal !== null} onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{modalTitle}</Text>
                <Text style={styles.modalSubtitle}>{modalSubtitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={closeModal}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderModalContent()}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={closeModal}
                style={({ pressed }) => [styles.modalConfirmButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.modalConfirmText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    backgroundColor: "#d6dbe3",
  },
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 14,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  loadingTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  loadingDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  backButton: {
    minWidth: 82,
    height: 44,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.8,
  },
  headerSaveButton: {
    minWidth: 82,
    height: 44,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  headerSaveButtonDisabled: {
    opacity: 0.7,
  },
  headerSaveText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc",
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    gap: 14,
  },
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.6,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
  heroPillWrap: {
    flexDirection: "row",
    gap: 10,
  },
  heroPill: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(226,232,240,0.86)",
    gap: 2,
  },
  heroPillLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#64748b",
  },
  heroPillValue: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    color: "#0f172a",
  },
  gridWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignContent: "flex-start",
  },
  gridCard: {
    width: "31.4%",
    minHeight: 140,
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  gridIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  gridCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: "#475569",
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerSummaryCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.64)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  footerSummaryLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: "#64748b",
  },
  footerSummaryValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 26,
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "90%",
    borderRadius: 30,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: "#64748b",
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  modalSectionStack: {
    gap: 14,
  },
  modalInlineCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  modalInlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalInlineTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  modalInlineDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
    maxWidth: 260,
  },
  groupTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#0f172a",
  },
  groupHelper: {
    marginTop: -4,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  optionWrap: {
    gap: 10,
  },
  optionChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  optionChipSelected: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  optionChipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionChipTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  optionChipTitleSelected: {
    color: "#020617",
  },
  optionChipDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  optionChipDescriptionSelected: {
    color: "#334155",
  },
  selectorRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  selectorButton: {
    flex: 1,
    minWidth: 88,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorButtonSelected: {
    backgroundColor: "#111827",
  },
  selectorButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  selectorButtonTextSelected: {
    color: "#f8fafc",
  },
  directionPadRow: {
    alignItems: "center",
  },
  directionPadMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
  },
  padButton: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  previewFrame: {
    height: HOME_PREVIEW_HEIGHT,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d6dbe3",
    overflow: "hidden",
    position: "relative",
  },
  previewGhostCard: {
    position: "absolute",
    borderRadius: 18,
    opacity: 0.2,
  },
  previewSignalGhost: {
    left: 16,
    top: 12,
    width: HOME_PREVIEW_WIDTH - 32,
    height: 112,
  },
  previewSpeedGhost: {
    left: 22,
    top: 142,
    width: HOME_PREVIEW_WIDTH - 44,
    height: 58,
  },
  previewDirectionGhost: {
    left: 18,
    top: 214,
    width: HOME_PREVIEW_WIDTH - 36,
    height: 92,
  },
  previewCard: {
    position: "absolute",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  previewCardSelected: {
    borderColor: "#0f172a",
    borderWidth: 1.5,
  },
  previewSignalCard: {
    width: HOME_PREVIEW_WIDTH - 36,
    height: 106,
  },
  previewSignalText: {
    fontSize: 34,
    lineHeight: 40,
    color: "#ffffff",
    textShadowColor: "rgba(15,23,42,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  previewSpeedCard: {
    width: HOME_PREVIEW_WIDTH - 54,
    height: 56,
    gap: 2,
  },
  previewSpeedLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#475569",
  },
  previewSpeedValue: {
    fontSize: 22,
    lineHeight: 26,
    color: "#0f172a",
  },
  previewDirectionCard: {
    width: HOME_PREVIEW_WIDTH - 40,
    height: 96,
    gap: 2,
  },
  previewDirectionText: {
    fontSize: 24,
    lineHeight: 28,
    color: "#0f172a",
  },
  destinationInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  destinationInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0f172a",
  },
  destinationAddButton: {
    minWidth: 72,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  destinationAddButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc",
  },
  destinationWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  destinationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  destinationChipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#1e293b",
  },
  destinationRemoveButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  goldActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 20,
    backgroundColor: "#f7d676",
    borderWidth: 1,
    borderColor: "#e3b93c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  goldActionText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#5b4100",
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalConfirmButton: {
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: "#f8fafc",
  },
  sliderCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sliderHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sliderTextGroup: {
    flex: 1,
    gap: 4,
  },
  sliderTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    color: "#0f172a",
  },
  sliderDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },
  sliderValueBadge: {
    minWidth: 72,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderValueBadgeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  sliderControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderStepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderTrack: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  sliderTrackBase: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d7dee7",
  },
  sliderTrackFill: {
    position: "absolute",
    left: 0,
    height: 10,
    borderRadius: 999,
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -12,
    backgroundColor: "#ffffff",
    borderWidth: 3,
    top: 8,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
