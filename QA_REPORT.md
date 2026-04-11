# QA 점검 보고서 (2026-04-10)

## 검증 대상
- **AI 피싱 마스터** 모듈
- **비전 AI 안전 운전** 모듈 (TLR, SPaT, LDW, TSR)

## 검증 시나리오

### 1️⃣ UI 라우팅 검증 (버튼 클릭 → 화면 전환 → 뒤로가기)

#### ✅ 정상 동작 라우트
| 출발 화면 | 버튼/액션 | 목적지 화면 | 상태 |
|----------|---------|-----------|------|
| `/` (홈) | 카메라 버튼 | `/camera` | ✅ 정상 |
| `/` (홈) | 설정 탭 | `/settings` | ✅ 정상 |
| `/camera` | 뒤로가기 | `/` | ✅ 정상 (`router.back()`) |
| `/settings-v2` | 음성 및 알림 | `/settings/voice-alerts` | ✅ 정상 |
| `/settings-v2` | 안전 보조 (NEW) | `/settings/safety-assist` | ✅ 정상 |
| `/settings/voice-alerts` | 뒤로가기 | `/settings-v2` | ✅ 정상 |
| `/settings/safety-assist` | 뒤로가기 | `/settings-v2` | ✅ 정상 |

#### ❌ 데드 링크 발견
| 출발 화면 | 버튼/액션 | 목적지 화면 | 문제 |
|----------|---------|-----------|------|
| `/settings-v2` | 신호등 정보 (TLR & SPaT) | `/settings/traffic-signal` | ⚠️ **화면 미구현** |
| `/settings-v2` | 내비게이션 | `/settings/navigation` | ⚠️ **화면 미구현** |
| `/settings-v2` | 화면 및 접근성 | `/settings/display` | ⚠️ **화면 미구현** |
| `/settings-v2` | 앱 정보 | `/settings/about` | ⚠️ **화면 미구현** |

**영향도:** 중간 - 사용자가 클릭 시 404 또는 빈 화면 표시

**권장 조치:**
```bash
# 다음 파일 생성 필요:
app/settings/traffic-signal.tsx
app/settings/navigation.tsx
app/settings/display.tsx
app/settings/about.tsx
```

---

### 2️⃣ 데이터 통합 및 상태 관리 검증

#### ✅ 정상 동작 상태 흐름
| 기능 | 저장 키 | 읽기 화면 | 쓰기 화면 | 동기화 방식 |
|-----|--------|---------|---------|----------|
| 저시력 모드 | `ai-omni-drive:settings` | index.tsx, camera.tsx | settings.tsx, voice-alerts.tsx | AsyncStorage + subscribe |
| AI 안내 활성화 | `ai-omni-drive:settings` | index.tsx | voice-alerts.tsx | AsyncStorage + subscribe |
| LDW 활성화 | `@lane_departure_state` | camera.tsx | safety-assist.tsx | AsyncStorage + subscribe |
| TSR 속도 제한 | `@tsr_state` | camera.tsx | safety-assist.tsx | AsyncStorage + subscribe |
| 전방 알림 거리 | `@advance_notification_config` | camera.tsx, index.tsx | camera.tsx, index.tsx (음성) | AsyncStorage + subscribe |

#### ⚠️ 잠재적 문제
1. **동시 쓰기 경쟁 조건**
   - 여러 화면이 `ai-omni-drive:settings` 키에 동시 접근
   - 락 메커니즘 없음 → 마지막 쓰기 승리 (last-write-wins)
   - 극히 드문 경우 설정 손실 가능

2. **실시간 동기화 제한**
   - subscribe/notify 패턴 사용 중이나 수동 구독 필요
   - 화면 A에서 설정 변경 → 화면 B는 재방문 시에만 반영
   - Redux/Zustand 같은 전역 상태 관리자 없음

3. **초기 로딩 타이밍**
   - AsyncStorage는 비동기 → 첫 렌더링 시 기본값 표시 후 깜빡임
   - `useEffect` + `useState` 패턴으로 완화 중

**권장 조치:**
- 중요도 낮음: 현재 구조로도 대부분의 사용 시나리오 커버
- 선택적 개선: Zustand 도입으로 전역 상태 관리 (향후 고려)

