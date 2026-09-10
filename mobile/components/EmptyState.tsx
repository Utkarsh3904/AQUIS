import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, typography } from "../theme/colors";
import { spacing } from "../theme/spacing";

interface EmptyStateProps {
  title: string;
  message?: string;
  loading?: boolean;
}

export function EmptyState({ title, message, loading }: EmptyStateProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.subheading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
