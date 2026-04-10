export type RedAlertEnvironmentPreset = "standard" | "night" | "rain" | "fog" | "custom";
export type DetectedDrivingEnvironment = "clear" | "night" | "rain" | "fog" | "unknown";

type FixedPreset = Exclude<RedAlertEnvironmentPreset, "custom">;

type RedAlertEnvironmentPresetConfig = {
  key: FixedPreset;
  title: string;
  description: string;
  brightness: number;
  periodMs: number;
};

export const RED_ALERT_ENVIRONMENT_PRESET_OPTIONS: RedAlertEnvironmentPresetConfig[] = [
  {
    key: "standard",
    title: "표준 주간",
    description: "도심 주간 주행에 맞춘 기본 경고 강도입니다.",
    brightness: 0.42,
    periodMs: 260,
  },
  {
    key: "night",
    title: "야간 도로",
    description: "눈부심을 줄이기 위해 밝기를 낮추고 주기를 약간 느리게 맞춥니다.",
    brightness: 0.28,
    periodMs: 320,
  },
  {
    key: "rain",
    title: "우천 반사",
    description: "젖은 노면 반사 속에서도 눈에 띄도록 밝기를 높이고 주기를 빠르게 맞춥니다.",
    brightness: 0.52,
    periodMs: 220,
  },
  {
    key: "fog",
    title: "안개·흐림",
    description: "대비가 낮은 시야를 고려해 밝기를 높이되 과도한 점멸은 줄입니다.",
    brightness: 0.48,
    periodMs: 300,
  },
];

export function getDetectedDrivingEnvironmentLabel(environment: DetectedDrivingEnvironment) {
  switch (environment) {
    case "night":
      return "야간";
    case "rain":
      return "우천";
    case "fog":
      return "안개·흐림";
    case "clear":
      return "맑은 주간";
    default:
      return "환경 미확인";
  }
}

export function resolveRedAlertPresetFromEnvironment(
  environment: DetectedDrivingEnvironment,
): FixedPreset {
  if (environment === "fog") {
    return "fog";
  }

  if (environment === "rain") {
    return "rain";
  }

  if (environment === "night") {
    return "night";
  }

  return "standard";
}

export function getRedAlertEnvironmentPresetConfig(preset: FixedPreset) {
  return (
    RED_ALERT_ENVIRONMENT_PRESET_OPTIONS.find((option) => option.key === preset) ??
    RED_ALERT_ENVIRONMENT_PRESET_OPTIONS[0]
  );
}

export function buildEnvironmentPresetReason(environment: DetectedDrivingEnvironment) {
  switch (environment) {
    case "fog":
      return "안개·흐림으로 대비가 낮아 안개 프리셋을 자동 적용했습니다.";
    case "rain":
      return "젖은 노면 반사가 감지되어 우천 프리셋을 자동 적용했습니다.";
    case "night":
      return "주변 광량이 낮아 야간 프리셋을 자동 적용했습니다.";
    case "clear":
      return "특수 기상 조건이 없어 표준 주간 프리셋을 유지합니다.";
    default:
      return "환경이 불명확해 표준 주간 프리셋을 기본값으로 유지합니다.";
  }
}

export function buildAutoRedAlertEnvironmentState(environment: DetectedDrivingEnvironment) {
  const preset = resolveRedAlertPresetFromEnvironment(environment);
  const config = getRedAlertEnvironmentPresetConfig(preset);

  return {
    preset,
    brightness: config.brightness,
    periodMs: config.periodMs,
    presetLabel: config.title,
    detectedEnvironmentLabel: getDetectedDrivingEnvironmentLabel(environment),
    environmentReason: buildEnvironmentPresetReason(environment),
  } as const;
}