---

### 3️⃣ 외부 브릿지 및 하드웨어 통합 검증

#### ✅ 구현 완료 브릿지
| 브릿지 | 라이브러리 | 사용 위치 | 권한 처리 | 상태 |
|-------|----------|---------|---------|------|
| **카메라** | `expo-camera` | camera.tsx | `useCameraPermissions()` | ✅ 정상 |
| **GPS/속도** | `expo-location` | index.tsx | `requestForegroundPermissionsAsync()` | ✅ 정상 |
| **진동** | `expo-haptics` | voice-alerts.ts | (권한 불필요) | ✅ 정상 |
| **TTS** | `expo-speech` | voice-alerts.ts | (권한 불필요) | ✅ 정상 |
| **음성 인식** | Web Speech API | index.tsx | `navigator.permissions.query()` (웹만) | ⚠️ 플랫폼 제한 |

#### ❌ 구현 누락 브릿지
| 브릿지 | 요구사항 출처 | 현재 상태 | 영향도 |
|-------|------------|---------|-------|
| **Wi-Fi 카메라** | 초기 요구사항 | 🔴 **미구현** | 높음 - 외부 카메라 연동 불가 |
| **모바일 음성 인식** | VOICE_COMMANDS.md | 🔴 **웹 플랫폼만 지원** | 중간 - iOS/Android에서 사용 불가 |

**권한 거부 시나리오 처리:**
```typescript
// ✅ 카메라 권한 거부 처리 (camera.tsx:52-58)
if (!permission?.granted) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>카메라 권한이 필요합니다</Text>
      <Button onPress={requestPermission} title="권한 요청" />
    </View>
  );
}

// ⚠️ GPS 권한 거부 처리 (index.tsx)
// 현재: 에러 로그만 출력, UI 피드백 없음
// 권장: 사용자에게 권한 재요청 UI 표시
```

**권장 조치:**
1. **Wi-Fi 카메라 브릿지 구현** (우선순위: 높음)
   ```typescript
   // lib/wifi-camera-bridge.ts 신규 생성
   // RTSP/HTTP 스트림 연동 또는 SDK 통합
   ```

2. **모바일 음성 인식** (우선순위: 중간)
   ```bash
   # expo-speech-recognition 또는 react-native-voice 검토
   ```

3. **GPS 권한 거부 UI 개선** (우선순위: 낮음)

---

### 4️⃣ 컴포넌트 간 통신 검증

#### ✅ 정상 동작 통신 경로

**경로 1: Vision AI → UI 경고 표시**
```
[camera.tsx] takePictureAsync()
    ↓ base64
[tRPC] trafficSignalRouter.detect()
    ↓ invokeLLM (Vision AI)
[camera.tsx] setTrafficState(result)
    ↓ state update
[camera.tsx] JSX 렌더링 (신호등 아이콘 색상 변경)
    ✅ 정상 동작 확인
```

**경로 2: 설정 변경 → 기능 활성화**
```
[safety-assist.tsx] LDW 토글 ON
    ↓ setLDWEnabled(true)
[lib/lane-departure-warning.ts] state.enabled = true
    ↓ AsyncStorage.setItem
[camera.tsx] subscribe('ldw_update')
    ↓ callback 실행
[camera.tsx] setInterval (2초마다 차선 감지)
    ✅ 정상 동작 확인
```

**경로 3: 음성 명령 → 다중 컴포넌트 반영**
```
[index.tsx] voiceCommand: "차선 경고 켜"
    ↓ handleVoiceCommand
[lib/lane-departure-warning.ts] setLDWEnabled(true)
    ↓ notify('ldw_update')
[camera.tsx] subscriber 콜백
    ↓ UI 업데이트
[lib/voice-alerts.ts] speak("차선 이탈 경고를 켰습니다")
    ✅ 정상 동작 확인
```

#### ⚠️ 개선 가능 영역

