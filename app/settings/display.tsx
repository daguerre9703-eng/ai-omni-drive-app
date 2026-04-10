/**
 * 화면 및 접근성 설정 화면
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
  Slider,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";

export default function DisplaySettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);
  const [hudBrightness, setHudBrightness] = useState(0.8);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [colorBlindModeEnabled, setColorBlindModeEnabled] = useState(false);
  const [largeIconsEnabled, setLargeIconsEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    saveSettings();
  }, [lowVisionMode, hudBrightness, highContrastEnabled, colorBlindModeEnabled, largeIconsEnabled]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
        setHudBrightness(settings.hudBrightness || 0.8);
        setHighContrastEnabled(settings.highContrastEnabled || false);
        setColorBlindModeEnabled(settings.colorBlindModeEnabled || false);
        setLargeIconsEnabled(settings.largeIconsEnabled || false);
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
          lowVisionModeEnabled: lowVisionMode,
          hudBrightness,
          highContrastEnabled,
          colorBlindModeEnabled,
          largeIconsEnabled,
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

          <Text style={styles.headerTitle}>화면 및 접근성</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 저시력 모드 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="accessibility" size={24} color="#3b82f6" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  저시력 모드
                </Text>
              </View>
              <Switch value={lowVisionMode} onValueChange={setLowVisionMode} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              글씨와 아이콘 크기를 키우고 색상 대비를 강화합니다.
            </Text>
          </View>

          {/* HUD 밝기 조절 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="brightness-6" size={24} color="#f59e0b" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                HUD 밝기 조절
              </Text>
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              HUD 오버레이의 밝기를 조절합니다.
            </Text>
            <View style={styles.sliderContainer}>
              <MaterialIcons name="brightness-low" size={20} color="#6b7280" />
              <Slider
                style={styles.slider}
                minimumValue={0.3}
                maximumValue={1.0}
                value={hudBrightness}
                onValueChange={setHudBrightness}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#cbd5e1"
              />
              <MaterialIcons name="brightness-high" size={20} color="#6b7280" />
            </View>
          </View>

          {/* 고대비 모드 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="contrast" size={24} color="#1f2937" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  고대비 모드
                </Text>
              </View>
              <Switch value={highContrastEnabled} onValueChange={setHighContrastEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              텍스트와 배경의 명도 차이를 극대화하여 가독성을 높입니다.
            </Text>
          </View>

          {/* 색각 이상 지원 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="palette" size={24} color="#8b5cf6" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  색각 이상 지원
                </Text>
              </View>
              <Switch value={colorBlindModeEnabled} onValueChange={setColorBlindModeEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              적록색맹을 위한 색상 팔레트를 적용합니다. (빨강 → 주황, 초록 → 청록)
            </Text>
          </View>

          {/* 큰 아이콘 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="aspect-ratio" size={24} color="#10b981" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  큰 아이콘
                </Text>
              </View>
              <Switch value={largeIconsEnabled} onValueChange={setLargeIconsEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              신호등, 차량, 표지판 아이콘의 크기를 1.5배로 확대합니다.
            </Text>
          </View>

          {/* 정보 카드 */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#3b82f6" />
            <Text style={[styles.infoText, lowVisionMode && styles.infoTextLowVision]}>
              접근성 설정은 모든 화면에 즉시 반영됩니다.
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
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  slider: {
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1e40af",
    lineHeight: 18,
  },
  infoTextLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
