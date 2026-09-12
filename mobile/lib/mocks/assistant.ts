import type { AssistantResponse } from "../../types/assistant";

// ml-build-spec §10.9 — request/response format
// "Is level rising?" for Ramchhitoni Sahawar (UP-011)
export const mockAssistantRising: AssistantResponse = {
  answer:
    "Latest level is -2.84 m on 2026-09-05. The model expects a rise of about +0.12 m " +
    "(to -2.72 m) over 30 days, 90% band +/- 1.61 m.",
  facts: {
    station: "Ramchhitoni Sahawar (UP-011)",
    district: "KAUSHAMBI",
    last: -2.841,
    last_date: "2026-09-05",
    min: -14.21,
    max: -0.93,
    change_7d: 0.042,
    change_30d: 0.121,
    change_60d: -0.315,
    change_180d: -0.872,
    district_median: -3.45,
    district_n_stations: 18,
    forecast: {
      anchor: -2.841,
      day30_pred: -2.72,
      change_30d_pred: 0.121,
      direction: "expected rise",
      plausible: true,
      band_half: 1.613,
      q05_level: -4.266,
      q95_level: -1.039,
      station_stride_rmse: 0.314,
      high_uncertainty: false,
    },
    drivers: [
      { driver: "rainfall", corr: 0.72, n: 120, p: 0.001 },
      { driver: "evaporation", corr: -0.31, n: 120, p: 0.02 },
    ],
    rain_recent: {
      last_rain_date: "2026-09-04",
      rain_7d: 12.4,
      rain_30d: 48.2,
      rain_90d: 187.5,
    },
    precautions: [
      { level: "info", title: "Seasonal pattern", why: "Monsoon recharge underway; levels typically rise Jul–Sep" },
    ],
    district_context: {
      median: -3.45,
      mean: -3.82,
      min_level: -8.12,
      max_level: -0.93,
      n_stations: 18,
      n_analysed: 16,
      most_stored: [
        { station: "Ramchhitoni Sahawar", level: -2.841, change_180d: -0.872 },
        { station: "Shivli", level: -1.23, change_180d: 0.15 },
      ],
    },
    district_names: ["KAUSHAMBI"],
    station_names: ["Ramchhitoni Sahawar (UP-011)"],
    n_obs: 2190,
    outliers: 3,
    span: 13.28,
    fleet_recency: {
      latest_date: "2026-09-09",
      stations_with_data: 545,
    },
  },
  mentions: ["Ramchhitoni Sahawar", "KAUSHAMBI", "UP-011"],
  station: "Ramchhitoni Sahawar (UP-011)",
};

// ml-build-spec §10.12 — forecast summary with high_uncertainty
export const mockAssistantHighUncertainty: AssistantResponse = {
  answer:
    "Latest level is -17.17 m on 2026-09-03. The model expects a rise of about +0.29 m " +
    "(to -16.88 m) over 30 days, but uncertainty is high — band +/- 3.32 m. " +
    "Exercise caution interpreting this forecast.",
  facts: {
    station: "Mahgaon (UP-031)",
    district: "KAUSHAMBI",
    last: -17.171,
    last_date: "2026-09-03",
    min: -24.31,
    max: -12.08,
    change_7d: 0.152,
    change_30d: 0.29,
    change_60d: 0.482,
    change_180d: 1.103,
    district_median: -3.45,
    district_n_stations: 18,
    forecast: {
      anchor: -17.171,
      day30_pred: -16.881,
      change_30d_pred: 0.29,
      direction: "expected rise",
      plausible: true,
      band_half: 3.324,
      q05_level: -18.637,
      q95_level: -11.989,
      station_stride_rmse: 1.847,
      high_uncertainty: true,
    },
  },
  mentions: ["Mahgaon", "KAUSHAMBI", "UP-031"],
  station: "Mahgaon (UP-031)",
};

// ml-build-spec §10.10 — no telemetry error case
export const mockAssistantNoTelemetry: AssistantResponse = {
  answer: "No telemetry found for station 'Nonexistent Station XYZ'.",
  facts: {} as any,
  mentions: [],
  station: "Nonexistent Station XYZ",
};

// ml-build-spec §10.10 — error shapes
export const mockErrors = {
  missingQuestion: { error: "bad request", detail: "`question` is required" },
  assistantDown: { error: "assistant unavailable", detail: "Ollama server not responding" },
  mlDown: { error: "ML service error", detail: "ML service unavailable" },
  unknownSlug: { error: "unknown slug" },
  noModel: { error: "no model", detail: "No trained model for station 'XYZ-999'", trained: false },
  noFeatures: { error: "no valid features", detail: "Station has insufficient data for prediction" },
  ollamaDown: { error: "assistant failed", detail: "Connection refused", hint: "is Ollama running?" },
  routeNotFound: { error: "Route not found" },
} as const;

export function getMockAssistantResponse(
  question: string,
  station: string
): AssistantResponse {
  if (station.includes("Nonexistent")) return mockAssistantNoTelemetry;
  if (station.includes("Mahgaon")) return mockAssistantHighUncertainty;
  return mockAssistantRising;
}
