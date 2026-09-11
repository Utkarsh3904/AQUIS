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
import { spacing, radii } from "../../theme/spacing";
import { useForecast } from "../../lib/hooks";
import { EmptyState } from "../../components/EmptyState";
import { formatIstDateTime, formatIstShort } from "../../lib/timezone";

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: colors.positive,
  DIRECTIONAL: colors.warning,
  LOW: colors.negative,
};

const DIRECTION_COLORS: Record<string, string> = {
  "expected rise": colors.positive,
  "expected decline": colors.negative,
  stable: colors.textSecondary,
};

export default function ForecastScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { data: forecast, loading, error } = useForecast(slug ?? null);
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>
        <EmptyState title={errorTitle} message={errorMessage} />
      </View>
    );
  }

  // ── Chart data: subsample every 4th point (120 → 30 visual points, one/day)
  const chartPoints = forecast.trajectory.filter((_, i) => i % 4 === 0);
  const allChartValues = chartPoints.flatMap((p) => [p.q05, p.q95, p.q50]);
  const minVal = Math.min(...allChartValues, forecast.anchor_gwl);
  const maxVal = Math.max(...allChartValues, forecast.anchor_gwl);
  const range = maxVal - minVal || 1;

  const dirColor = DIRECTION_COLORS[forecast.direction.label] ?? colors.textSecondary;
  const confColor =
    CONFIDENCE_COLORS[forecast.overall_confidence.level] ?? colors.textMuted;

  const changeSign = forecast.direction.change_q50_30d > 0 ? "+" : "";

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
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
              {forecast.direction.label.charAt(0).toUpperCase() +
                forecast.direction.label.slice(1)}
            </Text>
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: confColor + "18" },
              ]}
            >
              <Text style={[styles.confidenceBadgeText, { color: confColor }]}>
                {forecast.overall_confidence.level}
              </Text>
            </View>
          </View>
          <Text style={styles.headlineReason}>
            {forecast.overall_confidence.reason}
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
                const dotColor = CONFIDENCE_COLORS[p.confidence_level] ?? colors.textMuted;
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
                          width: selectedPoint === i ? 9 : 5,
                          height: selectedPoint === i ? 9 : 5,
                          marginLeft: selectedPoint === i ? -4.5 : -2.5,
                          borderRadius: selectedPoint === i ? 4.5 : 2.5,
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
            <Text style={styles.chartLabelText}>
              {formatIstShort(chartPoints[0].time)}
            </Text>
            <Text style={styles.chartLabelText}>
              {formatIstShort(chartPoints[chartPoints.length - 1].time)}
            </Text>
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
                <View style={[styles.pointConfBadge, { backgroundColor: CONFIDENCE_COLORS[chartPoints[selectedPoint].confidence_level] + "18" }]}>
                  <Text style={[styles.pointConfText, { color: CONFIDENCE_COLORS[chartPoints[selectedPoint].confidence_level] }]}>
                    {chartPoints[selectedPoint].confidence_level}
                  </Text>
                </View>
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
                {forecast.trajectory_30d.level.toFixed(2)} m
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
                      forecast.direction.label === "expected rise"
                        ? colors.positive
                        : forecast.direction.label === "expected decline"
                        ? colors.negative
                        : colors.textPrimary,
                  },
                ]}
              >
                {changeSign}
                {forecast.trajectory_30d.change.toFixed(2)} m
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>90% Band</Text>
              <Text style={styles.summaryStatValue}>
                {forecast.trajectory_30d.q05.toFixed(2)} to{" "}
                {forecast.trajectory_30d.q95.toFixed(2)}
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
                        (forecast.evidence.station_integrity.integrity >= 0.6
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
                          forecast.evidence.station_integrity.integrity >= 0.6
                            ? colors.positive
                            : colors.negative,
                      },
                    ]}
                  >
                    {(forecast.evidence.station_integrity.integrity * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.evidenceSubtext}>
                {forecast.evidence.station_integrity.integrity_reason}
              </Text>
            </View>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Recency</Text>
              <Text style={styles.evidenceValue}>
                {forecast.evidence.recency_days}d ago
              </Text>
              <Text style={styles.evidenceSubtext}>
                {(forecast.evidence.recent90_coverage * 100).toFixed(0)}% 90d
                coverage
              </Text>
            </View>
            <View style={styles.evidenceItem}>
              <Text style={styles.evidenceLabel}>Stability</Text>
              <Text style={styles.evidenceValue}>
                {forecast.evidence.stability_oscillation} flips
              </Text>
              <Text style={styles.evidenceSubtext}>
                {forecast.evidence.station_integrity.stability >= 1.0
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
                    color: forecast.evidence.anchor_ood
                      ? colors.warning
                      : colors.positive,
                  },
                ]}
              >
                {forecast.evidence.anchor_ood ? "Yes" : "No"}
              </Text>
              <Text style={styles.evidenceSubtext}>
                {forecast.evidence.anchor_ood
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
    paddingBottom: spacing.xxxl,
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
    height: 20,
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
