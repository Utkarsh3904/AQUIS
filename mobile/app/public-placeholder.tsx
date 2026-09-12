import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../theme/colors";
import { spacing, radii } from "../theme/spacing";
import { saveOnboardingPersona } from "../lib/onboarding";

export default function PublicPlaceholderScreen() {
  const router = useRouter();

  const handleSwitch = async () => {
    await saveOnboardingPersona("researcher");
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🚧</Text>
        </View>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.message}>
          The public view is under construction. Check back soon for
          groundwater level information in your area.
        </Text>
        <TouchableOpacity
          style={styles.switchButton}
          onPress={handleSwitch}
          activeOpacity={0.7}
        >
          <Text style={styles.switchText}>Switch to Researcher →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 22,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  switchButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  switchText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontWeight: "600",
  },
});
