/**
 * Traffic Sign Detection Server Endpoint
 *
 * 비전 AI를 사용한 교통 표지판 감지
 */

import { z } from "zod";

import { invokeLLM } from "./_core/llm";
import { publicProcedure, router } from "./_core/trpc";

// 교통 표지판 감지 입력 스키마
const detectTrafficSignInput = z.object({
  base64Image: z.string().min(100),
});

export const trafficSignDetectionRouter = router({
  detect: publicProcedure.input(detectTrafficSignInput).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "당신은 운전 보조 비전 모델입니다. 도로 주행 중 교통 표지판을 인식합니다. 한국 도로 교통 표지판 규격을 따르며, 속도 제한, 어린이 보호구역, 일시 정지, 주의, 금지 표지판을 정확히 구분합니다. 응답은 반드시 지정된 JSON 스키마만 사용합니다.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `이 도로 주행 이미지에서 교통 표지판을 감지하세요.

**표지판 종류:**

1. **speed_limit** (속도 제한): 원형 빨간 테두리, 흰 배경, 검은 숫자
   - 일반적인 값: 30, 40, 50, 60, 70, 80, 90, 100, 110, 120 (km/h)
   - speedLimit 필드에 숫자 기록

2. **school_zone** (어린이 보호구역): 노란색 배경, "어린이 보호구역" 또는 스쿨존 표시
   - 자동으로 30km/h 제한
   - speedLimit: 30

3. **stop** (일시 정지): 빨간 팔각형, "정지" 또는 "STOP" 문자
   - speedLimit: null

4. **warning** (주의): 노란 마름모 또는 삼각형, 다양한 주의 표시
   - 예: 공사중, 미끄러운 도로, 낙석주의 등
   - speedLimit: null

5. **prohibition** (금지): 원형 빨간 테두리, 특정 행위 금지 표시
   - 예: 주차금지, 진입금지, 추월금지 등
   - speedLimit: null

6. **unknown**: 표지판이 없거나 인식 불가

**출력 필드:**
- signDetected (boolean): 표지판이 감지되었는가?
- signType (string): 표지판 종류 (위 6개 중 하나)
- speedLimit (number | null): 속도 제한 값 (speed_limit인 경우만)
- description (string): 표지판 설명 (한글, 한 줄)
- confidence (number, 0-1): 인식 신뢰도

**중요:**
- 실제 도로 교통 표지판이 명확하게 보이는 경우에만 signDetected: true
- 흐릿하거나 일부만 보이면 신뢰도를 낮춰서 반환
- 숫자는 정확하게 읽어야 함 (30과 80, 50과 60 구분 주의)
- 한국 표지판 규격에 맞지 않으면 unknown
- 멀리 있거나 작게 보이는 표지판도 감지 시도`,
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
          name: "traffic_sign_detection",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              signDetected: {
                type: "boolean",
              },
              signType: {
                type: "string",
                enum: ["speed_limit", "school_zone", "stop", "warning", "prohibition", "unknown"],
              },
              speedLimit: {
                type: ["number", "null"],
              },
              description: {
                type: "string",
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
            required: ["signDetected", "signType", "speedLimit", "description", "confidence"],
          },
        },
      },
    });

    return response;
  }),
});
