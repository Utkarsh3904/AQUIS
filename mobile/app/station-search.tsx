import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useStations, useFleetAlerts, useStationSeries } from "../lib/hooks";
import { colors, typography } from "../theme/colors";
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../theme/spacing";
import type { StationListItem } from "../types/station";
import type { FleetAlertItem } from "../types/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

const STABLE_THRESHOLD = 0.05;

function computeDeltaInfo(change30d: number | null): {
  icon: string;
  text: string;
  color: string;
  label: string;
} {
  if (change30d == null) return { icon: "—", text: "— m (No data)", color: colors.textMuted, label: "Stable" };
  const abs = Math.abs(change30d);
  if (change30d > STABLE_THRESHOLD) {
    return { icon: "↗", text: `+${change30d.toFixed(2)} m (30d)`, color: colors.positive, label: "Rising" };
  }
  if (change30d < -STABLE_THRESHOLD) {
    return { icon: "↘", text: `${change30d.toFixed(2)} m (Drawdown)`, color: colors.negative, label: "Drawdown" };
  }
  return { icon: "→", text: `±${abs.toFixed(2)} m (Stable)`, color: colors.textMuted, label: "Stable" };
}

function computeSyncStatus(lastTs: string | null): { label: string; dotColor: string } {
  if (!lastTs) return { label: "No Telemetry", dotColor: colors.textMuted };
  const now = Date.now();
  const ts = new Date(lastTs.replace(" ", "T")).getTime();
  const hoursAgo = (now - ts) / (1000 * 60 * 60);
  if (hoursAgo <= 12) return { label: "Live Sync", dotColor: colors.positive };
  if (hoursAgo <= 72) return { label: "Periodic Cycle", dotColor: colors.warning };
  return { label: "Standard Telemetry", dotColor: colors.textMuted };
}

function computeStatusTag(forecast: any, change30d: number | null): string {
  if (forecast != null) return "30d Quantile Ready";
  if (change30d == null) return "Model Check Required";
  return "Anchor Telemetry Intact";
}

