"use client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PUBLIC_API } from "@/lib/api";
import { freshness, liveLine, parseAsOf, type Freshness } from "@/lib/freshness";

/** A client query that carries a page's main data tells the page guard (LiveRoot) how fresh it is. */
export const PageFreshness = createContext<(asOfMs: number) => void>(() => {});

/**
 * Live data from the public API: server-rendered first value, then client polling. Shared by URL
 * through the query cache, so two components on a page never fetch the same thing twice.
 *
 * `asOf` reads the payload's own time stamp. The server value is dated by it, not by the moment
 * the page mounted, so a payload rendered hours ago into the ISR cache refetches at once instead
 * of waiting a full interval (V3-01, L-01), and `state` says whether the value on screen is fresh,
 * being refreshed, or the last known one.
 */
export function useLive<T>(
  path: string | null,
  initial: T | null,
  intervalMs: number,
  opts: { asOf?: (d: T) => string | number | null | undefined; drivesPage?: boolean } = {},
): { data: T | null; updating: boolean; failed: boolean; refetch: () => void; asOfMs: number | null; state: Freshness; line: string | null } {
  const { asOf, drivesPage = false } = opts;
  const initialAsOf = initial !== null && asOf ? parseAsOf(asOf(initial)) : null;
  const q = useQuery<T>({
    queryKey: ["kerb", path],
    enabled: path !== null,
    queryFn: async () => {
      const r = await fetch(`${PUBLIC_API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    },
    ...(initial !== null ? { initialData: initial, initialDataUpdatedAt: initialAsOf ?? Date.now() } : {}),
    staleTime: 5_000,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  // Stable, and never cancels a request already in flight: a slow answer still arrives.
  const { refetch: qRefetch } = q;
  const refetch = useCallback(() => void qRefetch({ cancelRefetch: false }), [qRefetch]);
  const now = useNow();
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  useEffect(() => setMountedAt(Date.now()), []);
  const data = q.data ?? null;
  const asOfMs = data !== null && asOf ? parseAsOf(asOf(data)) : q.dataUpdatedAt || null;
  const state: Freshness = now === null || !asOf
    ? "fresh"
    : freshness({ asOfMs, nowMs: now, failed: q.isError && !q.isFetching, refreshStartedMs: mountedAt });
  const report = useContext(PageFreshness);
  useEffect(() => { if (drivesPage && asOfMs !== null) report(asOfMs); }, [drivesPage, asOfMs, report]);
  return { data, updating: q.isFetching, failed: q.isError && q.data === undefined, refetch, asOfMs, state, line: now === null || !asOf ? null : liveLine(state, asOfMs, now) };
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
