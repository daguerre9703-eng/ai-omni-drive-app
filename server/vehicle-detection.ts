import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

const detectVehicleInput = z.object({
  base64Image: z.string().min(100),
  mySpeedKmh: z.number().min(0).max(300),
  detectionSensitivity: z.enum(["low", "medium", "high"]),
});

export const vehicleDetectionRouter = router({
  detect: publicProcedure.input(detectVehicleInput).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "당신은 운전 보조 비전 모델입니다. 전방 카메라 영상을 분석하여 앞차의 존재 여부, 거리, 움직임을 판별합니다. 정확한 거리 추정이 어렵다면 unknown을 반환하세요. 응답은 반드시 지정된 JSON 스키마만 사용합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `현재 내 차량 속도는 ${input.mySpeedKmh} km/h이고 감지 민감도는 ${input.detectionSensitivity}입니다. 전방 중앙에 차량이 있는지 판별하고, 있다면 대략적인 거리(미터), 앞차가 움직이는지 정지해 있는지를 추정하세요. frontVehicleDetected(true/false), estimatedDistanceMeters(숫자 또는 null), frontVehicleMoving(true/false/null), frontVehicleStopped(true/false/null), confidence(0-1), summary(한 문장 요약)를 JSON으로 반환하세요. ${input.detectionSensitivity === "high" ? "고감도 모드이므로 멀리 있는 작은 차량도 감지하려 하되 과도한 추정은 피하세요." : input.detectionSensitivity === "low" ? "저감도 모드이므로 명확하게 가까운 차량만 감지하세요." : "중간 감도로 일반적인 교통 흐름에서 앞차를 판별하세요."}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${input.base64Image}`,
                detail: input.detectionSensitivity === "high" ? "high" : "low",
              },
            },
          ],
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "vehicle_detection",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              frontVehicleDetected: {
                type: "boolean",
              },
              estimatedDistanceMeters: {
                type: ["number", "null"],
              },
              frontVehicleMoving: {
                type: ["boolean", "null"],
              },
              frontVehicleStopped: {
                type: ["boolean", "null"],
              },
              estimatedFrontVehicleSpeedKmh: {
                type: ["number", "null"],
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
            required: [
              "frontVehicleDetected",
              "estimatedDistanceMeters",
              "frontVehicleMoving",
              "frontVehicleStopped",
              "estimatedFrontVehicleSpeedKmh",
              "confidence",
              "summary",
            ],
          },
        },
      },
      maxTokens: 200,
    });

    const rawContent = response.choices[0]?.message.content;
    const contentText = typeof rawContent === "string" ? rawContent : "{}";
    const parsed = JSON.parse(contentText) as {
      frontVehicleDetected?: boolean;
      estimatedDistanceMeters?: number | null;
      frontVehicleMoving?: boolean | null;
      frontVehicleStopped?: boolean | null;
      estimatedFrontVehicleSpeedKmh?: number | null;
      confidence?: number;
      summary?: string;
    };

    return {
      frontVehicleDetected: parsed.frontVehicleDetected ?? false,
      estimatedDistanceMeters: parsed.estimatedDistanceMeters ?? null,
      frontVehicleMoving: parsed.frontVehicleMoving ?? null,
      frontVehicleStopped: parsed.frontVehicleStopped ?? null,
      estimatedFrontVehicleSpeedKmh: parsed.estimatedFrontVehicleSpeedKmh ?? null,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
      summary: (parsed.summary ?? "차량 감지 결과 없음").trim() || "차량 감지 결과 없음",
    } as const;
  }),
});
