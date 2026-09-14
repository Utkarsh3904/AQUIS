import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { spacing, radii, elevation } from "../theme/spacing";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TABS = [
  { key: "index", label: "Map", icon: "map-outline" as const, activeIcon: "map" as const },
  { key: "watchlist", label: "Watchlist", icon: "list-outline" as const, activeIcon: "list" as const },
  { key: "forecast", label: "Forecast", icon: "stats-chart-outline" as const, activeIcon: "stats-chart" as const },
  { key: "assistant", label: "Assistant", icon: "chatbubble-outline" as const, activeIcon: "chatbubble" as const },
] as const;

const TAB_SIZE = 56;
const ICON_SIZE = 22;

export default function BottomNav({ state, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index];
  const currentKey = currentRoute?.name ?? "index";

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const isActive = currentKey === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => {
                if (!isActive) {
                  navigation.navigate(tab.key);
                }
              }}
            >
              <View style={[styles.iconCircle, isActive && styles.iconCircleActive]}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={ICON_SIZE}
                  color={isActive ? colors.onPrimary : colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 20,
    paddingHorizontal: spacing.lg,
    zIndex: 999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    ...elevation.medium,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    gap: 2,
  },
  iconCircle: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderRadius: TAB_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: colors.textMuted,
    marginTop: 1,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});
