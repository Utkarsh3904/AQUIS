import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { useStations } from "../../lib/hooks";
import { USE_MOCKS } from "../../lib/env";
import { getOnboardingState } from "../../lib/onboarding";
import { formatRelativeTime } from "../../lib/timezone";
import type { StationListItem } from "../../types/station";

type SortMode = "latest" | "name" | "district";

export default function WatchlistScreen() {
  const router = useRouter();
  const { data: stations, loading, error, refetch } = useStations();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    getOnboardingState().then((s) => setUserName(s.name ?? ""));
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  // ── Derived data from real station list ──
  const stationCount = stations.length;

  const syncTime = useMemo(() => {
    if (stations.length === 0) return null;
    let latest = "";
    for (const s of stations) {
      if (s.last_ts && s.last_ts > latest) latest = s.last_ts;
    }
    if (!latest) return null;
    const d = new Date(latest);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  }, [stations]);

  const syncDate = useMemo(() => {
    if (stations.length === 0) return null;
    let latest = "";
    for (const s of stations) {
      if (s.last_ts && s.last_ts > latest) latest = s.last_ts;
    }
    if (!latest) return null;
    const d = new Date(latest);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }, [stations]);

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stations) {
      counts[s.district] = (counts[s.district] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [stations]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = stations;
    if (selectedDistrict) {
      list = list.filter((s) => s.district === selectedDistrict);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [stations, selectedDistrict, search]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortMode === "latest") {
      list.sort((a, b) => (b.last_ts ?? "").localeCompare(a.last_ts ?? ""));
    } else if (sortMode === "name") {
      list.sort((a, b) => a.station.localeCompare(b.station));
    } else if (sortMode === "district") {
      list.sort((a, b) => a.district.localeCompare(b.district) || a.station.localeCompare(b.station));
    }
    return list;
  }, [filtered, sortMode]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Loading state ──
  if (loading && stationCount === 0) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading stations...</Text>
        </View>
      </View>
    );
  }

  // ── Error state ──
  if (error && stationCount === 0) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>AQUIS ML</Text>
              <Text style={styles.headerSubtitle}>
                <Text style={[styles.headerDot, { color: colors.negative }]}>●</Text> Offline
              </Text>
            </View>
            <View style={styles.headerRight}>
              {initials ? (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to reach ML service</Text>
          <Text style={styles.errorText}>
            {error.body?.detail ?? error.body?.error ?? "Network error"}.
            Check that the tunnel is running and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>AQUIS ML</Text>
            <Text style={styles.headerSubtitle}>
              <Text style={styles.headerDot}>●</Text> {stationCount} Stns Active • Live
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.syncText}>SYNC: {syncTime ?? "—"}</Text>
            {initials ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Network summary card ── */}
      <View style={styles.networkCard}>
        <View style={styles.networkCardHeader}>
          <Text style={styles.networkCardLabel}>HYDROLOGICAL TELEMETRY</Text>
          <View style={styles.networkLiveBadge}>
            <View style={styles.networkLiveDot} />
            <Text style={styles.networkLiveText}>Live Ingestion</Text>
          </View>
        </View>
        <Text style={styles.networkHeadline}>
          {stationCount} Active DWLR
        </Text>
        <View style={styles.networkSyncRow}>
          <Text style={styles.networkSyncIcon}>⟳</Text>
          <Text style={styles.networkSyncText}>
            Last sync: {syncDate ?? "—"}{"\n"}{syncTime ?? ""}
          </Text>
        </View>
        <Text style={styles.networkCaption}>
          Unique Station Slugs • Coverage discovered on forecast query
        </Text>
      </View>

      {/* ── District filter chips ── */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>DISTRICTS FILTER</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ name: null, count: stationCount }, ...districtCounts]}
          keyExtractor={(item) => item.name ?? "all"}
          contentContainerStyle={styles.chipList}
          renderItem={({ item }) => {
            const isActive = item.name === selectedDistrict || (item.name === null && selectedDistrict === null);
            const label = item.name ? `${item.name} (${item.count})` : `All Districts (${item.count})`;
            return (
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedDistrict(item.name)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Search + Sort ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search station, slug or district..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortMode((prev) => prev === "latest" ? "name" : prev === "name" ? "district" : "latest")}
          activeOpacity={0.7}
        >
          <Text style={styles.sortText}>{sortMode === "latest" ? "Latest ▾" : sortMode === "name" ? "Name ▾" : "District ▾"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Station list ── */}
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.slug ?? `station-${item.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <StationCard
            station={item}
            onPress={() => {
              const param = USE_MOCKS ? String(item.id) : (item.slug ?? String(item.id));
              router.push(`/station/${param}`);
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No stations found</Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different search term" : "No stations loaded"}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ── Station card component ──
function StationCard({
  station,
  onPress,
}: {
  station: StationListItem;
  onPress: () => void;
}) {
  const timeAgo = formatRelativeTime(station.last_ts);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.cardDistrictBadge}>
          <Text style={styles.cardDistrictText}>{station.district}</Text>
        </View>
        <Text style={styles.cardTimestamp}>{timeAgo}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>
        {station.station}
      </Text>
      {station.slug ? (
        <Text style={styles.cardSlug} numberOfLines={1}>
          slug: {station.slug}
        </Text>
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.cardExplore}>Explore →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    ...typography.headlineMd,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  headerDot: {
    color: colors.positive,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  syncText: {
    ...typography.codeMono,
    color: colors.textMuted,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    fontWeight: "700",
  },

  // ── Loading state ──
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.textMuted,
  },

  // ── Endpoint banner ──
  endpointBanner: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  endpointLabel: {
    ...typography.codeMono,
    color: colors.primary,
    fontWeight: "600",
  },
  endpointValue: {
    ...typography.codeMono,
    color: colors.textSecondary,
  },

  // ── Network summary card ──
  networkCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  networkCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  networkCardLabel: {
    ...typography.labelSm,
    color: colors.textMuted,
  },
  networkLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  networkLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.positive,
  },
  networkLiveText: {
    ...typography.labelSm,
    color: colors.positive,
  },
  networkHeadline: {
    ...typography.headlineLgMobile,
    color: colors.textPrimary,
  },
  networkSyncRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  networkSyncIcon: {
    ...typography.bodyMd,
    color: colors.textMuted,
  },
  networkSyncText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  networkCaption: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // ── Error state ──
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.headlineSm,
    color: colors.textPrimary,
    textAlign: "center",
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  retryText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontWeight: "600",
  },

  // ── District filter ──
  filterSection: {
    marginBottom: spacing.md,
  },
  filterLabel: {
    ...typography.labelSm,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.labelMd,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },

  // ── Search + Sort ──
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.textPrimary,
    padding: 0,
  },
  sortButton: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  sortText: {
    ...typography.labelMd,
    color: colors.textSecondary,
  },

  // ── List ──
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  separator: {
    height: spacing.sm,
  },

  // ── Station card ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDistrictBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  cardDistrictText: {
    ...typography.labelSm,
    color: colors.textSecondary,
  },
  cardTimestamp: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  cardName: {
    ...typography.titleMd,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  cardSlug: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  cardBottom: {
    marginTop: spacing.sm,
    alignItems: "flex-end",
  },
  cardExplore: {
    ...typography.labelMd,
    color: colors.primary,
    fontWeight: "600",
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.textMuted,
  },
});
