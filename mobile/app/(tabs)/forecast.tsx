import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useStations,
  useFleetAlerts,
  useStationFactsBySlug,
  useForecast,
} from "../../lib/hooks";
import { colors, typography } from "../../theme/colors";
import {
  spacing,
  radii,
  elevation,
  BOTTOM_NAV_CLEARANCE,
} from "../../theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: colors.positive,
  high: colors.positive,
  DIRECTIONAL: colors.warning,
  directional: colors.warning,
  LOW: colors.negative,
  low: colors.negative,
};
const DIRECTION_COLORS: Record<string, string> = {
  "expected rise": colors.positive,
  "expected decline": colors.negative,
  stable: colors.textSecondary,
  rising: colors.positive,
  declining: colors.negative,
};

function formatIstShort(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.replace(" ", "T"));
    const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    const dd = ist.getUTCDate();
    const mon = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][ist.getUTCMonth()];
    const hh = String(ist.getUTCHours()).padStart(2, "0");
    const mm = String(ist.getUTCMinutes()).padStart(2, "0");
    return `${dd} ${mon} ${hh}:${mm} IST`;
  } catch {
    return iso;
  }
}

function pValLabel(p: number): string {
  if (p < 0.001) return "strong";
  if (p < 0.01) return "moderate";
  if (p < 0.05) return "notable";
  return "weak";
}

function strengthLabel(corr: number): string {
  const abs = Math.abs(corr);
  if (abs >= 0.6) return "strong";
  if (abs >= 0.3) return "moderate";
  return "weak";
}

function confLevelLabel(forecast: any): string {
  const oc = forecast?.overall_confidence?.level;
  if (oc) return oc.toUpperCase();
  const u = forecast?.uncertainty;
  if (!u) return "LOW";
  if (u < 0.3) return "HIGH";
  if (u < 0.6) return "DIRECTIONAL";
  return "LOW";
}

