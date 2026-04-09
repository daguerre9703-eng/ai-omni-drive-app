export type HudElementKey = "signal" | "speed" | "direction";

export type FontPreset = "apple-extra-bold" | "gothic-bold" | "serif-bold";

export type LayoutPresetKey = "balanced" | "top-focus" | "lower-focus";

export type HomeThemeSlot = "my-theme-1";

export type ElementOffset = {
  x: number;
  y: number;
};

export type HudSizeSettings = {
  speedValue: number;
  distanceValue: number;
  directionArrow: number;
  directionLabel: number;
  signalTitle: number;
};

export type HudGlowSettings = {
  red: number;
  green: number;
};

export type HomeMasterTheme = {
  backgroundGrayLightness: number;
  backgroundGraySaturation: number;
  hudShellOpacity: number;
};

export type HomeMasterSettings = {
  layoutPreset: LayoutPresetKey;
  verticalBalance: number;
  positions: Record<HudElementKey, ElementOffset>;
  sizes: HudSizeSettings;
  fontPreset: FontPreset;
  theme: HomeMasterTheme;
  signalGlow: HudGlowSettings;
  savedThemeLabel: string;
};

export const HOME_MASTER_STORAGE_KEY = "ai-omni-drive:home-master-settings";

export const HOME_MASTER_THEME_SLOT_LABEL: Record<HomeThemeSlot, string> = {
  "my-theme-1": "나만의 테마 1",
};

export const FONT_PRESET_OPTIONS: Array<{
  key: FontPreset;
  title: string;
  description: string;
}> = [
  {
    key: "apple-extra-bold",
    title: "애플 Extra Bold",
    description: "두껍고 선명한 주행용 기본 서체",
  },
  {
    key: "gothic-bold",
    title: "고딕 Bold",
    description: "또렷한 획 중심의 안정적인 서체",
  },
  {
    key: "serif-bold",
    title: "명조 Bold",
    description: "대표님 취향용 대비감 있는 명조 서체",
  },
];

export const LAYOUT_PRESET_OPTIONS: Array<{
  key: LayoutPresetKey;
  title: string;
  description: string;
  verticalBalance: number;
  positions: Record<HudElementKey, ElementOffset>;
}> = [
  {
    key: "balanced",
    title: "균형형",
    description: "상단·중단·하단 균형을 유지하는 기본 배치",
    verticalBalance: 0,
    positions: {
      signal: { x: 0, y: 0 },
      speed: { x: 0, y: 0 },
      direction: { x: 0, y: 0 },
    },
  },
  {
    key: "top-focus",
    title: "상단 집중형",
    description: "신호 정보에 시선을 더 빨리 모으는 배치",
    verticalBalance: -14,
    positions: {
      signal: { x: 0, y: -8 },
      speed: { x: 0, y: -4 },
      direction: { x: 0, y: 6 },
    },
  },
  {
    key: "lower-focus",
    title: "하단 집중형",
    description: "방향과 속도 정보를 더 아래에서 빠르게 읽는 배치",
    verticalBalance: 14,
    positions: {
      signal: { x: 0, y: 8 },
      speed: { x: 0, y: 4 },
      direction: { x: 0, y: 12 },
    },
  },
];

export const DEFAULT_HOME_MASTER_SETTINGS: HomeMasterSettings = {
  layoutPreset: "balanced",
  verticalBalance: 0,
  positions: {
    signal: { x: 0, y: 0 },
    speed: { x: 0, y: 0 },
    direction: { x: 0, y: 0 },
  },
  sizes: {
    speedValue: 38,
    distanceValue: 88,
    directionArrow: 1,
    directionLabel: 40,
    signalTitle: 48,
  },
  fontPreset: "apple-extra-bold",
  theme: {
    backgroundGrayLightness: 73,
    backgroundGraySaturation: 10,
    hudShellOpacity: 0.58,
  },
  signalGlow: {
    red: 1,
    green: 1,
  },
  savedThemeLabel: HOME_MASTER_THEME_SLOT_LABEL["my-theme-1"],
};

export function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mergeHomeMasterSettings(
  partial?: Partial<HomeMasterSettings> | null,
): HomeMasterSettings {
  return {
    ...DEFAULT_HOME_MASTER_SETTINGS,
    ...partial,
    positions: {
      ...DEFAULT_HOME_MASTER_SETTINGS.positions,
      ...partial?.positions,
      signal: {
        ...DEFAULT_HOME_MASTER_SETTINGS.positions.signal,
        ...partial?.positions?.signal,
      },
      speed: {
        ...DEFAULT_HOME_MASTER_SETTINGS.positions.speed,
        ...partial?.positions?.speed,
      },
      direction: {
        ...DEFAULT_HOME_MASTER_SETTINGS.positions.direction,
        ...partial?.positions?.direction,
      },
    },
    sizes: {
      ...DEFAULT_HOME_MASTER_SETTINGS.sizes,
      ...partial?.sizes,
    },
    theme: {
      ...DEFAULT_HOME_MASTER_SETTINGS.theme,
      ...partial?.theme,
    },
    signalGlow: {
      ...DEFAULT_HOME_MASTER_SETTINGS.signalGlow,
      ...partial?.signalGlow,
    },
  };
}

export function getFontFamilyForPreset(fontPreset: FontPreset) {
  switch (fontPreset) {
    case "gothic-bold":
      return undefined;
    case "serif-bold":
      return "serif";
    case "apple-extra-bold":
    default:
      return undefined;
  }
}

export function getFontWeightForPreset(fontPreset: FontPreset):
  | "700"
  | "800"
  | "900"
  | undefined {
  switch (fontPreset) {
    case "gothic-bold":
      return "800";
    case "serif-bold":
      return "700";
    case "apple-extra-bold":
    default:
      return "900";
  }
}

export function getGrayBackgroundColor(lightness: number, saturation: number) {
  const clampedLightness = clampValue(lightness, 35, 92);
  const clampedSaturation = clampValue(saturation, 0, 24);
  return `hsl(210 ${clampedSaturation}% ${clampedLightness}%)`;
}

export function getShellOverlayColor(lightness: number, saturation: number, opacity: number) {
  const clampedLightness = clampValue(lightness + 9, 42, 98);
  const clampedSaturation = clampValue(saturation, 0, 20);
  const clampedOpacity = clampValue(opacity, 0.2, 0.9);
  return `hsla(210 ${clampedSaturation}% ${clampedLightness}% / ${clampedOpacity})`;
}

export function getSignalGlowOpacity(base: number, intensity: number) {
  return Number((base * clampValue(intensity, 0.2, 2.4)).toFixed(3));
}

export function applyLayoutPreset(presetKey: LayoutPresetKey): HomeMasterSettings {
  const preset = LAYOUT_PRESET_OPTIONS.find((option) => option.key === presetKey);

  if (!preset) {
    return DEFAULT_HOME_MASTER_SETTINGS;
  }

  return mergeHomeMasterSettings({
    layoutPreset: preset.key,
    verticalBalance: preset.verticalBalance,
    positions: preset.positions,
  });
}
