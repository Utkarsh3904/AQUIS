import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useStations } from "../lib/hooks";
import { setPendingSlug } from "../lib/pendingSlug";
import { colors, typography } from "../theme/colors";
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../theme/spacing";
import type { StationListItem } from "../types/station";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreStation(s: StationListItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const name = s.station.toLowerCase();
  const dist = s.district.toLowerCase();
  const slug = (s.slug ?? "").toLowerCase();
  if (name === q) return 100;
  if (dist === q) return 90;
  if (name.startsWith(q)) return 80;
  if (dist.startsWith(q)) return 70;
  if (name.includes(q)) return 60;
  if (dist.includes(q)) return 50;
  if (slug.includes(q)) return 40;
  if (fuzzyMatch(name, q)) return 30;
  if (fuzzyMatch(dist, q)) return 20;
  return 0;
}

function StationCard({
  item,
  onPressExplore,
}: {
  item: StationListItem;
  onPressExplore: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardTopLeft}>
          <Text style={s.stationName} numberOfLines={2} ellipsizeMode="tail">
            {item.station}
          </Text>
          <Text style={s.stationDistrict} numberOfLines={1} ellipsizeMode="tail">{item.district}</Text>
        </View>
        <TouchableOpacity
          style={s.exploreBtn}
          activeOpacity={0.7}
          onPress={onPressExplore}
        >
          <Text style={s.exploreBtnText}>Explore →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function StationSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    placeholder?: string;
    returnTo?: string;
  }>();
  const { data: stations, loading: stationsLoading } = useStations();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

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
      list = list
        .map((s) => ({ s, score: scoreStation(s, searchQuery) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.s);
    } else {
      list.sort((a, b) => {
        const cmp = (b.last_ts ?? "").localeCompare(a.last_ts ?? "");
        return sortAsc ? -cmp : cmp;
      });
    }

    return list;
  }, [stations, searchQuery, selectedDistrict, sortAsc]);

  const activeCount = useMemo(
    () => stations.filter((s) => s.slug).length,
    [stations]
  );

  const handleSort = useCallback(() => {
    setSortAsc((prev) => !prev);
  }, []);

  const handleDistrictChip = useCallback(
    (district: string) => {
      setSelectedDistrict((prev) => (prev === district ? null : district));
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: StationListItem }) => (
      <StationCard
        item={item}
        onPressExplore={() => {
          if (!item.slug) return;
          if (params.returnTo === "assistant") {
            setPendingSlug(item.slug);
            router.back();
          } else {
            router.push(`/station/${item.slug}`);
          }
        }}
      />
    ),
    [router, params.returnTo]
  );

  const keyExtractor = useCallback(
    (item: StationListItem) => item.slug ?? `station-${item.id}`,
    []
  );

  const placeholder =
    params.placeholder ?? "Search stations, districts, or slugs...";

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
              <View>
                <Text style={s.greeting}>Hello, User</Text>
                <Text style={s.countTitle}>
                  {activeCount} Active DWLR
                </Text>
              </View>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>U</Text>
              </View>
            </View>

            <View style={s.searchRow}>
              <View style={s.searchBar}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  ref={inputRef}
                  style={s.searchInput}
                  placeholder={placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    activeOpacity={0.7}
                  >
                    <Text style={s.clearBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={s.sortBtn}
                onPress={handleSort}
                activeOpacity={0.7}
              >
                <Text style={s.sortIcon}>↕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.chipsScrollWrap}>
              <FlatList
                horizontal
                data={districts}
                keyExtractor={(d) => d}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsRow}
                renderItem={({ item: d }) => (
                  <TouchableOpacity
                    style={[
                      s.chip,
                      selectedDistrict === d && s.chipActive,
                    ]}
                    onPress={() => handleDistrictChip(d)}
                  >
                    <Text
                      style={[
                        s.chipText,
                        selectedDistrict === d && s.chipTextActive,
                      ]}
                    >
                      {d.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {stationsLoading && (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.loadingText}>Loading stations...</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !stationsLoading ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>No stations found</Text>
              <Text style={s.emptyText}>
                Try adjusting your search or filters.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={s.listContent}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={11}
        initialNumToRender={12}
        getItemLayout={(_, index) => ({
          length: 92,
          offset: 92 * index,
          index,
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.xxs,
  },
  countTitle: {
    ...typography.headlineLg,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...elevation.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  clearBtn: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "600",
    paddingHorizontal: spacing.xs,
  },
  sortBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortIcon: { fontSize: 16, color: colors.textSecondary },

  chipsScrollWrap: { maxHeight: 44, marginBottom: spacing.xs },
  chipsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
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
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  chipTextActive: { color: "#FFFFFF" },

  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: { ...typography.bodySm, color: colors.textMuted },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTopLeft: { flex: 1 },
  stationName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 22,
  },
  stationDistrict: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  exploreBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
