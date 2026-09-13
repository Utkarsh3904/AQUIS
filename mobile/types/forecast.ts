// ml/_trajectory.py trajectory_forecast() — real engine output shape
// Supersedes the deleted Flask array contract

export interface TrajectoryPoint {
  time: string; // ISO-8601 UTC, 6-hourly
  gwl: number; // q50 median prediction
  q05: number;
  q50: number;
  q95: number;
  confidence_level: string; // "HIGH" | "DIRECTIONAL" | "LOW"
  reliability_reason: string;
  driver_source: string;
}

export interface Trajectory30d {
  times: string[];
  level: number;
  q05: number;
  q95: number;
  change: number;
}

export interface EndpointProduction {
  level: number | null;
  q05: number | null;
  q95: number | null;
  anchor: number | null;
  band_half: number | null;
}

export interface Direction {
  label: string; // "rising" | "declining" | "stable" (forecast API) or "expected rise" | "expected decline" (facts.forecast)
  change_q50_30d: number;
  agreement_with_production: boolean | null;
  sign_accuracy_30d: number | null;
}

export interface OverallConfidence {
  level: string; // "HIGH" | "DIRECTIONAL" | "LOW"
  reason: string;
  endpoint_match: boolean | null;
}

export interface StationIntegrity {
  integrity: number; // 0.4 | 0.6 | 1.0
  integrity_reason: string;
  ood: number; // 0.6 | 1.0
  stability: number; // 0.7 | 1.0
}

export interface Evidence {
  station_integrity: StationIntegrity;
  anchor_ood: boolean;
  stability_oscillation: number;
  recency_days: number;
  recent90_coverage: number;
}

export interface ForecastResponse {
  station: string;
  anchor_time: string; // ISO-8601 UTC
  anchor_gwl: number;
  model: string;
  trajectory: TrajectoryPoint[];
  trajectory_30d: Trajectory30d;
  endpoint_production: EndpointProduction;
  direction: Direction;
  overall_confidence: OverallConfidence;
  evidence: Evidence;
}
