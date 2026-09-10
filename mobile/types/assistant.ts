import type { StationForecast } from "./station";

// ml-build-spec §10.8 — POST /ml/assistant/chat request body
export interface AssistantRequest {
  question: string;
  station: string;
}

// ml-build-spec §10.5 + §10.9 — facts object inside assistant response
// Composed from _series_stats + district median + _forecast_summary
export interface AssistantFacts {
  station: string;
  district: string;
  last: number;
  last_date: string;
  min: number;
  max: number;
  change_7d: number;
  change_30d: number;
  change_60d: number;
  change_180d: number;
  district_median: number;
  district_n_stations: number;
  forecast: StationForecast;
}

// ml-build-spec §10.9 — POST /ml/assistant/chat 200 response
export interface AssistantResponse {
  answer: string;
  facts: AssistantFacts | Record<string, never>;
  station: string;
  mentions: string[];
}

// ml-build-spec §18 — error response shapes
export interface ApiError {
  error: string;
  detail?: string;
  hint?: string;
  trained?: boolean;
}
