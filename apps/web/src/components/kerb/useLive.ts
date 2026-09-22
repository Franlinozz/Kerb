"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PUBLIC_API } from "@/lib/api";

/**
 * Live data from the public API: server-rendered first value, then client polling. Shared by URL
 * through the query cache, so two components on a page never fetch the same thing twice.
 */
export function useLive<T>(path: string | null, initial: T | null, intervalMs: number): { data: T | null; updating: boolean; failed: boolean; refetch: () => void } {
  const q = useQuery<T>({
    queryKey: ["kerb", path],
    enabled: path !== null,
    queryFn: async () => {
      const r = await fetch(`${PUBLIC_API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    },
    ...(initial !== null ? { initialData: initial, initialDataUpdatedAt: Date.now() } : {}),
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return { data: q.data ?? null, updating: q.isFetching, failed: q.isError && q.data === undefined, refetch: () => void q.refetch() };
}

/** Wall clock, ticking once a second. null until mounted, so server and client render alike. */
export function useNow(stepMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

export function useNarrow(maxWidth = 760): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const on = (): void => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [maxWidth]);
  return narrow;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = (): void => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}
