/**
 * 음성 및 알림 설정 화면
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  VOICE_LENGTH_OPTIONS,
  VOICE_STYLE_OPTIONS,
  type VoiceAlertLength,
  type VoiceAlertStyle,
} from "@/lib/voice-alerts";

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";

export default function VoiceAlertsSettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(true);
  const [hapticAlertsEnabled, setHapticAlertsEnabled] = useState(true);
  const [voiceAlertLength, setVoiceAlertLength] = useState<VoiceAlertLength>("detailed");
  const [voiceAlertStyle, setVoiceAlertStyle] = useState<VoiceAlertStyle>("standard");

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    saveSettings();
  }, [voiceGuideEnabled, hapticAlertsEnabled, voiceAlertLength, voiceAlertStyle]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
        setVoiceGuideEnabled(settings.voiceGuideEnabled !== false);
        setHapticAlertsEnabled(settings.hapticAlertsEnabled !== false);
        setVoiceAlertLength(settings.voiceAlertLength || "detailed");
        setVoiceAlertStyle(settings.voiceAlertStyle || "standard");
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  };

  const saveSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...settings,
          voiceGuideEnabled,
          hapticAlertsEnabled,
          voiceAlertLength,
          voiceAlertStyle,
        })
      );
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          >
            <MaterialIcons name="arrow-back" size={28} color="#11181c" />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>

          <Text style={styles.headerTitle}>음성 및 알림</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* AI 음성 가이드 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="volume-up" size={24} color="#3b82f6" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  AI 음성 가이드
                </Text>
              </View>
              <Switch value={voiceGuideEnabled} onValueChange={setVoiceGuideEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              음성 안내를 끄면 HUD 문구만 갱신하고 소리는 출력하지 않습니다.
            </Text>
          </View>

          {/* 안내 음성 길이 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="format-size" size={24} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                안내 음성 길이
              </Text>
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              상세 안내 또는 간략 안내 중 하나를 골라 문장 길이를 조절할 수 있습니다.
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
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected, lowVisionMode && styles.optionTitleLowVision]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected, lowVisionMode && styles.optionDescriptionLowVision]}>
                        {option.description}
                      </Text>
                    </View>
                    {selected && (
                      <MaterialIcons name="check-circle" size={24} color="#3b82f6" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 안내 음성 스타일 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="tune" size={24} color="#ec4899" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                안내 음성 스타일
              </Text>
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
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
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected, lowVisionMode && styles.optionTitleLowVision]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected, lowVisionMode && styles.optionDescriptionLowVision]}>
                        {option.description}
                      </Text>
                    </View>
                    {selected && (
                      <MaterialIcons name="check-circle" size={24} color="#3b82f6" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 진동 패턴 경고 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="vibration" size={24} color="#f59e0b" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  진동 패턴 경고
                </Text>
              </View>
              <Switch value={hapticAlertsEnabled} onValueChange={setHapticAlertsEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              적색, 좌회전 가능, 보행 가능 상태를 서로 다른 진동 패턴으로 구분해 화면을 보지 않아도 알 수 있게 합니다.
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#11181c",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2937",
  },
  headerSpacer: {
    width: 80,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  sectionTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  sectionDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    lineHeight: 18,
  },
  sectionDescriptionLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  optionList: {
    marginTop: 12,
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  optionSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6",
    borderWidth: 2,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: "#1e40af",
  },
  optionTitleLowVision: {
    fontSize: 18,
    lineHeight: 24,
  },
  optionDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    lineHeight: 18,
  },
  optionDescriptionSelected: {
    color: "#3b82f6",
  },
  optionDescriptionLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
