import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getTrafficSignalDetection,
  loadTrafficSignalDetection,
  subscribeTrafficSignalDetection,
  type TrafficSignalState,
} from "@/lib/traffic-signal-store";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type SignalState = "red" | "yellow" | "green";
type DirectionState = "left" | "straight" | "right" | "uturn";

const SIGNAL_META: Record<SignalState, { title: string; cardBackground: string }> = {
  red: { title: "STOP", cardBackground: "#EF4444" },
  yellow: { title: "SLOW", cardBackground: "#FCD34D" },
  green: { title: "GO", cardBackground: "#10B981" },
};

const DIRECTION_META: Record<DirectionState, { symbol: string }> = {
  left: { symbol: "←" },
  straight: { symbol: "↑" },
  right: { symbol: "→" },
  uturn: { symbol: "↶" },
};

export default function HomeScreen() {
  const [signalState, setSignalState] = useState<SignalState>('yellow');
  const [direction, setDirection] = useState<DirectionState>('straight');
  const [distance, setDistance] = useState('120m');
  const [speed, setSpeed] = useState('0 km/h');

  const arrowPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(arrowPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [arrowPulseAnim]);

  const currentSignal = SIGNAL_META[signalState];
  const currentDirection = DIRECTION_META[direction];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* 신호등 카드 */}
        <View style={styles.signalSection}>
          <View style={[styles.signalCard, { backgroundColor: currentSignal.cardBackground }]}>
            <Text style={styles.signalTitle}>{currentSignal.title}</Text>
            <Text style={styles.signalSubtitle}>신호 인식 분석 중</Text>
            <View style={styles.timeChip}>
              <Text style={styles.timeChipLabel}>도착 예상</Text>
              <Text style={styles.timeChipValue}>21초</Text>
            </View>
          </View>
        </View>

        {/* 거리 표시 */}
        <View style={styles.distanceSection}>
          <Text style={styles.distanceLabel}>신호등까지 남은 거리</Text>
          <Text style={styles.distanceValue}>{distance}</Text>
        </View>

        {/* AR 화살표 */}
        <View style={styles.arrowSection}>
          <Animated.View style={[styles.arrowContainer, { transform: [{ scale: arrowPulseAnim }] }]}>
            <Text style={styles.arrowIcon}>{currentDirection.symbol}</Text>
          </Animated.View>
        </View>

        {/* 속도 표시 */}
        <View style={styles.speedSection}>
          <Text style={styles.speedLabel}>현재 속도</Text>
          <Text style={styles.speedValue}>{speed}</Text>
        </View>

        {/* 하단 버튼 */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.bottomButton} onPress={() => router.push("/camera")}>
            <MaterialIcons name="photo-camera" size={24} color="#374151" />
            <Text style={styles.bottomButtonText}>카메라</Text>
          </Pressable>

          <Pressable style={styles.bottomButton} onPress={() => {}}>
            <MaterialIcons name="mic" size={24} color="#374151" />
            <Text style={styles.bottomButtonText}>음성</Text>
          </Pressable>

          <Pressable style={styles.bottomButton} onPress={() => router.push("/")}>
            <MaterialIcons name="home" size={24} color="#374151" />
            <Text style={styles.bottomButtonText}>홈</Text>
          </Pressable>

          <Pressable style={styles.bottomButton} onPress={() => router.push("/settings")}>
            <MaterialIcons name="settings" size={24} color="#374151" />
            <Text style={styles.bottomButtonText}>설정</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  // 신호등 섹션
  signalSection: {
    flex: 2,
  },
  signalCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signalTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  signalSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  timeChip: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeChipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  timeChipValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFF",
  },
  // 거리 섹션
  distanceSection: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  distanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -1,
  },
  // AR 화살표 섹션
  arrowSection: {
    flex: 2,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#22C55E",
  },
  arrowContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowIcon: {
    fontSize: 60,
    color: "#22C55E",
    fontWeight: "900",
  },
  // 속도 섹션
  speedSection: {
    flex: 0.8,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  speedLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  speedValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.5,
  },
  // 하단 버튼
  bottomBar: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  bottomButton: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bottomButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
  },
});
