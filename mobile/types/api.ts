// ml-build-spec §12.3.5 — backend error conventions
export interface ApiErrorResponse {
  error: string;
  detail?: string;
}

// ml-build-spec §11.2 / backend controllers — paginated list wrapper
export interface PaginatedResponse<T> {
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
  data: T[];
}

// Real ML service response: GET /stations
export interface MlStationListItem {
  district: string;
  last_ts: string; // "2026-09-09 18:00:00" (space-separated)
  slug: string;
  station: string;
  latitude: number | null;
  longitude: number | null;
}

export interface MlStationListResponse {
  count: number;
  stations: MlStationListItem[];
}

// backend telemetry response: GET /telemetry/:stationId
export interface TelemetryObservation {
  id: number;
  station_id: number;
  observed_at: string;
  groundwater_level: number;
  created_at?: string;
}

// ml-build-spec §2.1 / backend: GET /trends/:stationId
export interface MannKendallResult {
  s_statistic: number;
  z_score: number;
  p_value: number;
  direction: string;
  significant: boolean;
  n: number;
  variance: number;
}

export interface SensSlopeResult {
  slope: number;
  intercept: number;
  slope_per_year: number;
  predicted_start: number;
  predicted_end: number;
  n_slopes: number;
}

export interface TrendResponse {
  station_id: number;
  mann_kendall: MannKendallResult | null;
  sens_slope: SensSlopeResult | null;
  observation_count: number;
  message?: string;
}

// ── GET /stations/<slug> — rich per-station facts ──────────────────
export interface StationDetailResponse {
  slug: string;
  station: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  level: "station";
  // Series stats
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
  // Forecast
  forecast: {
    anchor: number;
    day30_pred: number;
    change_30d_pred: number;
    direction: string;
    plausible: boolean;
    band_half: number | null;
    q05_level: number | null;
    q95_level: number | null;
    station_stride_rmse: number | null;
    high_uncertainty: boolean;
    obs_max: number | null;
    obs_min: number | null;
  } | null;
  // District
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
  // Drivers
  drivers: Array<{
    driver: string;
    corr: number;
    p: number;
    n: number;
  }>;
  // Rain
  rain_recent: {
    rain_7d: number | null;
    rain_30d: number | null;
    rain_90d: number | null;
    last_rain_date: string | null;
  };
  // Annual
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
  // Precautions
  precautions: Array<{
    level: string;
    title: string;
    why: string;
  }>;
  // Fleet
  fleet_recency: {
    latest_date: string;
    recent_dates: Record<string, number>;
    stations_with_data: number;
  };
  // Names
  station_names: string[];
  district_names: string[];
}

// ── GET /stations/<slug>/series — 6h GWL + driver time series ─────
export interface StationSeriesResponse {
  slug: string;
  station: string;
  district: string;
  granularity: "6h";
  drivers: string[];
  driver_labels: Record<string, string>;
  from: string | null;
  to: string | null;
  downsampled: boolean;
  count: number;
  points: Array<{
    time: string;
    gwl: number | null;
    rain: number | null;
    temp: number | null;
    river_level: number | null;
    humidity: number | null;
    solar: number | null;
    wind_speed: number | null;
    pressure: number | null;
    canal_level: number | null;
  }>;
}

// ── GET /districts — fleet-wide district summaries ─────────────────
export interface DistrictListItem {
  district: string;
  n_stations: number;
  scarcity: string;
  scarcity_basis: string;
  decline_share: number;
  median_change_m: number;
  n_decline: number;
  n_deep_180d: number;
  n_recover: number;
  n_stressed: number;
  worst_180d_drop: number;
}

export interface DistrictListResponse {
  count: number;
  counts: {
    healthy: number;
    scarce: number;
    unknown: number;
    watch: number;
  };
  districts: DistrictListItem[];
}

// ── GET /districts/<name> — single district detail ─────────────────
export interface DistrictDetailResponse {
  district: string;
  scarcity: string;
  scarcity_basis: string;
  levels: {
    max: number;
    mean: number;
    median: number;
    min: number;
    n_analysed: number;
    n_stations: number;
  };
  model_accuracy: {
    mae: number;
    rmse: number;
    rows: number;
    within_05: number;
  };
  most_stressed: Array<{
    station: string;
    slug: string;
    level: number;
    change_180d: number;
  }>;
  stations: Array<{
    station: string;
    slug: string;
    zone: string;
    band_half_m: number | null;
    change_30d_m: number;
    reason: string;
  }>;
  top_driver: {
    driver: string;
    corr: number;
    p: number;
    n: number;
  } | null;
}

// ── GET /fleet/recovery — stations sorted by recovery ──────────────
export interface FleetRecoveryItem {
  station: string;
  slug: string;
  district: string;
  category: string;
  direction: string;
  change_30d_m: number;
  band_half_m: number | null;
}

export interface FleetRecoveryResponse {
  count: number;
  generated_at: string;
  sort: string;
  items: FleetRecoveryItem[];
}

// ── GET /fleet/alerts — fleet-wide alert list ──────────────────────
export interface FleetAlertItem {
  station: string;
  slug: string;
  district: string;
  zone: string;
  change_30d_m: number;
  band_half_m: number | null;
  reason: string;
}

export interface FleetAlertsResponse {
  count: number;
  generated_at: string;
  counts: {
    alert: number;
    danger: number;
    safe: number;
    unknown: number;
  };
  alerts: FleetAlertItem[];
}

// ── GET /stations/<slug>/alerts — per-station alert detail ─────────
export interface StationAlertsResponse {
  slug: string;
  station: string;
  district: string;
  zone: string;
  level_now: number;
  change_30d: number;
  change_180d: number;
  forecast: {
    day30_pred: number;
    change_30d_pred: number;
    direction: string;
    plausible: boolean;
    high_uncertainty: boolean;
    q05_level: number;
    q95_level: number;
  } | null;
  reasons: Array<{
    level: string;
    title: string;
    why: string;
  }>;
  top_drivers: Array<{
    driver: string;
    label: string;
    corr: number;
    p: number;
    n: number;
  }>;
}
