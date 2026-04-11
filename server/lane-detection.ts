/**
 * Lane Detection Server Endpoint
 *
 * 비전 AI를 사용한 차선 감지
 */

import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

// 차선 감지 입력 스키마
const detectLaneInput = z.object({
  base64Image: z.string().min(100),
});

export const laneDetectionRouter = router({
  detect: publicProcedure.input(detectLaneInput).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "당신은 운전 보조 비전 모델입니다. 도로 주행 카메라 영상을 분석하여 차선의 위치와 차량의 차선 내 위치를 판별합니다. 응답은 반드시 지정된 JSON 스키마만 사용합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `이 도로 주행 이미지를 분석하여 차선 정보를 반환하세요.

**분석 항목:**

1. laneDetected (boolean): 차선이 명확하게 감지되는가? 좌우 차선 중 하나라도 보이면 true
2. lanePosition (string): 차량이 차선 내 어느 위치에 있는가?
   - "center": 차선 중앙 (정상)
   - "left_side": 좌측 차선에 가까움 (이탈 위험)
   - "right_side": 우측 차선에 가까움 (이탈 위험)
   - "unknown": 판단 불가
3. leftLaneVisible (boolean): 좌측 차선이 보이는가?
4. rightLaneVisible (boolean): 우측 차선이 보이는가?
5. distanceToLeftLane (number | null): 좌측 차선까지 거리(미터), 일반 차선 폭은 3-3.5m
6. distanceToRightLane (number | null): 우측 차선까지 거리(미터)
7. confidence (number, 0-1): 분석 신뢰도
8. reasoning (string): 판단 근거 한 줄 설명

**중요:** 실제 도로가 아니면 laneDetected: false, 야간/우천은 신뢰도 낮춤`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${input.base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "lane_detection",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              laneDetected: {
                type: "boolean",
              },
              lanePosition: {
                type: "string",
                enum: ["center", "left_side", "right_side", "unknown"],
              },
              leftLaneVisible: {
                type: "boolean",
              },
              rightLaneVisible: {
                type: "boolean",
              },
              distanceToLeftLane: {
                type: ["number", "null"],
              },
              distanceToRightLane: {
                type: ["number", "null"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reasoning: {
                type: "string",
              },
            },
            required: [
              "laneDetected",
              "lanePosition",
              "leftLaneVisible",
              "rightLaneVisible",
              "distanceToLeftLane",
              "distanceToRightLane",
              "confidence",
              "reasoning",
            ],
          },
        },
      },
    });

    return response;
  }),
});
