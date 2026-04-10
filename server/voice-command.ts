/**
 * 서버 측 음성 명령 파싱 — LLM 기반 자연어 의도 분석
 *
 * 클라이언트에서 로컬 패턴 매칭 실패 시 이 API를 호출하여
 * LLM이 사용자의 자연어 명령을 분석하고 설정 변경 의도를 반환한다.
 */
import { invokeLLM } from "./_core/llm";

export type VoiceCommandIntent =
  | "set_alert_distance"
  | "set_sensitivity"
  | "set_preset"
  | "set_priority"
  | "set_voice_style"
  | "set_voice_length"
  | "toggle_voice_guide"
  | "toggle_red_alert"
  | "set_red_alert_brightness"
  | "set_red_alert_period"
  | "unknown";

export type ParsedVoiceCommand = {
  intent: VoiceCommandIntent;
  confidence: number;
  params: Record<string, string | number | boolean>;
  explanation: string;
};

const SYSTEM_PROMPT = `당신은 AI 운전 보조 앱 "AI Omni-Drive"의 음성 명령 파서입니다.
사용자가 음성으로 말한 자연어 명령을 분석하여 앱 설정 변경 의도를 JSON으로 반환하세요.

지원하는 의도(intent) 목록:
- set_alert_distance: 알림 거리 설정 (params: { distanceMeters: number })
- set_sensitivity: 감도 모드 변경 (params: { mode: "standard"|"night"|"rain"|"auto" })
- set_preset: 환경 프리셋 변경 (params: { preset: "standard"|"night"|"rain"|"fog" })
- set_priority: 신호 우선순위 변경 (params: { mode: "pedestrian-first"|"vehicle-first"|"safety-first" })
- set_voice_style: 음성 스타일 변경 (params: { style: "default"|"calm"|"focus" })
- set_voice_length: 음성 길이 변경 (params: { length: "detailed"|"brief" })
- toggle_voice_guide: 음성 안내 ON/OFF (params: { enabled: boolean })
- toggle_red_alert: 적색 점멸 ON/OFF (params: { enabled: boolean })
- set_red_alert_brightness: 적색 점멸 밝기 (params: { brightness: number 0~1 })
- set_red_alert_period: 적색 점멸 주기 (params: { periodMs: number 120~1000 })
- unknown: 인식 불가

반드시 아래 JSON 형식으로만 응답하세요:
{
  "intent": "...",
  "confidence": 0.0~1.0,
  "params": { ... },
  "explanation": "한국어로 짧은 설명"
}`;

export async function parseVoiceCommandWithLLM(
  commandText: string,
): Promise<ParsedVoiceCommand> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: commandText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_command",
          strict: true,
          schema: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                description: "The detected intent",
              },
              confidence: {
                type: "number",
                description: "Confidence score 0-1",
              },
              params: {
                type: "object",
                description: "Parameters for the intent",
                additionalProperties: true,
              },
              explanation: {
                type: "string",
                description: "Brief Korean explanation",
              },
            },
            required: ["intent", "confidence", "params", "explanation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        intent: "unknown",
        confidence: 0,
        params: {},
        explanation: "LLM 응답을 받지 못했습니다.",
      };
    }

    const parsed = JSON.parse(content) as ParsedVoiceCommand;
    return parsed;
  } catch (error) {
    console.error("[VoiceCommand] LLM parsing failed:", error);
    return {
      intent: "unknown",
      confidence: 0,
      params: {},
      explanation: "음성 명령 분석 중 오류가 발생했습니다.",
    };
  }
}
