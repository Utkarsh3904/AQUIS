import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useStations } from "../../lib/hooks";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { EmptyState } from "../../components/EmptyState";
import type { StationListItem } from "../../types/station";

export default function ForecastTabScreen() {
  const router = useRouter();
  const { data: stations, loading, error } = useStations();

  const stationsWithSlug = useMemo(
    () => stations.filter((s) => s.slug),
    [stations]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading forecasts...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <EmptyState
          title="Unable to load forecasts"
          message={error.body?.detail ?? error.body?.error ?? "Network error"}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Forecast</Text>
        <Text style={styles.subtitle}>{stationsWithSlug.length} stations with models</Text>
      </View>
      <FlatList
        data={stationsWithSlug}
        keyExtractor={(item) => item.slug ?? `fc-${item.id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: StationListItem }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => item.slug && router.push(`/forecast/${item.slug}`)}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardName} numberOfLines={1}>{item.station}</Text>
              <Text style={styles.cardDistrict}>{item.district}</Text>
            </View>
            <Text style={styles.cardArrow}>→</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState title="No forecast stations available" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  title: { ...typography.headlineMd, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textMuted },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardLeft: { flex: 1, gap: spacing.xxs },
  cardName: { ...typography.titleMd, color: colors.textPrimary },
  cardDistrict: { ...typography.bodySm, color: colors.textMuted },
  cardArrow: { fontSize: 18, color: colors.primary, fontWeight: "600" },
});
