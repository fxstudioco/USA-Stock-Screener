"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  lastLoaded: number | null;
}

/** Minimal SWR-style hook: keeps the last good data when a refresh fails. */
export function useFetch<T>(url: string | null, refreshMs = 0): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    setLoading(true);
    try {
      const res = await fetch(u);
      const json = (await res.json()) as T & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (urlRef.current === u) {
        setData(json);
        setError(null);
        setLastLoaded(Date.now());
      }
    } catch (e) {
      if (urlRef.current === u) setError((e as Error).message);
    } finally {
      if (urlRef.current === u) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    void load();
    if (!refreshMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, refreshMs);
    return () => clearInterval(id);
  }, [url, refreshMs, load]);

  return { data, error, loading, reload: load, lastLoaded };
}
