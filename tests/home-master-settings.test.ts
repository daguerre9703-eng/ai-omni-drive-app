import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOME_MASTER_SETTINGS,
  applyLayoutPreset,
  getFontFamilyForPreset,
  getFontWeightForPreset,
  getGrayBackgroundColor,
  getShellOverlayColor,
  getSignalGlowOpacity,
  mergeHomeMasterSettings,
} from "../lib/home-master-settings";

describe("home master settings regression", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const settingsSource = readFileSync(join(process.cwd(), "app/settings.tsx"), "utf8");

  it("merges nested settings without dropping existing defaults", () => {
    const merged = mergeHomeMasterSettings({
      positions: {
        ...DEFAULT_HOME_MASTER_SETTINGS.positions,
        signal: { x: 18, y: -6 },
      },
      theme: {
        ...DEFAULT_HOME_MASTER_SETTINGS.theme,
        backgroundGrayLightness: 82,
      },
      signalGlow: {
        ...DEFAULT_HOME_MASTER_SETTINGS.signalGlow,
        red: 1.9,
      },
    });

    expect(merged.positions.signal).toEqual({ x: 18, y: -6 });
    expect(merged.positions.speed).toEqual(DEFAULT_HOME_MASTER_SETTINGS.positions.speed);
    expect(merged.positions.direction).toEqual(DEFAULT_HOME_MASTER_SETTINGS.positions.direction);
    expect(merged.theme.backgroundGrayLightness).toBe(82);
    expect(merged.theme.backgroundGraySaturation).toBe(
      DEFAULT_HOME_MASTER_SETTINGS.theme.backgroundGraySaturation,
    );
    expect(merged.signalGlow.red).toBe(1.9);
    expect(merged.signalGlow.green).toBe(DEFAULT_HOME_MASTER_SETTINGS.signalGlow.green);
  });

  it("applies layout presets with expected balance offsets", () => {
    const topFocus = applyLayoutPreset("top-focus");
    const lowerFocus = applyLayoutPreset("lower-focus");

    expect(topFocus.layoutPreset).toBe("top-focus");
    expect(topFocus.verticalBalance).toBe(-14);
    expect(topFocus.positions.signal).toEqual({ x: 0, y: -8 });
    expect(lowerFocus.layoutPreset).toBe("lower-focus");
    expect(lowerFocus.verticalBalance).toBe(14);
    expect(lowerFocus.positions.direction).toEqual({ x: 0, y: 12 });
  });

  it("keeps font and color helpers stable for the HUD theme engine", () => {
    expect(getFontFamilyForPreset("apple-extra-bold")).toBeUndefined();
    expect(getFontFamilyForPreset("serif-bold")).toBe("serif");
    expect(getFontWeightForPreset("apple-extra-bold")).toBe("900");
    expect(getFontWeightForPreset("gothic-bold")).toBe("800");
    expect(getGrayBackgroundColor(73, 10)).toBe("hsl(210 10% 73%)");
    expect(getGrayBackgroundColor(100, 40)).toBe("hsl(210 24% 92%)");
    expect(getShellOverlayColor(73, 10, 0.58)).toBe("hsla(210 10% 82% / 0.58)");
    expect(getShellOverlayColor(20, 30, 1.4)).toBe("hsla(210 20% 42% / 0.9)");
    expect(getSignalGlowOpacity(0.54, 2.8)).toBe(1.296);
    expect(getSignalGlowOpacity(0.24, 0.05)).toBe(0.048);
  });

  it("wires the settings center controls into the settings screen", () => {
    expect(settingsSource).toContain("홈 화면 전문 설정 센터");
    expect(settingsSource).toContain("드래그해서 위치 조절");
    expect(settingsSource).toContain("상하 여백 밸런스");
    expect(settingsSource).toContain("폰트 셀렉터");
    expect(settingsSource).toContain("배경 그레이 명도");
    expect(settingsSource).toContain("빨간불 Glow 강도");
    expect(settingsSource).toContain("나만의 테마 1 저장");
    expect(settingsSource).toContain("원상복구");
    expect(settingsSource).toContain("PanResponder.create");
  });

  it("reflects saved home master settings on the home hud", () => {
    expect(homeSource).toContain("HOME_MASTER_STORAGE_KEY");
    expect(homeSource).toContain("setHomeMasterSettings(mergeHomeMasterSettings(parsedHomeMasterValue));");
    expect(homeSource).toContain("dynamicBackgroundColor");
    expect(homeSource).toContain('shellTransform("signal")');
    expect(homeSource).toContain('shellTransform("speed")');
    expect(homeSource).toContain('shellTransform("direction")');
    expect(homeSource).toContain("fontSize: homeMasterSettings.sizes.distanceValue");
    expect(homeSource).toContain("fontSize: homeMasterSettings.sizes.speedValue");
    expect(homeSource).toContain("homeMasterSettings.sizes.directionArrow");
    expect(homeSource).toContain("dynamicSignalGlow");
    expect(homeSource).toContain("getSignalGlowOpacity(0.54, homeMasterSettings.signalGlow.red)");
  });
});
