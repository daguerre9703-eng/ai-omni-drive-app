/**
 * 카메라 인식 품질 및 신뢰도 강화 시스템
 */

export type QualityMetrics = {
  brightness: number; // 0-1
  sharpness: number; // 0-1
  stability: number; // 0-1
  overallQuality: number; // 0-1
  qualityLabel: string;
};

export type RecognitionHistory = {
  signalState: "red" | "yellow" | "green" | "unknown";
  confidence: number;
  timestamp: number;
};

export type ConsensusResult = {
  agreed: boolean;
  finalState: "red" | "yellow" | "green" | "unknown";
  consensusConfidence: number;
  reasonIfRejected: string;
};

export type RecognitionStats = {
  totalAttempts: number;
  successfulAttempts: number;
  averageConfidence: number;
  successRate: number;
  lastResetAt: number;
};

const MIN_CONFIDENCE_THRESHOLD = 0.65; // 최소 신뢰도 임계값
const CONSENSUS_WINDOW_SIZE = 3; // 합의를 위한 프레임 수
const CONSENSUS_AGREEMENT_RATIO = 0.67; // 2/3 이상 일치 필요
const MAX_HISTORY_SIZE = 10;

/**
 * 이미지 품질 평가 (간이 버전 - 실제로는 네이티브 분석 필요)
 */
export function evaluateFrameQuality(
  base64Image: string,
  previousFrameHash?: string,
): QualityMetrics {
  // 실제 구현에서는 네이티브 이미지 분석을 사용해야 하지만,
  // 여기서는 간단한 휴리스틱 사용
  const imageLength = base64Image.length;

  // 이미지 크기로 압축 품질 추정
  const brightness = imageLength > 50000 ? 0.8 : imageLength > 30000 ? 0.6 : 0.4;

  // 선명도는 이미지 크기와 엔트로피로 추정 (간이)
  const sharpness = imageLength > 45000 ? 0.85 : 0.7;

  // 안정성은 이전 프레임과 비교 (해시 기반 간이 비교)
  let stability = 0.75;
  if (previousFrameHash) {
    const currentHash = hashString(base64Image.slice(0, 1000));
    const similarity = 1 - Math.abs(currentHash - Number(previousFrameHash)) / 1000;
    stability = Math.max(0.3, Math.min(0.95, similarity));
  }

  const overallQuality = (brightness * 0.3 + sharpness * 0.4 + stability * 0.3);

  let qualityLabel = "낮음";
  if (overallQuality >= 0.8) qualityLabel = "우수";
  else if (overallQuality >= 0.65) qualityLabel = "양호";
  else if (overallQuality >= 0.5) qualityLabel = "보통";

  return {
    brightness,
    sharpness,
    stability,
    overallQuality,
    qualityLabel,
  };
}

/**
 * 간단한 문자열 해시 함수
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * 신뢰도 기반 결과 검증
 */
export function validateRecognitionConfidence(
  signalState: "red" | "yellow" | "green" | "unknown",
  confidence: number,
): { valid: boolean; reason: string } {
  if (signalState === "unknown") {
    return {
      valid: false,
      reason: "신호등이 인식되지 않았습니다",
    };
  }

  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return {
      valid: false,
      reason: `신뢰도 ${Math.round(confidence * 100)}%로 임계값 ${Math.round(MIN_CONFIDENCE_THRESHOLD * 100)}% 미만입니다`,
    };
  }

  return {
    valid: true,
    reason: "인식 성공",
  };
}

/**
 * 다중 프레임 합의 알고리즘
 */
export function calculateConsensus(
  history: RecognitionHistory[],
): ConsensusResult {
  if (history.length < CONSENSUS_WINDOW_SIZE) {
    return {
      agreed: false,
      finalState: "unknown",
      consensusConfidence: 0,
      reasonIfRejected: `합의를 위해 ${CONSENSUS_WINDOW_SIZE}개 프레임이 필요합니다 (현재 ${history.length}개)`,
    };
  }

  // 최근 N개 프레임 가져오기
  const recentFrames = history.slice(-CONSENSUS_WINDOW_SIZE);

  // 각 신호 상태별 빈도 계산
  const stateCounts = new Map<string, number>();
  const stateConfidences = new Map<string, number[]>();

  for (const frame of recentFrames) {
    const count = stateCounts.get(frame.signalState) || 0;
    stateCounts.set(frame.signalState, count + 1);

    const confidences = stateConfidences.get(frame.signalState) || [];
    confidences.push(frame.confidence);
    stateConfidences.set(frame.signalState, confidences);
  }

  // 가장 많이 나온 상태 찾기
  let maxCount = 0;
  let dominantState: "red" | "yellow" | "green" | "unknown" = "unknown";

  for (const [state, count] of stateCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantState = state as "red" | "yellow" | "green" | "unknown";
    }
  }

  // 합의 비율 계산
  const agreementRatio = maxCount / CONSENSUS_WINDOW_SIZE;

  if (agreementRatio < CONSENSUS_AGREEMENT_RATIO) {
    return {
      agreed: false,
      finalState: dominantState,
      consensusConfidence: 0,
      reasonIfRejected: `${CONSENSUS_WINDOW_SIZE}개 프레임 중 ${maxCount}개만 일치 (${Math.round(agreementRatio * 100)}%, 필요: ${Math.round(CONSENSUS_AGREEMENT_RATIO * 100)}%)`,
    };
  }

  // 합의된 상태의 평균 신뢰도 계산
  const confidences = stateConfidences.get(dominantState) || [0];
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

  return {
    agreed: true,
    finalState: dominantState,
    consensusConfidence: avgConfidence,
    reasonIfRejected: "",
  };
}

