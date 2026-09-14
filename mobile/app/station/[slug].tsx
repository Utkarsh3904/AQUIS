import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import {
  useStationFactsBySlug,
  useForecast,
  useStationSeries,
  useStations,
} from "../../lib/hooks";
import { fetchStationFacts } from "../../lib/api";
import BottomNavBar from "../../components/BottomNavBar";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RealSeriesChart({ slug }: { slug: string | null }) {
  const now = new Date();
  const from = "2026-01-01";
  const to = now.toISOString().split("T")[0];
  const { data: seriesData, loading } = useStationSeries(slug, {
    from,
    to,
    limit: 500,
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const CHART_H = 160;

  const points = useMemo(() => {
    if (!seriesData?.points || seriesData.points.length === 0) return [];
    const valid = seriesData.points
      .filter((p) => p.gwl != null)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (valid.length === 0) return [];
    const gwls = valid.map((p) => p.gwl!);
    const min = Math.min(...gwls);
    const max = Math.max(...gwls);
    const range = max - min || 1;
    return valid.map((p, i) => ({
      value: p.gwl!,
      time: p.time,
      x: (i / Math.max(valid.length - 1, 1)) * 100,
      y: (1 - (p.gwl! - min) / range) * CHART_H,
    }));
  }, [seriesData]);

  const segments = useMemo(() => {
    if (points.length < 2 || containerWidth === 0) return [];
    return points.slice(1).map((pt, i) => {
      const prev = points[i];
      const x1 = (prev.x / 100) * containerWidth;
      const y1 = prev.y;
      const x2 = (pt.x / 100) * containerWidth;
      const y2 = pt.y;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return { left: x1, top: y1, length, angle };
    });
  }, [points, containerWidth]);

  const yLabels = useMemo(() => {
    if (points.length === 0) return [];
    const gwls = points.map((p) => p.value);
    const min = Math.min(...gwls);
    const max = Math.max(...gwls);
    const range = max - min || 1;
    return [max, max - range * 0.33, max - range * 0.66, min].map((v) =>
      v.toFixed(2)
    );
  }, [points]);

  const timeLabels = useMemo(() => {
    if (points.length <= 1) return [];
    return ["Jan", "Apr", "Jul", "Sep"];
  }, [points]);

  if (loading) {
    return (
      <View style={styles.chartPlaceholder}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.chartPlaceholderText}>Loading telemetry...</Text>
      </View>
    );
  }

  if (points.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderTitle}>
          No telemetry data available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>From 2026 – Present</Text>
        <View style={styles.chartLegend}>
          <View
            style={[styles.legendLine, { backgroundColor: colors.primary }]}
          />
          <Text style={styles.legendLabel}>gwl</Text>
          <Text style={styles.filterIcon}>⬇</Text>
        </View>
      </View>
      <Text style={styles.chartSubtitle}>
        {points.length} readings (6h interval)
      </Text>
      <View style={styles.chartRow}>
        <View style={styles.chartYLabelsCol}>
          {yLabels.map((label, i) => (
            <Text
              key={i}
              style={styles.chartYLabel}
            >
              {label}
            </Text>
          ))}
        </View>
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={styles.chartArea}
        >
          {segments.map((seg, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: seg.left,
                top: seg.top,
                width: seg.length,
                height: 2,
                backgroundColor: colors.primary,
                borderRadius: 1,
                transform: [{ rotate: `${seg.angle}deg` }],
                transformOrigin: "left center",
              }}
            />
          ))}
        </View>
      </View>
      <View style={styles.chartXLabels}>
        {timeLabels.map((label, i) => (
          <Text key={i} style={styles.chartXLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}


export default function StationDetailScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"live" | "forecast">("live");
  const [districtRank, setDistrictRank] = useState<{
    rank: number;
    total: number;
  } | null>(null);

  const { data: stations } = useStations();
  const { data: facts, loading, error, refetch } = useStationFactsBySlug(
    slug ?? null
  );
  const { data: forecast } = useForecast(slug ?? null);

  const currentStation = useMemo(
    () => stations.find((s) => s.slug === slug) ?? null,
    [stations, slug]
  );

  useEffect(() => {
    if (!facts?.district || !slug || stations.length === 0) return;
    const district = facts.district;
    const districtStations = stations.filter(
      (s) => s.district === district && s.slug !== slug && s.slug != null
    );
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const results = await Promise.allSettled(
          districtStations.map((s) => fetchStationFacts(s.slug!))
        );
        if (cancelled) return;
        const allLevels: number[] = [facts.last];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value?.last != null) {
            allLevels.push(r.value.last);
          }
        }
        allLevels.sort((a, b) => b - a);
        const rank = allLevels.indexOf(facts.last) + 1;
        setDistrictRank({ rank, total: allLevels.length });
      } catch {
        // Silent fail
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [facts, stations, slug]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <EmptyState title="Loading station..." loading />
      </View>
    );
  }

  if (error && !facts) {
    return (
      <View style={styles.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
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
  const change30d = facts?.forecast?.change_30d_pred ?? 0;
  const direction = facts?.forecast?.direction ?? "stable";
  const isRising =
    direction === "expected rise" || direction === "rising";
  const scarcity =
    facts?.precautions?.[0]?.level === "watch" ? "Watch" : "Safe";

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
        <View
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Live Telemetry Analysis</Text>
        </View>

        <View style={styles.headerSection}>
          <View style={styles.headerEyebrow}>
            <Text style={styles.headerEyebrowText}>LIVE TELEMETRY</Text>
          </View>
          <Text style={styles.stationName} numberOfLines={1} ellipsizeMode="tail">
            {facts?.station ?? "Station"}
          </Text>
          <Text style={styles.stationDistrict} numberOfLines={1} ellipsizeMode="tail">
            {facts?.district ?? ""}
          </Text>
        </View>

        <View style={styles.tabsRow}>
          <TabButton
            label="Live Telemetry"
            active={activeTab === "live"}
            onPress={() => setActiveTab("live")}
          />
          <TabButton
            label="30D Forecast"
            active={false}
                    onPress={() => router.push(`/(tabs)/forecast?slug=${slug}`)}
          />
        </View>

        <>
            <View style={styles.projectedCard}>
              <Text style={styles.projectedLabel}>
                CURRENT GROUNDWATER LEVEL
              </Text>
              <View style={styles.projectedRow}>
                <Text style={styles.projectedValue}>
                  {level.toFixed(2)}
                </Text>
                <Text style={styles.projectedUnit}>mbgl</Text>
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor: isRising
                        ? colors.positiveBg
                        : colors.negativeBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changeBadgeText,
                      {
                        color: isRising ? colors.positive : colors.negative,
                      },
                    ]}
                  >
                    {isRising ? "↑" : "↓"}{" "}
                    {Math.abs(change30d).toFixed(2)}m
                  </Text>
                </View>
              </View>

              <View style={styles.anchorRow}>
                <Text style={styles.anchorIcon}>🎯</Text>
                <Text style={styles.anchorLabel}>Anchor GWL:</Text>
                <Text style={styles.anchorValue}>
                  {anchorGwl.toFixed(2)} mbgl
                </Text>
                <Text style={styles.anchorTime}>{anchorTime}</Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Forecast:</Text>
                  <Text style={[styles.metricValue, { color: isRising ? colors.positive : direction === "expected decline" || direction === "declining" ? colors.negative : colors.textSecondary }]}>
                    {isRising ? "↑ Rising" : direction === "expected decline" || direction === "declining" ? "↓ Declining" : "→ Stable"}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Water Scarcity:</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          scarcity === "Safe"
                            ? colors.positive
                            : colors.warning,
                      },
                    ]}
                  >
                    {scarcity}
                  </Text>
                </View>
              </View>
            </View>

            <RealSeriesChart slug={slug ?? null} />

            <TouchableOpacity
              style={styles.driverBtn}
              activeOpacity={0.7}
              onPress={() => slug && router.push(`/drivers/${slug}`)}
            >
              <Text style={styles.driverBtnText}>
                GET MORE INFORMATION PER DRIVER
              </Text>
            </TouchableOpacity>

            {districtCtx && (
              <View style={styles.benchmarkCard}>
                <View style={styles.benchmarkHeader}>
                  <Text style={styles.benchmarkIcon}>📊</Text>
                  <Text style={styles.benchmarkTitle}>
                    District Hydrological{"\n"}Benchmark
                  </Text>
                  {districtRank ? (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>
                        Rank #{districtRank.rank}/{districtRank.total}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.rankBadge}>
                      <ActivityIndicator size={10} color={colors.primary} />
                    </View>
                  )}
                </View>

                <Text style={styles.benchmarkCompare}>
                  <Text style={{ color: colors.positive, fontWeight: "700" }}>
                    {Math.abs(diffFromMedian).toFixed(2)} m{" "}
                    {isAboveMedian ? "higher" : "lower"}
                  </Text>{" "}
                  than {facts?.district ?? "district"} median across{" "}
                  {districtCtx.n_stations} stations.
                </Text>

                <View style={styles.depthBar}>
                  <Text style={styles.depthLabel}>
                    Below Median: {districtCtx.min_level?.toFixed(1) ?? "—"}m
                  </Text>
                  <Text style={styles.depthMedian}>
                    Median: {districtCtx.median?.toFixed(1) ?? "—"}m
                  </Text>
                  <Text style={styles.depthLabel}>
                    Above Median:{" "}
                    {districtCtx.max_level?.toFixed(1) ?? "—"}m
                  </Text>
                </View>

                <View style={styles.gaugeContainer}>
                  <View style={styles.gaugeTrack}>
                    {/* Median marker at center */}
                    <View
                      style={[
                        styles.gaugeMedianMarker,
                        { left: "50%" },
                      ]}
                    />
                    {/* Station value fill from median */}
                    <View
                      style={[
                        styles.gaugeFill,
                        {
                          left: isAboveMedian ? "50%" : `${Math.max(5, ((level - (districtCtx.min_level ?? 0)) / ((districtCtx.max_level ?? 1) - (districtCtx.min_level ?? 0))) * 100)}%`,
                          width: `${Math.abs(((level - (districtCtx.median ?? 0)) / ((districtCtx.max_level ?? 1) - (districtCtx.min_level ?? 0))) * 100)}%`,
                        },
                      ]}
                    />
                    {/* Station dot */}
                    <View
                      style={[
                        styles.gaugeStationDot,
                        {
                          left: `${Math.min(
                            95,
                            Math.max(
                              5,
                              ((level -
                                (districtCtx.min_level ?? 0)) /
                                ((districtCtx.max_level ?? 1) -
                                  (districtCtx.min_level ?? 0))) *
                                100
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.clusterRow}>
                  <Text style={styles.clusterLabel}>
                    Regional Cluster{"\n"}Spread
                  </Text>
                  <Text style={styles.clusterValue}>
                    Station: {level.toFixed(2)}m (
                    {isAboveMedian ? "Above Median" : "Below Median"})
                  </Text>
                </View>
              </View>
            )}
          </>
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
    gap: spacing.md,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  backArrow: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  topTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
    flex: 1,
  },

  headerSection: { gap: spacing.xxs },
  headerEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerEyebrowText: {
    ...typography.statLabel,
    color: colors.primary,
    letterSpacing: 0.06,
  },
  stationName: {
    ...typography.headlineLgMobile,
    color: colors.textPrimary,
    fontSize: 22,
  },
  stationDistrict: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },

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

  projectedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectedLabel: {
    ...typography.statLabel,
    color: colors.textSecondary,
    letterSpacing: 0.06,
    marginBottom: spacing.xs,
  },
  projectedRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  projectedValue: {
    ...typography.metricDisplay,
    color: colors.textPrimary,
    fontSize: 36,
  },
  projectedUnit: { ...typography.body, color: colors.textMuted },
  changeBadge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
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
  anchorIcon: { fontSize: 16 },
  anchorLabel: { ...typography.bodySm, color: colors.textSecondary },
  anchorValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
  },
  anchorTime: { ...typography.bodySm, color: colors.textMuted, fontSize: 10 },

  metricsRow: { flexDirection: "row", gap: spacing.lg },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  metricIcon: { fontSize: 16 },
  metricLabel: { ...typography.bodySm, color: colors.textSecondary },
  metricValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "600",
  },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: { ...typography.titleMd, color: colors.textPrimary },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendLabel: { ...typography.bodySm, color: colors.textSecondary },
  filterIcon: { fontSize: 16, color: colors.textMuted },
  chartSubtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  chartYLabel: {
    ...typography.codeMono,
    color: colors.textMuted,
    fontSize: 9,
    textAlign: "right",
    height: 160 / 4,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  chartYLabelsCol: {
    width: 48,
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 4,
  },
  chartArea: {
    flex: 1,
    height: 160,
    position: "relative",
  },
  chartXLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 48,
    marginTop: spacing.xs,
  },
  chartXLabel: { ...typography.codeMono, color: colors.textMuted, fontSize: 9 },
  chartPlaceholder: {
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  chartPlaceholderTitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chartPlaceholderText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },

  driverBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  driverBtnText: {
    ...typography.statLabel,
    color: colors.onPrimary,
    letterSpacing: 0.06,
  },

  benchmarkCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  benchmarkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  benchmarkIcon: { fontSize: 16 },
  benchmarkTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
    flex: 1,
  },
  rankBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  rankText: {
    ...typography.labelSm,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 10,
  },
  benchmarkCompare: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  depthBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  depthLabel: { ...typography.bodySm, color: colors.textMuted, fontSize: 10 },
  depthMedian: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
  },

  gaugeContainer: { paddingVertical: spacing.sm },
  gaugeTrack: {
    height: 8,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  gaugeFill: {
    position: "absolute",
    top: 0,
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
    opacity: 0.3,
  },
  gaugeStationDot: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    marginLeft: -8,
  },
  gaugeMedianMarker: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: colors.textSecondary,
    marginLeft: -1,
    zIndex: 2,
  },

  clusterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clusterLabel: { ...typography.bodySm, color: colors.textMuted, flex: 1 },
  clusterValue: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: "700",
    textAlign: "right",
  },
});
