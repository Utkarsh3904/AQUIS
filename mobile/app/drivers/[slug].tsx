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
import Svg, { Polyline, Line, G, Rect, Text as SvgText } from "react-native-svg";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import {
  useStationFactsBySlug,
  useForecast,
  useStationSeries,
  useStations,
} from "../../lib/hooks";
import BottomNavBar from "../../components/BottomNavBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

const CHART_HORIZONTAL_PADDING = 16;
const CHART_WIDTH = SCREEN_W - CHART_HORIZONTAL_PADDING * 2;
const CHART_HEIGHT = 140;
const CHART_PADDING = { top: 16, right: 12, bottom: 20, left: 12 };

const DRIVER_CONFIG: Record<
  string,
  { label: string; description: string; unit: string; color: string }
> = {
  rain: {
    label: "Rain Accumulation",
    description: "Rainfall (mm) vs Aquifer GWL (mbgl)",
    unit: "mm",
    color: "#3B82F6",
  },
  temp: {
    label: "Air Temperature",
    description: "Ambient temperature (\u00B0C) vs Aquifer GWL",
    unit: "\u00B0C",
    color: "#EF4444",
  },
  river_level: {
    label: "River Stage",
    description: "River water level (m) vs Aquifer GWL",
    unit: "m",
    color: "#0EA5E9",
  },
  humidity: {
    label: "Relative Humidity",
    description: "Ambient vapor (%) vs Aquifer GWL",
    unit: "%",
    color: "#8B5CF6",
  },
  solar: {
    label: "Solar Radiation",
    description: "MODIS Surface (MJ/m\u00B2/day) vs Aquifer GWL",
    unit: "MJ/m\u00B2/d",
    color: "#F59E0B",
  },
  wind_speed: {
    label: "Surface Wind Speed",
    description: "Anemometer (km/h) vs Aquifer GWL",
    unit: "km/h",
    color: "#6366F1",
  },
  pressure: {
    label: "Barometric Pressure",
    description: "Atmospheric head (hPa) vs Aquifer GWL",
    unit: "hPa",
    color: "#14B8A6",
  },
  canal_level: {
    label: "Canal Water Level",
    description: "Canal feeder level (m) vs Aquifer GWL",
    unit: "m",
    color: "#06B6D4",
  },
};

interface DriverInfo {
  key: string;
  label: string;
  description: string;
  unit: string;
  color: string;
  pairedCount: number;
  corr: number | null;
  pValue: number | null;
  n: number | null;
}

interface PairedPoint {
  time: string;
  ts: number;
  gwl: number;
  driver: number;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  const variance =
    arr.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (arr.length - 1);
  return Math.sqrt(variance) || 1;
}

function zScoreNormalize(values: number[]): number[] {
  const m = mean(values);
  const s = stddev(values);
  if (s === 0) return values.map(() => 0);
  return values.map((v) => (v - m) / s);
}

function getPairedData(
  points: any[],
  driverKey: string
): PairedPoint[] {
  const paired: PairedPoint[] = [];
  for (const pt of points) {
    const gwl = pt.gwl;
    const drv = pt[driverKey];
    if (
      gwl != null &&
      typeof gwl === "number" &&
      !isNaN(gwl) &&
      drv != null &&
      typeof drv === "number" &&
      !isNaN(drv)
    ) {
      const ts = new Date(pt.time).getTime();
      if (!isNaN(ts)) {
        paired.push({ time: pt.time, ts, gwl, driver: drv });
      }
    }
  }
  paired.sort((a, b) => a.ts - b.ts);
  return paired;
}

