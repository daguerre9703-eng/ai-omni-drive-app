/**
 * 신호등 인식 설정 화면
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

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";

export default function TrafficSignalSettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);
  const [autoRedAlertEnabled, setAutoRedAlertEnabled] = useState(true);
  const [countdownRecognitionEnabled, setCountdownRecognitionEnabled] = useState(true);
  const [environmentAdaptationEnabled, setEnvironmentAdaptationEnabled] = useState(true);
  const [signalTimingPredictionEnabled, setSignalTimingPredictionEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    saveSettings();
  }, [autoRedAlertEnabled, countdownRecognitionEnabled, environmentAdaptationEnabled, signalTimingPredictionEnabled]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
        setAutoRedAlertEnabled(settings.autoRedAlertEnabled !== false);
        setCountdownRecognitionEnabled(settings.countdownRecognitionEnabled !== false);
        setEnvironmentAdaptationEnabled(settings.environmentAdaptationEnabled !== false);
        setSignalTimingPredictionEnabled(settings.signalTimingPredictionEnabled !== false);
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
          autoRedAlertEnabled,
          countdownRecognitionEnabled,
          environmentAdaptationEnabled,
          signalTimingPredictionEnabled,
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

          <Text style={styles.headerTitle}>신호등 인식</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 적색 신호 자동 경고 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="traffic" size={24} color="#ef4444" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  적색 신호 자동 경고
                </Text>
              </View>
              <Switch value={autoRedAlertEnabled} onValueChange={setAutoRedAlertEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              빨간불 감지 시 즉시 음성 안내와 진동 경고를 울립니다.
            </Text>
          </View>

          {/* 카운트다운 인식 (OCR) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="timer" size={24} color="#3b82f6" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  카운트다운 인식 (OCR)
                </Text>
              </View>
              <Switch value={countdownRecognitionEnabled} onValueChange={setCountdownRecognitionEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              신호등 숫자 카운트다운을 읽어 남은 시간을 알려줍니다.
            </Text>
          </View>

          {/* 신호 타이밍 예측 (학습) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="psychology" size={24} color="#8b5cf6" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  신호 타이밍 예측 (학습)
                </Text>
              </View>
              <Switch value={signalTimingPredictionEnabled} onValueChange={setSignalTimingPredictionEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              동일 교차로의 신호 패턴을 학습해 주기를 예측합니다.
            </Text>
          </View>

          {/* 환경 자동 적응 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="wb-sunny" size={24} color="#f59e0b" />
                <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                  환경 자동 적응
                </Text>
              </View>
              <Switch value={environmentAdaptationEnabled} onValueChange={setEnvironmentAdaptationEnabled} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              주간/야간, 날씨 조건에 따라 신호등 감지 알고리즘을 자동 조정합니다.
            </Text>
          </View>

          {/* 정보 카드 */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color="#3b82f6" />
            <Text style={[styles.infoText, lowVisionMode && styles.infoTextLowVision]}>
              신호등 인식 기능은 카메라 화면에서 실시간 스캔을 켜야 작동합니다.
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
