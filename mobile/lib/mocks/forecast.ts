import type {
  ForecastResponse,
  TrajectoryPoint,
} from "../../types/forecast";
import { ApiRequestError } from "../api";

// Coverage mock: ~600 stations have models, ~545 scored per cycle.
// No pre-filter flag exists — must attempt forecast and handle error gracefully.
const FORECASTABLE_SLUGS = new Set([
  "Ramchhitoni%20Sahawar_UPGW_a1b2c3d4",
  "ASHADHA%20PRATHMIK%20VIDYALAYA_UPGW_5f5b3671",
]);

// ---------------------------------------------------------------------------
// Mock trajectory generation — matches ml/_trajectory.py trajectory_forecast()
// 120 points, 6-hourly, h=1..120 (30 days)
// ---------------------------------------------------------------------------

function generateTrajectory(
  anchorGwl: number,
  targetDelta30d: number,
  bandHalf30d: number,
  anchorTime: string
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const anchor = new Date(anchorTime);
  const MAX_H = 120;
  const STEP_H = 6;

  for (let h = 1; h <= MAX_H; h++) {
    const t = h / MAX_H; // 0→1 across the horizon

    // q50: smooth curve from anchor toward anchor + delta
    // Uses a slight exponential shape (real models show non-linear drift)
    const drift = targetDelta30d * (1 - Math.exp(-3 * t)) / (1 - Math.exp(-3));
    const q50 = anchorGwl + drift;

    // Band widens with horizon: narrow at anchor, full at 30d
    // Mirrors real _widen_s() calibration widening
    const widenFactor = 0.3 + 0.7 * t;
    const q05 = q50 - bandHalf30d * widenFactor;
    const q95 = q50 + bandHalf30d * widenFactor;

    // Confidence degrades by horizon bucket (mirrors real bucket_rules)
    let confidence_level: string;
    let reliability_reason: string;
    if (h <= 32) {
      confidence_level = "HIGH";
      reliability_reason =
        "forecast conditions support reliability";
    } else if (h <= 80) {
      confidence_level = "DIRECTIONAL";
      reliability_reason =
        "interval coverage acceptable; direction supported at this horizon";
    } else {
      confidence_level = "LOW";
      reliability_reason =
        "horizon error approaches persistence; interval wide vs error budget";
    }

    // Driver source: Open-Meteo forecast ≤16d (64 steps), climatology beyond
    const driver_source =
      h <= 64
        ? "Open-Meteo forecast (<=16d)"
        : "climatology (beyond Open-Meteo forecast)";

    const time = new Date(
      anchor.getTime() + h * STEP_H * 3600 * 1000
    ).toISOString();

    points.push({
      time,
      gwl: parseFloat(q50.toFixed(3)),
      q05: parseFloat(q05.toFixed(3)),
      q50: parseFloat(q50.toFixed(3)),
      q95: parseFloat(q95.toFixed(3)),
      confidence_level,
      reliability_reason,
      driver_source,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Ramchhitoni Sahawar (UP-011) — rising, HIGH confidence
// anchor -2.841, pred_xgb +0.121, band_half 1.613
// ---------------------------------------------------------------------------
const RAMCHHITONI_ANCHOR = -2.841;
const RAMCHHITONI_ANCHOR_TIME = "2026-09-05T18:00:00Z";
const RAMCHHITONI_DELTA = 0.121; // rising
const RAMCHHITONI_BAND_HALF = 1.613;

const ramchhitoniTrajectory = generateTrajectory(
  RAMCHHITONI_ANCHOR,
  RAMCHHITONI_DELTA,
  RAMCHHITONI_BAND_HALF,
  RAMCHHITONI_ANCHOR_TIME
);

const ramchhitoniTimes = ramchhitoniTrajectory.map((p) => p.time);
const ramchhitoniEndpoint = ramchhitoniTrajectory[119]; // h=120

export const mockForecastRamchhitoni: ForecastResponse = {
  station: "Ramchhitoni Sahawar (UP-011)",
  anchor_time: RAMCHHITONI_ANCHOR_TIME,
  anchor_gwl: RAMCHHITONI_ANCHOR,
  model: "direct multi-horizon shared XGBoost (q05/q50/q95)",
  trajectory: ramchhitoniTrajectory,
  trajectory_30d: {
    times: ramchhitoniTimes,
    level: ramchhitoniEndpoint.q50,
    q05: ramchhitoniEndpoint.q05,
    q95: ramchhitoniEndpoint.q95,
    change: parseFloat((ramchhitoniEndpoint.q50 - RAMCHHITONI_ANCHOR).toFixed(3)),
  },
  endpoint_production: {
    level: -2.72,
    q05: -4.266,
    q95: -1.039,
    anchor: RAMCHHITONI_ANCHOR,
    band_half: RAMCHHITONI_BAND_HALF,
  },
  direction: {
    label: "rising",
    change_q50_30d: parseFloat(
      (ramchhitoniEndpoint.q50 - RAMCHHITONI_ANCHOR).toFixed(3)
    ),
    agreement_with_production: true,
    sign_accuracy_30d: 0.82,
  },
  overall_confidence: {
    level: "HIGH",
    reason: "station data fresh; interval quality OK; direction supported at 30d",
    endpoint_match: true,
  },
  evidence: {
    station_integrity: {
      integrity: 1.0,
      integrity_reason: "station data fresh",
      ood: 1.0,
      stability: 1.0,
    },
    anchor_ood: false,
    stability_oscillation: 2,
    recency_days: 1.2,
    recent90_coverage: 0.97,
  },
};

// ---------------------------------------------------------------------------
// ASHADHA PRATHMIK VIDYALAYA — declining, DIRECTIONAL confidence
// anchor -6.411, pred_xgb -0.213, band_half 1.64
// ---------------------------------------------------------------------------
const ASHADHA_ANCHOR = -6.411;
const ASHADHA_ANCHOR_TIME = "2026-09-05T12:00:00Z";
const ASHADHA_DELTA = -0.213; // declining
const ASHADHA_BAND_HALF = 1.64;

const ashadhaTrajectory = generateTrajectory(
  ASHADHA_ANCHOR,
  ASHADHA_DELTA,
  ASHADHA_BAND_HALF,
  ASHADHA_ANCHOR_TIME
);

const ashadhaTimes = ashadhaTrajectory.map((p) => p.time);
const ashadhaEndpoint = ashadhaTrajectory[119];

export const mockForecastAshadha: ForecastResponse = {
  station: "ASHADHA PRATHMIK VIDYALAYA",
  anchor_time: ASHADHA_ANCHOR_TIME,
  anchor_gwl: ASHADHA_ANCHOR,
  model: "direct multi-horizon shared XGBoost (q05/q50/q95)",
  trajectory: ashadhaTrajectory,
  trajectory_30d: {
    times: ashadhaTimes,
    level: ashadhaEndpoint.q50,
    q05: ashadhaEndpoint.q05,
    q95: ashadhaEndpoint.q95,
    change: parseFloat((ashadhaEndpoint.q50 - ASHADHA_ANCHOR).toFixed(3)),
  },
  endpoint_production: {
    level: -6.624,
    q05: -7.835,
    q95: -4.558,
    anchor: ASHADHA_ANCHOR,
    band_half: ASHADHA_BAND_HALF,
  },
  direction: {
    label: "declining",
    change_q50_30d: parseFloat(
      (ashadhaEndpoint.q50 - ASHADHA_ANCHOR).toFixed(3)
    ),
    agreement_with_production: true,
    sign_accuracy_30d: 0.74,
  },
  overall_confidence: {
    level: "DIRECTIONAL",
    reason:
      "station data fresh; interval coverage acceptable; direction supported at 30d",
    endpoint_match: true,
  },
  evidence: {
    station_integrity: {
      integrity: 1.0,
      integrity_reason: "station data fresh",
      ood: 1.0,
      stability: 1.0,
    },
    anchor_ood: false,
    stability_oscillation: 1,
    recency_days: 1.5,
    recent90_coverage: 0.94,
  },
};

// ---------------------------------------------------------------------------
// Mock lookup — throws ApiRequestError matching real backend error shapes
// Coverage: ~600 stations have models, ~545 scored per cycle.
// Unknown slugs get "no model" (404); known but broken data gets
// "no valid features" (502). No pre-filter flag exists.
// ---------------------------------------------------------------------------
export function getMockForecast(slug: string): ForecastResponse {
  if (slug === "Ramchhitoni%20Sahawar_UPGW_a1b2c3d4")
    return mockForecastRamchhitoni;
  if (slug === "ASHADHA%20PRATHMIK%20VIDYALAYA_UPGW_5f5b3671")
    return mockForecastAshadha;

  // Simulate ML service down — covers 502 ML service error
  if (slug.includes("DOWN")) {
    throw new ApiRequestError(502, {
      error: "ML service error",
      detail: "ML service unavailable",
    });
  }

  // Simulate station without valid features — covers 502 no valid features
  if (slug.includes("NOFEATURES")) {
    throw new ApiRequestError(502, {
      error: "no valid features",
      detail: "Station has insufficient data for prediction",
    });
  }

  // Default: no model trained for this station — covers 404 no model
  throw new ApiRequestError(404, {
    error: "no model",
    detail: `No trained model for slug '${slug}'`,
    trained: false,
  });
}
