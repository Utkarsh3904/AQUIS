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
