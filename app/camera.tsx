import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

type DetectionRange = "좁게" | "보통" | "넓게";

const RANGE_OPTIONS: Array<{
  key: DetectionRange;
  title: string;
  description: string;
  frameWidth: number;
  frameHeight: number;
}> = [
  {
    key: "좁게",
    title: "좁게",
    description: "신호등 한 개를 크게 인식",
    frameWidth: 112,
    frameHeight: 112,
  },
  {
    key: "보통",
    title: "보통",
    description: "일반 도심 주행 기본값",
    frameWidth: 160,
    frameHeight: 132,
  },
  {
    key: "넓게",
    title: "넓게",
    description: "여러 차선과 표지판까지 함께 확인",
    frameWidth: 214,
    frameHeight: 156,
  },
];

export default function CameraScreen() {
  const [selectedRange, setSelectedRange] = useState<DetectionRange>("보통");

  const currentRange = useMemo(() => {
    return RANGE_OPTIONS.find((option) => option.key === selectedRange) ?? RANGE_OPTIONS[1];
  }, [selectedRange]);

  const handleConfirmRange = () => {
    Alert.alert("카메라 범위 적용", `${currentRange.title} 범위로 인식 영역을 맞췄습니다.`, [
      {
        text: "확인",
      },
    ]);
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          >
            <MaterialIcons name="arrow-back" size={28} color="#11181c" />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>

          <Text style={styles.headerTitle}>카메라</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>AI 인식 대기</Text>
            </View>
            <Text style={styles.previewHint}>전방 신호등 중심으로 맞춰 주세요</Text>
          </View>

          <View style={styles.cameraStage}>
            <View
              style={[
                styles.detectionFrame,
                {
                  width: currentRange.frameWidth,
                  height: currentRange.frameHeight,
                },
              ]}
            >
              <View style={styles.frameCornerTopLeft} />
              <View style={styles.frameCornerTopRight} />
              <View style={styles.frameCornerBottomLeft} />
              <View style={styles.frameCornerBottomRight} />
            </View>

            <View style={styles.cameraCenterChip}>
              <MaterialIcons name="center-focus-strong" size={28} color="#ffffff" />
              <Text style={styles.cameraCenterChipText}>{currentRange.title} 인식 범위</Text>
            </View>
          </View>

          <View style={styles.rangeCard}>
            <Text style={styles.sectionTitle}>인식 범위 조절</Text>
            <Text style={styles.sectionBody}>
              슬라이더 대신 큰 단계 버튼으로 조절할 수 있게 구성했습니다. 주행 중에는 한 번 눌러도 범위가 바로 바뀝니다.
            </Text>

            <View style={styles.rangeButtonRow}>
              {RANGE_OPTIONS.map((option) => {
                const selected = option.key === selectedRange;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => setSelectedRange(option.key)}
                    style={({ pressed }) => [
                      styles.rangeButton,
                      selected && styles.rangeButtonSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={[styles.rangeButtonTitle, selected && styles.rangeButtonTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.rangeButtonDescription,
                        selected && styles.rangeButtonDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>현재 선택</Text>
            <Text style={styles.summaryValue}>{currentRange.title}</Text>
            <Text style={styles.summaryDescription}>{currentRange.description}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleConfirmRange}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.confirmButtonText}>확인</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    minWidth: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  backText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#11181c",
  },
  headerSpacer: {
    width: 88,
  },
  previewCard: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  previewTopRow: {
    gap: 8,
  },
  liveBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  liveBadgeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  previewHint: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4b5563",
  },
  cameraStage: {
    height: 230,
    borderRadius: 26,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  detectionFrame: {
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: 22,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  frameCornerTopLeft: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderTopLeftRadius: 20,
  },
  frameCornerTopRight: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderTopRightRadius: 20,
  },
  frameCornerBottomLeft: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderColor: "#ffffff",
    borderBottomLeftRadius: 20,
  },
  frameCornerBottomRight: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderBottomRightRadius: 20,
  },
  cameraCenterChip: {
    position: "absolute",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraCenterChipText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  rangeCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  sectionBody: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
    color: "#4b5563",
  },
  rangeButtonRow: {
    gap: 10,
  },
  rangeButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  rangeButtonSelected: {
    borderColor: "#111827",
    backgroundColor: "#e5f0ff",
  },
  rangeButtonTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
  },
  rangeButtonTitleSelected: {
    color: "#111827",
  },
  rangeButtonDescription: {
    fontSize: 17,
    fontWeight: "600",
    color: "#6b7280",
  },
  rangeButtonDescriptionSelected: {
    color: "#334155",
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: "#111827",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#cbd5e1",
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
  },
  summaryDescription: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    color: "#d1d5db",
  },
  confirmButton: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  confirmButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
});
