import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

type SignalState = "red" | "yellow" | "green";

type DirectionState = "left" | "straight" | "right";

const SIGNAL_SEQUENCE: SignalState[] = ["red", "yellow", "green"];
const DIRECTION_SEQUENCE: DirectionState[] = ["left", "straight", "right"];

const SIGNAL_META: Record<
  SignalState,
  {
    title: string;
    label: string;
    distance: string;
    speed: string;
    backgroundColor: string;
  }
> = {
  red: {
    title: "STOP",
    label: "정지",
    distance: "128m",
    speed: "18 km/h",
    backgroundColor: "#FF4B2B",
  },
  yellow: {
    title: "SLOW",
    label: "주의",
    distance: "96m",
    speed: "31 km/h",
    backgroundColor: "#FDC830",
  },
  green: {
    title: "GO",
    label: "진행",
    distance: "64m",
    speed: "43 km/h",
    backgroundColor: "#80ff72",
  },
};

const DIRECTION_META: Record<
  DirectionState,
  {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
  }
> = {
  left: {
    icon: "turn-left",
    label: "좌회전",
  },
  straight: {
    icon: "straight",
    label: "직진",
  },
  right: {
    icon: "turn-right",
    label: "우회전",
  },
};

export default function HomeScreen() {
  const [signalIndex, setSignalIndex] = useState(0);
  const [directionIndex, setDirectionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSignalIndex((prev) => (prev + 1) % SIGNAL_SEQUENCE.length);
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  const signalState = SIGNAL_SEQUENCE[signalIndex];
  const currentSignal = useMemo(() => SIGNAL_META[signalState], [signalState]);
  const currentDirection = useMemo(
    () => DIRECTION_META[DIRECTION_SEQUENCE[directionIndex]],
    [directionIndex],
  );
  const handleAdvanceDirection = () => {
    setDirectionIndex((prev) => (prev + 1) % DIRECTION_SEQUENCE.length);
  };

  return (
    <ScreenContainer style={styles.screenContent}>
      <View style={styles.root}>
        <View style={styles.headerZone}>
          <Text style={styles.headerText}>AI Omni Code Sync</Text>
        </View>

        <View style={styles.mainColumn}>
          <View style={styles.visualZone}>
            <View style={[styles.signalCard, { backgroundColor: currentSignal.backgroundColor }]}>
              <Text style={styles.signalCardText}>{currentSignal.title}</Text>
              <Text style={styles.signalCardSubText}>{currentSignal.label}</Text>
            </View>
          </View>

          <View style={styles.infoZone}>
            <View style={styles.infoCard}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>남은 거리</Text>
                <Text style={styles.infoValue}>{currentSignal.distance}</Text>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>현재 속도</Text>
                <Text style={styles.infoValue}>{currentSignal.speed}</Text>
              </View>
            </View>
          </View>

          <View style={styles.naviZone}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내비게이션 방향 전환"
              onPress={handleAdvanceDirection}
              style={({ pressed }) => [styles.naviCard, pressed && styles.controlButtonPressed]}
            >
              <MaterialIcons name={currentDirection.icon} size={74} color="#ffffff" />
              <Text style={styles.naviText}>{currentDirection.label}</Text>
            </Pressable>
          </View>

          <View style={styles.bottomBarZone}>
            <View style={styles.bottomBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/camera")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="photo-camera" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>카메라</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="home" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>홈</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
              >
                <MaterialIcons name="settings" size={28} color="#11181c" />
                <Text numberOfLines={1} style={styles.controlText}>설정</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  root: {
    flex: 1,
  },
  headerZone: {
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
    letterSpacing: -0.3,
  },
  mainColumn: {
    flex: 1,
    flexDirection: "column",
  },
  visualZone: {
    flex: 2,
    justifyContent: "center",
  },
  signalCard: {
    flex: 1,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  signalCardText: {
    fontSize: 52,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  signalCardSubText: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  infoZone: {
    flex: 1.5,
    justifyContent: "center",
    paddingTop: 14,
    paddingBottom: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  infoBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#d1d5db",
    marginVertical: 18,
  },
  infoLabel: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4b5563",
    textAlign: "center",
  },
  infoValue: {
    marginTop: 12,
    fontSize: 34,
    fontWeight: "bold",
    color: "#11181c",
    textAlign: "center",
  },
  naviZone: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 10,
  },
  naviCard: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  naviText: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  bottomBarZone: {
    flex: 0.5,
    justifyContent: "center",
  },
  bottomBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 8,
    columnGap: 6,
  },
  controlButton: {
    width: "31%",
    flexBasis: "31%",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
  },
  controlButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  controlText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "bold",
    color: "#11181c",
    textAlign: "center",
    flexShrink: 0,
  },
});
