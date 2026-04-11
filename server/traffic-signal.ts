import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

type SignalState = "red" | "yellow" | "green" | "unknown";
type LeftTurnSignalState = "go" | "stop" | "unknown";
type PedestrianSignalState = "walk" | "stop" | "unknown";
type SignalPriorityMode = "pedestrian-first" | "vehicle-first" | "safety-first";
type SensitivityMode = "standard" | "night" | "rain" | "auto";
type DetectedDrivingEnvironment = "clear" | "night" | "rain" | "fog" | "unknown";

const detectTrafficSignalInput = z.object({
  base64Image: z.string().min(100),
  detectionRange: z.enum(["좁게", "보통", "넓게"]),
  priorityMode: z.enum(["pedestrian-first", "vehicle-first", "safety-first"]),
  sensitivityMode: z.enum(["standard", "night", "rain", "auto"]),
  cropHint: z.object({
    widthRatio: z.number().min(0.1).max(1),
    heightRatio: z.number().min(0.1).max(1),
  }),
});

const SIGNAL_LABELS: Record<SignalState, string> = {
  red: "STOP",
  yellow: "SLOW",
  green: "GO",
  unknown: "SLOW",
};

const LEFT_TURN_LABELS: Record<LeftTurnSignalState, string> = {
  go: "좌회전 가능",
  stop: "좌회전 대기",
  unknown: "좌회전 미확인",
};

const PEDESTRIAN_LABELS: Record<PedestrianSignalState, string> = {
  walk: "보행 가능",
  stop: "보행 정지",
  unknown: "보행 미확인",
};

const PRIORITY_MODE_LABELS: Record<SignalPriorityMode, string> = {
  "pedestrian-first": "보행 우선",
  "vehicle-first": "차량 우선",
  "safety-first": "안전 우선",
};

const SENSITIVITY_LABELS: Record<SensitivityMode, string> = {
  standard: "기본 감도",
  night: "야간 고감도",
  rain: "우천 고감도",
  auto: "자동 환경 적응",
};

const ENVIRONMENT_LABELS: Record<DetectedDrivingEnvironment, string> = {
  clear: "맑은 주간",
  night: "야간",
  rain: "우천",
  fog: "안개·흐림",
  unknown: "환경 미확인",
};

const coerceSignalState = (value: string): SignalState => {
  if (value === "red" || value === "yellow" || value === "green") {
    return value;
  }

  return "unknown";
};

const coerceLeftTurnState = (value: string): LeftTurnSignalState => {
  if (value === "go" || value === "stop") {
    return value;
  }

  return "unknown";
};

const coercePedestrianState = (value: string): PedestrianSignalState => {
  if (value === "walk" || value === "stop") {
    return value;
  }

  return "unknown";
};

const coerceDrivingEnvironment = (value: string): DetectedDrivingEnvironment => {
  if (value === "clear" || value === "night" || value === "rain" || value === "fog") {
    return value;
  }

  return "unknown";
};

