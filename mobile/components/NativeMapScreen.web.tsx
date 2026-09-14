import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useStations } from "../lib/hooks";
import { colors, typography } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function WebMapFallback() {
  const { data: stations } = useStations();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Station Map</Text>
        <Text style={styles.subtitle}>Interactive map available on mobile • {stations.length} stations</Text>
      </View>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>Interactive Map</Text>
        <Text style={styles.emptySubtitle}>Available on mobile devices</Text>
        <Text style={styles.emptyHint}>{stations.length} stations available in the watchlist</Text>
      </View>
    </View>
  );
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...typography.subheading, color: colors.textPrimary },
  emptySubtitle: { ...typography.caption, color: colors.textMuted },
  emptyHint: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
});
