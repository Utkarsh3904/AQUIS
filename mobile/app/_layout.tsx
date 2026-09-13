import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "../theme/colors";
import { getOnboardingState } from "../lib/onboarding";

export default function RootLayout() {
  const [onboardingState, setOnboardingState] = useState<{
    complete: boolean;
    persona: string | null;
  } | null>(null);

  useEffect(() => {
    getOnboardingState().then((state) => {
      setOnboardingState({
        complete: state.complete,
        persona: state.persona,
      });
    });
  }, []);

  if (onboardingState === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initialRoute = !onboardingState.complete
    ? "onboarding/name"
    : onboardingState.persona === "public"
    ? "public-placeholder"
    : "(tabs)";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="onboarding/name" />
        <Stack.Screen name="onboarding/persona" />
        <Stack.Screen name="public-placeholder" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="station/[id]"
          options={{
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="station-search"
          options={{
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="forecast/[slug]"
          options={{
            presentation: "card",
            animation: "slide_from_right",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
