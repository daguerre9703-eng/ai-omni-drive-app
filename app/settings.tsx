import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";

type NavigationProvider = "kakaomap" | "inavi" | "tmap";
type ArrowSize = "large" | "xlarge" | "huge";

type AppSettings = {
  voiceGuideEnabled: boolean;
  liveRouteSyncEnabled: boolean;
  selectedNavigationProvider: NavigationProvider;
  arrowSize: ArrowSize;
  quickDestinations: string[];
};

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";

const DEFAULT_SETTINGS: AppSettings = {
  voiceGuideEnabled: true,
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

export default function SettingsScreen() {
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(DEFAULT_SETTINGS.voiceGuideEnabled);
  const [liveRouteSyncEnabled, setLiveRouteSyncEnabled] = useState(DEFAULT_SETTINGS.liveRouteSyncEnabled);
  const [selectedNavigationProvider, setSelectedNavigationProvider] = useState<NavigationProvider>(
    DEFAULT_SETTINGS.selectedNavigationProvider,
  );
  const [arrowSize, setArrowSize] = useState<ArrowSize>(DEFAULT_SETTINGS.arrowSize);
  const [quickDestinations, setQuickDestinations] = useState<string[]>(DEFAULT_SETTINGS.quickDestinations);
  const [pendingDestination, setPendingDestination] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

        if (!savedValue) {
          return;
        }

        const parsed = JSON.parse(savedValue) as Partial<AppSettings>;

        if (!isMounted) {
          return;
        }

        setVoiceGuideEnabled(parsed.voiceGuideEnabled ?? DEFAULT_SETTINGS.voiceGuideEnabled);
        setLiveRouteSyncEnabled(parsed.liveRouteSyncEnabled ?? DEFAULT_SETTINGS.liveRouteSyncEnabled);
        setSelectedNavigationProvider(
          parsed.selectedNavigationProvider ?? DEFAULT_SETTINGS.selectedNavigationProvider,
        );
        setArrowSize(parsed.arrowSize ?? DEFAULT_SETTINGS.arrowSize);
        setQuickDestinations(parsed.quickDestinations ?? DEFAULT_SETTINGS.quickDestinations);
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

  const currentProviderLabel = useMemo(() => {
    return PROVIDER_OPTIONS.find((option) => option.key === selectedNavigationProvider)?.title ?? "티맵";
  }, [selectedNavigationProvider]);

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

  const handleSave = async () => {
    const nextSettings: AppSettings = {
      voiceGuideEnabled,
      liveRouteSyncEnabled,
      selectedNavigationProvider,
      arrowSize,
      quickDestinations,
    };

    try {
      setIsSaving(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      Alert.alert(
        "저장 완료",
        `${currentProviderLabel} 연동 설정과 화살표 크기 설정을 저장했습니다.`,
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
              사용자가 선택한 내비게이션 앱 기준으로 경로 연동과 방향 안내를 맞춥니다.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>AI 음성 가이드</Text>
              <Switch value={voiceGuideEnabled} onValueChange={setVoiceGuideEnabled} />
            </View>
            <Text style={styles.sectionDescription}>
              신호 상태와 방향 안내를 음성으로 읽어 줍니다.
            </Text>
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
});
