import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { colors, typography } from "../theme/colors";
import { spacing, radii, elevation } from "../theme/spacing";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TABS = [
  { key: "index", label: "Map", icon: "◎" },
  { key: "watchlist", label: "Watchlist", icon: "☰" },
  { key: "forecast", label: "Forecast", icon: "📈" },
] as const;

export default function BottomNav({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

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
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => {
            if (currentKey !== "assistant") {
              navigation.navigate("assistant");
            }
          }}
        >
          <Text style={styles.fabIcon}>✦</Text>
        </TouchableOpacity>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    ...elevation.medium,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    gap: 2,
  },
  tabIcon: {
    fontSize: 16,
    color: colors.textMuted,
  },
  tabIconActive: {
    color: colors.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.xs,
    ...elevation.low,
  },
  fabIcon: {
    fontSize: 18,
    color: colors.onPrimary,
    fontWeight: "700",
  },
});
