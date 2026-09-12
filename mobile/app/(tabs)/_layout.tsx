import React from "react";
import { Tabs } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { Text, View } from "react-native";

function MapIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color }}>
      ◎
    </Text>
  );
}

function WatchlistIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color }}>
      ☰
    </Text>
  );
}

function ForecastIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size, color }}>
      📈
    </Text>
  );
}

function AssistantIcon({ color, size }: { color: string; size: number }) {
  return (
    <View
      style={{
        width: size + 12,
        height: size + 12,
        borderRadius: (size + 12) / 2,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: size - 2, color: colors.onPrimary, fontWeight: "700" }}>
        ✦
      </Text>
    </View>
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
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: "500",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: MapIcon,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watchlist",
          tabBarIcon: WatchlistIcon,
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: "Forecast",
          tabBarIcon: ForecastIcon,
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
