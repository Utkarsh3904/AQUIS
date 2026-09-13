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
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import {
  useStationFactsBySlug,
  useForecast,
  useStationSeries,
  useStations,
} from "../../lib/hooks";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

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
    description: "Ambient temperature (°C) vs Aquifer GWL",
    unit: "°C",
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
    description: "MODIS Surface (MJ/m²/day) vs Aquifer GWL",
    unit: "MJ/m²/d",
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
  hasData: boolean;
  nonNullCount: number;
  corr: number | null;
  pValue: number | null;
  n: number | null;
}

function DualAxisChart({
  gwlPoints,
  driverPoints,
  driverColor,
  gwlColor,
  height,
}: {
  gwlPoints: Array<{ time: string; value: number }>;
  driverPoints: Array<{ time: string; value: number }>;
  driverColor: string;
  gwlColor?: string;
  height?: number;
}) {
  const chartH = height ?? 120;

  if (gwlPoints.length === 0 || driverPoints.length === 0) return null;

  const gwlVals = gwlPoints.map((p) => p.value);
  const drvVals = driverPoints.map((p) => p.value);

  const gwlMin = Math.min(...gwlVals);
  const gwlMax = Math.max(...gwlVals);
  const drvMin = Math.min(...drvVals);
  const drvMax = Math.max(...drvVals);

  const gwlRange = gwlMax - gwlMin || 1;
  const drvRange = drvMax - drvMin || 1;
  const gwlPad = gwlRange * 0.1;
  const drvPad = drvRange * 0.1;

  const combinedMin = Math.min(gwlMin - gwlPad, drvMin - drvPad);
  const combinedMax = Math.max(gwlMax + gwlPad, drvMax + drvPad);
  const combinedRange = combinedMax - combinedMin || 1;

  const totalPts = Math.max(gwlPoints.length, driverPoints.length);

  const gwlNorm = gwlPoints.map((p, i) => ({
    x: (i / Math.max(totalPts - 1, 1)) * 94 + 3,
    y: ((p.value - combinedMin) / combinedRange) * (chartH - 20) + 10,
  }));

  const drvNorm = driverPoints.map((p, i) => ({
    x: (i / Math.max(totalPts - 1, 1)) * 94 + 3,
    y: ((p.value - combinedMin) / combinedRange) * (chartH - 20) + 10,
  }));

  return (
    <View style={[chartStyles.chartArea, { height: chartH }]}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[chartStyles.gridLine, { top: `${(i / 3) * 85 + 7}%` }]}
        />
      ))}

      {gwlNorm.map((pt, i) => (
        <View
          key={`g-${i}`}
          style={[
            chartStyles.gwlDot,
            { left: `${pt.x}%`, top: pt.y },
          ]}
        />
      ))}

      {drvNorm.map((pt, i) => (
        <View
          key={`d-${i}`}
          style={[
            chartStyles.driverDot,
            {
              left: `${pt.x}%`,
              top: pt.y,
              backgroundColor: driverColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  chartArea: {
    position: "relative",
    marginBottom: spacing.sm,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.4,
  },
  gwlDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginLeft: -2,
    marginTop: -2,
  },
  driverDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    marginTop: -2,
  },
});

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

    const factsMap = new Map(
      factsDrivers.map((d) => [d.driver, d])
    );

    return seriesDrivers.map((key) => {
      const config = DRIVER_CONFIG[key] ?? {
        label: key,
        description: key,
        unit: "",
        color: colors.textMuted,
      };

      const points = series?.points ?? [];
      let nonNullCount = 0;
      for (const pt of points) {
        const val = (pt as any)[key];
        if (val != null && typeof val === "number" && !isNaN(val)) {
          nonNullCount++;
        }
      }

      const factsEntry = factsMap.get(key);

      return {
        key,
        label: config.label,
        description: config.description,
        unit: config.unit,
        color: config.color,
        hasData: nonNullCount >= 2,
        nonNullCount,
        corr: factsEntry?.corr ?? null,
        pValue: factsEntry?.p ?? null,
        n: factsEntry?.n ?? null,
      };
    });
  }, [series, facts]);

  const driversWithData = useMemo(
    () => drivers.filter((d) => d.hasData),
    [drivers]
  );

  const displayedDrivers =
    activeFilter === "all" ? drivers : drivers.filter((d) => d.key === activeFilter);

  const level = facts?.last ?? 0;
  const anchorGwl = forecast?.anchor_gwl ?? level;
  const change30d = facts?.forecast?.change_30d_pred ?? null;
  const direction = facts?.forecast?.direction ?? null;
  const day30Pred = facts?.forecast?.day30_pred ?? null;
  const bandHalf = facts?.forecast?.band_half ?? null;
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
          <Text style={s.stationName}>
            {facts?.station ?? station?.station ?? "Station"}
          </Text>
          <Text style={s.stationDistrict}>
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
              <Text style={s.refMetaValue}>Normalized</Text>
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
              style={[
                s.filterChip,
                activeFilter === "__withdata" && s.filterChipActive,
              ]}
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
          {drivers
            .filter((d) => !d.hasData)
            .map((d) => (
              <TouchableOpacity
                key={d.key}
                style={s.filterChip}
                onPress={() =>
                  setActiveFilter(activeFilter === d.key ? "all" : d.key)
                }
              >
                <Text style={s.filterChipText}>{d.label}</Text>
                <Text style={s.filterChipDim}>Sparse</Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        {displayedDrivers.map((driver) => {
          const points = series?.points ?? [];
          const gwlPoints: Array<{ time: string; value: number }> = [];
          const driverPoints: Array<{ time: string; value: number }> = [];

          for (const pt of points) {
            const gwl = (pt as any).gwl;
            const drv = (pt as any)[driver.key];
            if (gwl != null && typeof gwl === "number" && !isNaN(gwl)) {
              gwlPoints.push({ time: pt.time, value: gwl });
              if (drv != null && typeof drv === "number" && !isNaN(drv)) {
                driverPoints.push({ time: pt.time, value: drv });
              }
            }
          }

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
                {driver.hasData && (
                  <View style={s.driverDataBadge}>
                    <Text style={s.driverDataBadgeText}>
                      {driver.nonNullCount} pts
                    </Text>
                  </View>
                )}
              </View>

              <View style={s.driverAxisLabels}>
                <Text style={[s.axisLabel, { color: colors.primary }]}>
                  GWL: {gwlPoints.length > 0
                    ? `${Math.min(...gwlPoints.map((p) => p.value)).toFixed(2)} ... ${Math.max(...gwlPoints.map((p) => p.value)).toFixed(2)}`
                    : "—"}{" "}
                  mbgl
                </Text>
                <Text style={[s.axisLabel, { color: driver.color }]}>
                  {driver.label.split(" ")[0]}:{" "}
                  {driverPoints.length > 0
                    ? `${Math.min(...driverPoints.map((p) => p.value)).toFixed(1)} ... ${Math.max(...driverPoints.map((p) => p.value)).toFixed(1)}`
                    : "—"}{" "}
                  {driver.unit}
                </Text>
              </View>

              {driver.hasData ? (
                <DualAxisChart
                  gwlPoints={gwlPoints}
                  driverPoints={driverPoints}
                  driverColor={driver.color}
                  height={120}
                />
              ) : (
                <View style={s.noDataChart}>
                  <Text style={s.noDataChartText}>
                    Limited time-series data for this driver
                  </Text>
                  <Text style={s.noDataChartSubtext}>
                    {driver.nonNullCount} data point
                    {driver.nonNullCount !== 1 ? "s" : ""} available —
                    correlation analysis may still work with sufficient
                    observations
                  </Text>
                </View>
              )}

              <View style={s.chartXLabels}>
                <Text style={s.chartXLabel}>Start</Text>
                <Text style={s.chartXLabel}>Mid</Text>
                <Text style={s.chartXLabel}>Now</Text>
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

        {drivers.filter((d) => !d.hasData).length > 0 && (
          <View style={s.unavailableCard}>
            <Text style={s.unavailableTitle}>Not Available in Current Data</Text>
            <Text style={s.unavailableText}>
              The following driver columns exist in the API schema but have no
              usable time-series data for this station. These are NOT shown
              above.
            </Text>
            {drivers
              .filter((d) => !d.hasData)
              .map((d) => (
                <View key={d.key} style={s.unavailRow}>
                  <View
                    style={[
                      s.unavailDot,
                      { backgroundColor: colors.textMuted },
                    ]}
                  />
                  <Text style={s.unavailLabel}>{d.label}</Text>
                  <Text style={s.unavailCount}>
                    {d.nonNullCount} point{d.nonNullCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              ))}
          </View>
        )}

        <View style={s.notAvailableCard}>
          <Text style={s.notAvailTitle}>
            Drivers Not Available in API
          </Text>
          <Text style={s.notAvailText}>
            The reference design shows 12 drivers. The following 4 are NOT
            available in the current API schema and cannot be charted:
          </Text>
          {[
            "Evapotranspiration (ET₀)",
            "Soil Moisture (Root Zone)",
            "Vegetation Index (NDVI)",
            "Agri Tube Well Extraction",
          ].map((name) => (
            <View key={name} style={s.notAvailRow}>
              <Text style={s.notAvailX}>✕</Text>
              <Text style={s.notAvailName}>{name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  filterChipDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  filterChipTextActive: { color: colors.onPrimary },
  filterChipDim: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
  },

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

  driverAxisLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  axisLabel: {
    ...typography.codeMono,
    fontSize: 9,
  },

  noDataChart: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  noDataChartText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  noDataChartSubtext: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },

  chartXLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  chartXLabel: {
    ...typography.codeMono,
    color: colors.textMuted,
    fontSize: 9,
  },

  corrRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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

  unavailableCard: {
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unavailableTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  unavailableText: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  unavailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unavailDot: { width: 6, height: 6, borderRadius: 3 },
  unavailLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flex: 1,
  },
  unavailCount: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
  },

  notAvailableCard: {
    backgroundColor: colors.negativeBg,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.negativeBorder,
  },
  notAvailTitle: {
    ...typography.titleMd,
    color: colors.negativeText,
    marginBottom: spacing.xs,
  },
  notAvailText: {
    ...typography.bodySm,
    color: colors.negativeText,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  notAvailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  notAvailX: {
    ...typography.bodySm,
    color: colors.negative,
    fontWeight: "700",
    width: 14,
  },
  notAvailName: {
    ...typography.bodySm,
    color: colors.negativeText,
  },
});