function SvgLineChart({
  pairedData,
  driverColor,
  chartWidth,
  chartHeight,
}: {
  pairedData: PairedPoint[];
  driverColor: string;
  chartWidth: number;
  chartHeight: number;
}) {
  const padding = CHART_PADDING;
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const gwlValues = pairedData.map((p) => p.gwl);
  const drvValues = pairedData.map((p) => p.driver);

  const gwlZ = zScoreNormalize(gwlValues);
  const drvZ = zScoreNormalize(drvValues);

  const allZ = [...gwlZ, ...drvZ];
  const zMin = Math.min(...allZ);
  const zMax = Math.max(...allZ);
  const zRange = zMax - zMin || 1;
  const zPad = zRange * 0.05;
  const yMin = zMin - zPad;
  const yMax = zMax + zPad;
  const yRange = yMax - yMin;

  const n = pairedData.length;

  const gwlPoints = gwlZ.map((z, i) => {
    const x = padding.left + (i / Math.max(n - 1, 1)) * plotW;
    const y = padding.top + ((yMax - z) / yRange) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const drvPoints = drvZ.map((z, i) => {
    const x = padding.left + (i / Math.max(n - 1, 1)) * plotW;
    const y = padding.top + ((yMax - z) / yRange) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = padding.top + (i / 4) * plotH;
    const zVal = yMax - (i / 4) * yRange;
    return { y, label: zVal.toFixed(1) };
  });

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {gridLines.map((gl, i) => (
        <G key={i}>
          <Line
            x1={padding.left}
            y1={gl.y}
            x2={chartWidth - padding.right}
            y2={gl.y}
            stroke={colors.border}
            strokeWidth={0.5}
            opacity={0.4}
          />
          <SvgText
            x={padding.left - 2}
            y={gl.y + 3}
            fontSize={8}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {gl.label}
          </SvgText>
        </G>
      ))}

      <Polyline
        points={gwlPoints.join(" ")}
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Polyline
        points={drvPoints.join(" ")}
        fill="none"
        stroke={driverColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {n <= 60 &&
        gwlZ.map((z, i) => {
          const x = padding.left + (i / Math.max(n - 1, 1)) * plotW;
          const y = padding.top + ((yMax - z) / yRange) * plotH;
          return (
            <G key={`gd-${i}`}>
              <Rect
                x={x - 2}
                y={y - 2}
                width={4}
                height={4}
                rx={2}
                fill={colors.primary}
              />
            </G>
          );
        })}

      {n <= 60 &&
        drvZ.map((z, i) => {
          const x = padding.left + (i / Math.max(n - 1, 1)) * plotW;
          const y = padding.top + ((yMax - z) / yRange) * plotH;
          return (
            <G key={`dd-${i}`}>
              <Rect
                x={x - 2}
                y={y - 2}
                width={4}
                height={4}
                rx={2}
                fill={driverColor}
              />
            </G>
          );
        })}
    </Svg>
  );
}

export default function DriversScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<"all" | string>("all");

  const { data: stations } = useStations();
  const { data: facts, loading: factsLoading } = useStationFactsBySlug(
    slug ?? null
  );
  const { data: forecast } = useForecast(slug ?? null);
  const { data: series, loading: seriesLoading } = useStationSeries(
    slug ?? null,
    { limit: 500 }
  );

  const station = useMemo(
    () => stations.find((s) => s.slug === slug) ?? null,
    [stations, slug]
  );

  const drivers: DriverInfo[] = useMemo(() => {
    const seriesDrivers: string[] = series?.drivers ?? [];
    const factsDrivers: Array<{
      driver: string;
      corr: number;
      p: number;
      n: number;
    }> = (facts as any)?.drivers ?? [];

    const factsMap = new Map(factsDrivers.map((d) => [d.driver, d]));
    const points = series?.points ?? [];

    return seriesDrivers.map((key) => {
      const config = DRIVER_CONFIG[key] ?? {
        label: key,
        description: key,
        unit: "",
        color: colors.textMuted,
      };

      const paired = getPairedData(points, key);

      const factsEntry = factsMap.get(key);

      return {
        key,
        label: config.label,
        description: config.description,
        unit: config.unit,
        color: config.color,
        pairedCount: paired.length,
        corr: factsEntry?.corr ?? null,
        pValue: factsEntry?.p ?? null,
        n: factsEntry?.n ?? null,
      };
    });
  }, [series, facts]);

  const driversWithData = useMemo(
    () => drivers.filter((d) => d.pairedCount >= 3),
    [drivers]
  );

  const displayedDrivers =
    activeFilter === "all"
      ? drivers
      : drivers.filter((d) => d.key === activeFilter);

  const level = facts?.last ?? 0;
  const change30d = facts?.forecast?.change_30d_pred ?? null;
  const day30Pred = facts?.forecast?.day30_pred ?? null;
  const hasForecast = day30Pred != null;

  const isLoading = factsLoading || seriesLoading;

  if (isLoading) {
    return (
      <View style={s.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading driver data...</Text>
        </View>
      </View>
    );
  }

  if (!series && !facts) {
    return (
      <View style={s.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>Driver Analysis</Text>
        </View>
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>No driver data available</Text>
          <Text style={s.emptyText}>
            Series data could not be loaded for this station.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>Driver Analysis</Text>
        </View>

        <View style={s.headerSection}>
          <View style={s.headerEyebrow}>
            <Text style={s.headerEyebrowText}>RECHARGE DRIVERS</Text>
            <View style={s.liveBadge}>
              <View style={s.liveBadgeDot} />
              <Text style={s.liveBadgeText}>Live Sync</Text>
            </View>
          </View>
          <Text style={s.stationName} numberOfLines={1} ellipsizeMode="tail">
            {facts?.station ?? station?.station ?? "Station"}
          </Text>
          <Text style={s.stationDistrict} numberOfLines={1} ellipsizeMode="tail">
            {facts?.district ?? station?.district ?? ""}
          </Text>
        </View>

        <View style={s.refCard}>
          <Text style={s.refLabel}>PRIMARY REFERENCE CURVE</Text>
          <View style={s.refValueRow}>
            <Text style={s.refValue}>{level.toFixed(2)}</Text>
            <Text style={s.refUnit}>mbgl</Text>
            {hasForecast && change30d != null && (
              <View
                style={[
                  s.refDeltaBadge,
                  {
                    backgroundColor:
                      change30d >= 0 ? colors.positiveBg : colors.negativeBg,
                  },
                ]}
              >
                <Text
                  style={[
                    s.refDeltaText,
                    {
                      color:
                        change30d >= 0
                          ? colors.positiveText
                          : colors.negativeText,
                    },
                  ]}
                >
                  {change30d >= 0 ? "+" : ""}
                  {change30d.toFixed(2)}m recharge
                </Text>
              </View>
            )}
          </View>

          <View style={s.refMetaRow}>
            <View style={s.refMetaItem}>
              <Text style={s.refMetaLabel}>Target Aquifer</Text>
              <Text style={s.refMetaValue}>GWL (mbgl)</Text>
            </View>
            <View style={s.refMetaItem}>
              <Text style={s.refMetaLabel}>Driver Variable</Text>
              <Text style={s.refMetaValue}>Z-Score Normalized</Text>
            </View>
          </View>

          {!hasForecast && (
            <View style={s.forecastNote}>
              <Text style={s.forecastNoteText}>
                30-day forecast not available for this station
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsScroll}
        >
          <TouchableOpacity
            style={[
              s.filterChip,
              activeFilter === "all" && s.filterChipActive,
            ]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                s.filterChipText,
                activeFilter === "all" && s.filterChipTextActive,
              ]}
            >
              All Drivers ({drivers.length})
            </Text>
          </TouchableOpacity>
          {driversWithData.length > 0 && (
            <TouchableOpacity
              style={[s.filterChip, s.filterChipWithData]}
              onPress={() => setActiveFilter("all")}
            >
              <View
                style={[s.filterChipDot, { backgroundColor: colors.positive }]}
              />
              <Text style={s.filterChipText}>
                With Data ({driversWithData.length})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {displayedDrivers
          .map((driver) => {
            const points = series?.points ?? [];
            const paired = getPairedData(points, driver.key);

            const corrLabel =
              driver.corr != null
                ? `r=${driver.corr >= 0 ? "+" : ""}${driver.corr.toFixed(3)}`
                : null;
            const pLabel =
              driver.pValue != null
                ? driver.pValue < 0.001
                  ? "p<0.001"
                  : `p=${driver.pValue.toFixed(3)}`
                : null;

            return (
              <View key={driver.key} style={s.driverCard}>
                <View style={s.driverCardHeader}>
                  <View
                    style={[s.driverColorDot, { backgroundColor: driver.color }]}
                  />
                  <View style={s.driverCardHeaderLeft}>
                    <Text style={s.driverCardTitle}>{driver.label}</Text>
                    <Text style={s.driverCardDesc}>{driver.description}</Text>
                  </View>
                  <View style={s.driverDataBadge}>
                    <Text style={s.driverDataBadgeText}>
                      {paired.length} paired pts
                    </Text>
                  </View>
                </View>

                <View style={s.legendRow}>
                  <View style={s.legendItem}>
                    <View
                      style={[s.legendLine, { backgroundColor: colors.primary }]}
                    />
                    <Text style={s.legendText}>GWL (z-score)</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View
                      style={[s.legendLine, { backgroundColor: driver.color }]}
                    />
                    <Text style={s.legendText}>
                      {driver.label} (z-score)
                    </Text>
                  </View>
                </View>

                <View style={s.chartContainer}>
                  <SvgLineChart
                    pairedData={paired}
                    driverColor={driver.color}
                    chartWidth={CHART_WIDTH - spacing.lg * 2}
                    chartHeight={CHART_HEIGHT}
                  />
                </View>

                <View style={s.chartXLabels}>
                  <Text style={s.chartXLabel}>
                    {paired[0]?.time?.split("T")[0] ?? "Start"}
                  </Text>
                  <Text style={s.chartXLabel}>
                    {paired[Math.floor(paired.length / 2)]?.time?.split("T")[0] ?? "Mid"}
                  </Text>
                  <Text style={s.chartXLabel}>
                    {paired[paired.length - 1]?.time?.split("T")[0] ?? "Now"}
                  </Text>
                </View>

                <View style={s.zScoreNote}>
                  <Text style={s.zScoreNoteText}>
                    Z-score standardized: both series normalized to [mean=0,
                    stddev=1] for visual comparison
                  </Text>
                </View>

                {(corrLabel || pLabel || driver.n != null) && (
                  <View style={s.corrRow}>
                    {corrLabel && (
                      <View style={s.corrBadge}>
                        <Text style={s.corrBadgeText}>{corrLabel}</Text>
                      </View>
                    )}
                    {pLabel && (
                      <View style={s.corrBadge}>
                        <Text style={s.corrBadgeText}>{pLabel}</Text>
                      </View>
                    )}
                    {driver.n != null && (
                      <View style={s.corrBadge}>
                        <Text style={s.corrBadgeText}>n={driver.n}</Text>
                      </View>
                    )}
                  </View>
                )}

                {!corrLabel && !pLabel && driver.n == null && (
                  <View style={s.corrRow}>
                    <View style={[s.corrBadge, s.corrBadgeMuted]}>
                      <Text style={[s.corrBadgeText, s.corrBadgeTextMuted]}>
                        Correlation: N/A (facts unavailable)
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

        {displayedDrivers.filter((d) => d.pairedCount < 3).length > 0 && (
          <View style={s.insufficientCard}>
            <View style={s.insufficientHeader}>
              <Text style={s.insufficientIcon}>⚠</Text>
              <Text style={s.insufficientTitle}>Insufficient Data for Charts</Text>
            </View>
            <Text style={s.insufficientText}>
              The following parameters lack enough paired observations (need ≥3)
              with GWL to generate a chart at this station:
            </Text>
            {displayedDrivers
              .filter((d) => d.pairedCount < 3)
              .map((d) => (
                <View key={d.key} style={s.insufficientRow}>
                  <View
                    style={[s.insufficientDot, { backgroundColor: d.color }]}
                  />
                  <Text style={s.insufficientParam}>{d.label}</Text>
                  <Text style={s.insufficientCount}>
                    {d.pairedCount === 0
                      ? "No data"
                      : `${d.pairedCount} pt${d.pairedCount !== 1 ? "s" : ""}`}
                  </Text>
                </View>
              ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: BOTTOM_NAV_CLEARANCE },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  backArrow: { fontSize: 18, color: colors.textPrimary },
  topTitle: { ...typography.headlineSm, color: colors.textPrimary },

  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: { ...typography.body, color: colors.textMuted },

  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },

  headerSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerEyebrowText: {
    ...typography.statLabel,
    color: colors.primary,
    letterSpacing: 0.06,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.positive,
  },
  liveBadgeText: {
    ...typography.bodySm,
    color: colors.positive,
    fontWeight: "600",
    fontSize: 10,
  },
  stationName: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  stationDistrict: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },

  refCard: {
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refLabel: {
    ...typography.statLabel,
    color: colors.textSecondary,
    letterSpacing: 0.06,
    marginBottom: spacing.sm,
  },
  refValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  refValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  refUnit: { ...typography.body, color: colors.textMuted },
  refDeltaBadge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  refDeltaText: { ...typography.labelSm, fontWeight: "700", fontSize: 11 },
  refMetaRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  refMetaItem: { flex: 1 },
  refMetaLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  refMetaValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 11,
  },
  forecastNote: {
    marginTop: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  forecastNoteText: {
    ...typography.bodySm,
    color: colors.warningText,
    fontSize: 11,
  },

  chipsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipWithData: {
    borderColor: colors.positiveBorder,
  },
  filterChipDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  filterChipTextActive: { color: colors.onPrimary },

  driverCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  driverColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverCardHeaderLeft: { flex: 1 },
  driverCardTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  driverCardDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 11,
  },
  driverDataBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  driverDataBadgeText: {
    ...typography.labelSm,
    color: colors.textSecondary,
    fontSize: 10,
  },

  legendRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 10,
  },

  chartContainer: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },

  chartXLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  chartXLabel: {
    ...typography.codeMono,
    color: colors.textMuted,
    fontSize: 9,
  },

  zScoreNote: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  zScoreNoteText: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 9,
    fontStyle: "italic",
  },

  noDataChart: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noDataChartTitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  noDataChartSubtext: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
  },
  noDataChartHint: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 9,
    fontStyle: "italic",
    textAlign: "center",
  },

  corrRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  corrBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  corrBadgeMuted: {
    backgroundColor: colors.divider,
  },
  corrBadgeText: {
    ...typography.labelSm,
    color: colors.textSecondary,
    fontSize: 10,
  },
  corrBadgeTextMuted: {
    color: colors.textMuted,
  },

  insufficientCard: {
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insufficientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  insufficientIcon: {
    fontSize: 14,
  },
  insufficientTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  insufficientText: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  insufficientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  insufficientDot: { width: 6, height: 6, borderRadius: 3 },
  insufficientParam: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flex: 1,
  },
  insufficientCount: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
  },
});
