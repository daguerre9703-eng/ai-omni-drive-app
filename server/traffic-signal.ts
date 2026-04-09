import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

type SignalState = "red" | "yellow" | "green" | "unknown";

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

const coerceSignalState = (value: string): SignalState => {
  if (value === "red" || value === "yellow" || value === "green") {
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
            "당신은 운전 보조 비전 모델입니다. 사진 속 교차로 신호등의 주된 색상을 red, yellow, green, unknown 중 하나로만 판단합니다. 차량 HUD용이므로 가장 운전자에게 relevant한 전방 신호등 하나를 우선 해석하고, 확신이 낮으면 unknown을 선택합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `카메라 인식 범위는 ${input.detectionRange}입니다. 중앙 시야의 전방 신호등 상태를 판별하고 JSON으로만 응답하세요. crop hint width=${input.cropHint.widthRatio}, height=${input.cropHint.heightRatio}`,
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
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              summary: {
                type: "string",
              },
            },
            required: ["signalState", "confidence", "summary"],
          },
        },
      },
      maxTokens: 180,
    });

    const rawContent = response.choices[0]?.message.content;
    const contentText = typeof rawContent === "string" ? rawContent : "{}";
    const parsed = JSON.parse(contentText) as {
      signalState?: string;
      confidence?: number;
      summary?: string;
    };

    const signalState = coerceSignalState(parsed.signalState ?? "unknown");
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
    const summary = (parsed.summary ?? "신호 판별 결과 없음").trim() || "신호 판별 결과 없음";

    return {
      signalState,
      confidence,
      summary,
      displayLabel: SIGNAL_LABELS[signalState],
    } as const;
  }),
});
