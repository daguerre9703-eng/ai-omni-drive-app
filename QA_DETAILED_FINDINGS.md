# QA 상세 발견 사항 (코드 레퍼런스 포함)

## 1. 라우팅 데드 링크 (P0)

### 확인된 파일 구조
```
app/
├── settings-v2.tsx (메인 설정 화면)
├── settings/
│   ├── voice-alerts.tsx ✅
│   ├── safety-assist.tsx ✅
│   ├── traffic-signal.tsx ❌ 없음
│   ├── navigation.tsx ❌ 없음
│   ├── display.tsx ❌ 없음
│   └── about.tsx ❌ 없음
```

### settings-v2.tsx:36-80 문제 코드
```typescript
const SETTINGS_CATEGORIES: SettingsCategory[] = [
  // ✅ 정상 동작
  {
    id: "voice_alerts",
    route: "/settings/voice-alerts",  // 파일 존재
  },
  
  // ❌ 데드 링크 #1
  {
    id: "traffic_signal",
    route: "/settings/traffic-signal",  // 파일 없음!
  },
  
  // ✅ 정상 동작
  {
    id: "safety_assist",
    route: "/settings/safety-assist",  // 파일 존재
  },
  
  // ❌ 데드 링크 #2
  {
    id: "navigation",
    route: "/settings/navigation",  // 파일 없음!
  },
  
  // ❌ 데드 링크 #3
  {
    id: "display_accessibility",
    route: "/settings/display",  // 파일 없음!
  },
  
  // ❌ 데드 링크 #4
  {
    id: "about",
    route: "/settings/about",  // 파일 없음!
  },
];
```

### 수정 방안

**옵션 A: 빠른 수정 (임시 비활성화)**
```typescript
// settings-v2.tsx
const SETTINGS_CATEGORIES: SettingsCategory[] = [
  // ... 기존 코드 ...
].filter(cat => 
  ['voice_alerts', 'safety_assist'].includes(cat.id) || 
  cat.route?.startsWith('/settings/voice-alerts') ||
  cat.route?.startsWith('/settings/safety-assist')
);
```

**옵션 B: 완전 수정 (화면 구현)**
```bash
# 다음 4개 파일 생성 필요
touch app/settings/traffic-signal.tsx
touch app/settings/navigation.tsx
touch app/settings/display.tsx
touch app/settings/about.tsx
```

---

## 2. GPS 권한 거부 시 UI 피드백 부재 (P1)

### app/(tabs)/index.tsx:596-604 문제 코드
```typescript
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== "granted") {
  return;  // ⚠️ 아무 피드백 없이 조용히 종료
}
```

### 영향
- 사용자가 GPS 권한 거부 → 속도 표시 작동 안 함
- 에러 메시지 없음 → 사용자는 앱이 망가진 줄 착각 가능

### 수정 방안
```typescript
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== "granted") {
  // ✅ 토스트 알림 또는 Alert 표시
  Alert.alert(
    "위치 권한 필요",
    "현재 속도를 표시하려면 위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
    [
      { text: "취소", style: "cancel" },
      { text: "설정 열기", onPress: () => Linking.openSettings() },
    ]
  );
  return;
}
```

---

## 3. 음성 인식 플랫폼 제한 (P2)

### lib/voice-commands.ts:309-312
```typescript
export function startVoiceRecognition(...) {
  if (Platform.OS !== "web") {
    console.warn("Voice recognition is only supported on web platform");
    return null;  // ⚠️ iOS/Android에서는 작동 안 함
  }
  
  // @ts-ignore - Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  // ...
}
```

### 영향
- VOICE_COMMANDS.md의 모든 기능이 웹 플랫폼에서만 작동
- 모바일 앱에서는 음성 명령 버튼 자체가 비활성화 필요

### 수정 방안
```bash
# 네이티브 음성 인식 라이브러리 도입
expo install expo-speech-recognition
# 또는
npm install @react-native-voice/voice
```

```typescript
// lib/voice-commands.ts
import Voice from '@react-native-voice/voice';

export function startVoiceRecognition(...) {
  if (Platform.OS === "web") {
    // Web Speech API 사용
  } else {
    // 네이티브 Voice API 사용
    Voice.start('ko-KR');
  }
}
```

---

## 4. 카메라 권한 처리 (현재 정상)

### app/camera.tsx:52-61 ✅
```typescript
if (!permission?.granted) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>카메라 권한이 필요합니다</Text>
      <Text style={styles.submessage}>
        신호등 인식 및 차선 감지를 위해 카메라 접근이 필요합니다.
      </Text>
      <Button onPress={requestPermission} title="권한 요청" />
    </View>
  );
}
```

