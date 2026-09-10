import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { useStations } from "../../lib/hooks";
import { formatIstFullDate } from "../../lib/timezone";
import type { StationListItem } from "../../types/station";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function WatchlistScreen() {
  const router = useRouter();
  const { data: stations, loading, error } = useStations();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const districtCount = [...new Set(stations.map((s) => s.district))].length;
  const criticalCount = stations.filter(
    (s) => !s.slug
  ).length;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Greeting header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()} 👋</Text>
        <Text style={styles.headerTitle}>AQUIS</Text>
        <Text style={styles.date}>{formatIstFullDate(new Date().toISOString())}</Text>
      </View>

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.kpiCard1 }]}>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {stations.length}
          </Text>
          <Text style={styles.kpiLabel}>Active</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.kpiCard2 }]}>
          <Text style={[styles.kpiValue, { color: colors.positive }]}>
            {districtCount}
          </Text>
          <Text style={styles.kpiLabel}>Districts</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.kpiCard3 }]}>
          <Text style={[styles.kpiValue, { color: colors.warning }]}>
            {criticalCount}
          </Text>
          <Text style={styles.kpiLabel}>No Forecast</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.kpiCard4 }]}>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            UP
          </Text>
          <Text style={styles.kpiLabel}>State</Text>
        </View>
      </View>

      {/* Station list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Stations</Text>
        <Text style={styles.listCount}>{stations.length} total</Text>
      </View>

      <FlatList
        data={stations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <StationRow station={item} onPress={() => router.push(`/station/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

function StationRow({
  station,
  onPress,
}: {
  station: StationListItem;
  onPress: () => void;
}) {
  const hasForecast = station.slug !== null;
  return (
    <TouchableOpacity style={styles.stationRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.stationInfo}>
        <Text style={styles.stationName} numberOfLines={1}>
          {station.station}
        </Text>
        <Text style={styles.stationDistrict}>{station.district}</Text>
      </View>
      <View style={styles.stationMeta}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: hasForecast ? colors.positiveBg : colors.divider,
            },
          ]}
        >
          <View
            style={[
              styles.badgeDot,
              {
                backgroundColor: hasForecast
                  ? colors.positive
                  : colors.textMuted,
              },
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              {
                color: hasForecast ? colors.positive : colors.textMuted,
              },
            ]}
          >
            {hasForecast ? "Forecast" : "No forecast"}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 24,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kpiRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  kpiValue: {
    ...typography.kpiValue,
  },
  kpiLabel: {
    ...typography.statLabel,
    color: colors.textSecondary,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  listCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  stationRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stationInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  stationName: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  stationDistrict: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stationMeta: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    gap: spacing.xs,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: "600",
    fontSize: 11,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
  separator: {
    height: spacing.sm,
  },
});
