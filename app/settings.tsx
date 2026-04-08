import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function SettingsScreen() {
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

          <Text style={styles.headerTitle}>설정</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.grid}>
          <View style={styles.settingCard}>
            <MaterialIcons name="record-voice-over" size={34} color="#11181c" />
            <Text style={styles.cardTitle}>AI 음성 가이드</Text>
            <Switch value />
          </View>

          <View style={styles.settingCard}>
            <MaterialIcons name="palette" size={34} color="#11181c" />
            <Text style={styles.cardTitle}>테마</Text>
            <Text style={styles.cardValue}>기본</Text>
          </View>

          <View style={styles.settingCard}>
            <MaterialIcons name="tune" size={34} color="#11181c" />
            <Text style={styles.cardTitle}>HUD 조정</Text>
            <Text style={styles.cardValue}>크게</Text>
          </View>
        </View>
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
    marginBottom: 20,
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
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  settingCard: {
    width: "48%",
    minHeight: 180,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181c",
    textAlign: "center",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4b5563",
    textAlign: "center",
  },
});
