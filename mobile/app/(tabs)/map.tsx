import React from "react";
import {
  View,
  Text,
  StatusBar,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useStations } from "../../lib/hooks";
import { colors, typography } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import NativeMapScreen from "../../components/NativeMapScreen";

export default function MapScreen() {
  return <NativeMapScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: { ...typography.heading, color: colors.primary, fontSize: 24 },
  subtitle: { ...typography.caption, color: colors.textMuted },
});
