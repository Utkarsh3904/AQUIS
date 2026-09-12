// DESIGN.md — single source of truth for the entire app
// Color-usage rule: white/light surfaces as base, primary blue for
// navigation/actions/neutral data, GREEN for positive/good, RED for
// negative/bad, ORANGE/AMBER for caution/moderate.

export const colors = {
  // ── Canvas & surfaces ──
  background: "#F8F9FF",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#EFF4FF",
  surfaceContainer: "#E5EEFF",
  surfaceContainerHigh: "#DCE9FF",
  surfaceContainerHighest: "#D3E4FE",

  // ── Primary (Hydrological Blue) ──
  primary: "#0284C7",
  primaryDeep: "#075985",
  primaryLight: "#CCE5FF",
  primaryMuted: "#93CCFF",
  onPrimary: "#FFFFFF",

  // ── Semantic: Positive / Green ──
  positive: "#10B981",
  positiveDeep: "#059669",
  positiveBg: "#ECFDF5",
  positiveText: "#065F46",
  positiveBorder: "#A7F3D0",

  // ── Semantic: Caution / Amber ──
  warning: "#F59E0B",
  warningDeep: "#D97706",
  warningBg: "#FFFBEB",
  warningText: "#92400E",
  warningBorder: "#FDE68A",

  // ── Semantic: Alert / Red ──
  negative: "#EF4444",
  negativeDeep: "#DC2626",
  negativeBg: "#FEF2F2",
  negativeText: "#991B1B",
  negativeBorder: "#FECACA",

  // ── Text ──
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  textOnPrimary: "#FFFFFF",
  textOnSurface: "#0B1C30",
  textOnSurfaceVariant: "#3F4850",

  // ── Borders & dividers ──
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  borderHairline: "#E2E8F0",
  divider: "#F1F5F9",
  outline: "#707881",
  outlineVariant: "#BFC7D2",

  // ── Chart ──
  chartLine: "#0284C7",
  chartFill: "rgba(2,132,199,0.12)",
  chartBand: "rgba(2,132,199,0.12)",
  chartGrid: "#E2E8F0",
  chartMedianLine: "#0284C7",

  // ── Map pins ──
  mapPinNoForecast: "#94A3B8",
  mapPinDecline: "#EF4444",
  mapPinRise: "#10B981",

  // ── Telemetry card (dark) ──
  telemetryCard: "#213145",
  telemetryCardText: "#EAF1FF",

  // ── Chips ──
  chipBg: "#F1F5F9",
  chipText: "#334155",
  chipBorder: "#E2E8F0",

  // ── KPI cards ──
  kpiCard1: "#EFF4FF",
  kpiCard2: "#ECFDF5",
  kpiCard3: "#FFFBEB",
  kpiCard4: "#F0F9FF",

  // ── Hydro-specific ──
  hydrologicalDeep: "#075985",
  hydrologicalActive: "#0284C7",
  aquiferHealthy: "#10B981",
  aquiferSubtle: "#ECFDF5",
  confidenceHigh: "#059669",
  confidenceDirectional: "#F59E0B",
  confidenceDirectionalSubtle: "#FFFBEB",
  alertDrawdown: "#EF4444",
  alertDrawdownSubtle: "#FEF2F2",
  surfaceCanvas: "#FFFFFF",
  surfaceSubtle: "#F8FAFC",
  surfaceCard: "#FFFFFF",

  // ── Inverse ──
  inverseSurface: "#213145",
  inverseOnSurface: "#EAF1FF",
  inversePrimary: "#93CCFF",

  // ── Tertiary ──
  tertiary: "#006195",
  tertiaryContainer: "#287AB3",
};

export const typography = {
  // ── Display ──
  displayLg: { fontWeight: "700" as const, fontSize: 36, lineHeight: 44, letterSpacing: -0.02 },
  displayLgMobile: { fontWeight: "700" as const, fontSize: 28, lineHeight: 36, letterSpacing: -0.015 },

  // ── Headlines ──
  headlineLg: { fontWeight: "600" as const, fontSize: 28, lineHeight: 36, letterSpacing: -0.015 },
  headlineLgMobile: { fontWeight: "600" as const, fontSize: 24, lineHeight: 32, letterSpacing: -0.01 },
  headlineMd: { fontWeight: "600" as const, fontSize: 22, lineHeight: 28, letterSpacing: -0.01 },
  headlineSm: { fontWeight: "600" as const, fontSize: 18, lineHeight: 24 },

  // ── Title ──
  titleMd: { fontWeight: "600" as const, fontSize: 16, lineHeight: 22 },

  // ── Body ──
  bodyLg: { fontWeight: "400" as const, fontSize: 16, lineHeight: 24 },
  body: { fontWeight: "400" as const, fontSize: 14, lineHeight: 20 },
  bodyMd: { fontWeight: "400" as const, fontSize: 14, lineHeight: 20 },
  bodySm: { fontWeight: "400" as const, fontSize: 12, lineHeight: 16 },

  // ── Metrics ──
  metricDisplay: { fontWeight: "700" as const, fontSize: 32, lineHeight: 38, letterSpacing: -0.02 },
  metricLg: { fontWeight: "600" as const, fontSize: 24, lineHeight: 30, letterSpacing: -0.01 },
  stat: { fontWeight: "700" as const, fontSize: 24, lineHeight: 28 },

  // ── Labels ──
  labelMd: { fontWeight: "500" as const, fontSize: 13, lineHeight: 18 },
  labelSm: { fontWeight: "600" as const, fontSize: 11, lineHeight: 14, letterSpacing: 0.04 },
  statLabel: { fontWeight: "600" as const, fontSize: 11, lineHeight: 14, letterSpacing: 0.04 },

  // ── Code / mono ──
  codeMono: { fontWeight: "500" as const, fontSize: 12, lineHeight: 16 },

  // ── Legacy aliases (other screens still reference these) ──
  hero: { fontWeight: "700" as const, fontSize: 40, lineHeight: 44 },
  heading: { fontWeight: "600" as const, fontSize: 18, lineHeight: 24 },
  subheading: { fontWeight: "600" as const, fontSize: 15, lineHeight: 20 },
  caption: { fontWeight: "400" as const, fontSize: 12, lineHeight: 16 },
  bigNumber: { fontWeight: "700" as const, fontSize: 36, lineHeight: 40 },
  kpiValue: { fontWeight: "700" as const, fontSize: 20, lineHeight: 24 },
};
