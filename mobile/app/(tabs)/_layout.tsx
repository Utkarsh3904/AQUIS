import React from "react";
import { Tabs } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { Text } from "react-native";

function WatchlistIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color, fontWeight: "600" }}>
      ☰
    </Text>
  );
}

function MapIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color, fontWeight: "600" }}>
      ◉
    </Text>
  );
}

function AssistantIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color, fontWeight: "700" }}>
      ✦
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Watchlist",
          tabBarIcon: WatchlistIcon,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: MapIcon,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistant",
          tabBarIcon: AssistantIcon,
        }}
      />
    </Tabs>
  );
}
