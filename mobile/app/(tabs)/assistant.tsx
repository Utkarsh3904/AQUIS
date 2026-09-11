import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { postAssistantChat } from "../../lib/api";
import type { AssistantResponse } from "../../types/assistant";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  facts?: AssistantResponse["facts"];
}

const SUGGESTED_QUESTIONS = [
  "Is the level rising or falling?",
  "What is the 30-day forecast?",
  "How does this compare to district average?",
  "Show me the trend analysis",
];

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await postAssistantChat({
        question,
        station: "Ramchhitoni Sahawar (UP-011)",
      });

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: res.answer,
        facts: res.facts,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "Assistant unavailable — ML service is starting up.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AS</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>AQUIS Assistant</Text>
            <Text style={styles.headerSubtitle}>Groundwater intelligence at your fingertips</Text>
          </View>
        </View>
      </View>

      {/* Telemetry snapshot card */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemetryHeader}>
          <Text style={styles.telemetryLabel}>Latest Observation</Text>
          <View style={styles.telemetryLiveDot} />
        </View>
        <Text style={styles.telemetryStation}>Ramchhitoni Sahawar (UP-011)</Text>
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryStat}>
            <Text style={styles.telemetryStatLabel}>Observed</Text>
            <Text style={styles.telemetryStatValue}>-2.84 m</Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryStat}>
            <Text style={styles.telemetryStatLabel}>30d Forecast</Text>
            <Text style={[styles.telemetryStatValue, { color: colors.positive }]}>
              -2.72 m
            </Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryStat}>
            <Text style={styles.telemetryStatLabel}>Band</Text>
            <Text style={styles.telemetryStatValue}>±1.61 m</Text>
          </View>
        </View>
      </View>

      {/* Chat area */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Ask about groundwater</Text>
            <Text style={styles.emptyMessage}>
              Get instant facts about any station — level, trends, forecast outlook
            </Text>
            <View style={styles.suggestedChips}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.chip}
                  onPress={() => sendMessage(q)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={
                  item.role === "user"
                    ? styles.userBubbleText
                    : styles.assistantBubbleText
                }
              >
                {item.text}
              </Text>

              {/* Facts panel */}
              {item.facts && typeof item.facts === "object" && "last" in item.facts && (
                <View style={styles.factsPanel}>
                  {/* ── Current level ── */}
                  <View style={styles.factsSection}>
                    <Text style={styles.factsSectionTitle}>Observed Level</Text>
                    <View style={styles.factsRow}>
                      <Text style={styles.factsLabel}>Current</Text>
                      <Text style={styles.factsValue}>{item.facts.last} m</Text>
                    </View>
                    <View style={styles.factsRow}>
                      <Text style={styles.factsLabel}>Date</Text>
                      <Text style={styles.factsValue}>{item.facts.last_date}</Text>
                    </View>
                    <View style={styles.factsRow}>
                      <Text style={styles.factsLabel}>Range</Text>
                      <Text style={styles.factsValue}>{item.facts.min} to {item.facts.max} m</Text>
                    </View>
                  </View>

                  {/* ── Change stats ── */}
                  <View style={styles.factsSection}>
                    <Text style={styles.factsSectionTitle}>Level Changes</Text>
                    {[
                      { label: "7d", val: item.facts.change_7d },
                      { label: "30d", val: item.facts.change_30d },
                      { label: "60d", val: item.facts.change_60d },
                      { label: "180d", val: item.facts.change_180d },
                    ].map((c) => (
                      <View key={c.label} style={styles.factsRow}>
                        <Text style={styles.factsLabel}>{c.label} change</Text>
                        <Text style={[styles.factsValue, { color: c.val > 0 ? colors.positive : c.val < 0 ? colors.negative : colors.textPrimary }]}>
                          {c.val > 0 ? "+" : ""}{c.val} m
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* ── District context ── */}
                  <View style={styles.factsSection}>
                    <Text style={styles.factsSectionTitle}>District Context</Text>
                    {item.facts.district_median != null && (
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>District median</Text>
                        <Text style={styles.factsValue}>{item.facts.district_median} m</Text>
                      </View>
                    )}
                    {item.facts.district_n_stations != null && (
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Active stations</Text>
                        <Text style={styles.factsValue}>{item.facts.district_n_stations}</Text>
                      </View>
                    )}
                    {item.facts.last != null && item.facts.district_median != null && (
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>vs. district</Text>
                        <Text style={[styles.factsValue, {
                          color: item.facts.last > item.facts.district_median ? colors.positive : colors.negative,
                        }]}>
                          {item.facts.last > item.facts.district_median ? "above" : "below"} median
                          ({Math.abs(item.facts.last - item.facts.district_median).toFixed(2)} m)
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* ── Forecast outlook ── */}
                  {item.facts.forecast && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>30-Day Forecast</Text>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Direction</Text>
                        <Text style={[styles.factsValue, {
                          color: item.facts.forecast.direction === "expected rise"
                            ? colors.positive
                            : item.facts.forecast.direction === "expected decline"
                            ? colors.negative
                            : colors.textSecondary,
                        }]}>
                          {item.facts.forecast.direction}
                        </Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Predicted level</Text>
                        <Text style={styles.factsValue}>{item.facts.forecast.day30_pred} m</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>30d change</Text>
                        <Text style={[styles.factsValue, {
                          color: item.facts.forecast.change_30d_pred > 0 ? colors.positive : colors.negative,
                        }]}>
                          {item.facts.forecast.change_30d_pred > 0 ? "+" : ""}
                          {item.facts.forecast.change_30d_pred} m
                        </Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>90% band</Text>
                        <Text style={styles.factsValue}>±{item.facts.forecast.band_half} m</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Plausible</Text>
                        <Text style={[styles.factsValue, {
                          color: item.facts.forecast.plausible ? colors.positive : colors.warning,
                        }]}>
                          {item.facts.forecast.plausible ? "Yes" : "No — exercise caution"}
                        </Text>
                      </View>
                      {item.facts.forecast.high_uncertainty && (
                        <View style={styles.factsRow}>
                          <Text style={styles.factsLabel}>Confidence</Text>
                          <Text style={[styles.factsValue, { color: colors.warning }]}>
                            High uncertainty (stride RMSE {item.facts.forecast.station_stride_rmse} m)
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}

        {/* Suggested follow-ups (show after assistant response) */}
        {messages.length > 0 && messages.length % 2 === 0 && !loading && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.followUpScroll}
            contentContainerStyle={styles.followUpContent}
          >
            {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.followUpChip}
                onPress={() => sendMessage(q)}
                activeOpacity={0.7}
              >
                <Text style={styles.followUpChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textOnPrimary,
    fontSize: 14,
  },
  headerTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  telemetryCard: {
    backgroundColor: colors.telemetryCard,
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  telemetryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  telemetryLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  telemetryLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.positive,
  },
  telemetryStation: {
    ...typography.body,
    color: colors.telemetryCardText,
    fontWeight: "500",
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  telemetryStat: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  telemetryStatLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
  },
  telemetryStatValue: {
    ...typography.subheading,
    color: colors.telemetryCardText,
    fontSize: 16,
  },
  telemetryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  chatContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  suggestedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  chip: {
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.caption,
    color: colors.chipText,
    fontWeight: "500",
  },
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: spacing.xs,
  },
  userBubbleText: {
    ...typography.body,
    color: colors.textOnPrimary,
  },
  assistantBubbleText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  factsPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.md,
  },
  factsSection: {
    gap: spacing.xs,
  },
  factsSectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  factsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  factsLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  factsValue: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  typingIndicator: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  followUpScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  followUpContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  followUpChip: {
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.chipText + "30",
  },
  followUpChipText: {
    ...typography.caption,
    color: colors.chipText,
    fontWeight: "500",
  
  },
  inputBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.primaryMuted,
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textOnPrimary,
  },
});
