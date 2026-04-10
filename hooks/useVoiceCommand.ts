/**
 * useVoiceCommand — 핸즈프리 상시 음성 인식 React Hook
 *
 * expo-audio로 마이크 녹음 → 서버 Whisper STT 전사 → Wake Word 감지 →
 * 로컬 패턴 매칭 or 서버 LLM 파싱 → 설정 자동 변경
 *
 * 설정 > 마이크 상시 켜기 토글로만 통제된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";

import {
  containsWakeWord,
  parseCommandLocally,
  DEFAULT_VOICE_COMMAND_SETTINGS,
  VOICE_COMMAND_STORAGE_KEY,
  type VoiceCommandResult,
  type VoiceCommandSettings,
  type VoiceListeningState,
} from "@/lib/voice-command";
import { trpc } from "@/lib/trpc";

// ── 상수 ──
const LISTEN_DURATION_MS = 4000;       // 한 번 녹음 길이
const WAKE_LISTEN_DURATION_MS = 2500;  // 호출어 대기 시 짧은 녹음
const COOLDOWN_MS = 500;               // 녹음 간 쿨다운
const COMMAND_TIMEOUT_MS = 8000;       // 호출어 감지 후 명령 대기 시간

export type UseVoiceCommandOptions = {
  onCommand?: (result: VoiceCommandResult) => void;
  onWakeWord?: () => void;
  onStateChange?: (state: VoiceListeningState) => void;
  onError?: (error: string) => void;
};

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const { onCommand, onWakeWord, onStateChange, onError } = options;

  const [listeningState, setListeningState] = useState<VoiceListeningState>("idle");
  const [settings, setSettings] = useState<VoiceCommandSettings>(DEFAULT_VOICE_COMMAND_SETTINGS);
  const [lastCommand, setLastCommand] = useState<VoiceCommandResult | null>(null);

  const stateRef = useRef<VoiceListeningState>("idle");
  const settingsRef = useRef(settings);
  const activatedAtRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  const loopActiveRef = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // tRPC mutations
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const parseCommandMutation = trpc.voice.parseCommand.useMutation();

  // ── 상태 업데이트 헬퍼 ──
  const updateState = useCallback(
    (newState: VoiceListeningState) => {
      stateRef.current = newState;
      setListeningState(newState);
      onStateChange?.(newState);
    },
    [onStateChange],
  );

  // ── 설정 로드 ──
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(VOICE_COMMAND_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as VoiceCommandSettings;
          setSettings(parsed);
          settingsRef.current = parsed;
        }
      } catch (e) {
        console.error("[VoiceCommand] Failed to load settings:", e);
      }
    };
    load();
  }, []);

  // ── 설정 저장 ──
  const updateSettings = useCallback(async (next: Partial<VoiceCommandSettings>) => {
    const merged = { ...settingsRef.current, ...next };
    settingsRef.current = merged;
    setSettings(merged);
    try {
      await AsyncStorage.setItem(VOICE_COMMAND_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.error("[VoiceCommand] Failed to save settings:", e);
    }
  }, []);

  // ── 마이크 권한 요청 ──
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      return status.granted;
    } catch (e) {
      console.error("[VoiceCommand] Permission error:", e);
      return false;
    }
  }, []);

  // ── 한 번 녹음 → 전사 ──
  const recordAndTranscribe = useCallback(
    async (durationMs: number): Promise<string | null> => {
      if (isRecordingRef.current) return null;
      isRecordingRef.current = true;

      try {
        // 녹음 시작
        recorder.record();

        // 지정 시간 후 정지
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        const uri = await recorder.stop();

        if (!uri) return null;

        // 서버로 전사 요청 (expo-audio 녹음 파일 URI → 업로드 → Whisper)
        // 실제 구현에서는 storagePut으로 S3 업로드 후 URL을 전달
        const result = await transcribeMutation.mutateAsync({
          audioUrl: uri,
          language: "ko",
          prompt: "AI 옴니 드라이브 음성 명령 인식. 호출어: 옴니야, AI야",
        });

        return result.text || null;
      } catch (e) {
        console.error("[VoiceCommand] Record/transcribe error:", e);
        return null;
      } finally {
        isRecordingRef.current = false;
      }
    },
    [recorder, transcribeMutation],
  );

  // ── 명령 처리 ──
  const processCommand = useCallback(
    async (text: string) => {
      updateState("processing");

      // 1차: 로컬 패턴 매칭
      const localResult = parseCommandLocally(text);
      if (localResult && localResult.confidence >= 0.8) {
        setLastCommand(localResult);
        onCommand?.(localResult);
        updateState("waiting");
        return;
      }

      // 2차: 서버 LLM 파싱
      try {
        const serverResult = await parseCommandMutation.mutateAsync({
          commandText: text,
        });

        const result: VoiceCommandResult = {
          intent: serverResult.intent as VoiceCommandResult["intent"],
          rawText: text,
          confidence: serverResult.confidence,
          params: serverResult.params,
        };

        setLastCommand(result);
        onCommand?.(result);
      } catch (e) {
        console.error("[VoiceCommand] Server parse error:", e);
        onError?.("음성 명령 분석에 실패했습니다.");
      }

      updateState("waiting");
    },
    [onCommand, onError, parseCommandMutation, updateState],
  );

  // ── 메인 인식 루프 ──
  const startListeningLoop = useCallback(async () => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      onError?.("마이크 권한이 필요합니다.");
      updateState("error");
      loopActiveRef.current = false;
      return;
    }

    updateState("waiting");

    while (loopActiveRef.current && settingsRef.current.alwaysListening) {
      const currentState = stateRef.current;

      if (currentState === "waiting") {
        // 호출어 대기 모드: 짧게 녹음
        const text = await recordAndTranscribe(WAKE_LISTEN_DURATION_MS);

        if (text && containsWakeWord(text)) {
          // 호출어 감지!
          activatedAtRef.current = Date.now();
          updateState("activated");
          onWakeWord?.();

          // 호출어와 함께 명령이 포함되어 있을 수 있음
          const localResult = parseCommandLocally(text);
          if (localResult) {
            await processCommand(text);
            continue;
          }
        }
      } else if (currentState === "activated") {
        // 명령 대기 모드: 길게 녹음
        const elapsed = Date.now() - activatedAtRef.current;
        if (elapsed > COMMAND_TIMEOUT_MS) {
          // 타임아웃 → 호출어 대기로 복귀
          updateState("waiting");
          continue;
        }

        const text = await recordAndTranscribe(LISTEN_DURATION_MS);
        if (text && text.trim().length > 0) {
          await processCommand(text);
        }
      }

      // 쿨다운
      await new Promise((resolve) => setTimeout(resolve, COOLDOWN_MS));
    }

    loopActiveRef.current = false;
    if (stateRef.current !== "idle") {
      updateState("idle");
    }
  }, [
    onError,
    onWakeWord,
    processCommand,
    recordAndTranscribe,
    requestPermission,
    updateState,
  ]);

  // ── 시작/중지 ──
  const startListening = useCallback(async () => {
    await updateSettings({ alwaysListening: true });
    startListeningLoop();
  }, [startListeningLoop, updateSettings]);

  const stopListening = useCallback(async () => {
    loopActiveRef.current = false;
    await updateSettings({ alwaysListening: false });
    updateState("idle");
  }, [updateSettings, updateState]);

  // ── 설정 변경 감지 → 자동 시작/중지 ──
  useEffect(() => {
    if (settings.alwaysListening && stateRef.current === "idle") {
      startListeningLoop();
    } else if (!settings.alwaysListening && stateRef.current !== "idle") {
      loopActiveRef.current = false;
      updateState("idle");
    }
  }, [settings.alwaysListening, startListeningLoop, updateState]);

  // ── 클린업 ──
  useEffect(() => {
    return () => {
      loopActiveRef.current = false;
    };
  }, []);

  return {
    listeningState,
    settings,
    lastCommand,
    startListening,
    stopListening,
    updateSettings,
    requestPermission,
  };
}