function relativeTime(ts: string | null): string {
  if (!ts) return "—";
  const now = Date.now();
  const t = new Date(ts.replace(" ", "T")).getTime();
  const mins = Math.floor((now - t) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MiniSparkline({ slug }: { slug: string }) {
  const { data: seriesData, loading } = useStationSeries(slug, { limit: 30 });

  const points = useMemo(() => {
    if (!seriesData?.points || seriesData.points.length === 0) return [];
    const recent = seriesData.points.slice(-12);
    const gwls = recent.map((p) => p.gwl ?? 0);
    const min = Math.min(...gwls);
    const max = Math.max(...gwls);
    const range = max - min || 1;
    return recent.map((p) => (p.gwl ?? 0 - min) / range);
  }, [seriesData]);

  if (loading || points.length === 0) {
    return <View style={ssStyles.sparklineEmpty} />;
  }

  const W = 64;
  const H = 24;

  return (
    <View style={{ width: W, height: H }}>
      <View style={ssStyles.sparklineArea}>
        {points.map((val, idx) => {
          const x = (idx / (points.length - 1)) * (W - 2);
          const h = Math.max(2, val * (H - 4));
          return (
            <View
              key={idx}
              style={[
                ssStyles.sparkBar,
                {
                  left: x,
                  bottom: 0,
                  height: h,
                  backgroundColor: idx === points.length - 1 ? colors.primary : colors.positive,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function StationCard({
  item,
  alert,
  onPressExplore,
}: {
  item: StationListItem;
  alert: FleetAlertItem | undefined;
  onPressExplore: () => void;
}) {
  const change30d = alert?.change_30d_m ?? null;
  const delta = computeDeltaInfo(change30d);
  const sync = computeSyncStatus(item.last_ts);
  const statusTag = computeStatusTag(null, change30d);

  return (
    <View style={ssStyles.card}>
      <View style={ssStyles.cardTop}>
        <View style={ssStyles.cardTopLeft}>
          <View style={ssStyles.districtBadge}>
            <Text style={ssStyles.districtBadgeText}>{item.district}</Text>
          </View>
          <View style={ssStyles.syncRow}>
            <View style={[ssStyles.syncDot, { backgroundColor: sync.dotColor }]} />
            <Text style={ssStyles.syncLabel}>{sync.label}</Text>
          </View>
        </View>
        <View style={ssStyles.levelBlock}>
          <Text style={ssStyles.levelValue}>—</Text>
          <Text style={ssStyles.levelUnit}>m</Text>
        </View>
      </View>

      <Text style={ssStyles.stationName} numberOfLines={2}>{item.station}</Text>
      <Text style={ssStyles.slugText}>slug: {item.slug}</Text>

      <View style={ssStyles.deltaCard}>
        <View style={ssStyles.deltaLeft}>
          <View style={ssStyles.deltaTextRow}>
            <Text style={[ssStyles.deltaIcon, { color: delta.color }]}>{delta.icon}</Text>
            <Text style={[ssStyles.deltaText, { color: delta.color }]}>{delta.text}</Text>
          </View>
        </View>
        <MiniSparkline slug={item.slug ?? ""} />
      </View>

      <View style={ssStyles.cardBottom}>
        <View style={ssStyles.statusTag}>
          <Text style={ssStyles.statusTagText}>{statusTag}</Text>
        </View>
        <TouchableOpacity style={ssStyles.exploreBtn} activeOpacity={0.7} onPress={onPressExplore}>
          <Text style={ssStyles.exploreBtnText}>Explore &gt;</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function StationSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ placeholder?: string }>();
  const { data: stations, loading: stationsLoading } = useStations();
  const { data: fleetAlerts } = useFleetAlerts();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const alertMap = useMemo(() => {
    const m = new Map<string, FleetAlertItem>();
    if (fleetAlerts?.alerts) {
      for (const a of fleetAlerts.alerts) {
        if (a.slug) m.set(a.slug, a);
      }
    }
    return m;
  }, [fleetAlerts]);

  const districts = useMemo(() => {
    const set = new Set(stations.map((s) => s.district).filter(Boolean));
    return Array.from(set).sort();
  }, [stations]);

  const filtered = useMemo(() => {
    let list = stations.filter((s) => s.slug);
    if (selectedDistrict) {
      list = list.filter((s) => s.district === selectedDistrict);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b.last_ts ?? "").localeCompare(a.last_ts ?? ""));
    return list;
  }, [stations, searchQuery, selectedDistrict]);

  const placeholder = params.placeholder ?? "Search stations, districts, or slugs...";

  return (
    <View style={ssStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={[ssStyles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={ssStyles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={ssStyles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={ssStyles.headerTitle}>Browse Stations</Text>
        <View style={ssStyles.headerSpacer} />
      </View>

      <View style={ssStyles.searchContainer}>
        <View style={ssStyles.searchBar}>
          <Text style={ssStyles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={ssStyles.searchInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <Text style={ssStyles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={ssStyles.chipsScrollWrap}>
        <FlatList
          horizontal
          data={districts}
          keyExtractor={(d) => d}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ssStyles.chipsRow}
          renderItem={({ item: d }) => (
            <TouchableOpacity
              style={[ssStyles.chip, selectedDistrict === d && ssStyles.chipActive]}
              onPress={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
            >
              <Text style={[ssStyles.chipText, selectedDistrict === d && ssStyles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={ssStyles.resultCount}>
        <Text style={ssStyles.resultCountText}>
          {filtered.length} station{filtered.length !== 1 ? "s" : ""}
          {selectedDistrict ? ` in ${selectedDistrict}` : ""}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.slug ?? `station-${item.id}`}
        renderItem={({ item }) => (
          <StationCard
            item={item}
            alert={item.slug ? alertMap.get(item.slug) : undefined}
            onPressExplore={() => item.slug && router.push(`/station/${item.slug}`)}
          />
        )}
        ListEmptyComponent={
          !stationsLoading ? (
            <View style={ssStyles.emptyBox}>
              <Text style={ssStyles.emptyTitle}>No stations found</Text>
              <Text style={ssStyles.emptyText}>Try adjusting your search or filters.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={ssStyles.listContent}
      />
    </View>
  );
}

const ssStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

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
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  headerSpacer: { width: 36 },

  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...elevation.medium,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  clearBtn: { fontSize: 14, color: colors.textMuted, fontWeight: "600", paddingHorizontal: spacing.xs },

  chipsScrollWrap: { maxHeight: 44 },
  chipsRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.textSecondary },
  chipTextActive: { color: colors.onPrimary },

  resultCount: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  resultCountText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: BOTTOM_NAV_CLEARANCE },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  districtBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  districtBadgeText: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.04 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncLabel: { fontSize: 11, fontWeight: "500", color: colors.textMuted },

  levelBlock: { alignItems: "flex-end" },
  levelValue: { fontSize: 24, fontWeight: "700", color: colors.textPrimary, lineHeight: 28 },
  levelUnit: { fontSize: 12, color: colors.textMuted, marginTop: -2 },

  stationName: { fontSize: 17, fontWeight: "600", color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.xxs },
  slugText: { fontSize: 11, fontFamily: "monospace", color: colors.textMuted, marginBottom: spacing.md },

  deltaCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deltaLeft: { flex: 1 },
  deltaTextRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  deltaIcon: { fontSize: 14, fontWeight: "700" },
  deltaText: { fontSize: 13, fontWeight: "600" },

  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  statusTagText: { fontSize: 11, color: colors.textSecondary, fontWeight: "500" },
  exploreBtn: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exploreBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },

  emptyBox: { alignItems: "center", paddingVertical: 48, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textMuted },

  sparklineEmpty: { width: 64, height: 24, backgroundColor: colors.surfaceContainerLow, borderRadius: 4 },
  sparklineArea: { flex: 1, position: "relative" },
  sparkBar: { position: "absolute", width: 3, borderRadius: 1.5 },
});
