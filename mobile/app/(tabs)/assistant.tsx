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
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation, BOTTOM_NAV_CLEARANCE } from "../../theme/spacing";
import { postAssistantChat } from "../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useStations,
  useStationFactsBySlug,
  useForecast,
  useStationSeries,
} from "../../lib/hooks";
import type { AssistantResponse } from "../../types/assistant";

const { width: SCREEN_W } = Dimensions.get("window");

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  facts?: AssistantResponse["facts"];
  stationName?: string;
  mentions?: string[];
  showRecoveryCurve?: boolean;
  showSpatialMatrix?: boolean;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Is the groundwater level rising?",
  "What is the 30-day forecast?",
  "How does this compare to district average?",
];

function extractStationCode(slug: string): string {
  const match = slug.match(/([A-Z]{2}-\d+)/i);
  return match ? match[1].toUpperCase() : slug.split("-").pop()?.toUpperCase() ?? "";
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shouldShowRecoveryCurve(question: string, answer: string): boolean {
  const keywords = ["rising", "falling", "trend", "forecast", "recovery", "change", "trajectory", "level", "head", "recharge"];
  const combined = (question + " " + answer).toLowerCase();
  return keywords.some((k) => combined.includes(k));
}

function shouldShowSpatialMatrix(question: string, answer: string): boolean {
  const keywords = ["compare", "district", "median", "higher", "lower", "above", "below", "average"];
  const combined = (question + " " + answer).toLowerCase();
  return keywords.some((k) => combined.includes(k));
}

function Header({ district }: { district?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.headerLeft}>
        <View style={s.logoBox}>
          <Text style={s.logoIcon}>💧</Text>
        </View>
        <Text style={s.brandText}>AQUIS</Text>
      </View>
      <View style={s.headerCenter}>
        <View style={s.liveDot} />
        <Text style={s.contextLabel}>
          {district?.toUpperCase() ?? "AQUIS"} • ASSISTANT
        </Text>
      </View>
      <View style={s.headerRight}>
        <View style={s.profileIcon}>
          <Text style={s.profileIconText}>👤</Text>
        </View>
      </View>
    </View>
  );
}

