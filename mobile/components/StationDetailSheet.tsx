import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { colors, typography } from "../theme/colors";
import { spacing, radii, elevation } from "../theme/spacing";
import { useStationSeries } from "../lib/hooks";
import type { StationDetailResponse } from "../types/api";
import type { ForecastResponse } from "../types/forecast";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Props {
  station: StationDetailResponse;
  forecast: ForecastResponse | null;
  onClose: () => void;
  onMoreInfo: () => void;
}

// Helper to format date string to "DD MMM, HH:MM"
function formatDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return "06 Sep, 18:00";
  try {
    const parts = dateStr.split(" ")[0].split("-");
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const month = monthNames[monthIdx] || "Sep";
    const time = dateStr.includes(" ") ? " " + dateStr.split(" ")[1].substring(0, 5) : ", 18:00";
    return `${day < 10 ? "0" + day : day} ${month}${time}`;
  } catch {
    return dateStr;
  }
}

function ZoneBadge({ zone }: { zone: string }) {
  const bg =
    zone === "safe"
      ? colors.positiveBg
      : zone === "watch"
      ? colors.warningBg
      : zone === "alert" || zone === "danger"
      ? colors.negativeBg
      : colors.surfaceContainerLow;
  const textColor =
    zone === "safe"
      ? colors.positiveText
      : zone === "watch"
      ? colors.warningText
      : zone === "alert" || zone === "danger"
      ? colors.negativeText
      : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>
        • {zone.toUpperCase()}
      </Text>
    </View>
  );
}

