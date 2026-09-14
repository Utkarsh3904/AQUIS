import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, typography } from "../theme/colors";
import { spacing, radii } from "../theme/spacing";

export default function MapFallback() {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>◉</Text>
      </View>
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.message}>
        Interactive map is available on the mobile app. On web, use the
        Watchlist tab to browse stations.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 32,
    color: colors.primary,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 20,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
