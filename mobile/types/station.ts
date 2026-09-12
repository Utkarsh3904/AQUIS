// Internal normalized type — what all screens consume
export interface StationListItem {
  id: number;
  station: string;
  district: string;
  slug: string | null;
  lat: number;
  lon: number;
  last_ts: string;
  external_station_id: string;
}

// Raw DB row shape — what GET /stations actually returns
// data-model.md: stations table columns
export interface StationRow {
  id: number;
  station_name: string;
  district: string;
  latitude: number;
  longitude: number;
  last_observed_at: string;
  external_station_id: string;
  agency: string;
  state: string;
  first_observed_at: string;
  observation_count: number;
}

// ml-build-spec §10.4 — _forecast_summary(station) computed fields
// Real API shape from POST /assistant/chat → facts.forecast
export interface StationForecast {
  anchor: number;
  day30_pred: number;
  change_30d_pred: number;
  direction: string; // "expected rise" | "expected decline" | "stable"
  plausible: boolean;
  band_half: number;
  q05_level: number;
  q95_level: number;
  station_stride_rmse: number;
  high_uncertainty: boolean;
  // Optional fields present in real response
  level?: number;
  obs_max?: number;
  obs_min?: number;
}

// ml-build-spec §10.4 + §10.7 — facts dict (station detail KPIs)
// Now matches GET /stations/<slug> shape exactly (v3.3.0)
export interface StationFacts {
  slug: string;
  station: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  level: "station";
  last: number;
  last_date: string;
  min: number;
  max: number;
  span: number;
  n_obs: number;
  outliers: number;
  change_7d: number | null;
  change_30d: number | null;
  change_60d: number | null;
  change_180d: number | null;
  forecast: StationForecast | null;
  district_median: number;
  district_n_stations: number;
  district_context: {
    max_level: number | null;
    mean: number | null;
    median: number | null;
    min_level: number | null;
    n_analysed: number;
    n_deep_180d: number;
    n_stations: number;
    most_stressed: Array<{
      station: string;
      level: number;
      change_180d: number | null;
    }>;
  };
  drivers: Array<{
    driver: string;
    corr: number;
    p: number;
    n: number;
  }>;
  rain_recent: {
    rain_7d: number | null;
    rain_30d: number | null;
    rain_90d: number | null;
    last_rain_date: string | null;
  };
  annual: Array<{
    year: number;
    mean: number;
    min: number;
    max: number;
    rain_mm: number;
    n: number;
    mean_delta_prev?: number;
    rain_delta_prev?: number;
  }>;
  precautions: Array<{
    level: string;
    title: string;
    why: string;
  }>;
  fleet_recency: {
    latest_date: string;
    recent_dates: Record<string, number>;
    stations_with_data: number;
  };
  station_names: string[];
  district_names: string[];
}
