import { API_BASE, USE_MOCKS } from "./env";
import { mockStationRows } from "./mocks/stationList";
import { getMockStationFacts } from "./mocks/stationFacts";
import { getMockForecast } from "./mocks/forecast";
import { getMockAssistantResponse } from "./mocks/assistant";
import type { StationRow, StationListItem, StationFacts } from "../types/station";
import type { ForecastResponse } from "../types/forecast";
import type { AssistantRequest, AssistantResponse } from "../types/assistant";
import type {
  PaginatedResponse, MlStationListResponse, TrendResponse,
  StationDetailResponse, StationSeriesResponse,
  DistrictListResponse, DistrictDetailResponse,
  FleetRecoveryResponse, FleetAlertsResponse, StationAlertsResponse,
} from "../types/api";

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
    lat: s.latitude ?? 0,
    lon: s.longitude ?? 0,
    last_ts: s.last_ts?.replace(" ", "T"),
    external_station_id: s.slug,
  }));
}

// ─── Station facts (detail KPIs) ───────────────────────────────────────
// Mock: GET /stations/:id (numeric PK)
// Live: GET /stations/<slug> (ML service slug-based endpoint)
export async function fetchStationFacts(idOrSlug: number | string): Promise<StationDetailResponse> {
  if (USE_MOCKS) {
    return getMockStationFacts(Number(idOrSlug)) as unknown as StationDetailResponse;
  }
  return apiFetch<StationDetailResponse>(`/stations/${idOrSlug}`);
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

// ─── Station series (6h GWL + drivers) ─────────────────────────────
// GET /stations/<slug>/series
export async function fetchStationSeries(
  slug: string,
  opts?: { drivers?: string[]; from?: string; to?: string; limit?: number }
): Promise<StationSeriesResponse> {
  const params = new URLSearchParams();
  if (opts?.drivers?.length) params.set("drivers", opts.drivers.join(","));
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiFetch<StationSeriesResponse>(`/stations/${slug}/series${qs ? `?${qs}` : ""}`);
}

// ─── Station alerts ────────────────────────────────────────────────
// GET /stations/<slug>/alerts
export async function fetchStationAlerts(slug: string, n?: number): Promise<StationAlertsResponse> {
  const qs = n ? `?n=${n}` : "";
  return apiFetch<StationAlertsResponse>(`/stations/${slug}/alerts${qs}`);
}

// ─── District list ─────────────────────────────────────────────────
// GET /districts
export async function fetchDistrictList(limit?: number): Promise<DistrictListResponse> {
  const qs = limit ? `?limit=${limit}` : "";
  return apiFetch<DistrictListResponse>(`/districts${qs}`);
}

// ─── District detail ───────────────────────────────────────────────
// GET /districts/<name>
export async function fetchDistrictDetail(name: string): Promise<DistrictDetailResponse> {
  return apiFetch<DistrictDetailResponse>(`/districts/${encodeURIComponent(name)}`);
}

// ─── Fleet recovery ────────────────────────────────────────────────
// GET /fleet/recovery
export async function fetchFleetRecovery(limit?: number): Promise<FleetRecoveryResponse> {
  const qs = limit ? `?limit=${limit}` : "";
  return apiFetch<FleetRecoveryResponse>(`/fleet/recovery${qs}`);
}

// ─── Fleet alerts ──────────────────────────────────────────────────
// GET /fleet/alerts
export async function fetchFleetAlerts(limit?: number): Promise<FleetAlertsResponse> {
  const qs = limit ? `?limit=${limit}` : "";
  return apiFetch<FleetAlertsResponse>(`/fleet/alerts${qs}`);
}
