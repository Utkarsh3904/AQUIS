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

export default function MapScreen() {
  const router = useRouter();
  const { data: stations } = useStations();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Station Map</Text>
        <Text style={styles.subtitle}>
          Interactive map available on mobile • {stations.length} stations
        </Text>
      </View>
      <FlatList
        data={stations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/station/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{item.station}</Text>
              <Text style={styles.rowDistrict}>{item.district}</Text>
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowCoords}>
                {item.lat.toFixed(2)}°N, {item.lon.toFixed(2)}°E
              </Text>
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
  chevron: { fontSize: 20, color: colors.textMuted },
});