function StationContextCard({
  facts,
  forecast,
  stationCode,
  onClear,
}: {
  facts: NonNullable<AssistantResponse["facts"]>;
  forecast: any;
  stationCode: string;
  onClear: () => void;
}) {
  const last = facts.last;
  const day30Pred = facts.forecast?.day30_pred ?? forecast?.trajectory_30d?.level ?? null;
  const bandHalf = facts.forecast?.band_half ?? forecast?.endpoint_production?.band_half ?? null;
  const direction = facts.forecast?.direction ?? "stable";

  return (
    <View style={s.contextCard}>
      <View style={s.contextEyebrow}>
        <View style={s.contextEyebrowLeft}>
          <View
            style={[
              s.statusDot,
              {
                backgroundColor:
                  direction === "expected rise" || direction === "rising"
                    ? colors.positive
                    : direction === "expected decline" || direction === "declining"
                    ? colors.negative
                    : colors.warning,
              },
            ]}
          />
          <Text style={s.contextEyebrowLabel}>PIEZOMETER ACTIVE CONTEXT</Text>
        </View>
        <View style={s.contextEyebrowRight}>
          <View style={s.codeBadge}>
            <Text style={s.codeBadgeText}>{stationCode}</Text>
          </View>
          <TouchableOpacity onPress={onClear} style={s.clearBtn} activeOpacity={0.7}>
            <Text style={s.clearBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.contextNameRow}>
        <Text style={s.contextStationName}>{facts.station}</Text>
        <Text style={s.contextSubtitle}>DWLR Station</Text>
      </View>

      <View style={s.contextStatsRow}>
        <View style={s.contextStat}>
          <Text style={s.contextStatLabel}>Observed</Text>
          <Text style={s.contextStatValue}>{last.toFixed(2)} mbgl</Text>
        </View>
        <View style={s.contextStatDivider} />
        <View style={s.contextStat}>
          <Text style={s.contextStatLabel}>30D Pred</Text>
          <Text
            style={[
              s.contextStatValue,
              {
                color:
                  day30Pred != null && day30Pred > last
                    ? colors.positive
                    : day30Pred != null && day30Pred < last
                    ? colors.negative
                    : colors.textPrimary,
              },
            ]}
          >
            {day30Pred != null ? `${day30Pred.toFixed(2)}m` : "N/A"}
          </Text>
        </View>
        <View style={s.contextStatDivider} />
        <View style={s.contextStat}>
          <Text style={s.contextStatLabel}>90% Band</Text>
          <Text style={s.contextStatValue}>
            {bandHalf != null ? `±${bandHalf.toFixed(2)}m` : "N/A"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RecoveryCurveCard({
  facts,
  series,
  forecast,
}: {
  facts: NonNullable<AssistantResponse["facts"]>;
  series: any;
  forecast: any;
}) {
  const historical = useMemo(() => {
    if (!series?.points) return [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
    return series.points
      .filter((p: { gwl: number | null; time: string }) => p.gwl != null && new Date(p.time) >= cutoff)
      .filter((_p: { gwl: number | null; time: string }, i: number) => i % 6 === 0)
      .map((p: { gwl: number | null; time: string }) => ({ time: p.time, value: p.gwl as number }));
  }, [series]);

  const forecastPts = useMemo(() => {
    if (!forecast?.trajectory) return [];
    return forecast.trajectory
      .filter((_p: any, i: number) => i % 4 === 0)
      .map((p: { time: string; q50?: number; gwl?: number }) => ({
        time: p.time,
        value: (p.q50 ?? p.gwl) as number,
      }));
  }, [forecast]);

  const currentValue = facts.last;
  const delta = facts.forecast?.change_30d_pred ?? 0;

  if (historical.length === 0 && forecastPts.length === 0) return null;

  const allValues = [
    ...historical.map((pt: { time: string; value: number }) => pt.value),
    ...forecastPts.map((pt: { time: string; value: number }) => pt.value),
    currentValue,
  ];
  const vMin = Math.min(...allValues);
  const vMax = Math.max(...allValues);
  const pad = (vMax - vMin) * 0.15 || 1;
  const yMin = vMin - pad;
  const yMax = vMax + pad;
  const yRange = yMax - yMin;

  const totalPts = historical.length + forecastPts.length;
  const chartH = 100;

  return (
    <View style={s.vizCard}>
      <View style={s.vizCardHeader}>
        <Text style={s.vizCardTitle}>AQUIFER RECOVERY CURVE (180D TRAJECTORY)</Text>
        <View
          style={[
            s.deltaBadge,
            { backgroundColor: delta >= 0 ? colors.positiveBg : colors.negativeBg },
          ]}
        >
          <Text
            style={[
              s.deltaBadgeText,
              { color: delta >= 0 ? colors.positiveText : colors.negativeText },
            ]}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}m delta
          </Text>
        </View>
      </View>

      <View style={[s.chartArea, { height: chartH }]}>
        {historical.map((pt: { time: string; value: number }, i: number) => {
          const x = (i / Math.max(totalPts - 1, 1)) * 94 + 3;
          const y = ((pt.value - yMin) / yRange) * (chartH - 16) + 8;
          return (
            <View
              key={`h-${i}`}
              style={[s.chartDot, { left: `${x}%`, top: y }]}
            />
          );
        })}
        {forecastPts.map((pt: { time: string; value: number }, i: number) => {
          const x =
            ((historical.length + i) / Math.max(totalPts - 1, 1)) * 94 + 3;
          const y = ((pt.value - yMin) / yRange) * (chartH - 16) + 8;
          return (
            <View
              key={`f-${i}`}
              style={[s.chartDotForecast, { left: `${x}%`, top: y }]}
            />
          );
        })}
      </View>

      <View style={s.chartLabelsRow}>
        <Text style={s.chartLabel}>-180d</Text>
        <Text style={s.chartLabel}>
          Observed ({currentValue.toFixed(2)}m)
        </Text>
        <Text style={s.chartLabel}>+30d Forecast</Text>
      </View>

      <View style={s.pillRow}>
        {facts.forecast?.station_stride_rmse != null && (
          <View style={s.pill}>
            <Text style={s.pillText}>
              RMSE: {facts.forecast.station_stride_rmse.toFixed(2)}m
            </Text>
          </View>
        )}
        <View style={s.pill}>
          <Text style={s.pillText}>Stride Accuracy: N/A</Text>
        </View>
        <View style={s.pill}>
          <Text style={s.pillText}>Latency: N/A</Text>
        </View>
      </View>
    </View>
  );
}

function SpatialDispersionCard({
  facts,
}: {
  facts: NonNullable<AssistantResponse["facts"]>;
}) {
  const stationHead = facts.last;
  const districtMedian =
    facts.district_context?.median ?? facts.district_median;
  const topDriver = facts.drivers?.[0];
  const correlation = topDriver?.corr ?? null;
  const nStations =
    facts.district_context?.n_stations ?? facts.district_n_stations;

  return (
    <View style={s.vizCard}>
      <View style={s.vizCardHeader}>
        <Text style={s.vizCardTitle}>SPATIAL DISPERSION MATRIX</Text>
        <Text style={s.vizCardMeta}>{nStations} DWLR Stations</Text>
      </View>

      <View style={s.matrixRow}>
        <View style={s.matrixCol}>
          <Text style={s.matrixLabel}>Station Head</Text>
          <Text style={s.matrixValue}>{stationHead.toFixed(2)} mbgl</Text>
        </View>
        <View style={s.matrixCol}>
          <Text style={s.matrixLabel}>District Median</Text>
          <Text style={s.matrixValue}>
            {districtMedian?.toFixed(2) ?? "N/A"} mbgl
          </Text>
        </View>
      </View>

      <View style={s.matrixMetaRow}>
        <View style={s.matrixMetaItem}>
          <Text style={s.matrixMetaLabel}>Precip Lag:</Text>
          <Text style={s.matrixMetaValue}>N/A</Text>
        </View>
        <View style={s.matrixMetaItem}>
          <Text style={s.matrixMetaLabel}>Correlation:</Text>
          <Text style={s.matrixMetaValue}>
            {correlation != null
              ? `${correlation >= 0 ? "+" : ""}${correlation.toFixed(3)}`
              : "N/A"}
          </Text>
        </View>
      </View>
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
    if (
      facts &&
      "station_names" in facts &&
      Array.isArray(facts.station_names)
    ) {
      return facts.station_names;
    }
    return [];
  }, [facts]);

  const resolved = useMemo(() => {
    return mentions.map((name) => {
      const isStation = stationNames.some(
        (sn) =>
          sn.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(sn.toLowerCase())
      );
      if (!isStation) return { name, slug: null, found: false };
      const match = stations.find(
        (st) =>
          st.station.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(st.station.toLowerCase())
      );
      if (!match?.slug) return { name, slug: null, found: false };
      return { name, slug: match.slug, found: true };
    });
  }, [mentions, stationNames, stations]);

  const stationMentions = resolved.filter(
    (r) => r.found || stationNames.length > 0
  );
  if (stationMentions.length === 0) return null;

  return (
    <View style={s.mentionsContainer}>
      <Text style={s.mentionsLabel}>Mentioned stations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.mentionsScroll}
      >
        {stationMentions.map((r) => (
          <TouchableOpacity
            key={r.name}
            style={[s.mentionChip, !r.found && s.mentionChipDisabled]}
            onPress={() =>
              r.found && r.slug && router.push(`/station/${r.slug}`)
            }
            disabled={!r.found}
            activeOpacity={r.found ? 0.7 : 1}
          >
            <Text
              style={[
                s.mentionChipText,
                !r.found && s.mentionChipTextDisabled,
              ]}
            >
              {r.name}
              {r.found ? " ›" : " (not in dataset)"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { data: stations } = useStations();
  const { data: facts } = useStationFactsBySlug(selectedSlug);
  const { data: forecast } = useForecast(selectedSlug);
  const { data: series } = useStationSeries(selectedSlug, { limit: 2000 });

  const stationCode = useMemo(
    () => (selectedSlug ? extractStationCode(selectedSlug) : ""),
    [selectedSlug]
  );

  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations.filter((s) => s.slug);
    const q = searchQuery.toLowerCase();
    return stations.filter(
      (s) =>
        s.slug &&
        (s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q))
    );
  }, [stations, searchQuery]);

  const sendMessage = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading || !selectedSlug) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await postAssistantChat({
        question,
        station: selectedSlug,
      });

      const showRC = shouldShowRecoveryCurve(question, res.answer);
      const showSM = shouldShowSpatialMatrix(question, res.answer);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: res.answer,
        facts: res.facts,
        stationName: res.station,
        mentions: res.mentions,
        showRecoveryCurve: showRC,
        showSpatialMatrix: showSM,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "Assistant unavailable — ML service is starting up.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedSlug) {
    return (
      <View style={s.screen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <Header />
        <View style={s.pickerContainer}>
          <View style={s.pickerSearchBar}>
            <Text style={s.pickerSearchIcon}>🔍</Text>
            <TextInput
              style={s.pickerSearchInput}
              placeholder="Search station or district..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScrollView
            contentContainerStyle={s.pickerList}
            showsVerticalScrollIndicator={false}
          >
            {filteredStations.map((st) => (
              <TouchableOpacity
                key={st.slug}
                style={s.pickerStationCard}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedSlug(st.slug);
                  setSearchQuery("");
                }}
              >
                <View style={s.pickerStationDot} />
                <View style={s.pickerStationInfo}>
                  <Text style={s.pickerStationName} numberOfLines={1}>
                    {st.station}
                  </Text>
                  <Text style={s.pickerStationDistrict}>{st.district}</Text>
                </View>
                <Text style={s.pickerStationArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Header district={facts?.district} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {facts && (
          <StationContextCard
            facts={facts as any}
            forecast={forecast}
            stationCode={stationCode}
            onClear={() => {
              setSelectedSlug(null);
              setMessages([]);
            }}
          />
        )}

        <View style={s.chatContainer}>
          {messages.length === 0 && (
            <View style={s.emptyContainer}>
              <Text style={s.emptyTitle}>Ask about groundwater</Text>
              <Text style={s.emptyMessage}>
                Get instant insights about {facts?.station ?? "this station"} —
                level trends, forecast outlook, district comparison
              </Text>
              <View style={s.suggestedChips}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.chip}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.chipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item }) => (
              <View>
                {item.role === "user" && (
                  <View style={s.userBubble}>
                    <Text style={s.userBubbleText}>{item.text}</Text>
                  </View>
                )}

                {item.role === "assistant" && (
                  <View style={s.assistantBubble}>
                    <View style={s.assistantHeader}>
                      <View style={s.assistantAvatar}>
                        <Text style={s.assistantAvatarText}>A</Text>
                      </View>
                      <View>
                        <Text style={s.assistantName}>AQUIS Engine</Text>
                        <Text style={s.assistantTime}>
                          • {formatRelativeTime(item.timestamp)}
                        </Text>
                      </View>
                    </View>

                    <Text style={s.assistantText}>{item.text}</Text>

                    {item.showRecoveryCurve && facts && (
                      <RecoveryCurveCard
                        facts={facts as any}
                        series={series}
                        forecast={forecast}
                      />
                    )}

                    {item.showSpatialMatrix && facts && (
                      <SpatialDispersionCard facts={facts as any} />
                    )}

                    {item.mentions && item.mentions.length > 0 && (
                      <MentionChips
                        mentions={item.mentions}
                        facts={item.facts}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          />

          {loading && (
            <View style={s.typingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.typingText}>Thinking...</Text>
            </View>
          )}

          {messages.length > 0 &&
            messages.length % 2 === 0 &&
            !loading && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.followUpScroll}
                contentContainerStyle={s.followUpContent}
              >
                {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.followUpChip}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.followUpChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
        </View>

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Ask about aquifer head, recharge drivers, or forecast..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              s.sendButton,
              (!input.trim() || loading) && s.sendButtonDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}
          >
            <Text style={s.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...elevation.low,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoIcon: { fontSize: 16 },
  brandText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.positive,
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: 0.04,
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconText: { fontSize: 14 },

  contextCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.low,
  },
  contextEyebrow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  contextEyebrowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  contextEyebrowLabel: {
    ...typography.labelSm,
    color: colors.textSecondary,
    letterSpacing: 0.06,
  },
  contextEyebrowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  codeBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  codeBadgeText: {
    ...typography.labelSm,
    color: colors.textSecondary,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.divider,
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  contextNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  contextStationName: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    flex: 1,
  },
  contextSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  contextStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contextStat: { flex: 1, alignItems: "center", gap: spacing.xxs },
  contextStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  contextStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  contextStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  chatContainer: { flex: 1 },
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
    paddingBottom: BOTTOM_NAV_CLEARANCE,
    gap: spacing.md,
  },

  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: "#F0EBFF",
    borderRadius: radii.lg,
    borderBottomRightRadius: spacing.xs,
    padding: spacing.lg,
  },
  userBubbleText: {
    ...typography.body,
    color: colors.textPrimary,
  },

  assistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  assistantAvatarText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textOnPrimary,
    fontSize: 12,
  },
  assistantName: {
    ...typography.labelMd,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  assistantTime: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  assistantText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },

  vizCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vizCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  vizCardTitle: {
    ...typography.labelSm,
    color: colors.textSecondary,
    letterSpacing: 0.04,
    flex: 1,
  },
  vizCardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  deltaBadge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginLeft: spacing.sm,
  },
  deltaBadgeText: {
    ...typography.labelSm,
    fontWeight: "700",
    fontSize: 11,
  },

  chartArea: {
    position: "relative",
    marginBottom: spacing.sm,
  },
  chartDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginLeft: -2,
    marginTop: -2,
  },
  chartDotForecast: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryMuted,
    marginLeft: -2,
    marginTop: -2,
  },
  chartLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  pillText: {
    ...typography.labelSm,
    color: colors.textSecondary,
    fontSize: 10,
  },

  matrixRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  matrixCol: { flex: 1 },
  matrixLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.xxs,
  },
  matrixValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  matrixMetaRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  matrixMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  matrixMetaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  matrixMetaValue: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textPrimary,
    fontSize: 11,
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
  },
  mentionsScroll: { gap: spacing.xs },
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
  mentionChipTextDisabled: { color: colors.textMuted },

  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  followUpScroll: { maxHeight: 44, marginBottom: spacing.sm },
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
    borderRadius: 22,
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

  pickerContainer: { flex: 1 },
  pickerSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...elevation.medium,
  },
  pickerSearchIcon: { fontSize: 16 },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  pickerList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: BOTTOM_NAV_CLEARANCE,
  },
  pickerStationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerStationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  pickerStationInfo: { flex: 1, gap: 2 },
  pickerStationName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  pickerStationDistrict: { fontSize: 12, color: colors.textMuted },
  pickerStationArrow: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "600",
  },
});
