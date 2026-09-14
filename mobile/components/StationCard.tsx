import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography } from "../theme/colors";
import { spacing, radii } from "../theme/spacing";
import { formatRelativeTime } from "../lib/timezone";
import type { StationListItem } from "../types/station";

interface StationCardProps {
  station: StationListItem;
  onPress: () => void;
}

export function StationCard({ station, onPress }: StationCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {station.station}
        </Text>
        <Text style={styles.district} numberOfLines={1} ellipsizeMode="tail">{station.district}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.time}>{formatRelativeTime(station.last_ts)}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  district: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
});
