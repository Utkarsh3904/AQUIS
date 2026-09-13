import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStations } from "../../lib/hooks";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StationListItem } from "../../types/station";

const STORAGE_KEY_NAME = "aquis_user_name";
const STORAGE_KEY_PERSONA = "aquis_persona";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: stations, loading, error, refetch } = useStations();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"latest" | "name" | "district">("latest");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [userName, setUserName] = useState("Researcher");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_NAME).then((n) => {
      if (n) setUserName(n);
    });
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  const districts = useMemo(() => {
    const set = new Set(stations.map((s) => s.district).filter(Boolean));
    return Array.from(set).sort();
  }, [stations]);

  const filtered = useMemo(() => {
    let list = [...stations];
    if (selectedDistrict) {
      list = list.filter((s) => s.district === selectedDistrict);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
      );
    }
    if (sortMode === "name") list.sort((a, b) => a.station.localeCompare(b.station));
    else if (sortMode === "district") list.sort((a, b) => a.district.localeCompare(b.district) || a.station.localeCompare(b.station));
    else list.sort((a, b) => (b.last_ts ?? "").localeCompare(a.last_ts ?? ""));
    return list;
  }, [stations, searchQuery, sortMode, selectedDistrict]);

  const stationCount = filtered.length;
  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

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

  if (error && stationCount === 0) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to reach ML service</Text>
          <Text style={styles.errorText}>
            {error.body?.detail ?? error.body?.error ?? "Network error"}.
            Check that the tunnel is running and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderStationItem = ({ item }: { item: StationListItem }) => (
    <TouchableOpacity
      style={styles.stationCard}
      activeOpacity={0.7}
      onPress={() => item.slug && router.push(`/station/${item.slug}`)}
    >
      <View style={styles.stationHeader}>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName} numberOfLines={1}>{item.station}</Text>
          <Text style={styles.stationSlug} numberOfLines={1}>{item.slug ?? "—"}</Text>
        </View>
        <View style={styles.stationBadge}>
          <Text style={styles.stationBadgeText}>{item.district}</Text>
        </View>
      </View>
      <View style={styles.stationFooter}>
        <Text style={styles.stationTime}>
          {item.last_ts ? new Date(item.last_ts).toLocaleDateString() : "—"}
        </Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => item.slug && router.push(`/station/${item.slug}`)}
        >
          <Text style={styles.exploreBtnText}>Explore →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.headerTitle}>{stationCount} Active DWLR</Text>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={() => router.push("/station-search")}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search stations, districts, or slugs...</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSortMode(sortMode === "latest" ? "name" : sortMode === "name" ? "district" : "latest")}
        >
          <Text style={styles.sortBtnText}>{sortMode === "latest" ? "↕" : sortMode === "name" ? "A-Z" : "D"}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={districts}
        keyExtractor={(d) => d}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item: d }) => (
          <TouchableOpacity
            style={[styles.districtChip, selectedDistrict === d && styles.districtChipActive]}
            onPress={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
          >
            <Text style={[styles.districtChipText, selectedDistrict === d && styles.districtChipTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.slug ?? `station-${item.id}`}
        renderItem={renderStationItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState title="No stations match" message="Try a different search or district filter." />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  errorTitle: { ...typography.subheading, color: colors.textPrimary, textAlign: "center" },
  errorText: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  retryButton: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  retryText: { ...typography.labelMd, color: colors.onPrimary, fontWeight: "600" },
  listContent: { paddingBottom: BOTTOM_NAV_CLEARANCE },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + spacing.lg, paddingBottom: spacing.md },
  headerLeft: { gap: spacing.xs },
  greeting: { ...typography.body, color: colors.textMuted },
  headerTitle: { ...typography.headlineMd, color: colors.textPrimary },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  avatarText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: "700" },
  searchRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { ...typography.body, color: colors.textMuted, flex: 1 },
  sortBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border },
  sortBtnText: { ...typography.labelMd, color: colors.textSecondary },
  chipRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  districtChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  districtChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  districtChipText: { ...typography.labelSm, color: colors.textSecondary },
  districtChipTextActive: { color: colors.onPrimary },
  stationCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  stationInfo: { flex: 1, gap: spacing.xxs },
  stationName: { ...typography.titleMd, color: colors.textPrimary },
  stationSlug: { ...typography.codeMono, color: colors.textMuted, fontSize: 11 },
  stationBadge: { backgroundColor: colors.surfaceContainerLow, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  stationBadgeText: { ...typography.labelSm, color: colors.textSecondary, fontSize: 10 },
  stationFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stationTime: { ...typography.bodySm, color: colors.textMuted },
  exploreBtn: { backgroundColor: colors.primaryLight, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  exploreBtnText: { ...typography.labelSm, color: colors.primaryDeep, fontWeight: "600" },
});
