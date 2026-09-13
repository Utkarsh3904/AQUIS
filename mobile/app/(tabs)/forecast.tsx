import React, { useState, useMemo, useCallback } from "react";
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
import { useRouter } from "expo-router";
import { useStations, useFleetAlerts, useStationFactsBySlug, useForecast } from "../../lib/hooks";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: colors.positive, high: colors.positive,
  DIRECTIONAL: colors.warning, directional: colors.warning,
  LOW: colors.negative, low: colors.negative,
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
    const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][ist.getUTCMonth()];
    const hh = String(ist.getUTCHours()).padStart(2, "0");
    const mm = String(ist.getUTCMinutes()).padStart(2, "0");
    return `${dd} ${mon} ${hh}:${mm} IST`;
  } catch { return iso; }
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

// ─── Forecast Chart (simplified trajectory) ─────────────────────────
function TrajectoryChart({ trajectory, anchor, day30Pred }: { trajectory: any[]; anchor: number; day30Pred: number | null }) {
  if (!trajectory || trajectory.length < 2) return null;

  const sampled = trajectory.filter((_: any, i: number) => i % 4 === 0);
  const allVals = sampled.flatMap((p: any) => [p.q05, p.q95, p.q50].filter(Boolean));
  const vMin = Math.min(...allVals, anchor);
  const vMax = Math.max(...allVals, anchor);
  const pad = (vMax - vMin) * 0.15 || 1;
  const yMin = vMin - pad;
  const yMax = vMax + pad;
  const yRange = yMax - yMin;

  const totalPts = trajectory.length;
  const d14Idx = Math.min(Math.floor(totalPts * 14 / 30), totalPts - 1);
  const d24Idx = Math.min(Math.floor(totalPts * 24 / 30), totalPts - 1);

  return (
    <View style={fcStyles.chartWrap}>
      <View style={fcStyles.chartTierRow}>
        <View style={[fcStyles.tierBadge, { backgroundColor: colors.positiveBg }]}>
          <Text style={[fcStyles.tierText, { color: colors.positiveText }]}>D1-14: High Conf</Text>
        </View>
        <View style={[fcStyles.tierBadge, { backgroundColor: colors.warningBg }]}>
          <Text style={[fcStyles.tierText, { color: colors.warningText }]}>D15-24: Directional</Text>
        </View>
        <View style={[fcStyles.tierBadge, { backgroundColor: colors.negativeBg }]}>
          <Text style={[fcStyles.tierText, { color: colors.negativeText }]}>D25-30: Wide</Text>
        </View>
      </View>

      <View style={fcStyles.chartArea}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[fcStyles.gridLine, { top: `${(i / 3) * 85 + 7}%` }]} />
        ))}

        {sampled.map((p: any, i: number) => {
          const x = (i / (sampled.length - 1)) * 94 + 3;
          const yQ05 = ((p.q05 - yMin) / yRange) * 78 + 10;
          const yQ95 = ((p.q95 - yMin) / yRange) * 78 + 10;
          return (
            <View key={i} style={[fcStyles.envelopeCol, {
              left: `${x}%`,
              top: `${Math.min(yQ05, yQ95)}%`,
              height: `${Math.abs(yQ05 - yQ95)}%`,
            }]} />
          );
        })}

        {sampled.map((p: any, i: number) => {
          const x = (i / (sampled.length - 1)) * 94 + 3;
          const y = ((p.q50 - yMin) / yRange) * 78 + 10;
          const isD12 = i === Math.floor(sampled.length * 12 / 30);
          return (
            <View key={`d-${i}`}>
              <View style={[fcStyles.dot, { left: `${x}%`, top: `${y}%` }]} />
              {isD12 && (
                <View style={[fcStyles.d12Label, { left: `${x}%` }]}>
                  <Text style={fcStyles.d12Text}>D+12</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={fcStyles.chartXRow}>
        {["T-0", "D+12", "D+20", "D+30"].map((l, i) => (
          <Text key={i} style={fcStyles.chartXLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Main Tab Screen ────────────────────────────────────────────────
export default function ForecastTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: stations } = useStations();
  const { data: fleetAlerts } = useFleetAlerts();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: facts, loading: factsLoading } = useStationFactsBySlug(selectedSlug);
  const { data: forecast, loading: fcLoading, error: forecastError } = useForecast(selectedSlug);

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
    let safe = 0, caution = 0;
    for (const s of stations) {
      const z = s.slug ? stationZoneMap.get(s.slug) : null;
      if (z === "alert" || z === "danger" || z === "unknown") caution++;
      else safe++;
    }
    return { safe, caution };
  }, [stations, stationZoneMap]);

  const filteredStations = useMemo(() => {
    return stations.filter((s) => s.slug);
  }, [stations]);

  const [activeFilter, setActiveFilter] = useState<"all" | "safe" | "caution">("all");
  const displayStations = useMemo(() => {
    if (activeFilter === "all") return filteredStations;
    return filteredStations.filter((s) => {
      const z = s.slug ? stationZoneMap.get(s.slug) : null;
      if (activeFilter === "caution") return z === "alert" || z === "danger" || z === "unknown";
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
    const day30Pred = facts?.forecast?.day30_pred ?? null;
    const change30d = facts?.forecast?.change_30d_pred ?? 0;
    const direction = facts?.forecast?.direction ?? "stable";
    const isRising = direction === "expected rise" || direction === "rising";
    const bandHalf = facts?.forecast?.band_half ?? 0;
    const q05 = facts?.forecast?.q05_level ?? (level - bandHalf);
    const q95 = facts?.forecast?.q95_level ?? (level + bandHalf);
    const signAccuracy = forecastAny?.direction?.sign_accuracy_30d;
    const agreement = forecastAny?.direction?.agreement_with_production;
    const trajectory = forecastAny?.trajectory ?? [];
    const confLevel = confLevelLabel(forecastAny);
    const confColor = CONFIDENCE_COLORS[confLevel] ?? colors.textMuted;
    const dirColor = DIRECTION_COLORS[direction] ?? colors.textSecondary;
    const changeLabel = change30d >= 0 ? `+${change30d.toFixed(2)}` : change30d.toFixed(2);
    const drivers = (facts?.drivers ?? []).slice().sort((a: any, b: any) => Math.abs(b.corr) - Math.abs(a.corr)).slice(0, 5);
    const zone = stationZoneMap.get(selectedSlug) ?? "unknown";
    const category = zone === "safe" ? "stable" : zone === "unknown" ? "unreliable" : zone;

    return (
      <View style={fcStyles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={fcStyles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={[fcStyles.header, { paddingTop: insets.top + spacing.sm }]}>
            <View style={fcStyles.headerLeft}>
              <View style={fcStyles.logoBox}><Text style={fcStyles.logoIcon}>💧</Text></View>
              <Text style={fcStyles.brandText}>AQUIS</Text>
            </View>
            <View style={fcStyles.headerRight}>
              <View style={fcStyles.basinDot} />
              <Text style={fcStyles.basinText}>
                {station?.district?.toUpperCase() ?? "DISTRICT"} • GWL
              </Text>
            </View>
          </View>

          {/* Search bar */}
          <TouchableOpacity style={fcStyles.searchBar} onPress={() => router.push("/station-search")} activeOpacity={0.7}>
            <Text style={fcStyles.searchIcon}>🔍</Text>
            <Text style={fcStyles.searchText} numberOfLines={1}>
              {facts?.station ?? station?.station ?? "Station"} ({facts?.district ?? station?.district ?? ""})
            </Text>
            <Text style={fcStyles.searchClose}>✕</Text>
          </TouchableOpacity>

          {/* Filter chips (read-only in detail view) */}
          <View style={fcStyles.chipsRow}>
            <View style={[fcStyles.chip, { backgroundColor: colors.positiveBg }]}>
              <View style={[fcStyles.chipDot, { backgroundColor: colors.positive }]} />
              <Text style={[fcStyles.chipText, { color: colors.positiveText }]}>Safe / Nominal</Text>
              <View style={[fcStyles.chipCount, { backgroundColor: colors.positiveBorder }]}>
                <Text style={[fcStyles.chipCountText, { color: colors.positiveText }]}>{stationCounts.safe}</Text>
              </View>
            </View>
            <View style={[fcStyles.chip, { backgroundColor: colors.negativeBg }]}>
              <View style={[fcStyles.chipDot, { backgroundColor: colors.negative }]} />
              <Text style={[fcStyles.chipText, { color: colors.negativeText }]}>Caution / Depleting</Text>
              <View style={[fcStyles.chipCount, { backgroundColor: colors.negativeBorder }]}>
                <Text style={[fcStyles.chipCountText, { color: colors.negativeText }]}>{stationCounts.caution}</Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={fcStyles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={fcStyles.loadingText}>Loading forecast data...</Text>
            </View>
          ) : hasError ? (
            <View style={fcStyles.errorBox}>
              <Text style={fcStyles.errorTitle}>Station data unavailable</Text>
              <Text style={fcStyles.errorText}>This station's detail data is not available (XGBoost model error on backend).</Text>
              <TouchableOpacity style={fcStyles.retryBtn} onPress={() => setSelectedSlug(null)}>
                <Text style={fcStyles.retryText}>← Back to station list</Text>
              </TouchableOpacity>
            </View>
          ) : facts ? (
            <>
              {/* Station Forecast Header */}
              <View style={fcStyles.sectionHeader}>
                <Text style={fcStyles.sectionTag}>STATION FORECAST</Text>
                <Text style={fcStyles.sectionSync}>Last Sync: {facts.last_date ?? "—"}</Text>
              </View>
              <Text style={fcStyles.stationName}>{facts.station}</Text>
              <Text style={fcStyles.stationDistrict}>{facts.district}</Text>

              {/* Projected Level Hero */}
              <View style={fcStyles.heroCard}>
                <View style={fcStyles.heroTop}>
                  <View>
                    <Text style={fcStyles.heroLabel}>PROJECTED AQUIFER LEVEL</Text>
                    <View style={fcStyles.heroValueRow}>
                      <Text style={fcStyles.heroValue}>{level.toFixed(2)}</Text>
                      <Text style={fcStyles.heroUnit}> mbgl</Text>
                    </View>
                  </View>
                  <View style={[fcStyles.confBadge, { backgroundColor: confColor + "20" }]}>
                    <View style={[fcStyles.confDot, { backgroundColor: confColor }]} />
                    <Text style={[fcStyles.confText, { color: confColor }]}>• {confLevel} CONFIDENCE</Text>
                  </View>
                </View>

                {day30Pred != null && (
                  <View style={[fcStyles.heroChange, { backgroundColor: isRising ? colors.positiveBg : colors.negativeBg }]}>
                    <Text style={[fcStyles.heroChangeText, { color: isRising ? colors.positiveText : colors.negativeText }]}>
                      {changeLabel}m {isRising ? "↑" : "↓"}
                    </Text>
                  </View>
                )}

                <View style={fcStyles.anchorRow}>
                  <Text style={fcStyles.anchorLabel}>Anchor GWL:</Text>
                  <Text style={fcStyles.anchorValue}> {anchorGwl.toFixed(2)} mbgl</Text>
                  <Text style={fcStyles.anchorTime}> {formatIstShort(anchorTime)}</Text>
                </View>

                <View style={fcStyles.detailRow}>
                  <View style={fcStyles.detailCol}>
                    <Text style={fcStyles.detailLabel}>Direction</Text>
                    <Text style={[fcStyles.detailValue, { color: dirColor }]}>
                      {isRising ? "↗ Expected rise" : direction === "expected decline" || direction === "declining" ? "↘ Expected decline" : "→ Stable"}
                    </Text>
                  </View>
                  {signAccuracy != null && (
                    <View style={fcStyles.detailCol}>
                      <Text style={fcStyles.detailLabel}>30D Sign Accuracy</Text>
                      <Text style={fcStyles.detailValue}>{(signAccuracy * 100).toFixed(1)}%</Text>
                    </View>
                  )}
                </View>

                <View style={fcStyles.detailRow}>
                  {agreement != null && (
                    <View style={fcStyles.detailCol}>
                      <Text style={fcStyles.detailLabel}>Prod. Agreement</Text>
                      <Text style={fcStyles.detailValue}>{agreement ? "Yes" : "No"}</Text>
                    </View>
                  )}
                  <View style={fcStyles.detailCol}>
                    <Text style={fcStyles.detailLabel}>Water Scarcity</Text>
                    <Text style={fcStyles.detailValue}>{category}</Text>
                  </View>
                </View>
              </View>

              {/* Forecast Chart */}
              <View style={fcStyles.chartCard}>
                <View style={fcStyles.chartHeader}>
                  <View>
                    <Text style={fcStyles.chartTitle}>Forecast</Text>
                    <Text style={fcStyles.chartSubtitle}>30D forecast</Text>
                  </View>
                  {hasForecastData && (
                    <View style={fcStyles.legendRow}>
                      <View style={fcStyles.legendItem}>
                        <View style={[fcStyles.legendLine, { backgroundColor: colors.primaryLight }]} />
                        <Text style={fcStyles.legendText}>uncertainty</Text>
                      </View>
                      <View style={fcStyles.legendItem}>
                        <View style={[fcStyles.legendLine, { backgroundColor: colors.primary }]} />
                        <Text style={fcStyles.legendText}>forecast</Text>
                      </View>
                    </View>
                  )}
                </View>
                {hasForecastData ? (
                  <TrajectoryChart trajectory={trajectory} anchor={anchorGwl} day30Pred={day30Pred} />
                ) : (
                  <View style={fcStyles.chartEmpty}>
                    <Text style={fcStyles.chartEmptyTitle}>Forecast not available right now</Text>
                    <Text style={fcStyles.chartEmptyText}>
                      {hasForecastError
                        ? "The prediction model hasn't generated trajectory data for this station yet. This may change as the model is updated."
                        : "Trajectory data not yet generated for this station. This may change as the model is updated."}
                    </Text>
                  </View>
                )}
              </View>

              {/* Day 30 Summary */}
              {day30Pred != null && (
                <View style={fcStyles.day30Card}>
                  <View style={fcStyles.day30Top}>
                    <View style={[fcStyles.day30Dot, { backgroundColor: confColor }]} />
                    <Text style={fcStyles.day30Title}>Day 30: {day30Pred.toFixed(2)}m</Text>
                  </View>
                  <Text style={fcStyles.day30Envelope}>
                    90% Envelope: q05: {q05.toFixed(2)}m | q95: {q95.toFixed(2)}m
                  </Text>
                </View>
              )}

              {/* Drivers */}
              {drivers.length > 0 && (
                <View style={fcStyles.driversCard}>
                  <View style={fcStyles.driversHeader}>
                    <Text style={fcStyles.driversTitle}>Affecting Factors</Text>
                    <Text style={fcStyles.driversSort}>Label ↓</Text>
                  </View>
                  {drivers.map((d: any, i: number) => {
                    const absCorr = Math.abs(d.corr);
                    const corrColor = d.corr > 0 ? colors.positive : d.corr < 0 ? colors.negative : colors.textSecondary;
                    const barPct = Math.min(absCorr * 100, 100);
                    return (
                      <View key={i} style={fcStyles.driverRow}>
                        <View style={fcStyles.driverTop}>
                          <Text style={fcStyles.driverName}>{d.driver}</Text>
                          <Text style={[fcStyles.driverCorr, { color: corrColor }]}>
                            {d.corr > 0 ? "+" : ""}{d.corr.toFixed(2)} r
                          </Text>
                        </View>
                        <View style={fcStyles.driverBarBg}>
                          <View style={[fcStyles.driverBarFill, { width: `${barPct}%` as any, backgroundColor: corrColor }]} />
                        </View>
                        <Text style={fcStyles.driverMeta}>
                          p = {d.p < 0.001 ? "< 0.001" : d.p.toFixed(3)} ({strengthLabel(d.corr)} {d.corr > 0 ? "pos" : "neg"})
                        </Text>
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={fcStyles.moreBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/drivers/${selectedSlug}`)}
                  >
                    <Text style={fcStyles.moreBtnText}>Get more information per driver</Text>
                    <Text style={fcStyles.moreBtnArrow}>→</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[fcStyles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={fcStyles.headerLeft}>
          <View style={fcStyles.logoBox}><Text style={fcStyles.logoIcon}>💧</Text></View>
          <Text style={fcStyles.brandText}>AQUIS</Text>
        </View>
        <View style={fcStyles.headerRight}>
          <View style={fcStyles.basinDot} />
          <Text style={fcStyles.basinText}>UTTAR PRADESH • FORECAST</Text>
        </View>
      </View>

      {/* Search */}
      <View style={fcStyles.searchContainer}>
        <TouchableOpacity
          style={fcStyles.searchBarInput}
          activeOpacity={0.7}
          onPress={() => router.push("/station-search")}
        >
          <Text style={fcStyles.searchIcon}>🔍</Text>
          <Text style={fcStyles.searchPlaceholderText}>Search station or district...</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={fcStyles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fcStyles.chipsScroll}>
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
            <Text style={fcStyles.chipText}>Safe / Nominal</Text>
            <View style={[fcStyles.chipCount, { backgroundColor: "#F1F5F9" }]}>
              <Text style={fcStyles.chipCountText}>{stationCounts.safe}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fcStyles.chip, activeFilter === "caution" && fcStyles.chipActiveCaution]}
            onPress={() => setActiveFilter("caution")}
          >
            <View style={[fcStyles.chipDot, { backgroundColor: colors.negative }]} />
            <Text style={fcStyles.chipText}>Caution / Depleting</Text>
            <View style={[fcStyles.chipCount, { backgroundColor: "#F1F5F9" }]}>
              <Text style={fcStyles.chipCountText}>{stationCounts.caution}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Station List */}
      <ScrollView contentContainerStyle={fcStyles.listContent} showsVerticalScrollIndicator={false}>
        {displayStations.map((s) => {
          const z = s.slug ? stationZoneMap.get(s.slug) : null;
          const dotColor = z === "safe" ? colors.positive : z === "unknown" ? colors.textMuted : colors.negative;
          return (
            <TouchableOpacity
              key={s.slug ?? s.id}
              style={fcStyles.stationCard}
              activeOpacity={0.7}
              onPress={() => s.slug && setSelectedSlug(s.slug)}
            >
              <View style={[fcStyles.stationDot, { backgroundColor: dotColor }]} />
              <View style={fcStyles.stationCardLeft}>
                <Text style={fcStyles.stationCardName} numberOfLines={1}>{s.station}</Text>
                <Text style={fcStyles.stationCardDistrict}>{s.district}</Text>
              </View>
              <Text style={fcStyles.stationCardArrow}>→</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const fcStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: BOTTOM_NAV_CLEARANCE },

  // ── Header ──
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)", ...elevation.low,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBox: {
    width: 32, height: 32, borderRadius: radii.md,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
  },
  logoIcon: { fontSize: 16 },
  brandText: { fontSize: 18, fontWeight: "bold", color: colors.primary, letterSpacing: 0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  basinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.positive },
  basinText: { fontSize: 11, fontWeight: "600", color: colors.textPrimary, letterSpacing: 0.04 },

  // ── Search ──
  searchContainer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm,
    ...elevation.medium,
  },
  searchBarInput: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm, ...elevation.medium,
  },
  searchIcon: { fontSize: 16 },
  searchText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
  searchClose: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  searchPlaceholderText: { flex: 1, fontSize: 14, color: colors.textMuted },

  // ── Chips ──
  chipsContainer: { paddingTop: spacing.sm },
  chipsScroll: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  chipsRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginRight: spacing.sm, gap: spacing.xs, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveSafe: { borderColor: colors.positive },
  chipActiveCaution: { borderColor: colors.negative },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  chipTextActive: { color: colors.onPrimary },
  chipCount: { borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.xs },
  chipCountText: { fontSize: 10, fontWeight: "bold", color: colors.textSecondary },

  // ── Station list ──
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: BOTTOM_NAV_CLEARANCE },
  stationCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  stationDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  stationCardLeft: { flex: 1, gap: 2 },
  stationCardName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  stationCardDistrict: { fontSize: 12, color: colors.textMuted },
  stationCardArrow: { fontSize: 18, color: colors.primary, fontWeight: "600" },

  // ── Loading / Error ──
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, gap: spacing.md },
  loadingText: { fontSize: 14, color: colors.textMuted },
  errorBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: spacing.xl, gap: spacing.md },
  errorTitle: { fontSize: 18, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  errorText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  retryText: { fontSize: 14, fontWeight: "600", color: colors.onPrimary },

  // ── Section header ──
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  sectionTag: { fontSize: 11, fontWeight: "bold", color: colors.primary, letterSpacing: 0.06 },
  sectionSync: { fontSize: 11, color: colors.textMuted },
  stationName: { fontSize: 22, fontWeight: "bold", color: colors.textPrimary, paddingHorizontal: spacing.lg },
  stationDistrict: { fontSize: 14, color: colors.textMuted, paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  // ── Hero card ──
  heroCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20, padding: spacing.lg, marginBottom: spacing.md,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  heroLabel: { fontSize: 10, fontWeight: "bold", color: colors.textSecondary, letterSpacing: 0.05, marginBottom: spacing.xs },
  heroValueRow: { flexDirection: "row", alignItems: "baseline" },
  heroValue: { fontSize: 32, fontWeight: "bold", color: colors.textPrimary },
  heroUnit: { fontSize: 14, color: colors.textMuted },
  confBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.full, gap: spacing.xxs },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  confText: { fontSize: 10, fontWeight: "bold", letterSpacing: 0.04 },
  heroChange: { alignSelf: "flex-start", borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.sm },
  heroChangeText: { fontSize: 13, fontWeight: "bold" },
  anchorRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, flexWrap: "wrap" },
  anchorLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
  anchorValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "bold" },
  anchorTime: { fontSize: 11, color: colors.textMuted },
  detailRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.xs },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, letterSpacing: 0.04, marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },

  // ── Chart card ──
  chartCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  chartTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary },
  chartSubtitle: { fontSize: 12, color: colors.textMuted },
  legendRow: { flexDirection: "row", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendLine: { width: 16, height: 3, borderRadius: 1.5 },
  legendText: { fontSize: 10, color: colors.textMuted },

  // ── Trajectory chart ──
  chartWrap: { marginTop: spacing.sm },
  chartTierRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md, flexWrap: "wrap" },
  tierBadge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  tierText: { fontSize: 10, fontWeight: "bold" },
  chartArea: { height: 160, position: "relative", marginBottom: spacing.sm },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.chartGrid },
  envelopeCol: { position: "absolute", width: 2, backgroundColor: "rgba(2,132,199,0.12)" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginLeft: -3, marginTop: -3 },
  d12Label: { position: "absolute", top: -20, transform: [{ translateX: -16 }], backgroundColor: "#0F172A", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  d12Text: { fontSize: 9, color: "#FFFFFF", fontWeight: "bold" },
  chartXRow: { flexDirection: "row", justifyContent: "space-between" },
  chartXLabel: { fontSize: 10, color: colors.textMuted },
  chartEmpty: { paddingVertical: 32, paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.sm },
  chartEmptyTitle: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  chartEmptyText: { fontSize: 12, color: colors.textMuted, textAlign: "center", lineHeight: 18 },

  // ── Day 30 ──
  day30Card: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md,
  },
  day30Top: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  day30Dot: { width: 10, height: 10, borderRadius: 5 },
  day30Title: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary },
  day30Envelope: { fontSize: 12, color: colors.textSecondary },

  // ── Drivers ──
  driversCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  driversHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  driversTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary },
  driversSort: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  driverRow: { marginBottom: spacing.md },
  driverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xxs },
  driverName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  driverCorr: { fontSize: 13, fontWeight: "bold" },
  driverBarBg: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  driverBarFill: { height: 4, borderRadius: 2 },
  driverMeta: { fontSize: 11, color: colors.textMuted },

  moreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary, borderRadius: radii.lg,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    gap: spacing.sm, marginTop: spacing.sm,
  },
  moreBtnText: { fontSize: 14, fontWeight: "bold", color: colors.onPrimary },
  moreBtnArrow: { fontSize: 16, color: colors.onPrimary, fontWeight: "bold" },
});
