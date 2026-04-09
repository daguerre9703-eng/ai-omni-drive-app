import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

type SignalState = "red" | "yellow" | "green" | "unknown";
type LeftTurnSignalState = "go" | "stop" | "unknown";
type PedestrianSignalState = "walk" | "stop" | "unknown";

const detectTrafficSignalInput = z.object({
  base64Image: z.string().min(100),
  detectionRange: z.enum(["좁게", "보통", "넓게"]),
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

export const trafficSignalRouter = router({
  detect: publicProcedure.input(detectTrafficSignalInput).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "당신은 운전 보조 비전 모델입니다. 사진 속 전방 교차로 신호를 분석합니다. 반드시 일반 차량 신호(mainSignal), 좌회전 화살표(leftTurnSignal), 보행자 신호(pedestrianSignal)를 각각 독립적으로 판단하세요. 확신이 낮거나 보이지 않으면 unknown을 선택합니다. 응답은 반드시 지정된 JSON 스키마만 사용합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `카메라 인식 범위는 ${input.detectionRange}입니다. 중앙 시야 전방의 일반 차량 신호(red/yellow/green/unknown), 좌회전 화살표(go/stop/unknown), 보행자 신호(walk/stop/unknown)를 각각 판별하고 JSON으로만 응답하세요. crop hint width=${input.cropHint.widthRatio}, height=${input.cropHint.heightRatio}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${input.base64Image}`,
                detail: "low",
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
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              summary: {
                type: "string",
              },
            },
            required: ["signalState", "leftTurnState", "pedestrianState", "confidence", "summary"],
          },
        },
      },
      maxTokens: 220,
    });

    const rawContent = response.choices[0]?.message.content;
    const contentText = typeof rawContent === "string" ? rawContent : "{}";
    const parsed = JSON.parse(contentText) as {
      signalState?: string;
      leftTurnState?: string;
      pedestrianState?: string;
      confidence?: number;
      summary?: string;
    };

    const signalState = coerceSignalState(parsed.signalState ?? "unknown");
    const leftTurnState = coerceLeftTurnState(parsed.leftTurnState ?? "unknown");
    const pedestrianState = coercePedestrianState(parsed.pedestrianState ?? "unknown");
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
    const summary = (parsed.summary ?? "신호 판별 결과 없음").trim() || "신호 판별 결과 없음";

    return {
      signalState,
      leftTurnState,
      pedestrianState,
      confidence,
      summary,
      displayLabel: SIGNAL_LABELS[signalState],
      leftTurnLabel: LEFT_TURN_LABELS[leftTurnState],
      pedestrianLabel: PEDESTRIAN_LABELS[pedestrianState],
    } as const;
  }),
});