**평가:** ✅ 권한 거부 시 명확한 UI + 재요청 버튼 제공 (모범 사례)

---

## 5. Wi-Fi 카메라 브릿지 미구현 (P1)

### 현재 상태
```bash
$ find . -name "*wifi*" -o -name "*camera-bridge*"
# 결과: 없음
```

### camera.tsx:68-91 현재 구현
```typescript
// ⚠️ 로컬 카메라만 지원
const cameraRef = useRef<CameraView>(null);

const handleCapture = async () => {
  if (!cameraRef.current) return;
  
  const photo = await cameraRef.current.takePictureAsync({
    base64: true,
    quality: 0.8,
  });
  
  // Vision AI 전송
  // ...
};
```

### 필요한 구현
```typescript
// lib/wifi-camera-bridge.ts (신규 파일)

export type CameraSource = 'local' | 'wifi';

export interface WifiCameraConfig {
  ip: string;
  port: number;
  protocol: 'rtsp' | 'http' | 'mjpeg';
  username?: string;
  password?: string;
}

export async function captureFromWifiCamera(
  config: WifiCameraConfig
): Promise<{ base64: string }> {
  // RTSP 스트림 또는 HTTP MJPEG 캡처
  // 구현 필요: react-native-rtsp 또는 custom fetch
}

export async function streamWifiCamera(
  config: WifiCameraConfig,
  onFrame: (base64: string) => void
): Promise<() => void> {
  // 실시간 스트림 구독
}
```

### camera.tsx 통합 필요
```typescript
const [cameraSource, setCameraSource] = useState<CameraSource>('local');
const [wifiConfig, setWifiConfig] = useState<WifiCameraConfig | null>(null);

const handleCapture = async () => {
  let photo;
  
  if (cameraSource === 'local') {
    photo = await cameraRef.current.takePictureAsync({ base64: true });
  } else {
    photo = await captureFromWifiCamera(wifiConfig!);
  }
  
  // Vision AI 전송
  // ...
};
```

---

## 6. 상태 관리 동시 쓰기 경쟁 조건 (P2)

### 문제 시나리오
```typescript
// 화면 A: settings/voice-alerts.tsx:85
await AsyncStorage.setItem(
  "ai-omni-drive:settings",
  JSON.stringify({ ...currentSettings, aiGuideEnabled: true })
);

// 동시에 화면 B: settings-v2.tsx:110
await AsyncStorage.setItem(
  "ai-omni-drive:settings",
  JSON.stringify({ ...currentSettings, lowVisionModeEnabled: true })
);

// ⚠️ 두 쓰기 중 하나가 덮어써짐 (last-write-wins)
```

### 영향도
- 실제 발생 확률: 매우 낮음 (사용자가 두 화면을 동시에 조작하기 어려움)
- 발생 시 피해: 하나의 설정 변경이 손실됨

### 수정 방안 (선택적)

**옵션 1: 락 메커니즘**
```typescript
// lib/settings-lock.ts
let isWriting = false;
const writeQueue: Array<() => Promise<void>> = [];

export async function atomicWrite(key: string, value: any) {
  if (isWriting) {
    // 큐에 대기
    return new Promise(resolve => {
      writeQueue.push(async () => {
        await AsyncStorage.setItem(key, JSON.stringify(value));
        resolve();
      });
    });
  }
  
  isWriting = true;
  await AsyncStorage.setItem(key, JSON.stringify(value));
  isWriting = false;
  
  // 큐 처리
  if (writeQueue.length > 0) {
    const next = writeQueue.shift()!;
    await next();
  }
}
```

**옵션 2: Zustand (전역 상태 관리자)**
```typescript
// lib/settings-store.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      lowVisionModeEnabled: false,
      aiGuideEnabled: true,
      
      setLowVisionMode: (enabled: boolean) =>
        set({ lowVisionModeEnabled: enabled }),
      
      setAIGuide: (enabled: boolean) =>
        set({ aiGuideEnabled: enabled }),
    }),
    {
      name: 'ai-omni-drive:settings',
      getStorage: () => AsyncStorage,
    }
  )
);
```

---

## 7. Subscribe/Notify 패턴 검증

### 구현 확인

**lib/lane-departure-warning.ts:19-38**
```typescript
const listeners: Set<(state: LDWState) => void> = new Set();

export function subscribe(listener: (state: LDWState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener(state));
}
```

**camera.tsx:110-115**
```typescript
useEffect(() => {
  const unsubscribe = subscribeLDW((newState) => {
    setLdwState(newState);
  });
  return unsubscribe;
}, []);
```

**평가:** ✅ 정상 동작
- 화면이 마운트되면 구독 시작
- 언마운트 시 구독 해제 (메모리 누수 방지)
- 상태 변경 시 즉시 UI 업데이트

