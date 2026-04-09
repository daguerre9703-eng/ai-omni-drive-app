import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import {
  getTrafficSignalDetection,
  type DetectionRange,
  setTrafficSignalDetection,
} from "@/lib/traffic-signal-store";
import {
  DEFAULT_VOICE_ALERT_SETTINGS,
  speakVoiceAlert,
} from "@/lib/voice-alerts";

type DetectionRangeOption = {
  key: DetectionRange;
  title: string;
  description: string;
  frameWidth: number;
  frameHeight: number;
};

const RANGE_OPTIONS: DetectionRangeOption[] = [
  {
    key: "좁게",
    title: "좁게",
    description: "신호등 한 개를 크게 인식",
    frameWidth: 112,
    frameHeight: 112,
  },
  {
    key: "보통",
    title: "보통",
    description: "일반 도심 주행 기본값",
    frameWidth: 160,
    frameHeight: 132,
  },
  {
    key: "넓게",
    title: "넓게",
    description: "여러 차선과 표지판까지 함께 확인",
    frameWidth: 214,
    frameHeight: 156,
  },
];

const RANGE_FOCUS_HINT: Record<DetectionRange, string> = {
  좁게: "정면 한 개 신호등에 초점을 맞춥니다",
  보통: "교차로 전방 신호등을 균형 있게 확인합니다",
  넓게: "여러 차선과 복수 신호등을 함께 살핍니다",
};

const RANGE_CROP: Record<DetectionRange, { widthRatio: number; heightRatio: number }> = {
  좁게: { widthRatio: 0.28, heightRatio: 0.28 },
  보통: { widthRatio: 0.4, heightRatio: 0.34 },
  넓게: { widthRatio: 0.56, heightRatio: 0.4 },
};

const AUTO_SCAN_INTERVAL_MS = 2200;

