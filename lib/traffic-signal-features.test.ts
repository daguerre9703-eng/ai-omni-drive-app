import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("traffic signal feature regressions", () => {
  const storeSource = readFileSync(join(process.cwd(), "lib/traffic-signal-store.ts"), "utf8");
  const cameraSource = readFileSync(join(process.cwd(), "app/camera.tsx"), "utf8");
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const settingsSource = readFileSync(join(process.cwd(), "app/settings.tsx"), "utf8");
  const serverSource = readFileSync(join(process.cwd(), "server/traffic-signal.ts"), "utf8");
  const voiceSource = readFileSync(join(process.cwd(), "lib/voice-alerts.ts"), "utf8");

  it("expands shared traffic signal state for alert intensity, priority, and sensitivity", () => {
    expect(storeSource).toContain('export type RedAlertIntensity = "off" | "soft" | "balanced" | "strong";');
    expect(storeSource).toContain('export type SignalPriorityMode = "pedestrian-first" | "vehicle-first" | "safety-first";');
    expect(storeSource).toContain('export type SensitivityMode = "standard" | "night" | "rain" | "auto";');
    expect(storeSource).toContain('redAlertIntensity: "balanced"');
    expect(storeSource).toContain('priorityMode: "safety-first"');
    expect(storeSource).toContain('sensitivityMode: "standard"');
    expect(storeSource).toContain('normalizeRedAlertIntensity');
    expect(storeSource).toContain('normalizePriorityMode');
    expect(storeSource).toContain('normalizeSensitivityMode');
  });

  it("wires camera and home hud to the new three-way detection controls", () => {
    expect(cameraSource).toContain('const RED_ALERT_LABELS');
    expect(cameraSource).toContain('const PRIORITY_LABELS');
    expect(cameraSource).toContain('const SENSITIVITY_LABELS');
    expect(cameraSource).toContain('redAlertIntensity,');
    expect(cameraSource).toContain('priorityMode: signalPriorityMode');
    expect(cameraSource).toContain('sensitivityMode,');
    expect(cameraSource).toContain('supplementalText = result.prioritySummary');
    expect(homeSource).toContain('type RedAlertEnvironmentPreset = "standard" | "night" | "rain" | "fog" | "custom";');
    expect(homeSource).toContain('const RED_ALERT_LABEL');
    expect(homeSource).toContain('const RED_ALERT_ENVIRONMENT_LABEL');
    expect(homeSource).toContain('const PRIORITY_MODE_LABEL');
    expect(homeSource).toContain('const SENSITIVITY_MODE_LABEL');
    expect(homeSource).toContain('const [redAlertEnvironmentPreset, setRedAlertEnvironmentPreset] = useState<RedAlertEnvironmentPreset>(');
    expect(homeSource).toContain('const [redAlertBrightness, setRedAlertBrightness] = useState(DEFAULT_SETTINGS.redAlertBrightness);');
    expect(homeSource).toContain('const [redAlertPeriodMs, setRedAlertPeriodMs] = useState(DEFAULT_SETTINGS.redAlertPeriodMs);');
    expect(homeSource).toContain('setRedAlertEnvironmentPreset(');
    expect(homeSource).toContain('const redAlertPresetLabel = useMemo(');
    expect(homeSource).toContain('const intervalMs = Math.max(120, Math.round(redAlertPeriodMs));');
    expect(homeSource).toContain('const activeOpacity = Math.min(0.92, Number((redAlertBrightness * intensityMultiplier).toFixed(2)));');
    expect(homeSource).toContain('{RED_ALERT_LABEL[redAlertIntensity]}');
    expect(homeSource).toContain('{redAlertPresetLabel}');
    expect(homeSource).toContain('밝기 {redAlertBrightnessLabel}');
    expect(homeSource).toContain('주기 {redAlertPeriodLabel}');
    expect(homeSource).toContain('{PRIORITY_MODE_LABEL[signalPriorityMode]}');
    expect(homeSource).toContain('{SENSITIVITY_MODE_LABEL[sensitivityMode]}');
  });

  it("adds independent brightness and period controls to settings persistence", () => {
    expect(settingsSource).toContain('redAlertEnvironmentPreset: RedAlertEnvironmentPreset;');
    expect(settingsSource).toContain('redAlertBrightness: number;');
    expect(settingsSource).toContain('redAlertPeriodMs: number;');
    expect(settingsSource).toContain('redAlertEnvironmentPreset: "standard"');
    expect(settingsSource).toContain('redAlertBrightness: 0.42');
    expect(settingsSource).toContain('redAlertPeriodMs: 260');
    expect(settingsSource).toContain('const [redAlertPreviewOn, setRedAlertPreviewOn] = useState(true);');
    expect(settingsSource).toContain('applyRedAlertEnvironmentPreset');
    expect(settingsSource).toContain('setRedAlertEnvironmentPreset("custom");');
    expect(settingsSource).toContain('setInterval(() => {');
    expect(settingsSource).toContain('setRedAlertPreviewOn((prev) => !prev);');
    expect(settingsSource).toContain('Math.max(120, Math.round(redAlertPeriodMs / 2))');
    expect(settingsSource).toContain('const redAlertPreviewOpacity = useMemo(() => {');
    expect(settingsSource).toContain('const redAlertPreviewStateLabel = useMemo(() => {');
    expect(settingsSource).toContain('parsed.redAlertEnvironmentPreset ?? DEFAULT_SETTINGS.redAlertEnvironmentPreset');
    expect(settingsSource).toContain('setRedAlertBrightness(parsed.redAlertBrightness ?? DEFAULT_SETTINGS.redAlertBrightness);');
    expect(settingsSource).toContain('setRedAlertPeriodMs(parsed.redAlertPeriodMs ?? DEFAULT_SETTINGS.redAlertPeriodMs);');
    expect(settingsSource).toContain('RED_ALERT_ENVIRONMENT_PRESET_OPTIONS');
    expect(settingsSource).toContain('title="점멸 밝기"');
    expect(settingsSource).toContain('title="점멸 주기"');
    expect(settingsSource).toContain('onChange={handleRedAlertBrightnessChange}');
    expect(settingsSource).toContain('onChange={handleRedAlertPeriodChange}');
    expect(settingsSource).toContain('즉시 미리보기');
    expect(settingsSource).toContain('슬라이더를 움직이면 오른쪽 미니 화면이 현재 밝기와 주기대로 바로 반응합니다.');
    expect(settingsSource).toContain('styles.redAlertPreviewCard');
    expect(settingsSource).toContain('styles.redAlertPreviewOverlay');
    expect(settingsSource).toContain('redAlertIntensity === "off"');
    expect(settingsSource).toContain('redAlertPreviewOn');
    expect(settingsSource).toContain('redAlertBrightness,');
    expect(settingsSource).toContain('redAlertPeriodMs,');
  });

  it("keeps settings and server prompt aligned with refined priority and sensitivity modes", () => {
    expect(settingsSource).toContain('RED_ALERT_INTENSITY_OPTIONS');
    expect(settingsSource).toContain('RED_ALERT_ENVIRONMENT_PRESET_OPTIONS');
    expect(settingsSource).toContain('SIGNAL_PRIORITY_OPTIONS');
    expect(settingsSource).toContain('SENSITIVITY_MODE_OPTIONS');
    expect(settingsSource).toContain('setRedAlertIntensity(option.key)');
    expect(settingsSource).toContain('applyRedAlertEnvironmentPreset(option.key)');
    expect(settingsSource).toContain('setSignalPriorityMode(option.key)');
    expect(settingsSource).toContain('setSensitivityMode(option.key)');
    expect(settingsSource).toContain('야간, 우천, 안개 같은 운전 환경에 맞는 추천 조합');
    expect(serverSource).toContain('const PRIORITY_MODE_LABELS');
    expect(serverSource).toContain('const SENSITIVITY_LABELS');
    expect(serverSource).toContain('function buildPrioritySummary(');
    expect(serverSource).toContain('input.priorityMode');
    expect(serverSource).toContain('input.sensitivityMode');
    expect(serverSource).toContain('야간 모드이므로');
    expect(serverSource).toContain('우천 모드이므로');
    expect(serverSource).toContain('자동 환경 적응 모드이므로');
  });

  it("extends voice alerts with supplemental priority guidance", () => {
    expect(voiceSource).toContain('supplementalText?: string;');
    expect(voiceSource).toContain('const appendSupplementalText = (baseText: string) => {');
    expect(voiceSource).toContain('return appendSupplementalText(');
    expect(voiceSource).toContain('const supplementalText = context.supplementalText?.trim();');
    expect(voiceSource).toContain('return `${baseText.trim()} ${supplementalText}`.trim();');
  });
});
