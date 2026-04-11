import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("camera and settings controls regression", () => {
  const cameraSource = readFileSync(join(process.cwd(), "app/camera.tsx"), "utf8");
  const settingsSource = readFileSync(join(process.cwd(), "app/settings.tsx"), "utf8");

  it("keeps camera range controls and live signal recognition wiring", () => {
    expect(cameraSource).toContain("const RANGE_OPTIONS");
    expect(cameraSource).toContain('title: "좁게"');
    expect(cameraSource).toContain('title: "보통"');
    expect(cameraSource).toContain('title: "넓게"');
    expect(cameraSource).toContain("인식 범위 조절");
    expect(cameraSource).toContain("setSelectedRange(option.key)");
    expect(cameraSource).toContain("currentRange.frameWidth");
    expect(cameraSource).toContain("currentRange.frameHeight");
    expect(cameraSource).toContain("trpc.trafficSignal.detect.useMutation()");
    expect(cameraSource).toContain("takePictureAsync");
    expect(cameraSource).toContain("setTrafficSignalDetection({");
    expect(cameraSource).toContain("leftTurnState: result.leftTurnState");
    expect(cameraSource).toContain("pedestrianState: result.pedestrianState");
    expect(cameraSource).toContain("setLatestDetailText(");
    expect(cameraSource).toContain("result.leftTurnLabel");
    expect(cameraSource).toContain("result.pedestrianLabel");
    expect(cameraSource).toContain("Math.round(lastSpeedKmh)");
    expect(cameraSource).toContain("DEFAULT_VOICE_ALERT_SETTINGS");
    expect(cameraSource).toContain("resolveScanProfile");
    expect(cameraSource).toContain("intervalMs: 900");
    expect(cameraSource).toContain("intervalMs: 1500");
    expect(cameraSource).toContain("intervalMs: 2300");
    expect(cameraSource).toContain("adaptiveScanEnabled");
    expect(cameraSource).toContain("hapticAlertsEnabled");
    expect(cameraSource).toContain("lowVisionModeEnabled");
    expect(cameraSource).toContain("setIsMonitoring(true)");
    expect(cameraSource).toContain("setIsMonitoring(false)");
    expect(cameraSource).toContain("monitoringActive: monitoringActiveRef.current");
    expect(cameraSource).toContain('initialDetection.monitoringActive ? "실시간 스캔 준비 중" : "AI 인식 대기"');
    expect(cameraSource).toContain("연속 스캔 켜짐");
    expect(cameraSource).toContain("연속 스캔 꺼짐");
    expect(cameraSource).toContain('속도 적응 {adaptiveScanEnabled ? "ON" : "OFF"}');
    expect(cameraSource).toContain('진동 경고 {hapticAlertsEnabled ? "ON" : "OFF"}');
    expect(cameraSource).toContain('저시력 모드 {lowVisionModeEnabled ? "ON" : "OFF"}');
    expect(cameraSource).toContain('{isMonitoring ? "실시간 중지" : "실시간 시작"}');
    expect(cameraSource).toContain('speakVoiceAlert("red_signal_ahead"');
    expect(cameraSource).toContain('speakVoiceAlert("green_signal_changed"');
    expect(cameraSource).toContain("playSignalHapticAlert(");
    expect(cameraSource).toContain('Text style={[styles.confirmButtonText, lowVisionModeEnabled && styles.actionButtonTextLowVision]}');
    expect(cameraSource).toContain('{isAnalyzing ? "인식 중" : "신호등 인식"}');
  });

  it("keeps settings persistence and the main confirm button wired", () => {
    expect(settingsSource).toContain('import AsyncStorage from "@react-native-async-storage/async-storage";');
    expect(settingsSource).toContain('const SETTINGS_STORAGE_KEY = "ai-omni-drive:settings";');
    expect(settingsSource).toContain('await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));');
    expect(settingsSource).toContain('text: "확인"');
    expect(settingsSource).toContain('onPress: () => router.back()');
    expect(settingsSource).toContain('onPress={handleAddDestination}');
    expect(settingsSource).toContain('onPress={handleSave}');
    expect(settingsSource).toContain('{isSaving ? "저장 중..." : isLoading ? "불러오는 중..." : "확인"}');
  });

  it("keeps custom voice alert length and style controls wired", () => {
    expect(settingsSource).toContain('voiceAlertLength: VoiceAlertLength;');
    expect(settingsSource).toContain('voiceAlertStyle: VoiceAlertStyle;');
    expect(settingsSource).toContain('VOICE_LENGTH_OPTIONS.map((option) =>');
    expect(settingsSource).toContain('VOICE_STYLE_OPTIONS.map((option) =>');
    expect(settingsSource).toContain('setVoiceAlertLength(option.key)');
    expect(settingsSource).toContain('setVoiceAlertStyle(option.key)');
    expect(settingsSource).toContain('selectedLengthLabel');
    expect(settingsSource).toContain('selectedStyleLabel');
  });

  it("keeps home HUD voice template generation and accessibility preview wired", () => {
    const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const voiceSource = readFileSync(join(process.cwd(), "lib/voice-alerts.ts"), "utf8");

    expect(homeSource).toContain("buildVoiceAlertText");
    expect(homeSource).toContain("voiceAlertLength");
    expect(homeSource).toContain("voiceAlertStyle");
    expect(homeSource).toContain("voicePreviewText");
    expect(homeSource).toContain("subscribeTrafficSignalDetection");
    expect(homeSource).toContain("loadTrafficSignalDetection");
    expect(homeSource).toContain("liveSignalSummary");
    expect(homeSource).toContain("liveLeftTurnState");
    expect(homeSource).toContain("livePedestrianState");
    expect(homeSource).toContain("monitoringActive");
    expect(homeSource).toContain("lastAnalyzedAt");
    expect(homeSource).toContain("lastDetectedAt");
    expect(homeSource).toContain("scanIntervalMs");
    expect(homeSource).toContain("lastSpeedKmh");
    expect(homeSource).toContain("cadenceMode");
    expect(homeSource).toContain("adaptiveScanEnabled");
    expect(homeSource).toContain("hapticAlertsEnabled");
    expect(homeSource).toContain("lowVisionModeEnabled");
    expect(homeSource).toContain("formatHudTime");
    expect(homeSource).toContain("실시간 스캔 ON");
    expect(homeSource).toContain("실시간 스캔 OFF");
    expect(homeSource).toContain("최근 스캔");
    expect(homeSource).toContain("최근 감지");
    expect(homeSource).toContain("스캔 정보");
    expect(homeSource).toContain("보조 기능");
    expect(homeSource).toContain("LEFT_TURN_META");
    expect(homeSource).toContain("PEDESTRIAN_META");
    expect(homeSource).toContain("currentLeftTurnMeta.label");
    expect(homeSource).toContain("currentPedestrianMeta.label");
    expect(voiceSource).toContain('export type VoiceAlertLength = "detailed" | "brief";');
    expect(voiceSource).toContain('export type VoiceAlertStyle = "standard" | "calm" | "urgent";');
    expect(voiceSource).toContain("export function buildVoiceAlertText(");
    expect(voiceSource).toContain("supplementalText?: string;");
    expect(voiceSource).toContain("const appendSupplementalText = (baseText: string) => {");
    expect(voiceSource).toContain('`전방 ${roundedDistance}미터 적색 신호입니다. 안전 운행하세요.${STYLE_SUFFIX[settings.style]}`');
    expect(voiceSource).toContain('return appendSupplementalText("신호가 변경되었습니다. 출발하세요.");');
    expect(voiceSource).toContain('return appendSupplementalText(`전방 빨간불.${settings.style === "urgent" ? " 바로 감속." : ""}`);');
    expect(voiceSource).toContain('settings.style === "calm" ? "녹색불입니다. 천천히 출발." : "녹색불입니다. 출발."');
    expect(voiceSource).toContain("await Speech.stop();");
    expect(voiceSource).toContain("Speech.speak(text, getSpeechOptions(settings.style));");
  });
});
