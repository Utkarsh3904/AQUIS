import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { useStationFacts, useStations } from "../../lib/hooks";
import { EmptyState } from "../../components/EmptyState";

export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const stationId = Number(id);

  const { data: station, loading: stationLoading, error: stationError } = useStations();
  const { data: facts, loading: factsLoading, error: factsError } = useStationFacts(stationId || null);

  const currentStation = station?.find((s) => s.id === stationId) ?? null;
  const loading = stationLoading || factsLoading;
  const error = stationError ?? factsError;
  const [viewMode, setViewMode] = useState<"live" | "historical">("live");

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <EmptyState title="Loading station..." loading />
      </View>
    );
  }

  if (error && !currentStation) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>
        <EmptyState
          title={error.status === 404 ? "Station not found" : "Station unavailable"}
          message={error.body?.detail ?? error.body?.error ?? "Unknown error"}
        />
      </View>
    );
  }

  if (!currentStation) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>
        <EmptyState title="Station not found" />
      </View>
    );
  }

  const directionColor =
    facts?.forecast.direction === "expected rise"
      ? colors.positive
      : facts?.forecast.direction === "expected decline"
      ? colors.negative
      : colors.textSecondary;

  const changeVal = facts ? facts.change_30d : 0;
  const changeSign = changeVal > 0 ? "+" : "";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Search-like header bar */}
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Text style={styles.searchText} numberOfLines={1}>
            {currentStation.station}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Big current level */}
        {facts && (
          <View style={styles.levelSection}>
            <Text style={styles.levelValue}>{facts.last}</Text>
            <Text style={styles.levelUnit}>m</Text>
            <Text style={styles.levelDate}>as of {facts.last_date}</Text>
            <View style={[styles.directionBadge, { backgroundColor: directionColor + "18" }]}>
              <Text style={[styles.directionText, { color: directionColor }]}>
                {facts.forecast.direction}
              </Text>
            </View>
          </View>
        )}

        {/* Live / Historical toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "live" && styles.toggleBtnActive]}
            onPress={() => setViewMode("live")}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, viewMode === "live" && styles.toggleTextActive]}>
              Live
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "historical" && styles.toggleBtnActive]}
            onPress={() => setViewMode("historical")}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, viewMode === "historical" && styles.toggleTextActive]}>
              Historical
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chart placeholder */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {viewMode === "live" ? "Recent Observations" : "Historical Trend"}
          </Text>
          <View style={styles.chartPlaceholder}>
            <View style={styles.chartBar}>
              {Array.from({ length: 12 }).map((_, i) => {
                const height = 30 + Math.sin(i * 0.8 + 2) * 20 + Math.random() * 10;
                return (
                  <View
                    key={i}
                    style={[
                      styles.chartBarSegment,
                      {
                        height: `${height}%`,
                        backgroundColor:
                          viewMode === "live" ? colors.primary : colors.primaryMuted,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>-30d</Text>
              <Text style={styles.chartLabel}>Now</Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        {facts && (
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {changeSign}{facts.change_7d} m
              </Text>
              <Text style={styles.statLabel}>7d change</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {changeSign}{facts.change_30d} m
              </Text>
              <Text style={styles.statLabel}>30d change</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{facts.span} m</Text>
              <Text style={styles.statLabel}>Range</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{facts.n_obs.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Observations</Text>
            </View>
          </View>
        )}

        {/* Station info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Station Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>District</Text>
            <Text style={styles.infoValue}>{currentStation.district}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Agency</Text>
            <Text style={styles.infoValue}>UPGW</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>External ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {currentStation.external_station_id}
            </Text>
          </View>
        </View>

        {/* Forecast CTA */}
        {currentStation.slug ? (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push(`/forecast/${currentStation.slug}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaText}>View Full Forecast</Text>
            <Text style={styles.ctaChevron}>›</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableText}>
              Full forecast requires the ML service (not yet deployed)
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
  },
  searchText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
  },
  backBtn: { ...typography.body, color: colors.primary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  levelSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  levelValue: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  levelUnit: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  levelDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  directionBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  directionText: {
    ...typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.xs,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textOnPrimary,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  chartTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  chartPlaceholder: {
    height: 160,
    justifyContent: "flex-end",
  },
  chartBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 130,
  },
  chartBarSegment: {
    flex: 1,
    borderRadius: 3,
    minHeight: 8,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  chartLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statItem: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statValue: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoCardTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    fontWeight: "500",
    color: colors.textPrimary,
    maxWidth: "60%",
    textAlign: "right",
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ctaText: { ...typography.subheading, color: colors.textOnPrimary },
  ctaChevron: { fontSize: 22, color: colors.textOnPrimary },
  unavailableCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
  },
  unavailableText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
