import React, { useState, useRef, useMemo } from "react";
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
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";
import { postAssistantChat } from "../../lib/api";
import { useStations } from "../../lib/hooks";
import type { AssistantResponse } from "../../types/assistant";
import type { StationFacts } from "../../types/station";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  facts?: AssistantResponse["facts"];
  stationName?: string;
  mentions?: string[];
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
        stationName: res.station,
        mentions: res.mentions,
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
                  {/* ── Station header ── */}
                  {item.stationName && (
                    <View style={styles.factsStationHeader}>
                      <Text style={styles.factsStationName}>{item.stationName}</Text>
                    </View>
                  )}

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

                  {/* ── Primary drivers ── */}
                  {item.facts.drivers && item.facts.drivers.length > 0 && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>Primary Drivers</Text>
                      {item.facts.drivers.slice(0, 3).map((d: { driver: string; corr: number }, i: number) => (
                        <View key={i} style={styles.factsRow}>
                          <Text style={styles.factsLabel}>{d.driver}</Text>
                          <Text style={styles.factsValue}>
                            r = {d.corr > 0 ? "+" : ""}{d.corr.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Recent rainfall ── */}
                  {item.facts.rain_recent && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>Recent Rainfall</Text>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Last rain</Text>
                        <Text style={styles.factsValue}>{item.facts.rain_recent.last_rain_date}</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>7-day</Text>
                        <Text style={styles.factsValue}>{item.facts.rain_recent.rain_7d} mm</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>30-day</Text>
                        <Text style={styles.factsValue}>{item.facts.rain_recent.rain_30d} mm</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>90-day</Text>
                        <Text style={styles.factsValue}>{item.facts.rain_recent.rain_90d} mm</Text>
                      </View>
                    </View>
                  )}

                  {/* ── Precautions ── */}
                  {item.facts.precautions && item.facts.precautions.length > 0 && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>Precautions</Text>
                      {item.facts.precautions.map((p: { level: string; title: string; why: string }, i: number) => (
                        <View key={i} style={[styles.precautionRow, {
                          backgroundColor: p.level === "warning" ? colors.warning + "18" : colors.primary + "18",
                        }]}>
                          <Text style={[styles.precautionTitle, {
                            color: p.level === "warning" ? colors.warning : colors.primary,
                          }]}>
                            {p.level === "warning" ? "⚠" : "ℹ"} {p.title}
                          </Text>
                          <Text style={styles.precautionWhy}>{p.why}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Richer district context ── */}
                  {item.facts.district_context && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>District Overview</Text>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Median</Text>
                        <Text style={styles.factsValue}>{item.facts.district_context.median?.toFixed(2) ?? "—"} m</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Mean</Text>
                        <Text style={styles.factsValue}>{item.facts.district_context.mean?.toFixed(2) ?? "—"} m</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Range</Text>
                        <Text style={styles.factsValue}>
                          {item.facts.district_context.min_level?.toFixed(1) ?? "—"} to {item.facts.district_context.max_level?.toFixed(1) ?? "—"} m
                        </Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Stations</Text>
                        <Text style={styles.factsValue}>{item.facts.district_context.n_analysed ?? item.facts.district_context.n_stations}</Text>
                      </View>
                    </View>
                  )}

                  {/* ── Data freshness ── */}
                  {item.facts.fleet_recency && (
                    <View style={styles.factsSection}>
                      <Text style={styles.factsSectionTitle}>Data Freshness</Text>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Latest observation</Text>
                        <Text style={styles.factsValue}>{item.facts.fleet_recency.latest_date}</Text>
                      </View>
                      <View style={styles.factsRow}>
                        <Text style={styles.factsLabel}>Stations with data</Text>
                        <Text style={styles.factsValue}>{item.facts.fleet_recency.stations_with_data}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── Mentioned stations ── */}
              {item.mentions && item.mentions.length > 0 && (
                <MentionChips mentions={item.mentions} facts={item.facts} />
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

function MentionChips({
  mentions,
  facts,
}: {
  mentions: string[];
  facts?: AssistantResponse["facts"];
}) {
  const router = useRouter();
  const { data: stations } = useStations();

  const stationNames = useMemo(() => {
    if (facts && "station_names" in facts && Array.isArray(facts.station_names)) {
      return facts.station_names;
    }
    return [];
  }, [facts]);

  const resolved = useMemo(() => {
    return mentions.map((name) => {
      const isStation = stationNames.some(
        (sn) => sn.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(sn.toLowerCase())
      );
      if (!isStation) return { name, slug: null, found: false };
      const match = stations.find(
        (s) => s.station.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.station.toLowerCase())
      );
      if (!match?.slug) return { name, slug: null, found: false };
      return { name, slug: match.slug, found: true };
    });
  }, [mentions, stationNames, stations]);

  const stationMentions = resolved.filter((r) => r.found || stationNames.length > 0);
  if (stationMentions.length === 0) return null;

  return (
    <View style={styles.mentionsContainer}>
      <Text style={styles.mentionsLabel}>Mentioned stations</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentionsScroll}>
        {stationMentions.map((r) => (
          <TouchableOpacity
            key={r.name}
            style={[styles.mentionChip, !r.found && styles.mentionChipDisabled]}
            onPress={() => r.found && r.slug && router.push(`/station/${r.slug}`)}
            disabled={!r.found}
            activeOpacity={r.found ? 0.7 : 1}
          >
            <Text style={[styles.mentionChipText, !r.found && styles.mentionChipTextDisabled]}>
              {r.name}{r.found ? " ›" : " (not in dataset)"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  precautionRow: {
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  precautionTitle: {
    ...typography.caption,
    fontWeight: "700",
  },
  precautionWhy: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  factsStationHeader: {
    marginBottom: spacing.xs,
  },
  factsStationName: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontSize: 13,
  },
  mentionsContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  mentionsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
  },
  mentionsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  mentionChip: {
    backgroundColor: colors.primary + "18",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  mentionChipDisabled: {
    backgroundColor: colors.divider,
    borderColor: colors.border,
  },
  mentionChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  mentionChipTextDisabled: {
    color: colors.textMuted,
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
