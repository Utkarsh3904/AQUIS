import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation } from "../../theme/spacing";
import { useStationFactsBySlug, useForecast, useStationSeries, useStations } from "../../lib/hooks";
import { EmptyState } from "../../components/EmptyState";

const { width: SCREEN_W } = Dimensions.get("window");

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ForecastChart({
  anchor,
  trajectory,
  forecast,
}: {
  anchor: number;
  trajectory: any[];
  forecast: any;
}) {
  if (!trajectory || trajectory.length < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Loading forecast chart...</Text>
      </View>
    );
  }

  const chartPoints = trajectory.filter((_: any, i: number) => i % 4 === 0);
  const values = chartPoints.flatMap((p: any) => [p.q05, p.q95, p.q50].filter(Boolean));
  const min = Math.min(...values, anchor);
  const max = Math.max(...values, anchor);
  const range = max - min || 1;
  const padY = range * 0.15;

  const yMin = min - padY;
  const yMax = max + padY;
  const yRange = yMax - yMin;

  const xLabels = ["-14d", "-7d", "Today", "+7d", "+14d", "+21d", "+30d"];
  const anchorIdx = Math.floor(trajectory.length * 0.3);

  return (
    <View style={styles.forecastChartContainer}>
      <View style={styles.chartYLabels}>
        {[yMax, yMax - yRange * 0.33, yMax - yRange * 0.66, yMin].map((v, i) => (
          <Text key={i} style={styles.chartYLabel}>{v.toFixed(2)}m</Text>
        ))}
      </View>
      <View style={styles.chartArea}>
        {/* Grid lines */}
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.chartGridLine, { top: `${(i / 3) * 90 + 5}%` }]} />
        ))}

        {/* q05-q95 envelope band */}
        <View style={styles.envelopeBand}>
          {chartPoints.map((p: any, i: number) => {
            const x = (i / (chartPoints.length - 1)) * 95 + 2;
            const yQ05 = ((p.q05 - yMin) / yRange) * 80 + 10;
            const yQ95 = ((p.q95 - yMin) / yRange) * 80 + 10;
            return (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${Math.min(yQ05, yQ95)}%`,
                  width: 1,
                  height: `${Math.abs(yQ05 - yQ95)}%`,
                  backgroundColor: "rgba(2,132,199,0.12)",
                }}
              />
            );
          })}
        </View>

        {/* q50 dots */}
        {chartPoints.map((p: any, i: number) => {
          const x = (i / (chartPoints.length - 1)) * 95 + 2;
          const y = ((p.q50 - yMin) / yRange) * 80 + 10;
          return (
            <View
              key={`dot-${i}`}
              style={[styles.chartDot, { left: `${x}%`, top: `${y}%` }]}
            />
          );
        })}
      </View>

      {/* X labels */}
      <View style={styles.chartXLabels}>
        {xLabels.map((l, i) => (
          <Text key={i} style={[styles.chartXLabel, l === "Today" && styles.chartXLabelBold]}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function StationDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"live" | "forecast">("live");

  const { data: stations } = useStations();
  const { data: facts, loading, error, refetch } = useStationFactsBySlug(slug ?? null);
  const { data: forecast } = useForecast(slug ?? null);
  const { data: series } = useStationSeries(slug ?? null, { limit: 200 });

  const currentStation = useMemo(
    () => stations.find((s) => s.slug === slug) ?? null,
    [stations, slug]
  );

  const lastSync = facts?.last_date
    ? `${facts.last_date}`
    : "—";

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <EmptyState title="Loading station..." loading />
      </View>
    );
  }

  if (error && !facts) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <EmptyState
          title={error.status === 404 ? "Station not found" : "Station unavailable"}
          message={error.body?.detail ?? error.body?.error ?? "Unknown error"}
          onRetry={refetch}
        />
      </View>
    );
  }

  const level = facts?.last ?? 0;
  const anchorGwl = forecast?.anchor_gwl ?? level;
  const anchorTime = forecast?.anchor_time ?? "";
  const day30Pred = facts?.forecast?.day30_pred ?? 0;
  const change30d = facts?.forecast?.change_30d_pred ?? 0;
  const direction = facts?.forecast?.direction ?? "stable";
  const isRising = direction === "expected rise";
  const bandHalf = facts?.forecast?.band_half ?? 0;
  const q05 = facts?.forecast?.q05_level ?? (level - bandHalf);
  const q95 = facts?.forecast?.q95_level ?? (level + bandHalf);
  const signAccuracy = forecast?.direction?.sign_accuracy_30d;
  const agreement = forecast?.direction?.agreement_with_production;
  const scarcity = facts?.precautions?.[0]?.level === "watch" ? "Watch" : "Safe";

  const trajectory = forecast?.trajectory ?? [];
  const districtCtx = facts?.district_context;
  const districtMedian = districtCtx?.median ?? facts?.district_median ?? 0;
  const diffFromMedian = level - districtMedian;
  const isAboveMedian = diffFromMedian > 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchText} numberOfLines={1}>
            {facts?.station ?? "Station"} ({facts?.district ?? ""})
          </Text>
        </View>

        {/* Filter chips */}
        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: colors.positiveBg }]}>
            <View style={[styles.chipDot, { backgroundColor: colors.positive }]} />
            <Text style={[styles.chipText, { color: colors.positiveText }]}>Safe / Nominal</Text>
            <View style={[styles.chipCount, { backgroundColor: colors.positiveBorder }]}>
              <Text style={[styles.chipCountText, { color: colors.positiveText }]}>
                {facts?.district_context?.n_stations ?? "—"}
              </Text>
            </View>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.primaryLight }]}>
            <View style={[styles.chipDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.chipText, { color: colors.primaryDeep }]}>Caution / Depleting</Text>
            <View style={[styles.chipCount, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.chipCountText, { color: colors.primaryDeep }]}>
                {facts?.precautions?.length ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Station header */}
        <View style={styles.stationHeader}>
          <View style={styles.stationHeaderLeft}>
            <Text style={styles.chainIcon}>🔗</Text>
            <Text style={styles.stationHeaderLabel}>STATION FORECAST</Text>
            <View style={styles.stationIdBadge}>
              <Text style={styles.stationIdText}>
                {slug?.split("-").pop()?.toUpperCase() ?? "—"}
              </Text>
            </View>
          </View>
          <View style={styles.stationHeaderRight}>
            <Text style={styles.clockIcon}>🕐</Text>
            <Text style={styles.syncText}>Last Sync {lastSync}</Text>
          </View>
        </View>

        {/* Station name */}
        <Text style={styles.stationName}>{facts?.station ?? "Station"}</Text>
        <Text style={styles.stationDistrict}>
          {facts?.district ?? ""} {facts?.station_names ? "" : ""}
        </Text>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TabButton label="Live Telemetry" active={activeTab === "live"} onPress={() => setActiveTab("live")} />
          <TabButton label="30D Forecast" active={activeTab === "forecast"} onPress={() => setActiveTab("forecast")} />
        </View>

        {activeTab === "live" ? (
          <>
            {/* Projected Aquifer Level */}
            <View style={styles.projectedCard}>
              <Text style={styles.projectedLabel}>PROJECTED AQUIFER LEVEL</Text>
              <View style={styles.projectedRow}>
                <Text style={styles.projectedValue}>{day30Pred.toFixed(2)}</Text>
                <Text style={styles.projectedUnit}>mbgl</Text>
                <View style={[styles.changeBadge, { backgroundColor: isRising ? colors.positiveBg : colors.negativeBg }]}>
                  <Text style={[styles.changeBadgeText, { color: isRising ? colors.positive : colors.negative }]}>
                    {isRising ? "↑" : "↓"} {Math.abs(change30d).toFixed(2)}m
                  </Text>
                </View>
              </View>

              <View style={styles.anchorRow}>
                <Text style={styles.anchorIcon}>🎯</Text>
                <Text style={styles.anchorLabel}>Anchor GWL:</Text>
                <Text style={styles.anchorValue}>{anchorGwl.toFixed(2)} mbgl</Text>
                <Text style={styles.anchorTime}>{anchorTime}</Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>📈</Text>
                  <Text style={styles.metricValue}>
                    {isRising ? "Expected rise" : "Expected decline"}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>30D Sign Accuracy:</Text>
                  <Text style={styles.metricValue}>
                    {signAccuracy != null ? `${(signAccuracy * 100).toFixed(1)}%` : "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Prod. Agreement:</Text>
                  <Text style={styles.metricValue}>
                    {agreement === true ? "Yes" : agreement === false ? "No" : "—"}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Water Scarcity:</Text>
                  <Text style={[styles.metricValue, { color: scarcity === "Safe" ? colors.positive : colors.warning }]}>
                    {scarcity}
                  </Text>
                </View>
              </View>
            </View>

            {/* 30D Forecast Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>From 2026–Present</Text>
                <View style={styles.chartLegend}>
                  <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendLabel}>gwl</Text>
                  <Text style={styles.filterIcon}>⬇</Text>
                </View>
              </View>
              <Text style={styles.chartSubtitle}>30d forecast</Text>

              <ForecastChart
                anchor={anchorGwl}
                trajectory={trajectory}
                forecast={forecast}
              />

              {/* Day 30 summary */}
              <View style={styles.day30Card}>
                <View style={styles.day30Header}>
                  <View style={[styles.day30Dot, { backgroundColor: colors.positive }]} />
                  <Text style={styles.day30Label}>Day 30:</Text>
                  <Text style={styles.day30Value}>{day30Pred.toFixed(2)}m</Text>
                </View>
                <Text style={styles.day30Envelope}>
                  90% Envelope: q05: {q05.toFixed(2)}m | q95: {q95.toFixed(2)}m
                </Text>
              </View>
            </View>

            {/* Get more info per driver */}
            <TouchableOpacity style={styles.driverBtn} activeOpacity={0.7}>
              <Text style={styles.driverBtnText}>GET MORE INFORMATION PER DRIVER</Text>
            </TouchableOpacity>

            {/* District Hydrological Benchmark */}
            {districtCtx && (
              <View style={styles.benchmarkCard}>
                <View style={styles.benchmarkHeader}>
                  <Text style={styles.benchmarkIcon}>📊</Text>
                  <Text style={styles.benchmarkTitle}>District Hydrological{"\n"}Benchmark</Text>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>Rank #3/{districtCtx.n_stations}</Text>
                  </View>
                </View>

                <Text style={styles.benchmarkCompare}>
                  <Text style={{ color: colors.positive, fontWeight: "700" }}>
                    {Math.abs(diffFromMedian).toFixed(2)} m {isAboveMedian ? "higher" : "lower"}
                  </Text>{" "}
                  than {facts?.district ?? "district"} median across {districtCtx.n_stations} stations.
                </Text>

                <View style={styles.depthBar}>
                  <Text style={styles.depthLabel}>Deepest: {districtCtx.max_level?.toFixed(1) ?? "—"}m</Text>
                  <Text style={styles.depthMedian}>Median: {districtCtx.median?.toFixed(1) ?? "—"}m</Text>
                  <Text style={styles.depthLabel}>Shallow: {districtCtx.min_level?.toFixed(1) ?? "—"}m</Text>
                </View>

                <View style={styles.gaugeContainer}>
                  <View style={styles.gaugeTrack}>
                    <View
                      style={[
                        styles.gaugeFill,
                        {
                          left: `${Math.max(0, ((districtCtx.min_level ?? 0) - (districtCtx.min_level ?? 0)) / ((districtCtx.max_level ?? 1) - (districtCtx.min_level ?? 0)) * 100)}%`,
                          width: `${Math.min(100, ((level - (districtCtx.min_level ?? 0)) / ((districtCtx.max_level ?? 1) - (districtCtx.min_level ?? 0))) * 100)}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.gaugeStationDot,
                        {
                          left: `${Math.min(95, Math.max(5, ((level - (districtCtx.min_level ?? 0)) / ((districtCtx.max_level ?? 1) - (districtCtx.min_level ?? 0))) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.clusterRow}>
                  <Text style={styles.clusterLabel}>Regional Cluster{"\n"}Spread</Text>
                  <Text style={styles.clusterValue}>
                    Station: {level.toFixed(2)}m ({isAboveMedian ? "Above Median" : "Below Median"})
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          /* 30D Forecast Tab — reuse the chart */
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>30-Day Forecast Trajectory</Text>
            <ForecastChart
              anchor={anchorGwl}
              trajectory={trajectory}
              forecast={forecast}
            />
            <View style={styles.day30Card}>
              <View style={styles.day30Header}>
                <View style={[styles.day30Dot, { backgroundColor: colors.positive }]} />
                <Text style={styles.day30Label}>Day 30:</Text>
                <Text style={styles.day30Value}>{day30Pred.toFixed(2)}m</Text>
              </View>
              <Text style={styles.day30Envelope}>
                90% Envelope: q05: {q05.toFixed(2)}m | q95: {q95.toFixed(2)}m
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: { fontSize: 18, color: colors.textPrimary, fontWeight: "600" },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  searchIcon: { fontSize: 16 },
  searchText: { ...typography.body, color: colors.textPrimary, flex: 1 },

  // Chips
  chipsRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...typography.labelSm, fontWeight: "500" },
  chipCount: { borderRadius: radii.full, paddingHorizontal: spacing.xs, paddingVertical: 1 },
  chipCountText: { ...typography.labelSm, fontSize: 10, fontWeight: "700" },

  // Station header
  stationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stationHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  chainIcon: { fontSize: 14 },
  stationHeaderLabel: { ...typography.statLabel, color: colors.primary, letterSpacing: 0.06 },
  stationIdBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  stationIdText: { ...typography.labelSm, color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  stationHeaderRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  clockIcon: { fontSize: 12 },
  syncText: { ...typography.bodySm, color: colors.textMuted, fontSize: 10 },

  // Station name
  stationName: { ...typography.headlineLgMobile, color: colors.textPrimary, fontSize: 22 },
  stationDistrict: { ...typography.body, color: colors.textMuted, marginTop: -spacing.xs },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { ...typography.labelMd, color: colors.textMuted },
  tabBtnTextActive: { color: colors.onPrimary, fontWeight: "700" },

  // Projected card
  projectedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectedLabel: { ...typography.statLabel, color: colors.textSecondary, letterSpacing: 0.06, marginBottom: spacing.xs },
  projectedRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginBottom: spacing.md },
  projectedValue: { ...typography.metricDisplay, color: colors.textPrimary, fontSize: 36 },
  projectedUnit: { ...typography.body, color: colors.textMuted },
  changeBadge: { borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  changeBadgeText: { ...typography.labelSm, fontWeight: "700" },

  anchorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  anchorIcon: { fontSize: 14 },
  anchorLabel: { ...typography.bodySm, color: colors.textSecondary },
  anchorValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "700", flex: 1 },
  anchorTime: { ...typography.bodySm, color: colors.textMuted, fontSize: 10 },

  metricsRow: { flexDirection: "row", gap: spacing.lg },
  metricItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  metricIcon: { fontSize: 12 },
  metricLabel: { ...typography.bodySm, color: colors.textSecondary },
  metricValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "600" },

  // Chart card
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chartTitle: { ...typography.titleMd, color: colors.textPrimary },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendLabel: { ...typography.bodySm, color: colors.textSecondary },
  filterIcon: { fontSize: 12, color: colors.textMuted },
  chartSubtitle: { ...typography.bodySm, color: colors.textMuted, marginBottom: spacing.md },

  forecastChartContainer: { marginBottom: spacing.md },
  chartYLabels: { position: "absolute", left: 0, top: 0, bottom: 30, width: 50, justifyContent: "space-between" },
  chartYLabel: { ...typography.codeMono, color: colors.textMuted, fontSize: 9, textAlign: "right" },
  chartArea: { height: 160, marginLeft: 55, position: "relative" },
  chartGridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.4 },
  envelopeBand: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  chartDot: { position: "absolute", width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginLeft: -2.5, marginTop: -2.5 },
  anchorMarker: { position: "absolute", alignItems: "center" },
  anchorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface },
  chartAnchorLabel: { ...typography.codeMono, color: colors.primary, fontSize: 8, marginTop: 2, fontWeight: "600" },
  chartXLabels: { flexDirection: "row", justifyContent: "space-between", marginLeft: 55, marginTop: spacing.xs },
  chartXLabel: { ...typography.codeMono, color: colors.textMuted, fontSize: 9 },
  chartXLabelBold: { color: colors.primary, fontWeight: "700" },
  chartPlaceholder: { height: 160, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfaceContainerLow, borderRadius: radii.md },
  chartPlaceholderText: { ...typography.bodySm, color: colors.textMuted },

  day30Card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  day30Header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  day30Dot: { width: 8, height: 8, borderRadius: 4 },
  day30Label: { ...typography.body, color: colors.textSecondary },
  day30Value: { ...typography.stat, color: colors.textPrimary, fontSize: 20 },
  day30Envelope: { ...typography.bodySm, color: colors.textMuted },

  // Driver btn
  driverBtn: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverBtnText: { ...typography.statLabel, color: colors.textSecondary, letterSpacing: 0.06 },

  // Benchmark
  benchmarkCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  benchmarkHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  benchmarkIcon: { fontSize: 18 },
  benchmarkTitle: { ...typography.titleMd, color: colors.textPrimary, flex: 1 },
  rankBadge: { backgroundColor: colors.primaryLight, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  rankText: { ...typography.labelSm, color: colors.primary, fontWeight: "700", fontSize: 10 },
  benchmarkCompare: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  depthBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  depthLabel: { ...typography.bodySm, color: colors.textMuted, fontSize: 10 },
  depthMedian: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "700" },

  gaugeContainer: { paddingVertical: spacing.sm },
  gaugeTrack: { height: 8, backgroundColor: colors.surfaceContainerLow, borderRadius: 4, position: "relative", overflow: "visible" },
  gaugeFill: { position: "absolute", top: 0, height: 8, backgroundColor: colors.primary, borderRadius: 4, opacity: 0.3 },
  gaugeStationDot: { position: "absolute", top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.surface, marginLeft: -8 },

  clusterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clusterLabel: { ...typography.bodySm, color: colors.textMuted, flex: 1 },
  clusterValue: { ...typography.bodySm, color: colors.primary, fontWeight: "700", textAlign: "right" },
});
