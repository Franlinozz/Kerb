/**
 * First-paint freshness (V3-01, docs/v3/V3-LIVE-AUDIT.md L-01). A page served from the ISR cache
 * can carry data rendered at the previous visit, hours ago on a quiet site. Every live surface
 * reads its payload's own time stamp and says which of three states it is in, so a stale number is
 * never shown as current. Pure, so the thresholds are pinned by unit tests.
 */
export const STALE_AFTER_MS = 90_000;
/** How long the Refreshing state may last before the surface admits it is showing the last known value. */
export const REFRESH_GRACE_MS = 15_000;

export type Freshness = "fresh" | "refreshing" | "lastKnown";

export function parseAsOf(asOf: string | number | null | undefined): number | null {
  if (asOf === null || asOf === undefined) return null;
  const ms = typeof asOf === "number" ? asOf : Date.parse(asOf);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * fresh: the data is under 90 s old (or carries no stamp to judge by).
 * refreshing: older, and a refresh is in flight or was asked for less than 15 s ago.
 * lastKnown: older, and the refresh failed or has not landed within 15 s.
 */
export function freshness(input: { asOfMs: number | null; nowMs: number; failed: boolean; refreshStartedMs: number | null }): Freshness {
  const { asOfMs, nowMs, failed, refreshStartedMs } = input;
  if (asOfMs === null || nowMs - asOfMs <= STALE_AFTER_MS) return "fresh";
  if (failed) return "lastKnown";
  if (refreshStartedMs === null || nowMs - refreshStartedMs < REFRESH_GRACE_MS) return "refreshing";
  return "lastKnown";
}

/** "12s", "4m", "2h 17m": the age of a value, for "Last known, {age} old" and "Updated {age} ago". */
export function age(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}

/** The words a live line shows for a state. */
export function liveLine(state: Freshness, asOfMs: number | null, nowMs: number): string {
  if (state === "refreshing") return "Refreshing live data";
  if (asOfMs === null) return "Live";
  if (state === "lastKnown") return `Last known, ${age(nowMs - asOfMs)} old`;
  return `Updated ${age(nowMs - asOfMs)} ago`;
}

/** The oldest of a page's payload stamps: the page is only as fresh as its stalest input. */
export function oldestAsOf(...stamps: (string | null | undefined)[]): string | null {
  let best: { ms: number; s: string } | null = null;
  for (const s of stamps) {
    const ms = parseAsOf(s);
    if (ms !== null && s && (best === null || ms < best.ms)) best = { ms, s };
  }
  return best?.s ?? null;
}
