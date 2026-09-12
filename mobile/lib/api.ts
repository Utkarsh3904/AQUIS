import { API_BASE, USE_MOCKS } from "./env";
import { mockStationRows } from "./mocks/stationList";
import { getMockStationFacts } from "./mocks/stationFacts";
import { getMockForecast } from "./mocks/forecast";
import { getMockAssistantResponse } from "./mocks/assistant";
import type { StationRow, StationListItem, StationFacts } from "../types/station";
import type { ForecastResponse } from "../types/forecast";
import type { AssistantRequest, AssistantResponse } from "../types/assistant";
import type { PaginatedResponse, MlStationListResponse, TrendResponse } from "../types/api";

const FETCH_TIMEOUT_MS = 30_000;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiRequestError(res.status, body);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class ApiRequestError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

// ─── Normalizer ─────────────────────────────────────────────────────────
// Translates raw DB columns (data-model.md stations table) into our
// internal StationListItem shape. Both mock and live paths run through this.
export function mapStationRow(row: StationRow): StationListItem {
  return {
    id: row.id,
    station: row.station_name,
    district: row.district,
    slug: null, // never on GET /stations — that endpoint doesn't touch Flask
    lat: row.latitude,
    lon: row.longitude,
    last_ts: row.last_observed_at?.replace(" ", "T"), // real API returns space-separated, normalize to ISO-8601
    external_station_id: row.external_station_id,
  };
}

// ─── Station list ───────────────────────────────────────────────────────
// GET /stations — real ML service returns {count, stations: [{district, last_ts, slug, station}]}
// Mock path returns raw DB rows normalized via mapStationRow
export async function fetchStationList(): Promise<StationListItem[]> {
  if (USE_MOCKS) return mockStationRows.map(mapStationRow);
  const res = await apiFetch<MlStationListResponse>("/stations?limit=2000");
  return res.stations.map((s) => ({
    id: 0, // ML service doesn't provide numeric IDs — slug is the identifier
    station: s.station,
    district: s.district,
    slug: s.slug,
    lat: 0, // ML service doesn't provide coordinates
    lon: 0,
    last_ts: s.last_ts?.replace(" ", "T"),
    external_station_id: s.slug,
  }));
}

// ─── Station facts (detail KPIs) ───────────────────────────────────────
// Mock: GET /stations/:id (numeric PK)
// Live: GET /stations/<slug> (ML service slug-based endpoint)
export async function fetchStationFacts(idOrSlug: number | string): Promise<StationFacts> {
  if (USE_MOCKS) {
    return getMockStationFacts(Number(idOrSlug));
  }
  return apiFetch<StationFacts>(`/stations/${idOrSlug}`);
}

// ─── Forecast ───────────────────────────────────────────────────────────
// GET /forecast/:slug — slug from ML service, nullable
// Coverage: ~600 stations have models, ~545 scored per cycle.
// No pre-filter flag — must attempt call and handle error gracefully.
export async function fetchForecast(slug: string): Promise<ForecastResponse> {
  if (USE_MOCKS) {
    return getMockForecast(slug);
  }
  return apiFetch<ForecastResponse>(`/forecast/${slug}`);
}

// ─── Assistant ──────────────────────────────────────────────────────────
// POST /assistant/chat
export async function postAssistantChat(
  req: AssistantRequest
): Promise<AssistantResponse> {
  if (USE_MOCKS) {
    return getMockAssistantResponse(req.question, req.station);
  }
  return apiFetch<AssistantResponse>("/assistant/chat", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ─── Telemetry (GWL chart data) ────────────────────────────────────────
// GET /telemetry/:stationId — numeric id, never external_station_id
export async function fetchTelemetry(
  stationId: number,
  limit = 1000
): Promise<PaginatedResponse<{ observed_at: string; groundwater_level: number }>> {
  if (USE_MOCKS) return { meta: { total: 0, limit, offset: 0 }, data: [] };
  return apiFetch(`/telemetry/${stationId}?limit=${limit}`);
}

// ─── Trends ─────────────────────────────────────────────────────────────
// GET /trends/:stationId — numeric id
export async function fetchTrend(stationId: number): Promise<TrendResponse> {
  if (USE_MOCKS) {
    return {
      station_id: stationId,
      mann_kendall: {
        s_statistic: 142,
        z_score: 1.873421,
        p_value: 0.060934,
        direction: "no trend",
        significant: false,
        n: 2190,
        variance: 5234.6667,
      },
      sens_slope: {
        slope: 0.00000032,
        intercept: -3.0142,
        slope_per_year: 0.0101,
        predicted_start: -3.0142,
        predicted_end: -2.9031,
        n_slopes: 2406555,
      },
      observation_count: 2190,
    };
  }
  return apiFetch(`/trends/${stationId}`);
}
