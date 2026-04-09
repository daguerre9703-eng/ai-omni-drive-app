import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("home hud layout regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const tabSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");

  it("restores the requested gray apple hud shell", () => {
    expect(homeSource).toContain('backgroundColor: "#B7BBC2"');
    expect(homeSource).toContain("providerPill");
    expect(homeSource).toContain("mainStack");
    expect(homeSource).toContain("cardShell");
    expect(homeSource).toContain('backgroundColor: "#D0D3D9"');
  });

  it("keeps the large traffic signal card with rotating go slow stop states", () => {
    expect(homeSource).toContain('const [signalIndex, setSignalIndex] = useState(1);');
    expect(homeSource).toContain('10000');
    expect(homeSource).toContain('title: "GO"');
    expect(homeSource).toContain('title: "SLOW"');
    expect(homeSource).toContain('title: "STOP"');
    expect(homeSource).toContain('cardBackground: "#7EF36B"');
    expect(homeSource).toContain('cardBackground: "#FFE37A"');
    expect(homeSource).toContain('cardBackground: "#C41230"');
    expect(homeSource).toContain('justifyContent: "flex-start"');
    expect(homeSource).toContain('paddingTop: 16');
    expect(homeSource).toContain('marginTop: 54');
    expect(homeSource).toContain('fontSize: 74');
  });

  it("keeps only the enlarged speed panel in the middle info area", () => {
    expect(homeSource).toContain('현재 속도');
    expect(homeSource).toContain('speedOnlyColumn');
    expect(homeSource).toContain('speedOnlyValue');
    expect(homeSource).toContain('signalDistanceLabel: "128m"');
    expect(homeSource).toContain('fallbackSpeedLabel: "18 km/h"');
    expect(homeSource).not.toContain('metricDivider');
    expect(homeSource).not.toContain('남은 거리');
    expect(homeSource).not.toContain('11개국어 스캔');
    expect(homeSource).not.toContain('AI 운전 보조 실시간 디스플레이');
  });

  it("keeps the centered bold direction arrow card and manual direction switch", () => {
    expect(homeSource).toContain('type DirectionState = "left" | "straight" | "right" | "uturn";');
    expect(homeSource).toContain('12000');
    expect(homeSource).toContain('const handleAdvanceDirection = () => {');
    expect(homeSource).toContain('onPress={handleAdvanceDirection}');
    expect(homeSource).toContain('symbol: "↑"');
    expect(homeSource).toContain('label: "직진"');
    expect(homeSource).toContain('huge: 122');
    expect(homeSource).toContain('fontSize: Math.round(arrowFontSize * 1.56 * homeMasterSettings.sizes.directionArrow)');
    expect(homeSource).not.toContain('styles.directionLabel');
  });

  it("preserves gps linked updates and compact bottom controls", () => {
    expect(homeSource).toContain('Location.watchPositionAsync');
    expect(homeSource).toContain('selectedNavigationProvider');
    expect(homeSource).toContain('router.push("/camera")');
    expect(homeSource).toContain('router.push("/settings")');
    expect(homeSource).toContain('카메라');
    expect(homeSource).toContain('홈');
    expect(homeSource).toContain('설정');
    expect(tabSource).toContain('display: "none"');
  });

  it("strengthens the ruby red full-screen warning blink for stop state", () => {
    expect(homeSource).toContain('const [redAlertVisible, setRedAlertVisible] = useState(false);');
    expect(homeSource).toContain('backgroundColor: "#C41230"');
    expect(homeSource).toContain('setRedAlertVisible((prev) => !prev);');
    expect(homeSource).toContain('}, 260);');
    expect(homeSource).toContain('opacity: 0.54');
    expect(homeSource).toContain('opacity: 0.08');
  });
});