/**
 * 결과 안정성 검증 (이전 결과와 비교)
 */
export function checkResultStability(
  currentState: "red" | "yellow" | "green" | "unknown",
  previousState: "red" | "yellow" | "green" | "unknown" | null,
  currentConfidence: number,
): { stable: boolean; warning: string } {
  if (!previousState || previousState === "unknown") {
    return {
      stable: true,
      warning: "",
    };
  }

  // 빨간불에서 파란불로 또는 파란불에서 빨간불로 급격히 변경되는 경우 경고
  if (
    (previousState === "red" && currentState === "green") ||
    (previousState === "green" && currentState === "red")
  ) {
    if (currentConfidence < 0.85) {
      return {
        stable: false,
        warning: `급격한 신호 변화 감지 (${previousState} → ${currentState}), 신뢰도 ${Math.round(currentConfidence * 100)}%로 재확인 필요`,
      };
    }
  }

  return {
    stable: true,
    warning: "",
  };
}

/**
 * 인식 통계 관리
 */
export class RecognitionStatsTracker {
  private stats: RecognitionStats;

  constructor() {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      averageConfidence: 0,
      successRate: 0,
      lastResetAt: Date.now(),
    };
  }

  recordAttempt(success: boolean, confidence?: number) {
    this.stats.totalAttempts++;

    if (success) {
      this.stats.successfulAttempts++;

      if (confidence !== undefined) {
        // 이동 평균으로 평균 신뢰도 업데이트
        const currentAvg = this.stats.averageConfidence;
        const newAvg = (currentAvg * (this.stats.successfulAttempts - 1) + confidence) / this.stats.successfulAttempts;
        this.stats.averageConfidence = newAvg;
      }
    }

    this.stats.successRate = this.stats.successfulAttempts / this.stats.totalAttempts;
  }

  getStats(): RecognitionStats {
    return { ...this.stats };
  }

  reset() {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      averageConfidence: 0,
      successRate: 0,
      lastResetAt: Date.now(),
    };
  }

  getStatsLabel(): string {
    if (this.stats.totalAttempts === 0) {
      return "통계 없음";
    }

    return `성공률 ${Math.round(this.stats.successRate * 100)}% (${this.stats.successfulAttempts}/${this.stats.totalAttempts}) · 평균 신뢰도 ${Math.round(this.stats.averageConfidence * 100)}%`;
  }
}

/**
 * 히스토리 관리 헬퍼
 */
export function addToHistory(
  history: RecognitionHistory[],
  newEntry: RecognitionHistory,
): RecognitionHistory[] {
  const updated = [...history, newEntry];

  // 최대 크기 유지
  if (updated.length > MAX_HISTORY_SIZE) {
    return updated.slice(-MAX_HISTORY_SIZE);
  }

  return updated;
}

/**
 * 재시도 권장 여부 판단
 */
export function shouldRetry(
  confidence: number,
  quality: QualityMetrics,
  attemptCount: number,
): { shouldRetry: boolean; reason: string } {
  const maxRetries = 3;

  if (attemptCount >= maxRetries) {
    return {
      shouldRetry: false,
      reason: `최대 재시도 횟수(${maxRetries}회) 도달`,
    };
  }

  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return {
      shouldRetry: true,
      reason: `신뢰도 ${Math.round(confidence * 100)}%로 낮음`,
    };
  }

  if (quality.overallQuality < 0.5) {
    return {
      shouldRetry: true,
      reason: `프레임 품질 ${quality.qualityLabel}`,
    };
  }

  return {
    shouldRetry: false,
    reason: "인식 품질 양호",
  };
}