function buildPrioritySummary(
  priorityMode: SignalPriorityMode,
  signalState: SignalState,
  leftTurnState: LeftTurnSignalState,
  pedestrianState: PedestrianSignalState,
) {
  const vehicleStop = signalState === "red" || signalState === "yellow";
  const vehicleGo = signalState === "green" || leftTurnState === "go";
  const pedestrianGo = pedestrianState === "walk";
  const pedestrianStop = pedestrianState === "stop";
  const conflictDetected = vehicleGo && pedestrianGo;

  if (priorityMode === "pedestrian-first") {
    if (conflictDetected) {
      return "보행 우선: 보행 가능 신호를 먼저 알리고 차량 진행은 보조로만 안내합니다.";
    }

    if (pedestrianGo) {
      return "보행 우선: 횡단 가능 신호를 먼저 안내합니다.";
    }

    if (vehicleStop || pedestrianStop) {
      return "보행 우선: 횡단 정지와 차량 감속 필요를 함께 경고합니다.";
    }

    return "보행 우선: 보행 신호를 가장 먼저 확인 중입니다.";
  }

  if (priorityMode === "vehicle-first") {
    if (signalState === "red") {
      return "차량 우선: 정지 신호를 최우선으로 경고합니다.";
    }

    if (conflictDetected) {
      return "차량 우선: 차량 진행 흐름을 먼저 읽고 보행 가능 신호는 보조로 안내합니다.";
    }

    if (signalState === "green") {
      return leftTurnState === "go"
        ? "차량 우선: 직진과 좌회전 가능 여부를 함께 안내합니다."
        : "차량 우선: 직진 차량 신호를 먼저 안내합니다.";
    }

    return "차량 우선: 전방 차량 신호를 중심으로 확인 중입니다.";
  }

  if (signalState === "red") {
    return "안전 우선: 차량 정지 신호가 감지되어 즉시 감속·정지를 우선 경고합니다.";
  }

  if (pedestrianStop && vehicleStop) {
    return "안전 우선: 차량과 보행 모두 정지 신호이므로 가장 보수적인 안내를 유지합니다.";
  }

  if (conflictDetected) {
    return "안전 우선: 차량 진행과 보행 가능 신호가 함께 보여 주변 교차 흐름을 가장 보수적으로 안내합니다.";
  }

  if (pedestrianGo) {
    return "안전 우선: 보행 가능 신호를 우선 안내합니다.";
  }

  if (leftTurnState === "go") {
    return "안전 우선: 좌회전 가능 신호를 보조 안내합니다.";
  }

  return "안전 우선: 가장 보수적인 신호 안내를 유지합니다.";
}