// ─── Continuous Forecast Chart ──────────────────────────────────────────
// Renders a continuous q50 line (rotated segments) + shaded q05–q95 envelope
function TrajectoryChart({
  trajectory,
  anchor,
}: {
  trajectory: any[];
  anchor: number;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  const CHART_H = 180;

  const data = useMemo(() => {
    if (!trajectory || trajectory.length < 2) return null;
    const pts = trajectory
      .filter(
        (p: any) =>
          p.q05 != null && p.q95 != null && p.q50 != null
      )
      .map((p: any, i: number) => ({
        q05: p.q05 as number,
        q50: p.q50 as number,
        q95: p.q95 as number,
        time: p.time as string,
        confidence: (p.confidence_level as string ?? "DIRECTIONAL").toUpperCase(),
        dayIndex: i,
      }));
    if (pts.length < 2) return null;

    // Compute real tier boundaries from confidence_level transitions
    const firstTime = new Date(pts[0].time).getTime();
    const ptsWithDays = pts.map((p) => ({
      ...p,
      day: Math.round((new Date(p.time).getTime() - firstTime) / (24 * 3600 * 1000)),
    }));

    // Find transition points
    let highEnd = 0;
    let directionalEnd = 0;
    let lastConf = ptsWithDays[0].confidence;
    for (const p of ptsWithDays) {
      if (lastConf === "HIGH" && p.confidence !== "HIGH") {
        highEnd = p.day;
      }
      if (lastConf !== "LOW" && p.confidence === "LOW") {
        directionalEnd = p.day;
      }
      lastConf = p.confidence;
    }
    // If no transitions found, use fallback boundaries
    if (highEnd === 0) highEnd = Math.min(14, Math.floor(ptsWithDays.length / 3));
    if (directionalEnd === 0) directionalEnd = Math.min(24, Math.floor(ptsWithDays.length * 2 / 3));

    const allVals = pts.flatMap((p) => [p.q05, p.q95, p.q50]);
    allVals.push(anchor);
    const vMin = Math.min(...allVals);
    const vMax = Math.max(...allVals);
    const pad = (vMax - vMin) * 0.15 || 0.5;
    const yMin = vMin - pad;
    const yMax = vMax + pad;
    const yRange = yMax - yMin;
    const totalPts = pts.length;

    return {
      pts,
      yMin,
      yMax,
      yRange,
      totalPts,
      highEnd,
      directionalEnd,
    };
  }, [trajectory, anchor]);

  if (!data) return null;

  const { pts, yMin, yRange, totalPts, highEnd, directionalEnd } = data;

  const toY = (v: number) =>
    ((v - yMin) / yRange) * (CHART_H - 20) + 10;
  const toX = (i: number) =>
    chartWidth > 0
      ? (i / Math.max(pts.length - 1, 1)) * (chartWidth - 8) + 4
      : 0;

  const yLabels = useMemo(() => {
    const gwls = pts.map((p) => p.q50);
    const min = Math.min(...gwls);
    const max = Math.max(...gwls);
    const range = max - min || 1;
    return [max, max - range * 0.33, max - range * 0.66, min].map((v) =>
      v.toFixed(2)
    );
  }, [pts]);

  // Build line segments for q50
  const lineSegments = useMemo(() => {
    if (chartWidth === 0) return [];
    return pts.slice(1).map((pt, i) => {
      const prev = pts[i];
      const x1 = toX(i);
      const y1 = toY(prev.q50);
      const x2 = toX(i + 1);
      const y2 = toY(pt.q50);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return { left: x1, top: y1, length, angle };
    });
  }, [pts, chartWidth]);

  // Build envelope band segments (q05 → q95 height at each point)
  const envelopeCols = useMemo(() => {
    if (chartWidth === 0) return [];
    const colW = Math.max(2, (chartWidth - 8) / pts.length);
    return pts.map((p, i) => {
      const x = toX(i);
      const yQ05 = toY(p.q05);
      const yQ95 = toY(p.q95);
      const top = Math.min(yQ05, yQ95);
      const height = Math.abs(yQ05 - yQ95);
      return { left: x - colW / 2, top, width: colW, height };
    });
  }, [pts, chartWidth]);

  // D+12 marker
  const d12Idx = Math.floor(pts.length * 12 / 30);

  return (
    <View style={chartStyles.wrap}>
      <View style={chartStyles.tierRow}>
        <View
          style={[
            chartStyles.tierBadge,
            { backgroundColor: colors.positiveBg },
          ]}
        >
          <Text
            style={[chartStyles.tierText, { color: colors.positiveText }]}
          >
            D1-{highEnd}: High Conf
          </Text>
        </View>
        <View
          style={[
            chartStyles.tierBadge,
            { backgroundColor: colors.warningBg },
          ]}
        >
          <Text
            style={[chartStyles.tierText, { color: colors.warningText }]}
          >
            D{highEnd + 1}-{directionalEnd}: Directional
          </Text>
        </View>
        <View
          style={[
            chartStyles.tierBadge,
            { backgroundColor: colors.negativeBg },
          ]}
        >
          <Text
            style={[chartStyles.tierText, { color: colors.negativeText }]}
          >
            D{directionalEnd + 1}-30: Wide
          </Text>
        </View>
      </View>

      <View
        style={chartStyles.chartArea}
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      >
        {chartWidth > 0 && (
          <>
            {/* Y-axis labels */}
            {yLabels.map((label, i) => (
              <Text
                key={i}
                style={[
                  chartStyles.yLabel,
                  { top: `${(i / 3) * 85 + 7}%` },
                ]}
              >
                {label}
              </Text>
            ))}

            {/* Grid lines */}
            {[0, 1, 2, 3].map((i) => (
              <View
                key={`g-${i}`}
                style={[
                  chartStyles.gridLine,
                  { top: `${(i / 3) * 85 + 7}%` },
                ]}
              />
            ))}

            {/* Envelope band (shaded q05–q95 area) */}
            {envelopeCols.map((col, i) => (
              <View
                key={`env-${i}`}
                style={{
                  position: "absolute",
                  left: col.left,
                  top: col.top,
                  width: col.width,
                  height: col.height,
                  backgroundColor: "rgba(2,132,199,0.10)",
                  borderRadius: 1,
                }}
              />
            ))}

            {/* Continuous q50 line (rotated segments) */}
            {lineSegments.map((seg, i) => (
              <View
                key={`line-${i}`}
                style={{
                  position: "absolute",
                  left: seg.left,
                  top: seg.top,
                  width: seg.length,
                  height: 2.5,
                  backgroundColor: colors.primary,
                  borderRadius: 1.25,
                  transform: [{ rotate: `${seg.angle}deg` }],
                  transformOrigin: "left center",
                }}
              />
            ))}

            {/* q50 dots */}
            {pts.map((p, i) => {
              const x = toX(i);
              const y = toY(p.q50);
              return (
                <View
                  key={`dot-${i}`}
                  style={{
                    position: "absolute",
                    left: x - 3,
                    top: y - 3,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
              );
            })}

            {/* D+12 marker */}
            {d12Idx > 0 && d12Idx < pts.length && (
              <View
                style={[
                  chartStyles.d12Label,
                  { left: toX(d12Idx) - 16 },
                ]}
              >
                <Text style={chartStyles.d12Text}>D+12</Text>
              </View>
            )}

            {/* Anchor dashed line */}
            <View
              style={[
                chartStyles.anchorLine,
                {
                  top: toY(pts[0].q50),
                  left: 0,
                  right: 0,
                },
              ]}
            />
          </>
        )}
      </View>

      <View style={chartStyles.xRow}>
        {["T-0", "D+12", "D+20", "D+30"].map((l, i) => (
          <Text key={i} style={chartStyles.xLabel}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Main Forecast Tab Screen ───────────────────────────────────────────
export default function ForecastTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { data: stations } = useStations();
  const { data: fleetAlerts } = useFleetAlerts();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(slug ?? null);
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-select station if slug param is provided
  useEffect(() => {
    if (slug && slug !== selectedSlug) {
      setSelectedSlug(slug);
    }
  }, [slug]);

  const { data: facts, loading: factsLoading } =
    useStationFactsBySlug(selectedSlug);
  const {
    data: forecast,
    loading: fcLoading,
    error: forecastError,
  } = useForecast(selectedSlug);

  const stationZoneMap = useMemo(() => {
    const m = new Map<string, string>();
    if (fleetAlerts?.alerts) {
      for (const a of fleetAlerts.alerts) {
        if (a.slug) m.set(a.slug, a.zone);
      }
    }
    return m;
  }, [fleetAlerts]);

  const stationCounts = useMemo(() => {
    let safe = 0,
      caution = 0;
    for (const s of stations) {
      const z = s.slug ? stationZoneMap.get(s.slug) : null;
      if (z === "alert" || z === "danger" || z === "unknown") caution++;
      else safe++;
    }
    return { safe, caution };
  }, [stations, stationZoneMap]);

  const filteredStations = useMemo(() => {
    let list = stations.filter((s) => s.slug);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [stations, searchQuery]);

  const [activeFilter, setActiveFilter] = useState<
    "all" | "safe" | "caution"
  >("all");
  const displayStations = useMemo(() => {
    if (activeFilter === "all") return filteredStations;
    return filteredStations.filter((s) => {
      const z = s.slug ? stationZoneMap.get(s.slug) : null;
      if (activeFilter === "caution")
        return z === "alert" || z === "danger" || z === "unknown";
      return z !== "alert" && z !== "danger" && z !== "unknown";
    });
  }, [filteredStations, activeFilter, stationZoneMap]);

  // ── Station selected: show forecast view ──
  if (selectedSlug) {
    const station = stations.find((s) => s.slug === selectedSlug);
    const isLoading = factsLoading || fcLoading;
    const hasError = !facts && !factsLoading;
    const hasForecastData = forecast != null && !forecastError;
    const hasForecastError = !fcLoading && forecastError != null;

    const level = facts?.last ?? 0;
    const forecastAny = forecast as any;
    const anchorGwl = forecastAny?.anchor_gwl ?? level;
    const anchorTime = forecastAny?.anchor_time ?? facts?.last_date ?? "";
    const day30Pred =
      forecast?.trajectory_30d?.level ??
      facts?.forecast?.day30_pred ??
      null;
    const change30d = facts?.forecast?.change_30d_pred ?? 0;
    const direction = facts?.forecast?.direction ?? "stable";
    const isRising =
      direction === "expected rise" || direction === "rising";
    const bandHalf = facts?.forecast?.band_half ?? 0;
    const q05 =
      facts?.forecast?.q05_level ?? (level - bandHalf);
    const q95 =
      facts?.forecast?.q95_level ?? (level + bandHalf);
    const trajectory = forecastAny?.trajectory ?? [];
    const confLevel = confLevelLabel(forecastAny);
    const confColor =
      CONFIDENCE_COLORS[confLevel] ?? colors.textMuted;
    const dirColor =
      DIRECTION_COLORS[direction] ?? colors.textSecondary;
    const changeLabel =
      change30d >= 0
        ? `+${change30d.toFixed(2)}`
        : change30d.toFixed(2);
    const drivers = (facts?.drivers ?? [])
      .slice()
      .sort(
        (a: any, b: any) =>
          Math.abs(b.corr) - Math.abs(a.corr)
      )
      .slice(0, 5);
    const zone =
      stationZoneMap.get(selectedSlug) ?? "unknown";
    const category =
      zone === "safe"
        ? "stable"
        : zone === "unknown"
        ? "unreliable"
        : zone;

    return (
      <View style={fcStyles.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <ScrollView
          contentContainerStyle={fcStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back button */}
          <View
            style={[
              fcStyles.topBar,
              { paddingTop: insets.top + spacing.sm },
            ]}
          >
            <TouchableOpacity
              onPress={() => setSelectedSlug(null)}
              style={fcStyles.backBtn}
            >
              <Text style={fcStyles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={fcStyles.topTitle}>30-Day Forecast</Text>
          </View>

          {/* Station name */}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            <View style={{ marginBottom: spacing.xs }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary, letterSpacing: 0.06 }}>
                FORECAST TRAJECTORY
              </Text>
            </View>
            <Text style={fcStyles.stationName} numberOfLines={1} ellipsizeMode="tail">
              {facts?.station ?? station?.station ?? "Station"}
            </Text>
            <Text style={fcStyles.stationDistrict} numberOfLines={1} ellipsizeMode="tail">
              {facts?.district ?? station?.district ?? ""}
            </Text>
          </View>

          {/* Live Telemetry toggle */}
          <View style={fcStyles.tabsRow}>
            <TouchableOpacity
              style={fcStyles.tabBtn}
              onPress={() => router.push(`/station/${selectedSlug}`)}
              activeOpacity={0.7}
            >
              <Text style={fcStyles.tabBtnText}>Live Telemetry</Text>
            </TouchableOpacity>
            <View style={[fcStyles.tabBtn, fcStyles.tabBtnActive]}>
              <Text style={[fcStyles.tabBtnText, fcStyles.tabBtnTextActive]}>30D Forecast</Text>
            </View>
          </View>

          {/* Filter chips (read-only) */}
          <View style={fcStyles.chipsRow}>
            <View
              style={[
                fcStyles.chip,
                { backgroundColor: colors.positiveBg },
              ]}
            >
              <View
                style={[
                  fcStyles.chipDot,
                  { backgroundColor: colors.positive },
                ]}
              />
              <Text
                style={[
                  fcStyles.chipText,
                  { color: colors.positiveText },
                ]}
              >
                Safe / Nominal
              </Text>
              <View
                style={[
                  fcStyles.chipCount,
                  {
                    backgroundColor:
                      colors.positiveBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    fcStyles.chipCountText,
                    { color: colors.positiveText },
                  ]}
                >
                  {stationCounts.safe}
                </Text>
              </View>
            </View>
            <View
              style={[
                fcStyles.chip,
                { backgroundColor: colors.negativeBg },
              ]}
            >
              <View
                style={[
                  fcStyles.chipDot,
                  { backgroundColor: colors.negative },
                ]}
              />
              <Text
                style={[
                  fcStyles.chipText,
                  { color: colors.negativeText },
                ]}
              >
                Caution / Depleting
              </Text>
              <View
                style={[
                  fcStyles.chipCount,
                  {
                    backgroundColor:
                      colors.negativeBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    fcStyles.chipCountText,
                    { color: colors.negativeText },
                  ]}
                >
                  {stationCounts.caution}
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={fcStyles.loadingBox}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
              <Text style={fcStyles.loadingText}>
                Loading forecast data...
              </Text>
            </View>
          ) : hasError ? (
            <View style={fcStyles.errorBox}>
              <Text style={fcStyles.errorTitle}>
                Station data unavailable
              </Text>
              <Text style={fcStyles.errorText}>
                This station's detail data is not available.
              </Text>
              <TouchableOpacity
                style={fcStyles.retryBtn}
                onPress={() => setSelectedSlug(null)}
              >
                <Text style={fcStyles.retryText}>
                  ← Back to station list
                </Text>
              </TouchableOpacity>
            </View>
          ) : facts ? (
            <>
              {/* Station Forecast Header */}
              <View style={fcStyles.sectionHeader}>
                <Text style={fcStyles.sectionTag}>
                  STATION FORECAST
                </Text>
                <Text style={fcStyles.sectionId}>
                  {selectedSlug
                    ?.split("-")
                    .pop()
                    ?.toUpperCase() ?? "—"}
                </Text>
                <Text style={fcStyles.sectionSync}>
                  Last Sync:{" "}
                  {formatIstShort(facts.last_date ?? "")}
                </Text>
              </View>
              <Text style={fcStyles.stationName} numberOfLines={1} ellipsizeMode="tail">
                {facts.station}
              </Text>
              <Text style={fcStyles.stationDistrict} numberOfLines={1} ellipsizeMode="tail">
                {facts.district}
              </Text>

              {/* Projected Level Hero */}
              <View style={fcStyles.heroCard}>
                <View style={fcStyles.heroTop}>
                  <View>
                    <Text style={fcStyles.heroLabel}>
                      PROJECTED AQUIFER LEVEL
                    </Text>
                    <View style={fcStyles.heroValueRow}>
                      <Text style={fcStyles.heroValue}>
                        {level.toFixed(2)}
                      </Text>
                      <Text style={fcStyles.heroUnit}>
                        {" "}
                        mbgl
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      fcStyles.confBadge,
                      {
                        backgroundColor:
                          confColor + "20",
                      },
                    ]}
                  >
                    <View
                      style={[
                        fcStyles.confDot,
                        { backgroundColor: confColor },
                      ]}
                    />
                    <Text
                      style={[
                        fcStyles.confText,
                        { color: confColor },
                      ]}
                    >
                      • {confLevel} CONFIDENCE
                    </Text>
                  </View>
                </View>

                {day30Pred != null && (
                  <View
                    style={[
                      fcStyles.heroChange,
                      {
                        backgroundColor: isRising
                          ? colors.positiveBg
                          : colors.negativeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        fcStyles.heroChangeText,
                        {
                          color: isRising
                            ? colors.positiveText
                            : colors.negativeText,
                        },
                      ]}
                    >
                      {changeLabel}m{" "}
                      {isRising ? "↑" : "↓"}
                    </Text>
                  </View>
                )}

                <View style={fcStyles.anchorRow}>
                  <Text style={fcStyles.anchorLabel}>
                    Anchor GWL:
                  </Text>
                  <Text style={fcStyles.anchorValue}>
                    {" "}
                    {anchorGwl.toFixed(2)} mbgl
                  </Text>
                  <Text style={fcStyles.anchorTime}>
                    {" "}
                    {formatIstShort(anchorTime)}
                  </Text>
                </View>

                <View style={fcStyles.detailRow}>
                  <View style={fcStyles.detailCol}>
                    <Text style={fcStyles.detailLabel}>
                      Direction
                    </Text>
                    <Text
                      style={[
                        fcStyles.detailValue,
                        { color: dirColor },
                      ]}
                    >
                      {isRising
                        ? "↗ Expected rise"
                        : direction ===
                            "expected decline" ||
                          direction === "declining"
                        ? "↘ Expected decline"
                        : "→ Stable"}
                    </Text>
                  </View>
                  <View style={fcStyles.detailCol}>
                    <Text style={fcStyles.detailLabel}>
                      Water Scarcity
                    </Text>
                    <Text
                      style={fcStyles.detailValue}
                    >
                      {category}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Forecast Chart */}
              <View style={fcStyles.chartCard}>
                <View style={fcStyles.chartHeader}>
                  <View>
                    <Text
                      style={fcStyles.chartTitle}
                    >
                      Forecast
                    </Text>
                    <Text
                      style={fcStyles.chartSubtitle}
                    >
                      30D forecast
                    </Text>
                  </View>
                  {hasForecastData && (
                    <View style={fcStyles.legendRow}>
                      <View
                        style={fcStyles.legendItem}
                      >
                        <View
                          style={[
                            fcStyles.legendLine,
                            {
                              backgroundColor:
                                colors.primaryLight,
                            },
                          ]}
                        />
                        <Text
                          style={fcStyles.legendText}
                        >
                          uncertainty
                        </Text>
                      </View>
                      <View
                        style={fcStyles.legendItem}
                      >
                        <View
                          style={[
                            fcStyles.legendLine,
                            {
                              backgroundColor:
                                colors.primary,
                            },
                          ]}
                        />
                        <Text
                          style={fcStyles.legendText}
                        >
                          forecast
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                {hasForecastData ? (
                  <TrajectoryChart
                    trajectory={trajectory}
                    anchor={anchorGwl}
                  />
                ) : (
                  <View
                    style={fcStyles.chartEmpty}
                  >
                    <Text
                      style={
                        fcStyles.chartEmptyTitle
                      }
                    >
                      Forecast not available right
                      now
                    </Text>
                    <Text
                      style={
                        fcStyles.chartEmptyText
                      }
                    >
                      {hasForecastError
                        ? "The prediction model hasn't generated trajectory data for this station yet."
                        : "Trajectory data not yet generated for this station."}
                    </Text>
                  </View>
                )}
              </View>

              {/* Day 30 Summary */}
              {day30Pred != null && (
                <View style={fcStyles.day30Card}>
                  <View style={fcStyles.day30Top}>
                    <View
                      style={[
                        fcStyles.day30Dot,
                        { backgroundColor: confColor },
                      ]}
                    />
                    <Text
                      style={fcStyles.day30Title}
                    >
                      Day 30: {day30Pred.toFixed(2)}m
                    </Text>
                  </View>
                  <Text
                    style={fcStyles.day30Envelope}
                  >
                    90% Envelope: q05:{" "}
                    {q05.toFixed(2)}m | q95:{" "}
                    {q95.toFixed(2)}m
                  </Text>
                </View>
              )}

              {/* Drivers */}
              {drivers.length > 0 && (
                <View style={fcStyles.driversCard}>
                  <View
                    style={fcStyles.driversHeader}
                  >
                    <Text
                      style={fcStyles.driversTitle}
                    >
                      Affecting Factors
                    </Text>
                    <Text
                      style={fcStyles.driversSort}
                    >
                      Label ↓
                    </Text>
                  </View>
                  {drivers.map(
                    (d: any, i: number) => {
                      const absCorr = Math.abs(
                        d.corr
                      );
                      const corrColor =
                        d.corr > 0
                          ? colors.positive
                          : d.corr < 0
                          ? colors.negative
                          : colors.textSecondary;
                      const barPct = Math.min(
                        absCorr * 100,
                        100
                      );
                      return (
                        <View
                          key={i}
                          style={
                            fcStyles.driverRow
                          }
                        >
                          <View
                            style={
                              fcStyles.driverTop
                            }
                          >
                            <Text
                              style={
                                fcStyles.driverName
                              }
                            >
                              {d.driver}
                            </Text>
                            <Text
                              style={[
                                fcStyles.driverCorr,
                                {
                                  color: corrColor,
                                },
                              ]}
                            >
                              {d.corr > 0
                                ? "+"
                                : ""}
                              {d.corr.toFixed(2)} r
                            </Text>
                          </View>
                          <View
                            style={
                              fcStyles.driverBarBg
                            }
                          >
                            <View
                              style={[
                                fcStyles.driverBarFill,
                                {
                                  width: `${barPct}%` as any,
                                  backgroundColor:
                                    corrColor,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={
                              fcStyles.driverMeta
                            }
                          >
                            p ={" "}
                            {d.p < 0.001
                              ? "< 0.001"
                              : d.p.toFixed(3)}{" "}
                            (
                            {strengthLabel(d.corr)}{" "}
                            {d.corr > 0
                              ? "pos"
                              : "neg"}
                            )
                          </Text>
                        </View>
                      );
                    }
                  )}

                  <TouchableOpacity
                    style={fcStyles.moreBtn}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push(
                        `/drivers/${selectedSlug}`
                      )
                    }
                  >
                    <Text
                      style={fcStyles.moreBtnText}
                    >
                      Get more information per
                      driver
                    </Text>
                    <Text
                      style={fcStyles.moreBtnArrow}
                    >
                      →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ── No station selected: show station picker ──
  return (
    <View style={fcStyles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View
        style={[
          fcStyles.topBar,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        <View style={fcStyles.headerSection}>
          <Text style={fcStyles.topTitle}>30-Day Forecast</Text>
          <Text style={fcStyles.headerSubtitle}>Select a station to view forecast</Text>
        </View>
      </View>

      {/* Search + Filters */}
      <View style={fcStyles.searchRow}>
        <View style={fcStyles.searchBar}>
          <Text style={fcStyles.searchIcon}>🔍</Text>
          <TextInput
            style={fcStyles.searchInput}
            placeholder="Search stations, districts..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={fcStyles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={fcStyles.chipsScroll}
        >
          <TouchableOpacity
            style={[fcStyles.chip, activeFilter === "all" && fcStyles.chipActive]}
            onPress={() => setActiveFilter("all")}
          >
            <Text style={[fcStyles.chipText, activeFilter === "all" && fcStyles.chipTextActive]}>
              All ({stationCounts.safe + stationCounts.caution})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fcStyles.chip, activeFilter === "safe" && fcStyles.chipActiveSafe]}
            onPress={() => setActiveFilter("safe")}
          >
            <View style={[fcStyles.chipDot, { backgroundColor: colors.positive }]} />
            <Text style={fcStyles.chipText}>Safe</Text>
            <View style={[fcStyles.chipCount, { backgroundColor: "#F1F5F9" }]}>
              <Text style={fcStyles.chipCountText}>{stationCounts.safe}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fcStyles.chip, activeFilter === "caution" && fcStyles.chipActiveCaution]}
            onPress={() => setActiveFilter("caution")}
          >
            <View style={[fcStyles.chipDot, { backgroundColor: colors.negative }]} />
            <Text style={fcStyles.chipText}>Caution</Text>
            <View style={[fcStyles.chipCount, { backgroundColor: "#F1F5F9" }]}>
              <Text style={fcStyles.chipCountText}>{stationCounts.caution}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Station List */}
      <FlatList
        data={displayStations}
        keyExtractor={(item) => item.slug ?? `${item.district}-${item.station}`}
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={fcStyles.stationCard}
            activeOpacity={0.7}
            onPress={() => s.slug && setSelectedSlug(s.slug)}
          >
            <View style={fcStyles.stationCardLeft}>
              <Text style={fcStyles.stationCardName} numberOfLines={1} ellipsizeMode="tail">
                {s.station}
              </Text>
              <Text style={fcStyles.stationCardDistrict} numberOfLines={1} ellipsizeMode="tail">
                {s.district}
              </Text>
            </View>
            <TouchableOpacity
              style={fcStyles.exploreBtn}
              onPress={() => s.slug && setSelectedSlug(s.slug)}
            >
              <Text style={fcStyles.exploreBtnText}>Explore →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={fcStyles.listContent}
      />
    </View>
  );
}

const fcStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingBottom: BOTTOM_NAV_CLEARANCE,
  },

  // Top bar with back button
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
    fontSize: 18,
    color: colors.textPrimary,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  headerSection: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Tab toggle row
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.onPrimary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...elevation.low,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoIcon: { fontSize: 16 },
  brandText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  basinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.positive,
  },
  basinText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: 0.04,
  },

  // Search
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },

  // Chips
  chipsContainer: { paddingTop: spacing.sm },
  chipsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  chipsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipActiveSafe: { borderColor: colors.positive },
  chipActiveCaution: { borderColor: colors.negative },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chipTextActive: { color: colors.onPrimary },
  chipCount: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textSecondary,
  },

  // Station list
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
  },
  stationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stationCardLeft: { flex: 1, gap: 2 },
  stationCardName: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  stationCardDistrict: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  exploreBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  exploreBtnText: { ...typography.labelSm, color: colors.primaryDeep, fontWeight: "600" },

  // Loading / Error
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },
  errorBox: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onPrimary,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTag: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.06,
  },
  sectionId: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sectionSync: {
    fontSize: 11,
    color: colors.textMuted,
  },
  stationName: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  stationDistrict: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Hero card
  heroCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textSecondary,
    letterSpacing: 0.05,
    marginBottom: spacing.xs,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  heroUnit: {
    fontSize: 14,
    color: colors.textMuted,
  },
  confBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    gap: spacing.xxs,
  },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  confText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.04,
  },
  heroChange: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroChangeText: { fontSize: 13, fontWeight: "bold" },
  anchorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  anchorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  anchorValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "bold",
  },
  anchorTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  detailRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  detailCol: { flex: 1 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.04,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  // Chart card
  chartCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  legendRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  legendText: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Day 30
  day30Card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  day30Top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  day30Dot: { width: 10, height: 10, borderRadius: 5 },
  day30Title: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  day30Envelope: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Drivers
  driversCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  driversHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  driversTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  driversSort: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  driverRow: { marginBottom: spacing.md },
  driverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xxs,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  driverCorr: { fontSize: 13, fontWeight: "bold" },
  driverBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  driverBarFill: { height: 4, borderRadius: 2 },
  driverMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },

  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  moreBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.onPrimary,
  },
  moreBtnArrow: {
    fontSize: 16,
    color: colors.onPrimary,
    fontWeight: "bold",
  },

  chartEmpty: {
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  chartEmptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  chartEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});

// ─── Chart sub-styles ───────────────────────────────────────────────────
const chartStyles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  tierRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  tierBadge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  tierText: { fontSize: 10, fontWeight: "bold" },
  chartArea: {
    height: 180,
    position: "relative",
    marginBottom: spacing.sm,
    marginLeft: 40,
  },
  yLabel: {
    position: "absolute",
    left: 0,
    width: 36,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: "500",
    backgroundColor: colors.surface,
    paddingHorizontal: 2,
    zIndex: 2,
    textAlign: "right",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.chartGrid,
    opacity: 0.4,
  },
  d12Label: {
    position: "absolute",
    top: -20,
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 3,
  },
  d12Text: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  anchorLine: {
    position: "absolute",
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.warning,
    opacity: 0.5,
    zIndex: 1,
  },
  xRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 36,
  },
  xLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
