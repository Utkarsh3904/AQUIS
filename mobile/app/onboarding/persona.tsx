import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { saveOnboardingPersona } from "../../lib/onboarding";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OnboardingPersonaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleSelect = async (persona: "researcher" | "public") => {
    await saveOnboardingPersona(persona);
    if (persona === "public") {
      router.replace("/public-placeholder");
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>How will you use AQUIS?</Text>
          <Text style={styles.subtitle}>
            This helps us customize your experience
          </Text>
        </View>

        <View style={styles.cardsSection}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect("researcher")}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardEmoji}>🔬</Text>
            </View>
            <Text style={styles.cardTitle}>Researcher</Text>
            <Text style={styles.cardDesc}>
              Full access to forecasts, analytics, and the AI assistant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect("public")}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardEmoji}>💧</Text>
            </View>
            <Text style={styles.cardTitle}>Public</Text>
            <Text style={styles.cardDesc}>
              View groundwater levels and basic information
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxxl,
    justifyContent: "center",
    gap: spacing.xxxxl,
  },
  headerSection: {
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textOnPrimary,
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  cardsSection: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.textOnPrimary,
    fontSize: 18,
  },
  cardDesc: {
    ...typography.body,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
  },
});
