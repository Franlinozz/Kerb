"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Clock } from "@/lib/api";
import { useLive, useNow } from "./useLive";
import { clockPath, railWindow } from "@/lib/time";

export { clockPath, railWindow };
const DAY = 86_400_000;

/**
 * An asset's Clock, kept current: refetched every 60 s and again the moment now passes the next
 * transition, so the countdown never runs past zero. While that fetch is in flight the rail
 * says "Updating".
 */
export function useClock(symbol: string, initial: Clock | null): { clock: Clock | null; updating: boolean; failed: boolean; now: number | null } {
  const now = useNow();
  const windowRef = useRef(initial ? { fromMs: Date.parse(initial.window.from), toMs: Date.parse(initial.window.to) } : railWindow(Date.now()));
  // Roll the window forward when the day changes under an open page.
  if (now !== null && now > windowRef.current.fromMs + 3 * DAY) windowRef.current = railWindow(now);
  const path = useMemo(() => clockPath(symbol, windowRef.current), [symbol, windowRef.current.fromMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useLive<Clock>(path, initial, 60_000);
  const next = live.data ? Date.parse(live.data.clock.nextTransition.at) : null;
  const passed = now !== null && next !== null && now >= next;
  const { refetch } = live;
  useEffect(() => { if (passed) refetch(); }, [passed, next, refetch]);
  return { clock: live.data, updating: live.updating || passed, failed: live.failed, now };
}
