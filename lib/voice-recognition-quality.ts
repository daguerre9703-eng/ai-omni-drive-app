/**
 * 음성 인식 품질 향상 시스템
 *
 * 기능:
 * - 음성 입력 전처리 및 노이즈 제거
 * - 신뢰도 기반 재시도
 * - 다중 인식 결과 합의 알고리즘
 * - 컨텍스트 기반 명령어 보정
 */

export type VoiceRecognitionAttempt = {
  transcript: string;
  confidence: number;
  timestamp: number;
};

export type RecognitionQualityMetrics = {
  averageConfidence: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
};

const MIN_VOICE_CONFIDENCE = 0.7; // 최소 신뢰도 임계값
const MAX_RETRY_ATTEMPTS = 3; // 최대 재시도 횟수
const CONSENSUS_WINDOW = 2; // 합의를 위한 시도 횟수

/**
 * 음성 텍스트 정규화 (오타 및 노이즈 제거)
 */
export function normalizeVoiceText(text: string): string {
  let normalized = text.trim().toLowerCase();

  // 일반적인 음성 인식 오류 패턴 수정
  const corrections: Record<string, string> = {
    // 숫자 관련
    "일미터": "1미터",
    "이미터": "2미터",
    "삼미터": "3미터",
    "십미터": "10미터",
    "백미터": "100미터",

    // 신호등 관련
    "시호등": "신호등",
    "신호 등": "신호등",
    "신 호등": "신호등",
    "빨강불": "빨간불",
    "빨강 불": "빨간불",
    "파랑불": "파란불",
    "파랑 불": "파란불",
    "노랑불": "노란불",
    "노랑 불": "노란불",
    "초록불": "파란불",

    // 음악 관련
    "유튜브뮤직": "유튜브 뮤직",
    "유투브": "유튜브",
    "음악재생": "음악 재생",
    "음악정지": "음악 정지",
    "다음곡": "다음 곡",
    "이전곡": "이전 곡",

    // 일반 명령어
    "켜줘": "켜",
    "꺼줘": "꺼",
    "해줘": "해",
    "알려줘": "알려",
  };

  // 패턴 치환
  for (const [wrong, correct] of Object.entries(corrections)) {
    normalized = normalized.replace(new RegExp(wrong, "g"), correct);
  }

  // 연속 공백 제거
  normalized = normalized.replace(/\s+/g, " ");

  return normalized;
}

/**
 * 신뢰도 검증
 */
export function validateVoiceConfidence(
  transcript: string,
  confidence: number,
): { valid: boolean; reason: string } {
  if (!transcript || transcript.trim().length === 0) {
    return {
      valid: false,
      reason: "음성이 인식되지 않았습니다",
    };
  }

  if (transcript.length < 2) {
    return {
      valid: false,
      reason: "인식된 음성이 너무 짧습니다",
    };
  }

  if (confidence < MIN_VOICE_CONFIDENCE) {
    return {
      valid: false,
      reason: `신뢰도 ${Math.round(confidence * 100)}%로 낮습니다 (최소 ${Math.round(MIN_VOICE_CONFIDENCE * 100)}% 필요)`,
    };
  }

  return {
    valid: true,
    reason: "인식 성공",
  };
}

/**
 * 다중 시도 합의 알고리즘
 */
export function calculateVoiceConsensus(
  attempts: VoiceRecognitionAttempt[],
): { agreed: boolean; finalTranscript: string; confidence: number; reason: string } {
  if (attempts.length === 0) {
    return {
      agreed: false,
      finalTranscript: "",
      confidence: 0,
      reason: "인식 시도가 없습니다",
    };
  }

  if (attempts.length === 1) {
    const attempt = attempts[0];
    return {
      agreed: attempt.confidence >= MIN_VOICE_CONFIDENCE,
      finalTranscript: attempt.transcript,
      confidence: attempt.confidence,
      reason: attempt.confidence >= MIN_VOICE_CONFIDENCE ? "단일 인식 성공" : "신뢰도 부족",
    };
  }

  // 유사도 기반 클러스터링
  const normalized = attempts.map(a => ({
    ...a,
    normalized: normalizeVoiceText(a.transcript),
  }));

  // 가장 많이 나온 텍스트 찾기
  const textCounts = new Map<string, number>();
  const textConfidences = new Map<string, number[]>();

  for (const item of normalized) {
    const count = textCounts.get(item.normalized) || 0;
    textCounts.set(item.normalized, count + 1);

    const confidences = textConfidences.get(item.normalized) || [];
    confidences.push(item.confidence);
    textConfidences.set(item.normalized, confidences);
  }

  let maxCount = 0;
  let dominantText = "";

  for (const [text, count] of textCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantText = text;
    }
  }

  // 합의 비율 계산
  const agreementRatio = maxCount / attempts.length;

  if (agreementRatio < 0.5) {
    return {
      agreed: false,
      finalTranscript: dominantText,
      confidence: 0,
      reason: `${attempts.length}회 시도 중 ${maxCount}회만 일치 (일관성 부족)`,
    };
  }

  // 평균 신뢰도 계산
  const confidences = textConfidences.get(dominantText) || [0];
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

  return {
    agreed: true,
    finalTranscript: dominantText,
    confidence: avgConfidence,
    reason: `${maxCount}/${attempts.length} 시도 일치, 평균 신뢰도 ${Math.round(avgConfidence * 100)}%`,
  };
}

