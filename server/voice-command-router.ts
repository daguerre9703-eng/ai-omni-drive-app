/**
 * 음성 명령 tRPC 라우터
 * - voice.transcribe: 오디오 URL → Whisper STT 전사
 * - voice.parseCommand: 자연어 텍스트 → LLM 의도 분석
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { parseVoiceCommandWithLLM } from "./voice-command";
import { TRPCError } from "@trpc/server";

export const voiceCommandRouter = router({
  transcribe: publicProcedure
    .input(
      z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
        prompt: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await transcribeAudio(input);

      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
          cause: result,
        });
      }

      return result;
    }),

  parseCommand: publicProcedure
    .input(
      z.object({
        commandText: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await parseVoiceCommandWithLLM(input.commandText);
      return result;
    }),
});