---

## 8. Vision AI 통신 검증

### 데이터 흐름

**1단계: 이미지 캡처 (camera.tsx:165-175)**
```typescript
const photo = await cameraRef.current.takePictureAsync({
  base64: true,
  quality: 0.8,
});
```

**2단계: tRPC 호출 (camera.tsx:177-179)**
```typescript
const result = await trpc.laneDetection.detect.mutate({
  base64Image: photo.base64!,
});
```

**3단계: Vision AI 처리 (server/lane-detection.ts:19-110)**
```typescript
const response = await invokeLLM({
  messages: [
    {
      role: "system",
      content: "당신은 운전 보조 비전 모델입니다...",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "이 도로 주행 이미지를 분석..." },
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
    json_schema: { /* ... */ },
  },
});
```

**4단계: 상태 업데이트 (camera.tsx:181-183)**
```typescript
updateLaneDetection(
  result.lanePosition as any,
  // ...
);
```

**5단계: Subscribe 알림 (lib/lane-departure-warning.ts:116-142)**
```typescript
export function updateLaneDetection(...) {
  // 상태 업데이트
  state.lanePosition = lanePosition;
  // ...
  
  // 모든 구독자에게 알림
  notify();
}
```

**6단계: UI 렌더링 (camera.tsx:296-315)**
```typescript
{ldwState.enabled && (
  <View style={styles.ldwSection}>
    <Text style={styles.ldwTitle}>
      차선 위치: {lanePositionText[ldwState.lanePosition]}
    </Text>
    {ldwState.warning !== "safe" && (
      <Text style={styles.warningText}>
        ⚠️ {warningMessages[ldwState.warning]}
      </Text>
    )}
  </View>
)}
```

**평가:** ✅ 전체 파이프라인 정상 동작
- 이미지 → Vision AI → 상태 → UI 흐름 완벽
- 에러 처리: try-catch로 실패 시 로그 출력

---

## 9. 종합 평가 매트릭스

| 검증 항목 | 상태 | 심각도 | 비고 |
|---------|------|--------|------|
| 홈 ↔ 카메라 라우팅 | ✅ PASS | - | - |
| 홈 ↔ 설정 라우팅 | ✅ PASS | - | - |
| 설정 → 음성/알림 | ✅ PASS | - | - |
| 설정 → 안전 보조 | ✅ PASS | - | - |
| **설정 → 신호등/내비/화면/정보** | ❌ FAIL | P0 | 데드 링크 4개 |
| Vision AI 통신 | ✅ PASS | - | - |
| 카메라 권한 처리 | ✅ PASS | - | UI 피드백 완벽 |
| **GPS 권한 처리** | ⚠️ WARN | P1 | UI 피드백 없음 |
| AsyncStorage 상태 관리 | ✅ PASS | - | 경쟁 조건은 극히 드뭄 |
| Subscribe/Notify 패턴 | ✅ PASS | - | - |
| **음성 인식 (웹)** | ✅ PASS | - | 웹만 지원 |
| **음성 인식 (모바일)** | ❌ FAIL | P2 | 미구현 |
| **Wi-Fi 카메라 브릿지** | ❌ FAIL | P1 | 미구현 |
| TTS/진동 브릿지 | ✅ PASS | - | - |

---

## 10. 액션 아이템 (우선순위 순)

### P0 (즉시 수정)
- [ ] **데드 링크 4개 수정**
  - 옵션 A: settings-v2.tsx에서 미구현 카테고리 주석 처리
  - 옵션 B: 4개 화면 스켈레톤 구현 (각 10줄 정도)

### P1 (다음 스프린트)
- [ ] **GPS 권한 거부 시 Alert 표시**
  - 파일: `app/(tabs)/index.tsx:602`
  - 예상 작업 시간: 10분
  
- [ ] **Wi-Fi 카메라 브릿지 구현**
  - 신규 파일: `lib/wifi-camera-bridge.ts`
  - camera.tsx 통합
  - 예상 작업 시간: 4시간

### P2 (향후 개선)
- [ ] **모바일 음성 인식 지원**
  - 라이브러리: expo-speech-recognition 또는 @react-native-voice/voice
  - lib/voice-commands.ts 리팩토링
  - 예상 작업 시간: 2시간
  
- [ ] **Zustand 도입 (선택적)**
  - 전역 상태 관리 개선
  - 동시 쓰기 경쟁 조건 해결
  - 예상 작업 시간: 3시간

---

**최종 점검일:** 2026-04-10  
**검증자:** Claude Sonnet 4.5  
**다음 리뷰 권장일:** P0 수정 완료 후
