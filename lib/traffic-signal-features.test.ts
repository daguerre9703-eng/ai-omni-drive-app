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
    expect(homeSource).toContain('const RED_ALERT_LABEL');
    expect(homeSource).toContain('const PRIORITY_MODE_LABEL');
    expect(homeSource).toContain('const SENSITIVITY_MODE_LABEL');
    expect(homeSource).toContain('redAlertIntensity === "soft" ? 420 : redAlertIntensity === "strong" ? 170 : 260');
    expect(homeSource).toContain('return redAlertVisible ? 0.68 : 0.14;');
    expect(homeSource).toContain('return redAlertVisible ? 0.18 : 0.03;');
    expect(homeSource).toContain('{RED_ALERT_LABEL[redAlertIntensity]}');
    expect(homeSource).toContain('{PRIORITY_MODE_LABEL[signalPriorityMode]}');
    expect(homeSource).toContain('{SENSITIVITY_MODE_LABEL[sensitivityMode]}');
  });

  it("keeps settings and server prompt aligned with refined priority and sensitivity modes", () => {
    expect(settingsSource).toContain('RED_ALERT_INTENSITY_OPTIONS');
    expect(settingsSource).toContain('SIGNAL_PRIORITY_OPTIONS');
    expect(settingsSource).toContain('SENSITIVITY_MODE_OPTIONS');
    expect(settingsSource).toContain('setRedAlertIntensity(option.key)');
    expect(settingsSource).toContain('setSignalPriorityMode(option.key)');
    expect(settingsSource).toContain('setSensitivityMode(option.key)');
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
