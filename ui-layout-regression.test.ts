import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("home hud layout regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const tabSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");

  it("uses the requested vertical flex distribution across the driving hud", () => {
    expect(homeSource).toContain('flexDirection: "column"');
    expect(homeSource).toContain('visualZone');
    expect(homeSource).toContain('flex: 2');
    expect(homeSource).toContain('infoZone');
    expect(homeSource).toContain('flex: 1.5');
    expect(homeSource).toContain('naviZone');
    expect(homeSource).toContain('flex: 1');
    expect(homeSource).toContain('bottomBarZone');
    expect(homeSource).toContain('flex: 0.5');
  });

  it("cycles the signal card with the requested dynamic colors and labels", () => {
    expect(homeSource).toContain('backgroundColor: "#FF4B2B"');
    expect(homeSource).toContain('backgroundColor: "#FDC830"');
    expect(homeSource).toContain('backgroundColor: "#80ff72"');
    expect(homeSource).toContain('title: "STOP"');
    expect(homeSource).toContain('title: "SLOW"');
    expect(homeSource).toContain('title: "GO"');
    expect(homeSource).toContain('backgroundColor: currentSignal.backgroundColor');
  });

  it("keeps live signal preview rotation enabled", () => {
    expect(homeSource).toContain('const [signalIndex, setSignalIndex] = useState(0);');
    expect(homeSource).toContain('setInterval(() => {');
    expect(homeSource).toContain('1600');
    expect(homeSource).toContain('const signalState = SIGNAL_SEQUENCE[signalIndex];');
  });

  it("cycles navigation direction states automatically and supports manual switching", () => {
    expect(homeSource).toContain('type DirectionState = "left" | "straight" | "right" | "uturn";');
    expect(homeSource).toContain('const [directionIndex, setDirectionIndex] = useState(0);');
    expect(homeSource).toContain('const interval = setInterval(() => {');
    expect(homeSource).toContain('2200');
    expect(homeSource).toContain('const handleAdvanceDirection = () => {');
    expect(homeSource).toContain('onPress={handleAdvanceDirection}');
    expect(homeSource).toContain('label: "좌회전"');
    expect(homeSource).toContain('label: "직진"');
    expect(homeSource).toContain('label: "우회전"');
    expect(homeSource).toContain('label: "유턴"');
  });

  it("shows large accessible driving information and controls", () => {
    expect(homeSource).toContain('남은 거리');
    expect(homeSource).toContain('현재 속도');
    expect(homeSource).toContain('카메라');
    expect(homeSource).toContain('홈');
    expect(homeSource).toContain('설정');
    expect(homeSource).toContain('fontSize: 24');
    expect(homeSource).toContain('fontWeight: "bold"');
    expect(homeSource).toContain('fontSize: 52');
  });

  it("keeps compact spacing rules that prevent text overlap on narrow screens", () => {
    expect(homeSource).toContain('const displayedArrowFontSize = Math.min(arrowFontSize, 120);');
    expect(homeSource).toContain('columnGap: 8');
    expect(homeSource).toContain('fontSize: 20');
    expect(homeSource).toContain('fontSize: 28');
    expect(homeSource).toContain('naviMetaGroup');
    expect(homeSource).toContain('numberOfLines={1} style={styles.naviMetaText}');
    expect(homeSource).toContain('footerSubStatusText');
    expect(homeSource).toContain('미리듣기: {voicePreviewText}');
  });

  it("builds the bottom bar with balanced spacing and working routes", () => {
    expect(homeSource).toContain('justifyContent: "space-around"');
    expect(homeSource).toContain('router.push("/camera")');
    expect(homeSource).toContain('router.push("/settings")');
    expect(tabSource).toContain('display: "none"');
  });
});
