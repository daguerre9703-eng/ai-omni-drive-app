import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("home hud layout regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const tabSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");

  it("uses the white apple standard structure with a scrollable showcase layout", () => {
    expect(homeSource).toContain('backgroundColor: "#F5F7FB"');
    expect(homeSource).toContain("heroHeader");
    expect(homeSource).toContain("heroGrid");
    expect(homeSource).toContain("ScrollView");
    expect(homeSource).toContain('WHITE APPLE STANDARD');
  });

  it("keeps live signal preview rotation enabled with high-contrast signal states", () => {
    expect(homeSource).toContain('const [signalIndex, setSignalIndex] = useState(0);');
    expect(homeSource).toContain('1600');
    expect(homeSource).toContain('title: "STOP"');
    expect(homeSource).toContain('title: "SLOW"');
    expect(homeSource).toContain('title: "GO"');
    expect(homeSource).toContain('accent: "#FF3B30"');
    expect(homeSource).toContain('accent: "#34C759"');
    expect(homeSource).toContain('signalHalo');
  });

  it("cycles navigation direction states automatically and supports manual switching with bold arrow presentation", () => {
    expect(homeSource).toContain('type DirectionState = "left" | "straight" | "right" | "uturn";');
    expect(homeSource).toContain('const [directionIndex, setDirectionIndex] = useState(0);');
    expect(homeSource).toContain('2200');
    expect(homeSource).toContain('const handleAdvanceDirection = () => {');
    expect(homeSource).toContain('onPress={handleAdvanceDirection}');
    expect(homeSource).toContain('symbol: "←"');
    expect(homeSource).toContain('symbol: "↑"');
    expect(homeSource).toContain('symbol: "→"');
    expect(homeSource).toContain('symbol: "↶"');
    expect(homeSource).toContain('fontSize: 34');
  });

  it("shows the requested sample showcase for multilingual scan and ai driving assist", () => {
    expect(homeSource).toContain('SAMPLE SHOWCASE');
    expect(homeSource).toContain('11개국어 스캔');
    expect(homeSource).toContain('AI 운전 보조 실시간 디스플레이');
    expect(homeSource).toContain('OCR LIVE');
    expect(homeSource).toContain('Vision AI로 즉시 읽고 큰 글씨로 번역');
    expect(homeSource).toContain('const LANGUAGE_SAMPLES = [');
    expect(homeSource).toContain('{ code: "KO", label: "안녕하세요" }');
    expect(homeSource).toContain('{ code: "FR", label: "Bonjour" }');
  });

  it("preserves live gps and voice guidance information in the driving showcase", () => {
    expect(homeSource).toContain('GPS 상태');
    expect(homeSource).toContain('좌표');
    expect(homeSource).toContain('음성 가이드');
    expect(homeSource).toContain('알림 모드');
    expect(homeSource).toContain('AI 음성 예고');
    expect(homeSource).toContain('빠른 목적지');
    expect(homeSource).toContain('실시간 경로 동기화');
    expect(homeSource).toContain('buildVoiceAlertText');
    expect(homeSource).toContain('Location.watchPositionAsync');
  });

  it("keeps the bottom control bar and hidden expo tab bar routing behavior", () => {
    expect(homeSource).toContain('router.push("/camera")');
    expect(homeSource).toContain('router.push("/settings")');
    expect(homeSource).toContain('카메라');
    expect(homeSource).toContain('홈');
    expect(homeSource).toContain('설정');
    expect(tabSource).toContain('display: "none"');
  });
});