export const trafficSignalRouter = router({
  detect: publicProcedure.input(detectTrafficSignalInput).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "당신은 운전 보조 비전 모델입니다. 사진 속 전방 교차로 신호를 분석합니다. 일반 차량 신호(mainSignal), 좌회전 화살표(leftTurnSignal), 보행자 신호(pedestrianSignal)를 각각 독립적으로 판단하세요. 야간, 역광, 빗물 반사, 흐린 렌즈 가능성까지 고려하고 확신이 낮으면 unknown을 선택합니다. 응답은 반드시 지정된 JSON 스키마만 사용합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `카메라 인식 범위는 ${input.detectionRange}입니다. 우선순위 규칙은 ${PRIORITY_MODE_LABELS[input.priorityMode]}이고, 감도 모드는 ${SENSITIVITY_LABELS[input.sensitivityMode]}입니다. 중앙 시야 전방의 일반 차량 신호(red/yellow/green/unknown), 좌회전 화살표(go/stop/unknown), 보행자 신호(walk/stop/unknown)를 각각 판별하고, 장면의 주행 환경을 clear/night/rain/fog/unknown 중 하나로 추정하세요.

**중요**: 신호등에 숫자 카운트다운(잔여 시간)이 표시되어 있다면 OCR로 해당 숫자를 읽어서 countdownSeconds에 넣어주세요. 숫자가 없거나 읽을 수 없다면 null로 설정하세요. countdownConfidence에는 숫자 인식 신뢰도를 0-1 사이로 넣어주세요.

environmentSummary에는 왜 해당 환경으로 판단했는지 한 문장으로 설명하세요. ${input.sensitivityMode === "night" ? "야간 모드이므로 어두운 배경, 눈부심, 헤드라이트 역광 속 작은 점등 차이를 더 세밀하게 읽되 확신이 낮으면 unknown을 선택하세요." : input.sensitivityMode === "rain" ? "우천 모드이므로 빗물 반사, 젖은 노면, 흐린 렌즈, 번짐이 있어도 신호의 실제 점등 위치를 우선 판단하되 확신이 낮으면 unknown을 선택하세요." : input.sensitivityMode === "auto" ? "자동 환경 적응 모드이므로 야간, 우천, 흐림, 역광 여부를 먼저 추정하고 그에 맞는 민감도로 판별하되 과도한 추정은 피하고 애매하면 unknown을 선택하세요." : "기본 감도로 과도한 추정 없이 명확한 점등만 판별하세요."} 보행자와 차량 신호가 동시에 보일 때는 두 신호를 모두 독립 판별하되 summary에는 어떤 신호가 충돌하는지 한 문장으로 간단히 적어 주세요. crop hint width=${input.cropHint.widthRatio}, height=${input.cropHint.heightRatio}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${input.base64Image}`,
                detail: input.sensitivityMode === "standard" ? "low" : "high",
              },
            },
          ],
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "traffic_signal_detection",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              signalState: {
                type: "string",
                enum: ["red", "yellow", "green", "unknown"],
              },
              leftTurnState: {
                type: "string",
                enum: ["go", "stop", "unknown"],
              },
              pedestrianState: {
                type: "string",
                enum: ["walk", "stop", "unknown"],
              },
              drivingEnvironment: {
                type: "string",
                enum: ["clear", "night", "rain", "fog", "unknown"],
              },
              environmentSummary: {
                type: "string",
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              summary: {
                type: "string",
              },
              countdownSeconds: {
                type: ["number", "null"],
              },
              countdownConfidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
            required: ["signalState", "leftTurnState", "pedestrianState", "drivingEnvironment", "environmentSummary", "confidence", "summary", "countdownSeconds", "countdownConfidence"],
          },
        },
      },
      maxTokens: 300,
    });

    const rawContent = response.choices[0]?.message.content;
    const contentText = typeof rawContent === "string" ? rawContent : "{}";
    const parsed = JSON.parse(contentText) as {
      signalState?: string;
      leftTurnState?: string;
      pedestrianState?: string;
      drivingEnvironment?: string;
      environmentSummary?: string;
      confidence?: number;
      summary?: string;
      countdownSeconds?: number | null;
      countdownConfidence?: number;
    };

    const signalState = coerceSignalState(parsed.signalState ?? "unknown");
    const leftTurnState = coerceLeftTurnState(parsed.leftTurnState ?? "unknown");
    const pedestrianState = coercePedestrianState(parsed.pedestrianState ?? "unknown");
    const drivingEnvironment = coerceDrivingEnvironment(parsed.drivingEnvironment ?? "unknown");
    const environmentSummary =
      (parsed.environmentSummary ?? "주행 환경 판별 결과 없음").trim() || "주행 환경 판별 결과 없음";
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
    const summary = (parsed.summary ?? "신호 판별 결과 없음").trim() || "신호 판별 결과 없음";
    const prioritySummary = buildPrioritySummary(
      input.priorityMode,
      signalState,
      leftTurnState,
      pedestrianState,
    );
    const countdownSeconds = parsed.countdownSeconds ?? null;
    const countdownConfidence = Math.min(1, Math.max(0, Number(parsed.countdownConfidence ?? 0)));

    return {
      signalState,
      leftTurnState,
      pedestrianState,
      confidence,
      summary,
      prioritySummary,
      displayLabel: SIGNAL_LABELS[signalState],
      leftTurnLabel: LEFT_TURN_LABELS[leftTurnState],
      pedestrianLabel: PEDESTRIAN_LABELS[pedestrianState],
      priorityMode: input.priorityMode,
      priorityModeLabel: PRIORITY_MODE_LABELS[input.priorityMode],
      sensitivityMode: input.sensitivityMode,
      sensitivityLabel: SENSITIVITY_LABELS[input.sensitivityMode],
      drivingEnvironment,
      drivingEnvironmentLabel: ENVIRONMENT_LABELS[drivingEnvironment],
      environmentSummary,
      countdownSeconds,
      countdownConfidence,
    } as const;
  }),
});
