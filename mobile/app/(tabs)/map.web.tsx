import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { useStations } from "../../lib/hooks";
import { USE_MOCKS } from "../../lib/env";

export default function MapScreen() {
  const router = useRouter();
  const { data: stations } = useStations();

  const hasCoords = stations.some((s) => s.lat !== 0 || s.lon !== 0);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Station Map</Text>
        {hasCoords ? (
          <Text style={styles.subtitle}>
            Interactive map • {stations.length} stations
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            Map coordinates pending from ML service • {stations.length} stations
          </Text>
        )}
      </View>

      {!hasCoords && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingIcon}>📍</Text>
          <Text style={styles.pendingTitle}>Map data pending</Text>
          <Text style={styles.pendingBody}>
            Lat/lon coordinates will be added to the station list endpoint.{"\n"}
            Station list is browsable below.
          </Text>
        </View>
      )}

      <FlatList
        data={stations}
        keyExtractor={(item) => String(item.id ?? item.slug)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              const param = USE_MOCKS ? String(item.id) : (item.slug ?? String(item.id));
              router.push(`/station/${param}`);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{item.station}</Text>
              <Text style={styles.rowDistrict}>{item.district}</Text>
            </View>
            <View style={styles.rowMeta}>
              {hasCoords ? (
                <Text style={styles.rowCoords}>
                  {item.lat.toFixed(2)}°N, {item.lon.toFixed(2)}°E
                </Text>
              ) : (
                <Text style={styles.rowSlug} numberOfLines={1}>{item.slug}</Text>
              )}
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: { ...typography.heading, color: colors.primary, fontSize: 24 },
  subtitle: { ...typography.caption, color: colors.textMuted },
  pendingCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  pendingIcon: { fontSize: 28 },
  pendingTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  pendingBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  row: {
    backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  rowInfo: { flex: 1, gap: spacing.xs },
  rowName: { ...typography.subheading, color: colors.textPrimary },
  rowDistrict: { ...typography.caption, color: colors.textSecondary },
  rowMeta: { alignItems: "flex-end", gap: spacing.xs },
  rowCoords: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  rowSlug: { ...typography.caption, color: colors.textMuted, fontSize: 10, maxWidth: 120 },
  chevron: { fontSize: 20, color: colors.textMuted },
});
