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
});