function formatClockLabel(timestamp: number) {
  if (!timestamp) {
    return "아직 없음";
  }

  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function CameraScreen() {
  const initialDetection = getTrafficSignalDetection();
  const [selectedRange, setSelectedRange] = useState<DetectionRange>("보통");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(initialDetection.monitoringActive);
  const [liveStatusText, setLiveStatusText] = useState(
    initialDetection.monitoringActive ? "실시간 스캔 준비 중" : "AI 인식 대기",
  );
  const [latestResultText, setLatestResultText] = useState(
    initialDetection.summary === "신호 인식 대기"
      ? "아직 인식된 신호가 없습니다."
      : initialDetection.summary,
  );
  const [latestDetailText, setLatestDetailText] = useState("좌회전·보행 신호 대기");
  const [cameraReady, setCameraReady] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(initialDetection.lastAnalyzedAt);
  const [lastDetectedAt, setLastDetectedAt] = useState(initialDetection.detectedAt);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const isAnalyzingRef = useRef(false);
  const monitoringActiveRef = useRef(initialDetection.monitoringActive);
  const lastDetectedStateRef = useRef<"red" | "yellow" | "green" | "unknown" | null>(
    initialDetection.state,
  );

  const detectSignal = trpc.trafficSignal.detect.useMutation();

  const currentRange = useMemo(() => {
    return RANGE_OPTIONS.find((option) => option.key === selectedRange) ?? RANGE_OPTIONS[1];
  }, [selectedRange]);

  const lastAnalyzedLabel = useMemo(() => formatClockLabel(lastAnalyzedAt), [lastAnalyzedAt]);
  const lastDetectedLabel = useMemo(() => formatClockLabel(lastDetectedAt), [lastDetectedAt]);

  useEffect(() => {
    return () => {
      cameraRef.current = null;
      monitoringActiveRef.current = false;
      void setTrafficSignalDetection({ monitoringActive: false });
    };
  }, []);

  const ensurePermission = useCallback(async () => {
    if (!permission) {
      return false;
    }

    if (permission.granted) {
      return true;
    }

    const nextPermission = await requestPermission();
    return nextPermission.granted;
  }, [permission, requestPermission]);

  const runSignalAnalysis = useCallback(
    async (trigger: "manual" | "auto") => {
      if (Platform.OS === "web") {
        if (trigger === "manual") {
          Alert.alert("웹 미리보기 제한", "실제 카메라 인식은 모바일 기기에서 확인해 주세요.");
        }
        return false;
      }

      const granted = await ensurePermission();
      if (!granted) {
        if (trigger === "manual") {
          Alert.alert("카메라 권한 필요", "신호등 인식을 위해 카메라 권한을 허용해 주세요.");
        }
        return false;
      }

      if (!cameraRef.current || !cameraReady || isAnalyzingRef.current) {
        return false;
      }

      const analysisStartedAt = Date.now();

      try {
        isAnalyzingRef.current = true;
        setIsAnalyzing(true);
        setLastAnalyzedAt(analysisStartedAt);
        setLiveStatusText(
          monitoringActiveRef.current ? "실시간 스캔 중 · 전방 신호 확인" : "AI 신호등 판별 중",
        );

        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.45,
          skipProcessing: true,
        });

        if (!photo?.base64) {
          throw new Error("카메라 프레임을 가져오지 못했습니다.");
        }

        const crop = RANGE_CROP[selectedRange];
        const result = await detectSignal.mutateAsync({
          base64Image: photo.base64,
          detectionRange: selectedRange,
          cropHint: crop,
        });

        const detectedAt = Date.now();

        await setTrafficSignalDetection({
          state: result.signalState,
          leftTurnState: result.leftTurnState,
          pedestrianState: result.pedestrianState,
          confidence: result.confidence,
          source: "camera-ai",
          detectedAt,
          lastAnalyzedAt: detectedAt,
          monitoringActive: monitoringActiveRef.current,
          summary: result.summary,
        });

        setLastAnalyzedAt(detectedAt);
        setLastDetectedAt(detectedAt);
        setLatestResultText(`${result.displayLabel} · 신뢰도 ${Math.round(result.confidence * 100)}%`);
        setLatestDetailText(`${result.leftTurnLabel} · ${result.pedestrianLabel}`);
        setLiveStatusText(
          monitoringActiveRef.current
            ? `실시간 스캔 중 · ${result.displayLabel}`
            : `수동 인식 완료 · ${result.displayLabel}`,
        );

        const previousState = lastDetectedStateRef.current;
        lastDetectedStateRef.current = result.signalState;

        if (result.signalState !== previousState) {
          if (result.signalState === "red") {
            await speakVoiceAlert("red_signal_ahead", DEFAULT_VOICE_ALERT_SETTINGS, {
              distanceMeters: 128,
            });
          } else if (result.signalState === "green") {
            await speakVoiceAlert("green_signal_changed", DEFAULT_VOICE_ALERT_SETTINGS, {
              distanceMeters: 128,
            });
          }
        }

        return true;
      } catch (error) {
        console.error("Failed to analyze traffic signal", error);
        setLastAnalyzedAt(analysisStartedAt);
        setLiveStatusText(
          monitoringActiveRef.current ? "실시간 스캔 재시도 중" : "AI 인식 실패",
        );

        await setTrafficSignalDetection({
          lastAnalyzedAt: analysisStartedAt,
          monitoringActive: monitoringActiveRef.current,
          summary: monitoringActiveRef.current ? "실시간 스캔 재시도 중" : "AI 인식 실패",
        });

        if (trigger === "manual") {
          Alert.alert("신호등 인식 실패", "카메라 프레임 분석 중 문제가 발생했습니다. 다시 시도해 주세요.");
        }

        return false;
      } finally {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [cameraReady, detectSignal, ensurePermission, selectedRange],
  );

  useEffect(() => {
    monitoringActiveRef.current = isMonitoring;
    void setTrafficSignalDetection({ monitoringActive: isMonitoring });

    if (!isMonitoring) {
      setLiveStatusText((current) =>
        current.startsWith("실시간") ? "실시간 스캔 중지" : current,
      );
      return;
    }

    setLiveStatusText("실시간 스캔 준비 중");
  }, [isMonitoring]);

  useEffect(() => {
    if (!isMonitoring || !cameraReady || Platform.OS === "web" || !permission?.granted) {
      return;
    }

    let active = true;

    const runLoop = async () => {
      if (!active) {
        return;
      }

      await runSignalAnalysis("auto");
    };

    void runLoop();
    const timerId = setInterval(() => {
      void runLoop();
    }, AUTO_SCAN_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timerId);
    };
  }, [cameraReady, isMonitoring, permission?.granted, runSignalAnalysis]);

  const handleAnalyzeFrame = async () => {
    await runSignalAnalysis("manual");
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("웹 미리보기 제한", "실시간 카메라 스캔은 모바일 기기에서 확인해 주세요.");
      return;
    }

    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert("카메라 권한 필요", "실시간 스캔을 위해 카메라 권한을 허용해 주세요.");
      return;
    }

    setIsMonitoring(true);
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

          <Text style={styles.headerTitle}>카메라</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <View style={styles.topBadgeRow}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveStatusText}</Text>
              </View>
              <View style={[styles.scanStateBadge, isMonitoring && styles.scanStateBadgeActive]}>
                <Text style={[styles.scanStateBadgeText, isMonitoring && styles.scanStateBadgeTextActive]}>
                  {isMonitoring ? "연속 스캔 켜짐" : "연속 스캔 꺼짐"}
                </Text>
              </View>
            </View>
            <Text style={styles.previewHint}>전방 신호등 중심으로 맞춰 주세요</Text>
          </View>

          <View style={styles.cameraStage}>
            {permission?.granted && Platform.OS !== "web" ? (
              <CameraView
                ref={(instance) => {
                  cameraRef.current = instance;
                }}
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
              />
            ) : (
              <View style={styles.cameraFallbackLayer}>
                <MaterialIcons name="photo-camera" size={42} color="#cbd5e1" />
                <Text style={styles.cameraFallbackText}>
                  {Platform.OS === "web"
                    ? "웹 미리보기에서는 카메라 대신 안내 화면을 표시합니다"
                    : "카메라 권한을 허용하면 실제 프리뷰가 시작됩니다"}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.detectionFrame,
                {
                  width: currentRange.frameWidth,
                  height: currentRange.frameHeight,
                },
              ]}
            >
              <View style={styles.frameCornerTopLeft} />
              <View style={styles.frameCornerTopRight} />
              <View style={styles.frameCornerBottomLeft} />
              <View style={styles.frameCornerBottomRight} />
            </View>

            <View style={styles.cameraCenterChip}>
              <MaterialIcons name="center-focus-strong" size={28} color="#ffffff" />
              <Text style={styles.cameraCenterChipText}>{currentRange.title} 인식 범위</Text>
            </View>
          </View>

          <View style={styles.rangeCard}>
            <Text style={styles.sectionTitle}>인식 범위 조절</Text>
            <Text style={styles.sectionBody}>
              슬라이더 대신 큰 단계 버튼으로 조절할 수 있게 구성했습니다. 연속 스캔 중에도 범위를 바꾸면 다음 프레임부터 바로 반영됩니다.
            </Text>

            <View style={styles.rangeButtonRow}>
              {RANGE_OPTIONS.map((option) => {
                const selected = option.key === selectedRange;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSelectedRange(option.key)}
                    style={({ pressed }) => [
                      styles.rangeButton,
                      selected && styles.rangeButtonSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.rangeButtonTitle, selected && styles.rangeButtonTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.rangeButtonDescription,
                        selected && styles.rangeButtonDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>현재 선택</Text>
            <Text style={styles.summaryValue}>{currentRange.title}</Text>
            <Text style={styles.summaryDescription}>{RANGE_FOCUS_HINT[currentRange.key]}</Text>
            <Text style={styles.summaryMeta}>{latestResultText}</Text>
            <Text style={styles.summarySubMeta}>{latestDetailText}</Text>
            <View style={styles.summaryInfoRow}>
              <View style={styles.summaryInfoChip}>
                <Text style={styles.summaryInfoLabel}>마지막 스캔</Text>
                <Text style={styles.summaryInfoValue}>{lastAnalyzedLabel}</Text>
              </View>
              <View style={styles.summaryInfoChip}>
                <Text style={styles.summaryInfoLabel}>마지막 감지</Text>
                <Text style={styles.summaryInfoValue}>{lastDetectedLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {!permission?.granted && Platform.OS !== "web" ? (
          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
          </Pressable>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleToggleMonitoring}
            style={({ pressed }) => [
              styles.secondaryButton,
              isMonitoring && styles.secondaryButtonActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, isMonitoring && styles.secondaryButtonTextActive]}>
              {isMonitoring ? "실시간 중지" : "실시간 시작"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleAnalyzeFrame}
            disabled={isAnalyzing}
            style={({ pressed }) => [
              styles.confirmButton,
              isAnalyzing && styles.confirmButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isAnalyzing ? <ActivityIndicator color="#ffffff" /> : null}
            <Text style={styles.confirmButtonText}>{isAnalyzing ? "인식 중" : "신호등 인식"}</Text>
          </Pressable>
        </View>
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
    marginBottom: 16,
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
  previewCard: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  previewTopRow: {
    gap: 8,
  },
  topBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  liveBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  liveBadgeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  scanStateBadge: {
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scanStateBadgeActive: {
    backgroundColor: "#dcfce7",
  },
  scanStateBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },
  scanStateBadgeTextActive: {
    color: "#166534",
  },
  previewHint: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4b5563",
  },
  cameraStage: {
    height: 230,
    borderRadius: 26,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  cameraFallbackLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: "#111827",
  },
  cameraFallbackText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    color: "#e2e8f0",
    textAlign: "center",
  },
  detectionFrame: {
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: 22,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  frameCornerTopLeft: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderTopLeftRadius: 20,
  },
  frameCornerTopRight: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderTopRightRadius: 20,
  },
  frameCornerBottomLeft: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderBottomLeftRadius: 20,
  },
  frameCornerBottomRight: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderBottomRightRadius: 20,
  },
  cameraCenterChip: {
    position: "absolute",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraCenterChipText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  rangeCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  sectionBody: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
    color: "#4b5563",
  },
  rangeButtonRow: {
    gap: 10,
  },
  rangeButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  rangeButtonSelected: {
    borderColor: "#111827",
    backgroundColor: "#e5f0ff",
  },
  rangeButtonTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  rangeButtonTitleSelected: {
    color: "#111827",
  },
  rangeButtonDescription: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6b7280",
  },
  rangeButtonDescriptionSelected: {
    color: "#334155",
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: "#111827",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#cbd5e1",
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
  },
  summaryDescription: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: "#d1d5db",
  },
  summaryMeta: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "700",
    color: "#93c5fd",
  },
  summarySubMeta: {
    fontSize: 16,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  summaryInfoRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  summaryInfoChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  summaryInfoLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#94a3b8",
  },
  summaryInfoValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  permissionButton: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  permissionButtonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#dbe4f0",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  secondaryButtonActive: {
    backgroundColor: "#dcfce7",
  },
  secondaryButtonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
  },
  secondaryButtonTextActive: {
    color: "#166534",
  },
  confirmButton: {
    flex: 1.2,
    borderRadius: 24,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 18,
  },
  confirmButtonDisabled: {
    opacity: 0.72,
  },
  confirmButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
});
