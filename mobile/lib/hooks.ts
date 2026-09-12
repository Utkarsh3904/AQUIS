import { useEffect, useState } from "react";
import {
  fetchStationList, fetchStationFacts, fetchForecast, fetchTrend,
  fetchStationSeries, fetchStationAlerts, fetchDistrictList, fetchDistrictDetail,
  fetchFleetAlerts,
  ApiRequestError,
} from "../lib/api";
import type { StationListItem } from "../types/station";
import type { ForecastResponse } from "../types/forecast";
import type {
  TrendResponse, StationDetailResponse, StationSeriesResponse,
  StationAlertsResponse, DistrictListResponse, DistrictDetailResponse,
  FleetAlertsResponse,
} from "../types/api";
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
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStationList()
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  return { data, loading, error, refetch };
}

export function useStationFacts(id: number | null) {
  const [data, setData] = useState<StationDetailResponse | null>(null);
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

export function useStationSeries(slug: string | null, opts?: { drivers?: string[]; limit?: number }) {
  const [data, setData] = useState<StationSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchStationSeries(slug, opts)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}

export function useStationAlerts(slug: string | null, n?: number) {
  const [data, setData] = useState<StationAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchStationAlerts(slug, n)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}

export function useDistrictList() {
  const [data, setData] = useState<DistrictListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    fetchDistrictList()
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export function useDistrictDetail(name: string | null) {
  const [data, setData] = useState<DistrictDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    if (!name) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDistrictDetail(name)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [name]);

  return { data, loading, error };
}
export function useStationFactsBySlug(slug: string | null) {
  const [data, setData] = useState<StationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

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
  }, [slug, fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  return { data, loading, error, refetch };
}

export function useForecast(slug: string | null) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

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
  }, [slug, fetchKey]);

  const refetch = () => setFetchKey((k) => k + 1);

  return { data, loading, error, refetch };
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

export function useFleetAlerts(limit?: number) {
  const [data, setData] = useState<FleetAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFleetAlerts(limit)
      .then(setData)
      .catch((e: ApiRequestError) => setError(toHookError(e)))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading, error };
}