/**
 * 재시도 필요 여부 판단
 */
export function shouldRetryVoiceRecognition(
  attempt: VoiceRecognitionAttempt | null,
  attemptCount: number,
): { shouldRetry: boolean; reason: string } {
  if (attemptCount >= MAX_RETRY_ATTEMPTS) {
    return {
      shouldRetry: false,
      reason: `최대 재시도 횟수(${MAX_RETRY_ATTEMPTS}회) 도달`,
    };
  }

  if (!attempt) {
    return {
      shouldRetry: true,
      reason: "음성이 인식되지 않았습니다",
    };
  }

  const validation = validateVoiceConfidence(attempt.transcript, attempt.confidence);

  if (!validation.valid) {
    return {
      shouldRetry: true,
      reason: validation.reason,
    };
  }

  return {
    shouldRetry: false,
    reason: "인식 성공",
  };
}

/**
 * 컨텍스트 기반 명령어 보정
 */
export function enhanceVoiceCommandWithContext(
  transcript: string,
  currentContext: {
    isNavigating?: boolean;
    isMusicPlaying?: boolean;
    currentSignalState?: "red" | "yellow" | "green" | "unknown";
  },
): string {
  let enhanced = normalizeVoiceText(transcript);

  // 컨텍스트 기반 명령어 예측 및 보정

  // 신호등 관련 컨텍스트
  if (currentContext.currentSignalState) {
    // "지금"이나 "현재" 단어가 있으면 신호등 상태 쿼리로 해석
    if (/(지금|현재)/.test(enhanced) && !/(음악|노래)/.test(enhanced)) {
      if (!/(신호|불|미터|거리)/.test(enhanced)) {
        enhanced = enhanced + " 신호등 상태";
      }
    }
  }

  // 음악 재생 컨텍스트
  if (currentContext.isMusicPlaying) {
    // "다음", "이전" 단독으로 나오면 곡 전환으로 해석
    if (/^(다음|이전)$/.test(enhanced)) {
      enhanced = enhanced + " 곡";
    }

    // "멈춰", "정지" 단독으로 나오면 음악 정지로 해석
    if (/^(멈춰|정지|중지|일시정지)$/.test(enhanced)) {
      enhanced = "음악 " + enhanced;
    }
  } else {
    // 음악이 재생 중이 아닐 때 "재생", "틀어" 단독으로 나오면 음악 재생으로 해석
    if (/^(재생|틀어|시작)$/.test(enhanced)) {
      enhanced = "음악 " + enhanced;
    }
  }

  // 내비게이션 컨텍스트
  if (currentContext.isNavigating) {
    // "몇 미터", "얼마나" 단독으로 나오면 신호등 거리로 해석
    if (/^(몇\s*미터|얼마나)/.test(enhanced)) {
      if (!/(신호|거리)/.test(enhanced)) {
        enhanced = "신호등 " + enhanced;
      }
    }
  }

  return enhanced;
}

/**
 * 음성 인식 통계 추적
 */
export class VoiceRecognitionStatsTracker {
  private metrics: RecognitionQualityMetrics;

  constructor() {
    this.metrics = {
      averageConfidence: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 0,
    };
  }

  recordAttempt(success: boolean, confidence?: number) {
    this.metrics.totalAttempts++;

    if (success) {
      this.metrics.successfulAttempts++;

      if (confidence !== undefined) {
        const currentAvg = this.metrics.averageConfidence;
        const newAvg = (currentAvg * (this.metrics.successfulAttempts - 1) + confidence) / this.metrics.successfulAttempts;
        this.metrics.averageConfidence = newAvg;
      }
    } else {
      this.metrics.failedAttempts++;
    }

    this.metrics.successRate = this.metrics.successfulAttempts / this.metrics.totalAttempts;
  }

  getMetrics(): RecognitionQualityMetrics {
    return { ...this.metrics };
  }

  getStatsLabel(): string {
    if (this.metrics.totalAttempts === 0) {
      return "음성 인식 통계 없음";
    }

    return `성공률 ${Math.round(this.metrics.successRate * 100)}% (${this.metrics.successfulAttempts}/${this.metrics.totalAttempts}) · 평균 신뢰도 ${Math.round(this.metrics.averageConfidence * 100)}%`;
  }

  reset() {
    this.metrics = {
      averageConfidence: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 0,
    };
  }
}

/**
 * 음성 입력 유사도 계산 (Levenshtein Distance)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  return 1 - matrix[len1][len2] / maxLen;
}
