import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import { useForecast } from "../../lib/hooks";
import { EmptyState } from "../../components/EmptyState";
import { formatIstDateTime, formatIstShort } from "../../lib/timezone";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: colors.positive,
  DIRECTIONAL: colors.warning,
  LOW: colors.negative,
  high: colors.positive,
  directional: colors.warning,
  low: colors.negative,
};

const DIRECTION_COLORS: Record<string, string> = {
  "expected rise": colors.positive,
  "expected decline": colors.negative,
  stable: colors.textSecondary,
  rising: colors.positive,
  declining: colors.negative,
};

export default function ForecastScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { data: forecast, loading, error, refetch } = useForecast(slug ?? null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <EmptyState title="Loading forecast..." loading />
      </View>
    );
  }

  if (error || !forecast) {
    const errorTitle =
      error?.status === 404
        ? "No model available"
        : error?.status === 502
        ? "Forecast unavailable"
        : "Forecast unavailable";
    const errorMessage =
      error?.body?.detail ?? error?.body?.error ?? "No data";

    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>
        <EmptyState title={errorTitle} message={errorMessage} onRetry={refetch} />
      </View>
    );
  }

  // ── Chart data: subsample every 4th point (120 → 30 visual points, one/day)
  const chartPoints = (forecast.trajectory ?? []).filter((_, i) => i % 4 === 0);
  const allChartValues = chartPoints.flatMap((p) => [p.q05, p.q95, p.q50]);
  const minVal = allChartValues.length > 0 ? Math.min(...allChartValues, forecast.anchor_gwl) : forecast.anchor_gwl;
  const maxVal = allChartValues.length > 0 ? Math.max(...allChartValues, forecast.anchor_gwl) : forecast.anchor_gwl;
  const range = maxVal - minVal || 1;

  const dirLabel = forecast.direction?.label ?? "stable";
  const dirColor = DIRECTION_COLORS[dirLabel] ?? colors.textSecondary;
  const confLevel = forecast.overall_confidence?.level ?? "LOW";
  const confColor =
    CONFIDENCE_COLORS[confLevel] ?? colors.textMuted;

  const changeSign = (forecast.direction?.change_q50_30d ?? 0) > 0 ? "+" : "";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forecast</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {forecast.station}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Headline: direction + confidence ── */}
        <View style={styles.headlineCard}>
          <View style={styles.headlineRow}>
            <Text
              style={[styles.headlineDirection, { color: dirColor }]}
            >
              {dirLabel.charAt(0).toUpperCase() +
                dirLabel.slice(1)}
            </Text>
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: confColor + "18" },
              ]}
            >
              <Text style={[styles.confidenceBadgeText, { color: confColor }]}>
                {confLevel}
              </Text>
            </View>
          </View>
          <Text style={styles.headlineReason}>
            {forecast.overall_confidence?.reason ?? ""}
          </Text>
          <View style={styles.anchorRow}>
            <Text style={styles.anchorLabel}>Anchor</Text>
            <Text style={styles.anchorValue}>{forecast.anchor_gwl} m</Text>
            <Text style={styles.anchorDate}>
              {formatIstDateTime(forecast.anchor_time)} IST
            </Text>
          </View>
        </View>

        {/* ── Chart: trajectory line + q05/q95 band ── */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>30-Day Trajectory</Text>
          {/* Confidence legend */}
          <View style={styles.legendRow}>
            {(["HIGH", "DIRECTIONAL", "LOW"] as const).map((level) => (
              <View key={level} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: CONFIDENCE_COLORS[level] }]} />
                <Text style={styles.legendText}>{level}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chartArea}>
            {/* q05–q95 band */}
            <View style={styles.chartBars}>
              {chartPoints.map((p, i) => {
                const yLow = ((p.q05 - minVal) / range) * 100;
                const yHigh = ((p.q95 - minVal) / range) * 100;
                const bandHeight = yHigh - yLow;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.chartColumn}
                    onPress={() => setSelectedPoint(selectedPoint === i ? null : i)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.chartBand,
                        {
                          bottom: `${yLow}%`,
                          height: `${bandHeight}%`,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* q50 dots — colored by confidence_level */}
            <View style={styles.chartDots}>
              {chartPoints.map((p, i) => {
                const y = ((p.q50 - minVal) / range) * 100;
                const normalizedConf = (p.confidence_level ?? "").toUpperCase();
                const dotColor = CONFIDENCE_COLORS[normalizedConf] ?? CONFIDENCE_COLORS[p.confidence_level] ?? colors.textMuted;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.chartDotTouch, { bottom: `${y}%` }]}
                    onPress={() => setSelectedPoint(selectedPoint === i ? null : i)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.chartDot,
                        {
                          backgroundColor: dotColor,
                          width: selectedPoint === i ? 11 : 7,
                          height: selectedPoint === i ? 11 : 7,
                          marginLeft: selectedPoint === i ? -5.5 : -3.5,
                          borderRadius: selectedPoint === i ? 5.5 : 3.5,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Anchor line */}
            <View
              style={[
                styles.anchorLine,
                {
                  bottom: `${((forecast.anchor_gwl - minVal) / range) * 100}%`,
                },
              ]}
            >
              <Text style={styles.anchorLineLabel}>Anchor</Text>
            </View>
          </View>
          <View style={styles.chartLabels}>
            {chartPoints.length > 0 && (
              <>
                <Text style={styles.chartLabelText}>
                  {formatIstShort(chartPoints[0].time)}
                </Text>
                <Text style={styles.chartLabelText}>
                  {formatIstShort(chartPoints[chartPoints.length - 1].time)}
                </Text>
              </>
            )}
          </View>

          {/* Selected point info panel */}
          {selectedPoint !== null && chartPoints[selectedPoint] && (
            <View style={styles.pointInfoPanel}>
              <View style={styles.pointInfoHeader}>
                <Text style={styles.pointInfoTime}>
                  {formatIstDateTime(chartPoints[selectedPoint].time)}
                </Text>
                <TouchableOpacity onPress={() => setSelectedPoint(null)}>
                  <Text style={styles.pointInfoClose}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pointInfoRow}>
                <Text style={styles.pointInfoLabel}>Level (q50)</Text>
                <Text style={styles.pointInfoValue}>{chartPoints[selectedPoint].q50.toFixed(3)} m</Text>
              </View>
              <View style={styles.pointInfoRow}>
                <Text style={styles.pointInfoLabel}>90% Band</Text>
                <Text style={styles.pointInfoValue}>
                  {chartPoints[selectedPoint].q05.toFixed(3)} to {chartPoints[selectedPoint].q95.toFixed(3)}
                </Text>
              </View>
              <View style={styles.pointInfoRow}>
                <Text style={styles.pointInfoLabel}>Confidence</Text>
                {(() => {
                  const selConf = (chartPoints[selectedPoint].confidence_level ?? "").toUpperCase();
                  const selConfColor = CONFIDENCE_COLORS[selConf] ?? CONFIDENCE_COLORS[chartPoints[selectedPoint].confidence_level] ?? colors.textMuted;
                  return (
                    <View style={[styles.pointConfBadge, { backgroundColor: selConfColor + "18" }]}>
                      <Text style={[styles.pointConfText, { color: selConfColor }]}>
                        {chartPoints[selectedPoint].confidence_level}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <View style={styles.pointInfoRow}>
                <Text style={styles.pointInfoLabel}>Driver source</Text>
                <Text style={styles.pointInfoValue} numberOfLines={2}>
                  {chartPoints[selectedPoint].driver_source}
                </Text>
              </View>
              <View style={[styles.pointInfoRow, styles.pointInfoRowLast]}>
                <Text style={styles.pointInfoLabel}>Why this rating</Text>
                <Text style={styles.pointInfoValue} numberOfLines={3}>
                  {chartPoints[selectedPoint].reliability_reason}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── 30-Day Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>30-Day Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Level</Text>
              <Text style={styles.summaryStatValue}>
                {forecast.trajectory_30d?.level?.toFixed(2) ?? "—"} m
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Change</Text>
              <Text
                style={[
                  styles.summaryStatValue,
                  {
                    color:
                      dirLabel === "expected rise" || dirLabel === "rising"
                        ? colors.positive
                        : dirLabel === "expected decline" || dirLabel === "declining"
                        ? colors.negative
                        : colors.textPrimary,
                  },
                ]}
              >
                {changeSign}
                {forecast.trajectory_30d?.change?.toFixed(2) ?? "—"} m
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>90% Band</Text>
              <Text style={styles.summaryStatValue}>
                {forecast.trajectory_30d?.q05?.toFixed(2) ?? "—"} to{" "}
                {forecast.trajectory_30d?.q95?.toFixed(2) ?? "—"}
              </Text>
            </View>
          </View>
          {forecast.endpoint_production.level != null && (
            <View style={styles.endpointRow}>
              <Text style={styles.endpointLabel}>Production model</Text>
              <Text style={styles.endpointValue}>
                {forecast.endpoint_production.level.toFixed(2)} m
                {forecast.endpoint_production.band_half != null
                  ? ` ±${forecast.endpoint_production.band_half.toFixed(2)}`
                  : ""}
              </Text>
            </View>
          )}
        </View>

        {/* ── Evidence ── */}
        <View style={styles.evidenceCard}>
          <Text style={styles.cardTitle}>Evidence</Text>
          <View style={styles.evidenceGrid}>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Integrity</Text>
              <View style={styles.evidenceBadgeRow}>
                <View
                  style={[
                    styles.evidenceBadge,
                    {
                      backgroundColor:
                        ((forecast.evidence?.station_integrity?.integrity ?? 0) >= 0.6
                          ? colors.positive
                          : colors.negative) + "18",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.evidenceBadgeText,
                      {
                        color:
                          (forecast.evidence?.station_integrity?.integrity ?? 0) >= 0.6
                            ? colors.positive
                            : colors.negative,
                      },
                    ]}
                  >
                    {((forecast.evidence?.station_integrity?.integrity ?? 0) * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.evidenceSubtext}>
                {forecast.evidence?.station_integrity?.integrity_reason ?? ""}
              </Text>
            </View>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Recency</Text>
              <Text style={styles.evidenceValue}>
                {forecast.evidence?.recency_days ?? "—"}d ago
              </Text>
              <Text style={styles.evidenceSubtext}>
                {((forecast.evidence?.recent90_coverage ?? 0) * 100).toFixed(0)}% 90d
                coverage
              </Text>
            </View>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Stability</Text>
              <Text style={styles.evidenceValue}>
                {forecast.evidence?.stability_oscillation ?? "—"} flips
              </Text>
              <Text style={styles.evidenceSubtext}>
                {(forecast.evidence?.station_integrity?.stability ?? 0) >= 1.0
                  ? "Stable trajectory"
                  : "Oscillating"}
              </Text>
            </View>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Anchor OOD</Text>
              <Text
                style={[
                  styles.evidenceValue,
                  {
                    color: forecast.evidence?.anchor_ood
                      ? colors.warning
                      : colors.positive,
                  },
                ]}
              >
                {forecast.evidence?.anchor_ood ? "Yes" : "No"}
              </Text>
              <Text style={styles.evidenceSubtext}>
                {forecast.evidence?.anchor_ood
                  ? "Outside training range"
                  : "Within training range"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Model info ── */}
        <View style={styles.modelCard}>
          <Text style={styles.cardTitle}>Model</Text>
          <Text style={styles.modelText}>{forecast.model}</Text>
          {forecast.direction.sign_accuracy_30d != null && (
            <Text style={styles.modelSubtext}>
              Sign accuracy: {(forecast.direction.sign_accuracy_30d * 100).toFixed(0)}%
            </Text>
          )}
          {forecast.direction.agreement_with_production != null && (
            <Text style={[styles.modelSubtext, {
              color: forecast.direction.agreement_with_production ? colors.positive : colors.warning,
            }]}>
              {forecast.direction.agreement_with_production
                ? "Agrees with production model"
                : "Differs from production model"}
            </Text>
          )}
          {forecast.overall_confidence.endpoint_match != null && (
            <Text style={styles.modelSubtext}>
              Endpoint match: {forecast.overall_confidence.endpoint_match ? "Yes" : "No"}
            </Text>
          )}
        </View>
      </ScrollView>
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
  backBtn: {
    ...typography.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  headerTitle: { ...typography.heading, color: colors.textPrimary },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
    gap: spacing.md,
  },
  // ── Headline ──
  headlineCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headlineDirection: {
    ...typography.heading,
    fontSize: 22,
    textTransform: "capitalize",
  },
  confidenceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  confidenceBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
  },
  headlineReason: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  anchorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  anchorLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  anchorValue: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  anchorDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: "auto",
  },
  // ── Chart ──
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  chartTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  chartArea: {
    height: 200,
    position: "relative",
  },
  chartBars: {
    flexDirection: "row",
    flex: 1,
    gap: 1,
    position: "relative",
    zIndex: 0,
  },
  chartColumn: {
    flex: 1,
    position: "relative",
  },
  chartBand: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.chartBand,
    borderRadius: 1,
  },
  chartDots: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 1,
  },
  chartDot: {
    position: "absolute",
    left: "50%",
    backgroundColor: colors.primary,
  },
  chartDotTouch: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 24,
    justifyContent: "center",
  },
  anchorLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.warning,
  },
  anchorLineLabel: {
    position: "absolute",
    right: 0,
    top: -14,
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  chartLabelText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  // ── Point info panel ──
  pointInfoPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  pointInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pointInfoTime: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontSize: 13,
  },
  pointInfoClose: {
    fontSize: 20,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
  pointInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  pointInfoRowLast: {
    alignItems: "flex-start",
  },
  pointInfoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    flexShrink: 0,
  },
  pointInfoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 11,
    textAlign: "right",
    flex: 1,
  },
  pointConfBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pointConfText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  // ── 30-Day Summary ──
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
  },
  summaryStatValue: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
  },
  endpointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  endpointLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  endpointValue: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  // ── Evidence ──
  evidenceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  evidenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  evidenceItem: {
    width: "48%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  evidenceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
  },
  evidenceBadgeRow: {
    flexDirection: "row",
  },
  evidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  evidenceBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 11,
  },
  evidenceValue: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  evidenceSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  // ── Model ──
  modelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  modelText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modelSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
});
