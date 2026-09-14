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
  // Optional fields present in real response
  n_obs?: number;
  outliers?: number;
  span?: number;
  district_context?: {
    max_level: number;
    mean: number;
    median: number;
    min_level: number;
    most_stored?: Array<{ station: string; level: number; change_180d: number }>;
    n_analysed: number;
    n_stations: number;
  };
  district_names?: string[];
  drivers?: Array<{ driver: string; corr: number; n: number; p: number }>;
  fleet_recency?: {
    latest_date: string;
    recent_dates?: Record<string, number>;
    stations_with_data: number;
  };
  precautions?: Array<{ level: string; title: string; why: string }>;
  rain_recent?: {
    last_rain_date: string;
    rain_30d: number;
    rain_7d: number;
    rain_90d: number;
  };
  station_names?: string[];
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
