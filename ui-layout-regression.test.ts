import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("home hud layout regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const tabSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");

  it("uses the requested vertical flex distribution across the driving hud", () => {
    expect(homeSource).toContain('flexDirection: "column"');
    expect(homeSource).toContain('visualZone');
    expect(homeSource).toContain('flex: 2.12');
    expect(homeSource).toContain('infoZone');
    expect(homeSource).toContain('flex: 1.28');
    expect(homeSource).toContain('naviZone');
    expect(homeSource).toContain('flex: 1.1');
    expect(homeSource).toContain('bottomBarZone');
    expect(homeSource).toContain('flex: 0.46');
  });

  it("cycles the signal card with the requested dynamic colors and labels", () => {
    expect(homeSource).toContain('backgroundColor: "#FF4B2B"');
    expect(homeSource).toContain('backgroundColor: "#FDC830"');
    expect(homeSource).toContain('backgroundColor: "#80ff72"');
    expect(homeSource).toContain('title: "STOP"');
    expect(homeSource).toContain('title: "SLOW"');
    expect(homeSource).toContain('title: "GO"');
    expect(homeSource).toContain('backgroundColor: currentSignal.backgroundColor');
    expect(homeSource).toContain('signalHighlight');
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
    expect(homeSource).toContain('fontSize: 34');
    expect(homeSource).toContain('fontSize: 20');
    expect(homeSource).toContain('fontSize: 18');
  });

  it("restores the apple silver and dark space card language without extra footer clutter", () => {
    expect(homeSource).toContain('backgroundColor: "#05070b"');
    expect(homeSource).toContain('backgroundColor: "#d9dbe0"');
    expect(homeSource).toContain('backgroundColor: "#d7d9df"');
    expect(homeSource).toContain('backgroundColor: "#cfd3da"');
    expect(homeSource).toContain('backgroundColor: "#eef1f5"');
    expect(homeSource).toContain('borderColor: "rgba(255,255,255,0.65)"');
    expect(homeSource).not.toContain('미리듣기: {voicePreviewText}');
    expect(homeSource).not.toContain('footerStatusRow');
  });

  it("builds the bottom bar with balanced spacing and working routes", () => {
    expect(homeSource).toContain('justifyContent: "space-between"');
    expect(homeSource).toContain('router.push("/camera")');
    expect(homeSource).toContain('router.push("/settings")');
    expect(tabSource).toContain('display: "none"');
  });
});
