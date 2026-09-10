import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { saveOnboardingName } from "../../lib/onboarding";

export default function OnboardingNameScreen() {
  const router = useRouter();
  const [name, setName] = useState("");

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveOnboardingName(trimmed);
    router.push("/onboarding/persona");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.logo}>AQUIS</Text>
          <Text style={styles.subtitle}>Groundwater Intelligence</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>What should we call you?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!name.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  greeting: {
    ...typography.body,
    color: "rgba(255,255,255,0.8)",
  },
  logo: {
    fontWeight: "800",
    fontSize: 42,
    lineHeight: 48,
    color: colors.textOnPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.7)",
  },
  inputSection: {
    gap: spacing.md,
  },
  label: {
    ...typography.subheading,
    color: colors.textOnPrimary,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...typography.body,
    color: colors.textOnPrimary,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.textOnPrimary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.primary,
    fontSize: 16,
  },
});
