#!/bin/bash

echo "======================================"
echo "  AI Omni-Drive APK 자동 빌드"
echo "======================================"
echo ""
echo "큰 글씨 모드로 진행 상황을 표시합니다"
echo ""

# 1단계: EAS CLI 설치 확인
echo "📦 1단계: EAS CLI 확인 중..."
if ! command -v eas &> /dev/null
then
    echo "   ⚠️  EAS CLI 설치가 필요합니다"
    echo "   🔧 설치 중... (30초 소요)"
    pnpm install -g eas-cli
    echo "   ✅ 설치 완료!"
else
    echo "   ✅ EAS CLI 이미 설치됨"
fi
echo ""

# 2단계: Expo 로그인 확인
echo "🔐 2단계: Expo 계정 확인 중..."
if ! eas whoami &> /dev/null
then
    echo "   ⚠️  로그인이 필요합니다"
    echo "   📧 이메일과 비밀번호를 입력하세요:"
    eas login
    echo "   ✅ 로그인 완료!"
else
    echo "   ✅ 이미 로그인됨: $(eas whoami)"
fi
echo ""

# 3단계: APK 빌드 시작
echo "🚀 3단계: APK 빌드 시작"
echo "   ⏱️  예상 시간: 15-20분"
echo "   📧 완료 시 이메일로 링크 전송"
echo ""
echo "빌드 시작..."
echo ""

eas build --platform android --profile production

# 4단계: 완료
echo ""
echo "======================================"
echo "  ✅ 빌드 완료!"
echo "======================================"
echo ""
echo "📧 이메일을 확인하세요"
echo "📱 다운로드 링크를 클릭하면 APK 설치 가능"
echo ""
echo "또는 아래 명령어로 QR 코드 생성:"
echo "   pnpm qr"
echo ""
