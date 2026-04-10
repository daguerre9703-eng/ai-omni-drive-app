/**
 * 앱 정보 및 도움말 화면
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";
const APP_VERSION = "1.0.0";
const BUILD_NUMBER = "2026041001";

export default function AboutSettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
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

          <Text style={styles.headerTitle}>앱 정보</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 앱 버전 정보 */}
          <View style={styles.sectionCard}>
            <View style={styles.appIconContainer}>
              <MaterialIcons name="drive-eta" size={64} color="#3b82f6" />
            </View>
            <Text style={[styles.appName, lowVisionMode && styles.appNameLowVision]}>
              AI Omni-Drive
            </Text>
            <Text style={[styles.appTagline, lowVisionMode && styles.appTaglineLowVision]}>
              비전 AI 기반 안전 운전 보조 시스템
            </Text>
            <View style={styles.versionContainer}>
              <Text style={[styles.versionText, lowVisionMode && styles.versionTextLowVision]}>
                버전 {APP_VERSION} (빌드 {BUILD_NUMBER})
              </Text>
            </View>
          </View>

          {/* 주요 기능 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="star" size={24} color="#f59e0b" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                주요 기능
              </Text>
            </View>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  신호등 실시간 인식 (TLR & SPaT)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  차선 이탈 경고 (LDW)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  교통 표지판 인식 (TSR)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  전방 차량 감지 및 충돌 경고
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  음성 명령 제어
                </Text>
              </View>
            </View>
          </View>

          {/* 사용 가이드 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="help-outline" size={24} color="#3b82f6" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                사용 가이드
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleOpenLink("https://docs.ai-omni-drive.com")}
              style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
            >
              <Text style={[styles.linkButtonText, lowVisionMode && styles.linkButtonTextLowVision]}>
                온라인 사용 설명서 보기
              </Text>
              <MaterialIcons name="open-in-new" size={18} color="#3b82f6" />
            </Pressable>
          </View>

          {/* 라이선스 및 오픈소스 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="description" size={24} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                라이선스 및 오픈소스
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleOpenLink("https://github.com/ai-omni-drive/licenses")}
              style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
            >
              <Text style={[styles.linkButtonText, lowVisionMode && styles.linkButtonTextLowVision]}>
                오픈소스 라이선스 보기
              </Text>
              <MaterialIcons name="open-in-new" size={18} color="#3b82f6" />
            </Pressable>
          </View>

          {/* 개발자 정보 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="code" size={24} color="#10b981" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                개발자 정보
              </Text>
            </View>
            <Text style={[styles.developerText, lowVisionMode && styles.developerTextLowVision]}>
              © 2026 AI Omni-Drive Team
            </Text>
            <Text style={[styles.developerText, lowVisionMode && styles.developerTextLowVision]}>
              Powered by Vision AI & React Native
            </Text>
          </View>

          {/* 푸터 */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, lowVisionMode && styles.footerTextLowVision]}>
              안전 운전을 최우선으로 합니다.
            </Text>
            <Text style={[styles.footerText, lowVisionMode && styles.footerTextLowVision]}>
              운전 중에는 도로에 집중하세요.
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
  appIconContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 4,
  },
  appNameLowVision: {
    fontSize: 28,
    lineHeight: 34,
  },
  appTagline: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 12,
  },
  appTaglineLowVision: {
    fontSize: 17,
    lineHeight: 24,
  },
  versionContainer: {
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  versionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
  },
  versionTextLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
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
  featureList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  featureTextLowVision: {
    fontSize: 17,
    lineHeight: 24,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e40af",
  },
  linkButtonTextLowVision: {
    fontSize: 17,
    lineHeight: 24,
  },
  developerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  developerTextLowVision: {
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textAlign: "center",
  },
  footerTextLowVision: {
    fontSize: 15,
    lineHeight: 21,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
