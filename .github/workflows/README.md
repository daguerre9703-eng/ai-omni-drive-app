# GitHub Actions 자동 빌드

## 🚀 설정 완료!

이 설정으로 GitHub에 푸시하면 자동으로 APK가 빌드됩니다!

---

## ⚙️ 필요한 설정 (1회만)

### Expo 토큰 설정:

1. **Expo 웹사이트 접속**: https://expo.dev/signup
   - 이메일: daguerre9703@gmail.com
   - 비밀번호: 1234
   - 가입 버튼 클릭

2. **액세스 토큰 생성**: https://expo.dev/accounts/[username]/settings/access-tokens
   - "Create Token" 클릭
   - 이름: "GitHub Actions"
   - 토큰 복사 (한 번만 표시됨!)

3. **GitHub Secret 등록**: https://github.com/daguerre9703-eng/ai-omni-drive-app/settings/secrets/actions
   - "New repository secret" 클릭
   - Name: `EXPO_TOKEN`
   - Value: 위에서 복사한 토큰 붙여넣기
   - "Add secret" 클릭

---

## 📱 사용 방법

### 자동 빌드:
코드를 GitHub에 푸시하면 자동으로 빌드 시작!

```bash
git push origin main
```

### 수동 빌드:
1. GitHub 저장소 페이지: https://github.com/daguerre9703-eng/ai-omni-drive-app
2. "Actions" 탭 클릭
3. "Build Android APK" 클릭
4. "Run workflow" 버튼 클릭
5. "Run workflow" 확인

---

## 📧 다운로드

빌드 완료 후 (15-20분):
- ✅ **이메일**로 다운로드 링크 전송 (daguerre9703@gmail.com)
- ✅ **Expo 대시보드**에서 직접 다운로드: https://expo.dev

---

## 🔗 빠른 링크

- Expo 가입: https://expo.dev/signup
- 토큰 생성: https://expo.dev/accounts/daguerre9703/settings/access-tokens
- GitHub Secrets: https://github.com/daguerre9703-eng/ai-omni-drive-app/settings/secrets/actions
- Actions 실행: https://github.com/daguerre9703-eng/ai-omni-drive-app/actions

---

**한 번만 설정하면 이후로는 자동입니다!**
