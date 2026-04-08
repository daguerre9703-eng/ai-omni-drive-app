import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("camera and settings controls regression", () => {
  const cameraSource = readFileSync(join(process.cwd(), "app/camera.tsx"), "utf8");
  const settingsSource = readFileSync(join(process.cwd(), "app/settings.tsx"), "utf8");

  it("keeps camera range controls and a visible confirm action", () => {
    expect(cameraSource).toContain('type DetectionRange = "좁게" | "보통" | "넓게";');
    expect(cameraSource).toContain('const RANGE_OPTIONS');
    expect(cameraSource).toContain('title: "좁게"');
    expect(cameraSource).toContain('title: "보통"');
    expect(cameraSource).toContain('title: "넓게"');
    expect(cameraSource).toContain('인식 범위 조절');
    expect(cameraSource).toContain('setSelectedRange(option.key)');
    expect(cameraSource).toContain('currentRange.frameWidth');
    expect(cameraSource).toContain('currentRange.frameHeight');
    expect(cameraSource).toContain('handleConfirmRange');
    expect(cameraSource).toContain('Text style={styles.confirmButtonText}>확인</Text>');
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

  it("keeps home HUD voice template generation and speech dispatch wired", () => {
    const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const voiceSource = readFileSync(join(process.cwd(), "lib/voice-alerts.ts"), "utf8");

    expect(homeSource).toContain('buildVoiceAlertText');
    expect(homeSource).toContain('speakVoiceAlert');
    expect(homeSource).toContain('voiceAlertLength');
    expect(homeSource).toContain('voiceAlertStyle');
    expect(homeSource).toContain('voicePreviewText');
    expect(homeSource).toContain('await speakVoiceAlert(event, voiceSettings, { distanceMeters });');
    expect(voiceSource).toContain('export type VoiceAlertLength = "detailed" | "brief";');
    expect(voiceSource).toContain('export type VoiceAlertStyle = "standard" | "calm" | "urgent";');
    expect(voiceSource).toContain('export function buildVoiceAlertText(');
    expect(voiceSource).toContain('return `전방 ${roundedDistance}미터 적색 신호입니다. 안전 운행하세요.${STYLE_SUFFIX[settings.style]}`.trim();');
    expect(voiceSource).toContain('return "신호가 변경되었습니다. 출발하세요.";');
    expect(voiceSource).toContain('return `전방 빨간불.${settings.style === "urgent" ? " 바로 감속." : ""}`.trim();');
    expect(voiceSource).toContain('return settings.style === "calm" ? "녹색불입니다. 천천히 출발." : "녹색불입니다. 출발.";');
    expect(voiceSource).toContain('await Speech.stop();');
    expect(voiceSource).toContain('Speech.speak(text, getSpeechOptions(settings.style));');
  });
});
