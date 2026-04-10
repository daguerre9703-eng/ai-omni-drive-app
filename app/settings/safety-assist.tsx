/**
 * 안전 보조 기능 설정 화면
 *
 * - LDW (차선 이탈 경고)
 * - TSR (교통 표지판 인식)
 * - 전방 차량 감지
 * - 전방 알림 거리
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
  setLDWEnabled,
  setSpeedLimitAlertEnabled,
} from "@/lib/lane-departure-warning";
import {
  setTSREnabled,
} from "@/lib/traffic-sign-recognition";
import {
  setAdvanceNotificationMode,
  getAdvanceNotificationModeLabel,
  getAdvanceNotificationModeDescription,
  ALL_MODES,
  type AdvanceNotificationMode,
} from "@/lib/advance-notification";

const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";

export default function SafetyAssistSettingsScreen() {
  const [lowVisionMode, setLowVisionMode] = useState(false);
  const [ldwEnabled, setLdwEnabled] = useState(true);
  const [tsrEnabled, setTsrEnabledState] = useState(true);
  const [speedLimitAlertEnabled, setSpeedLimitAlertEnabledState] = useState(true);
  const [distanceMode, setDistanceMode] = useState<AdvanceNotificationMode>("auto");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setLowVisionMode(settings.lowVisionModeEnabled || false);
        setLdwEnabled(settings.ldwEnabled !== false);
        setTsrEnabledState(settings.tsrEnabled !== false);
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  };

  const handleLDWToggle = async (value: boolean) => {
    setLdwEnabled(value);
    await setLDWEnabled(value);
  };

  const handleTSRToggle = async (value: boolean) => {
    setTsrEnabledState(value);
    await setTSREnabled(value);
  };

  const handleSpeedLimitAlertToggle = async (value: boolean) => {
    setSpeedLimitAlertEnabledState(value);
    await setSpeedLimitAlertEnabled(value);
  };

  const handleDistanceModeChange = async (mode: AdvanceNotificationMode) => {
    setDistanceMode(mode);
    await setAdvanceNotificationMode(mode);
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

          <Text style={styles.headerTitle}>안전 보조 기능</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* LDW 차선 이탈 경고 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="settings-backup-restore" size={24} color="#ef4444" />
                <View style={styles.titleWithBadge}>
                  <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                    LDW 차선 이탈 경고
                  </Text>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                </View>
              </View>
              <Switch value={ldwEnabled} onValueChange={handleLDWToggle} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              방향지시등 없이 차선을 이탈하면 시각·청각·촉각 경고를 제공합니다. 차선 가시성과 이탈 거리를 실시간으로 감지합니다.
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  실시간 차선 인식 (2초마다)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  가상 방향지시등 지원
                </Text>
              </View>
            </View>
          </View>

          {/* TSR 교통 표지판 인식 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="traffic" size={24} color="#f59e0b" />
                <View style={styles.titleWithBadge}>
                  <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                    TSR 교통 표지판 인식
                  </Text>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                </View>
              </View>
              <Switch value={tsrEnabled} onValueChange={handleTSRToggle} />
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              속도 제한, 스쿨존, 일시 정지 등 중요 표지판을 인식하여 표시합니다. 내비게이션 데이터와 연동하여 정확도를 향상시킵니다.
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  속도 제한 표지판 감지 (5초마다)
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#10b981" />
                <Text style={[styles.featureText, lowVisionMode && styles.featureTextLowVision]}>
                  스쿨존 자동 30km/h 제한
                </Text>
              </View>
            </View>

            {/* 속도 초과 알림 */}
            <View style={styles.subSettingRow}>
              <Text style={[styles.subSettingLabel, lowVisionMode && styles.subSettingLabelLowVision]}>
                속도 초과 알림
              </Text>
              <Switch value={speedLimitAlertEnabled} onValueChange={handleSpeedLimitAlertToggle} />
            </View>
          </View>

          {/* 전방 알림 거리 설정 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="straighten" size={24} color="#3b82f6" />
              <Text style={[styles.sectionTitle, lowVisionMode && styles.sectionTitleLowVision]}>
                전방 알림 거리 설정
              </Text>
            </View>
            <Text style={[styles.sectionDescription, lowVisionMode && styles.sectionDescriptionLowVision]}>
              신호등 및 위험 요소를 몇 미터 전방에서 알림받을지 설정합니다.
            </Text>

            <View style={styles.optionList}>
              {ALL_MODES.map((mode) => {
                const selected = mode === distanceMode;

                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    onPress={() => handleDistanceModeChange(mode)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected, lowVisionMode && styles.optionTitleLowVision]}>
                        {getAdvanceNotificationModeLabel(mode)}
                      </Text>
                      <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected, lowVisionMode && styles.optionDescriptionLowVision]}>
                        {getAdvanceNotificationModeDescription(mode)}
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

          {/* 안내 정보 */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={20} color="#3b82f6" />
            <Text style={[styles.infoText, lowVisionMode && styles.infoTextLowVision]}>
              모든 안전 보조 기능은 실시간 스캔이 켜져 있을 때 자동으로 작동합니다. 카메라 화면에서 "실시간 시작" 버튼을 눌러 활성화하세요.
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
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  newBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
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
  featureList: {
    marginTop: 12,
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  featureTextLowVision: {
    fontSize: 16,
    lineHeight: 20,
  },
  subSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  subSettingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  subSettingLabelLowVision: {
    fontSize: 17,
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
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
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
