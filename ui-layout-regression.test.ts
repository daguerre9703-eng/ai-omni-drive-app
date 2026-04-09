import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("home hud layout regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const tabSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");
  const settingsSource = readFileSync(join(process.cwd(), "app/settings.tsx"), "utf8");

  it("keeps the requested gray apple hud shell", () => {
    expect(homeSource).toContain('backgroundColor: "#B7BBC2"');
    expect(homeSource).toContain("providerPill");
    expect(homeSource).toContain("mainStack");
    expect(homeSource).toContain("cardShell");
    expect(homeSource).toContain('backgroundColor: "#D0D3D9"');
  });

  it("keeps an inactive gray signal state before live detection and rotates active go slow stop states", () => {
    expect(homeSource).toContain('type SignalState = "inactive" | "red" | "yellow" | "green";');
    expect(homeSource).toContain('const SIGNAL_SEQUENCE: SignalState[] = ["inactive", "green", "yellow", "red"]');
    expect(homeSource).toContain('title: "IDLE"');
    expect(homeSource).toContain('label: "미감지"');
    expect(homeSource).toContain('cardBackground: "#AEB5BE"');
    expect(homeSource).toContain('title: "GO"');
    expect(homeSource).toContain('title: "SLOW"');
    expect(homeSource).toContain('title: "STOP"');
    expect(homeSource).toContain('minHeight: 148');
    expect(homeSource).toContain('paddingTop: 12');
    expect(homeSource).toContain('marginTop: 24');
    expect(homeSource).toContain('fontSize: 74');
    expect(homeSource).toContain('marginTop: 16');
    expect(homeSource).toContain('fontSize: 14');
    expect(homeSource).toContain('fontSize: 34');
  });

  it("keeps only the centered speed panel and falls back to zero when gps speed is unavailable", () => {
    expect(homeSource).toContain('const [distanceValue, setDistanceValue] = useState("--");');
    expect(homeSource).toContain('const [speedValue, setSpeedValue] = useState("0 km/h");');
    expect(homeSource).toContain('displayedDistanceValue = isSignalInactive ? "--" : distanceValue');
    expect(homeSource).toContain('isSignalInactive ? <View style={styles.signalDistanceSpacer} />');
    expect(homeSource).toContain('signalDistanceSpacer');
    expect(homeSource).toContain('height: 18');
    expect(homeSource).toContain('marginTop: 8');
    expect(homeSource).toContain('현재 속도');
    expect(homeSource).toContain('speedOnlyColumn');
    expect(homeSource).toContain('speedOnlyValue');
    expect(homeSource).toContain('minHeight: 116');
    expect(homeSource).toContain('paddingVertical: 12');
    expect(homeSource).toContain('gap: 8');
    expect(homeSource).toContain('Math.max(rawTranslateY, 32)');
    expect(homeSource).toContain('gap: 22');
    expect(homeSource).toContain('flex: 0.5');
    expect(homeSource).toContain('flex: 0.28');
    expect(homeSource).toContain(': "0 km/h";');
    expect(homeSource).not.toContain('metricDivider');
    expect(homeSource).not.toContain('남은 거리');
  });

  it("keeps the enlarged centered direction arrow card and stronger direction typography", () => {
    expect(homeSource).toContain('type DirectionState = "left" | "straight" | "right" | "uturn";');
    expect(homeSource).toContain('12000');
    expect(homeSource).toContain('const handleAdvanceDirection = () => {');
    expect(homeSource).toContain('onPress={handleAdvanceDirection}');
    expect(homeSource).toContain('icon: "north"');
    expect(homeSource).toContain('label: "직진"');
    expect(homeSource).toContain('size={Math.round(arrowFontSize * 2.42 * homeMasterSettings.sizes.directionArrow)}');
    expect(homeSource).toContain('minHeight: 428');
    expect(homeSource).toContain('fontSize: 52');
  });

  it("preserves gps linked updates and always-visible translucent bottom controls", () => {
    expect(homeSource).toContain('Location.watchPositionAsync');
    expect(homeSource).toContain('selectedNavigationProvider');
    expect(homeSource).toContain('const [bottomBarVisible, setBottomBarVisible] = useState(true);');
    expect(homeSource).toContain('const revealBottomBar = useCallback(() => {');
    expect(homeSource).toContain('onTouchStart={revealBottomBar}');
    expect(homeSource).toContain('router.push("/camera")');
    expect(homeSource).toContain('router.push("/settings")');
    expect(homeSource).toContain('카메라');
    expect(homeSource).toContain('홈');
    expect(homeSource).toContain('설정');
    expect(homeSource).toContain('minHeight: 38');
    expect(tabSource).toContain('display: "none"');
  });

  it("keeps the ruby red full-screen warning blink for stop state", () => {
    expect(homeSource).toContain('const [redAlertVisible, setRedAlertVisible] = useState(false);');
    expect(homeSource).toContain('backgroundColor: "#C41230"');
    expect(homeSource).toContain('setRedAlertVisible((prev) => !prev);');
    expect(homeSource).toContain('}, 260);');
    expect(homeSource).toContain('opacity: 0.54');
    expect(homeSource).toContain('opacity: 0.08');
  });

  it("keeps the settings dashboard as a grid with central modal editing flow", () => {
    expect(settingsSource).toContain("GRID_CARDS");
    expect(settingsSource).toContain('key: "display"');
    expect(settingsSource).toContain('title: "시인성"');
    expect(settingsSource).toContain('Modal,');
    expect(settingsSource).toContain('const [activeModal, setActiveModal] = useState<SettingsModalKey | null>(null);');
    expect(settingsSource).toContain('const openModal = (key: SettingsModalKey) => setActiveModal(key);');
    expect(settingsSource).toContain('onPress={() => openModal(card.key)}');
    expect(settingsSource).toContain('transparent');
  });
});
