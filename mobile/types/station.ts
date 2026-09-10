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
export interface StationForecast {
  anchor: number;
  pred_xgb: number;
  day30_pred: number;
  change_30d_pred: number;
  direction: string;
  plausible: boolean;
  band_half: number;
  q05_level: number;
  q95_level: number;
  station_stride_rmse: number;
  high_uncertainty: boolean;
}

// ml-build-spec §10.4 + §10.7 — facts dict (station detail KPIs)
export interface StationFacts {
  last: number;
  last_date: string;
  change_7d: number;
  change_30d: number;
  change_60d: number;
  change_180d: number;
  min: number;
  max: number;
  span: number;
  n_obs: number;
  outliers: number;
  forecast: StationForecast;
}