1. **subscribe 누락 리스크**
   - 현재: 각 화면이 `useEffect`에서 수동으로 `subscribe()` 호출
   - 문제: 구독 설정 누락 시 상태 업데이트 수신 불가
   - 예시: camera.tsx는 구독 중이지만, 새로 만들 `/settings/traffic-signal.tsx`는 구독 설정 필요
   
   **권장:** 전역 이벤트 버스 도입 또는 React Context API 활용

2. **에러 전파 메커니즘 부재**
   - Vision AI 호출 실패 시 → 로컬 에러 처리만 (try-catch)
   - 다른 컴포넌트에 실패 상태 전파 안 됨
   - 예시: 신호등 인식 실패 → 홈 화면에서 "일시적 오류" 표시 없음
   
   **권장:** 에러 상태도 subscribe/notify 패턴 적용

3. **순환 참조 가능성**
   - 현재: 각 모듈이 독립적으로 notify 호출
   - 잠재적 문제: A → B 업데이트 → B → A 업데이트 → 무한 루프
   - 완화: 현재 코드에서는 발생하지 않음 (단방향 흐름)

---

## 종합 평가

### 🟢 정상 동작 (PASS)
- ✅ 핵심 화면 라우팅 (홈 ↔ 카메라 ↔ 설정)
- ✅ Vision AI 통신 (신호등, 차량, 차선, 표지판 인식)
- ✅ 하드웨어 브릿지 (카메라, GPS, TTS, 진동)
- ✅ 상태 관리 기본 동작 (AsyncStorage + subscribe)
- ✅ 음성 명령 처리 (웹 플랫폼)

### 🟡 부분 문제 (WARN)
- ⚠️ 설정 화면 4개 미구현 (데드 링크)
- ⚠️ 모바일 음성 인식 미지원
- ⚠️ GPS 권한 거부 시 UI 피드백 부재
- ⚠️ 실시간 상태 동기화 제한 (화면 간)

### 🔴 주요 누락 (FAIL)
- 🔴 **Wi-Fi 카메라 브릿지 미구현** (요구사항 대비)

---

## 우선순위별 수정 권장 사항

### P0 (즉시 수정 필요)
1. **데드 링크 제거 또는 화면 구현**
   - 옵션 A: settings-v2.tsx에서 미구현 카테고리 임시 비활성화
   - 옵션 B: 4개 설정 화면 빠르게 스켈레톤 구현

### P1 (다음 스프린트)
2. **Wi-Fi 카메라 브릿지 구현**
   - RTSP 스트림 또는 HTTP MJPEG 지원
   - 외부 카메라 IP/포트 설정 UI

### P2 (향후 개선)
3. **모바일 음성 인식 지원**
   - expo-speech-recognition 또는 네이티브 모듈 검토
4. **전역 상태 관리 개선**
   - Zustand 도입 검토
5. **에러 전파 메커니즘**
   - 중앙 에러 핸들러 + 토스트 알림

---

## 테스트 체크리스트

### 수동 테스트 (사용자 시나리오)
- [x] 홈 → 카메라 → 신호등 인식 → 결과 표시
- [x] 홈 → 설정 → 음성/알림 → 저시력 모드 ON → 홈 반영 확인
- [x] 카메라 → LDW 활성화 → 차선 인식 → 경고 표시
- [x] 카메라 → TSR 활성화 → 표지판 인식 → 속도 제한 표시
- [ ] 설정 → 신호등 정보 클릭 (데드 링크 확인)
- [ ] GPS 권한 거부 → 앱 동작 확인 (UI 피드백 누락)
- [ ] Wi-Fi 카메라 연결 (기능 없음)

### 자동 테스트 (권장)
```typescript
// 추후 Jest + React Native Testing Library 도입 시
describe('라우팅 테스트', () => {
  it('설정 화면 모든 링크 접근 가능', () => {
    // settings-v2.tsx의 모든 Pressable 클릭 테스트
  });
});

describe('상태 관리 테스트', () => {
  it('LDW 설정 변경 시 카메라 화면 반영', () => {
    // setLDWEnabled → camera.tsx state 확인
  });
});
```

---

**보고서 작성일:** 2026-04-10  
**검증 범위:** 라우팅, 상태 관리, 브릿지, 컴포넌트 통신  
**다음 액션:** P0 데드 링크 수정 → P1 Wi-Fi 카메라 구현
