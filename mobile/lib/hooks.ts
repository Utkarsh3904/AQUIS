import { useEffect, useState } from "react";
import { fetchStationList, fetchStationFacts, fetchForecast, fetchTrend, ApiRequestError } from "../lib/api";
import type { StationListItem, StationFacts } from "../types/station";
import type { ForecastResponse } from "../types/forecast";
import type { TrendResponse } from "../types/api";
import type { ApiError } from "../types/assistant";

export interface HookError {
  status: number;
  body: ApiError;
}

function toHookError(e: unknown): HookError {
  if (e instanceof ApiRequestError) {
    return { status: e.status, body: e.body as ApiError };
  }
  return { status: 0, body: { error: "network error", detail: String(e) } };
}

export function useStations() {
  const [data, setData] = useState<StationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    fetchStationList()
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export function useStationFacts(id: number | null) {
  const [data, setData] = useState<StationFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchStationFacts(id)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}

export function useStationFactsBySlug(slug: string | null) {
  const [data, setData] = useState<StationFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchStationFacts(slug)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}

export function useForecast(slug: string | null) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchForecast(slug)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}

export function useTrend(stationId: number | null) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!stationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchTrend(stationId)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [stationId]);

  return { data, loading, error };
}