// MiniChart using real telemetry series points from GET /stations/<slug>/series
function MiniChart({ slug }: { slug: string | null }) {
  const { data: seriesData, loading } = useStationSeries(slug, { limit: 30 });

  const points = useMemo(() => {
    if (!seriesData?.points || seriesData.points.length === 0) return [];
    const recent = seriesData.points.slice(-7);
    const gwls = recent.map((p) => p.gwl ?? 0);
    const min = Math.min(...gwls);
    const max = Math.max(...gwls);
    const range = max - min || 1;
    return recent.map((p) => {
      const val = p.gwl ?? 0;
      return (val - min) / range;
    });
  }, [seriesData]);

  if (loading) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Loading real telemetry...</Text>
      </View>
    );
  }

  if (points.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>No historical series data available</Text>
      </View>
    );
  }

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartArea}>
        <View style={styles.dottedLine} />
        <View style={styles.columnsContainer}>
          {points.map((val, idx) => {
            const pct = val * 0.55 + 0.25;
            const isLast = idx === points.length - 1;
            return (
              <View
                key={idx}
                style={[
                  styles.chartColumn,
                  {
                    height: `${pct * 100}%`,
                    borderTopWidth: 2,
                    borderTopColor: colors.primary,
                  },
                ]}
              >
                {isLast && (
                  <View style={styles.highlightDotOuter}>
                    <View style={styles.highlightDotInner} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chartLabels}>
        {dayLabels.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.chartDayLabel,
              i === dayLabels.length - 1 && styles.chartDayLabelActive,
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function StationDetailSheet({ station, forecast, onClose, onMoreInfo }: Props) {
  const zone = useMemo(() => {
    if (!station) return "unknown";
    const f = station.forecast;
    if (!f) return "safe";
    if (!f.plausible) return "watch";
    if (f.high_uncertainty) return "watch";
    if ((f.direction === "expected decline" || f.direction === "declining") && Math.abs(f.change_30d_pred) > 0.5) return "alert";
    return "safe";
  }, [station]);

  const level = station.last;
  const lastDate = station.last_date;
  const median = station.district_context?.median;
  const change30d = station.forecast?.change_30d_pred ?? 0;
  const day30Pred = station.forecast?.day30_pred ?? null;
  const bandHalf = station.forecast?.band_half ?? 0;
  const q05 = station.forecast?.q05_level;
  const q95 = station.forecast?.q95_level;
  const direction = station.forecast?.direction ?? "stable";
  const isRising = direction === "expected rise";
  const changeLabel = change30d >= 0 ? `+${change30d.toFixed(2)}` : change30d.toFixed(2);

  const bandLow = q05 != null ? q05.toFixed(2) : (level - bandHalf).toFixed(2);
  const bandHigh = q95 != null ? q95.toFixed(2) : (level + bandHalf).toFixed(2);

  // Real median comparison logic
  const medianSubtitle = useMemo(() => {
    if (median == null) return "Groundwater observation point";
    const diff = level - median;
    if (Math.abs(diff) < 0.3) return "Near district median";
    if (diff > 0) return "Above district median";
    return "Below district median";
  }, [level, median]);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.waveIcon}>≋</Text>
            <Text style={styles.sheetTitle}>Water Level Status</Text>
          </View>
          <ZoneBadge zone={zone} />
        </View>

        <Text style={styles.stationIdLine}>
          {station.district?.toUpperCase() ?? "DISTRICT"} • {station.station?.toUpperCase() ?? "STATION"}
        </Text>

        <View style={styles.twoCards}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>WATER LEVEL</Text>
              <View style={styles.checkmarkCircle}>
                <Text style={styles.checkmarkSymbol}>✓</Text>
              </View>
            </View>
            <Text style={styles.kpiValueContainer}>
              <Text style={styles.kpiValue}>{level.toFixed(2)}</Text>
              <Text style={styles.kpiUnit}> mbgl</Text>
            </Text>
            <Text style={styles.kpiSub}>{medianSubtitle}</Text>
          </View>

          <View style={[styles.kpiCard, styles.kpiCardForecast]}>
            <View style={styles.kpiCardHeader}>
              <Text style={[styles.kpiLabel, { color: colors.primary }]}>30-DAY FORECAST</Text>
              <Text style={styles.kpiTrend}>📈</Text>
            </View>
            {day30Pred != null ? (
              <>
                <Text style={styles.kpiValueContainer}>
                  <Text style={[styles.kpiValue, { color: colors.primary }]}>{day30Pred.toFixed(3)}</Text>
                  <Text style={[styles.kpiUnit, { color: colors.primary }]}> mbgl</Text>
                </Text>
                <Text style={styles.forecastSub}>
                  <Text style={styles.forecastSubValue}>{changeLabel}m</Text>
                  <Text style={styles.forecastSubText}> {isRising ? "expected recharge" : "expected decline"}</Text>
                </Text>
              </>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.forecastSubText, { fontSize: 12 }]}>Forecast not available for this station</Text>
              </View>
            )}
          </View>
        </View>

        {forecast && (
          <View style={styles.calibrationRow}>
            <View style={styles.calibrationLeft}>
              <Text style={styles.calibrationIcon}>🎛️</Text>
              <Text style={styles.calibrationLabel}>90% Calibrated Band:</Text>
              <Text style={styles.calibrationValues}>
                [{bandLow}m, {bandHigh}m]
              </Text>
            </View>
            <View style={styles.mlBadge}>
              <Text style={styles.mlBadgeText}>XGBOOST ML</Text>
            </View>
          </View>
        )}

        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>
            HISTORICAL 7-DAY CURVE ({Math.abs(change30d).toFixed(2)}M AVG DEPTH) {formatDateString(lastDate)}
          </Text>
          <MiniChart slug={station.slug} />
        </View>

        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.7} onPress={onMoreInfo}>
          <Text style={styles.ctaText}>Get more station information</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: SCREEN_H * 0.72,
    ...elevation.high,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DCE9FF",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  waveIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "700",
  },
  sheetTitle: {
    ...typography.headlineSm,
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  stationIdLine: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.textMuted,
    letterSpacing: 0.06,
    marginBottom: spacing.lg,
  },
  twoCards: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: spacing.lg,
  },
  kpiCardForecast: {
    backgroundColor: "#EFF4FF",
  },
  kpiCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textSecondary,
    letterSpacing: 0.05,
  },
  checkmarkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.positive,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkSymbol: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  kpiTrend: {
    fontSize: 14,
  },
  kpiValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  kpiUnit: {
    fontSize: 14,
    color: colors.textMuted,
  },
  kpiSub: {
    fontSize: 11,
    color: colors.positiveText,
    fontWeight: "bold",
  },
  forecastSub: {
    fontSize: 11,
  },
  forecastSubValue: {
    color: colors.primary,
    fontWeight: "bold",
  },
  forecastSubText: {
    color: colors.textMuted,
  },
  calibrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  calibrationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  calibrationIcon: {
    fontSize: 14,
  },
  calibrationLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "bold",
  },
  calibrationValues: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: "bold",
  },
  mlBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  mlBadgeText: {
    color: colors.primary,
    fontWeight: "bold",
    fontSize: 10,
  },
  chartSection: {
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textSecondary,
    letterSpacing: 0.06,
    marginBottom: spacing.md,
  },
  chartContainer: {
    gap: spacing.xs,
  },
  chartArea: {
    height: 80,
    position: "relative",
  },
  dottedLine: {
    position: "absolute",
    top: 5,
    left: 0,
    right: 0,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  columnsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  chartColumn: {
    flex: 1,
    backgroundColor: "rgba(2, 132, 199, 0.06)",
    position: "relative",
  },
  highlightDotOuter: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.4)",
    zIndex: 10,
  },
  highlightDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  chartDayLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  chartDayLabelActive: {
    color: colors.primary,
    fontWeight: "bold",
  },
  chartPlaceholder: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
  },
  chartPlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ctaButton: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...elevation.medium,
  },
  ctaText: {
    fontSize: 16,
    color: colors.onPrimary,
    fontWeight: "bold",
  },
  ctaArrow: {
    fontSize: 18,
    color: colors.onPrimary,
    fontWeight: "bold",
  },
});
