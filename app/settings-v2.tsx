/**
 * Settings Screen v2 - 카테고리별 정리
 *
 * 대분류:
 * 1. 음성 및 알림
 * 2. 신호등 인식
 * 3. 안전 보조 기능
 * 4. 내비게이션
 * 5. 화면 및 접근성
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

type SettingsCategory = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  description: string;
  route?: string;
  badge?: string;
};

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "voice_alerts",
    title: "음성 및 알림",
    icon: "volume-up",
    description: "음성 안내, 진동 경고, TTS 설정",
    route: "/settings/voice-alerts",
  },
  {
    id: "traffic_signal",
    title: "신호등 인식",
    icon: "traffic",
    description: "신호 감지, 적색 경고, 환경 적응",
    route: "/settings/traffic-signal",
  },
  {
    id: "safety_assist",
    title: "안전 보조 기능",
    icon: "shield",
    description: "차선 이탈(LDW), 표지판(TSR), 전방 차량",
    route: "/settings/safety-assist",
    badge: "NEW",
  },
  {
    id: "navigation",
    title: "내비게이션",
    icon: "navigation",
    description: "경로 연동, 화살표, 빠른 목적지",
    route: "/settings/navigation",
  },
  {
    id: "display_accessibility",
    title: "화면 및 접근성",
    icon: "accessibility",
    description: "저시력 모드, HUD 커스터마이징",
    route: "/settings/display",
  },
  {
    id: "about",
    title: "앱 정보 및 도움말",
    icon: "info",
    description: "버전 정보, 사용 가이드, 라이선스",
    route: "/settings/about",
  },
];

export default function SettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem("ai-omni-drive:settings");
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.root}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
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
        >
          {/* 빠른 설정 토글 */}
          <View style={styles.quickSettingsCard}>
            <Text style={[styles.quickSettingsTitle, lowVisionMode && styles.quickSettingsTitleLowVision]}>
              빠른 설정
            </Text>

            <View style={styles.quickSettingRow}>
              <View style={styles.quickSettingInfo}>
                <MaterialIcons name="accessibility" size={24} color="#4b5563" />
                <Text style={[styles.quickSettingLabel, lowVisionMode && styles.quickSettingLabelLowVision]}>
                  저시력 모드
                </Text>
              </View>
              <Switch
                value={lowVisionMode}
                onValueChange={async (value) => {
                  setLowVisionMode(value);
                  try {
                    const stored = await AsyncStorage.getItem("ai-omni-drive:settings");
                    const settings = stored ? JSON.parse(stored) : {};
                    await AsyncStorage.setItem(
                      "ai-omni-drive:settings",
                      JSON.stringify({ ...settings, lowVisionModeEnabled: value })
                    );
                  } catch (error) {
                    console.error("Failed to save setting", error);
                  }
                }}
              />
            </View>
          </View>

          {/* 설정 카테고리 목록 */}
          <View style={styles.categoriesSection}>
            <Text style={[styles.sectionLabel, lowVisionMode && styles.sectionLabelLowVision]}>
              설정 카테고리
            </Text>

            {SETTINGS_CATEGORIES.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                onPress={() => {
                  if (category.route) {
                    router.push(category.route as any);
                  }
                }}
                style={({ pressed }) => [
                  styles.categoryCard,
                  pressed && styles.categoryCardPressed,
                ]}
              >
                <View style={styles.categoryIconContainer}>
                  <MaterialIcons
                    name={category.icon}
                    size={32}
                    color="#3b82f6"
                  />
                  {category.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{category.badge}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.categoryContent}>
                  <View style={styles.categoryHeader}>
                    <Text style={[styles.categoryTitle, lowVisionMode && styles.categoryTitleLowVision]}>
                      {category.title}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color="#9ca3af"
                    />
                  </View>
                  <Text style={[styles.categoryDescription, lowVisionMode && styles.categoryDescriptionLowVision]}>
                    {category.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* 고급 설정 */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings" as any)}
            style={({ pressed }) => [
              styles.advancedSettingsButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <MaterialIcons name="tune" size={20} color="#6b7280" />
            <Text style={[styles.advancedSettingsText, lowVisionMode && styles.advancedSettingsTextLowVision]}>
              고급 설정 (레거시)
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>
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
    paddingRight: 12,
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
  quickSettingsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickSettingsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 12,
  },
  quickSettingsTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  quickSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  quickSettingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickSettingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
  },
  quickSettingLabelLowVision: {
    fontSize: 18,
    lineHeight: 24,
  },
  categoriesSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionLabelLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  categoryCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryCardPressed: {
    backgroundColor: "#f8fafc",
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
  },
  categoryContent: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  categoryTitleLowVision: {
    fontSize: 20,
    lineHeight: 26,
  },
  categoryDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    lineHeight: 18,
  },
  categoryDescriptionLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  advancedSettingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 8,
  },
  advancedSettingsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  advancedSettingsTextLowVision: {
    fontSize: 17,
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
