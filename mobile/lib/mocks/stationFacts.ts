import type { StationFacts } from "../../types/station";
import { ApiRequestError } from "../api";

// Keys are numeric Postgres PK ids, matching StationListItem.id
// §10.4 + §10.7 prompt template fields
export const mockStationFacts: Record<number, StationFacts> = {
  11: {
    last: -2.841,
    last_date: "2026-09-05",
    change_7d: 0.042,
    change_30d: 0.121,
    change_60d: -0.315,
    change_180d: -0.872,
    min: -14.21,
    max: -0.93,
    span: 13.28,
    n_obs: 4387,
    outliers: 12,
    forecast: {
      anchor: -2.841,
      pred_xgb: 0.121,
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
  },
  17: {
    last: -6.411,
    last_date: "2026-09-05",
    change_7d: -0.083,
    change_30d: -0.213,
    change_60d: -0.451,
    change_180d: -1.204,
    min: -18.72,
    max: -3.15,
    span: 15.57,
    n_obs: 4213,
    outliers: 8,
    forecast: {
      anchor: -6.411,
      pred_xgb: -0.213,
      day30_pred: -6.624,
      change_30d_pred: -0.213,
      direction: "expected decline",
      plausible: true,
      band_half: 1.64,
      q05_level: -7.835,
      q95_level: -4.558,
      station_stride_rmse: 0.597,
      high_uncertainty: false,
    },
  },
  31: {
    last: -17.171,
    last_date: "2026-09-03",
    change_7d: 0.152,
    change_30d: 0.29,
    change_60d: 0.482,
    change_180d: 1.103,
    min: -24.31,
    max: -12.08,
    span: 12.23,
    n_obs: 3982,
    outliers: 5,
    forecast: {
      anchor: -17.171,
      pred_xgb: 0.29,
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
};

export function getMockStationFacts(id: number): StationFacts {
  const facts = mockStationFacts[id];
  if (!facts) {
    throw new ApiRequestError(404, {
      error: "unknown station",
      detail: `No facts for station id ${id}`,
    });
  }
  return facts;
}
