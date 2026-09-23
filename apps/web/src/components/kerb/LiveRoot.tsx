"use client";
/**
 * The page-level freshness guard (V3-01, L-01). Every live route wraps its body in LiveRoot with
 * the time stamp of the payload it was rendered from, stamped on the root as data-asof. If that
 * payload is more than 90 s old (an ISR page rendered at the previous visit), the values are
 * dimmed, the line says "Refreshing live data", and the page asks the server for a fresh render
 * until one lands. If none lands within 15 s it says "Last known, {age} old" with a Retry button.
 * A client query that carries the page's main data (the Board) may report a fresher stamp.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageFreshness, useNow } from "./useLive";
import { freshness, liveLine, parseAsOf } from "@/lib/freshness";

export function LiveRoot({ asOf, className, children }: { asOf: string | null; className?: string; children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const now = useNow();
  const serverMs = parseAsOf(asOf);
  const [clientMs, setClientMs] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const asOfMs = serverMs === null ? clientMs : clientMs === null ? serverMs : Math.max(serverMs, clientMs);
  const state = now === null ? "fresh" : freshness({ asOfMs, nowMs: now, failed: false, refreshStartedMs: startedAt });
  const report = useCallback((ms: number) => setClientMs((c) => (c === null || ms > c ? ms : c)), []);

  // Stale on arrival: ask for a fresh render every 3 s while inside the grace period. Each
  // router.refresh() also prompts the ISR cache to regenerate, so the second answer is new.
  const stale = state !== "fresh";
  useEffect(() => {
    if (!stale || state === "lastKnown") return undefined;
    setStartedAt((s) => s ?? Date.now());
    router.refresh();
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [stale, state, router]);
  useEffect(() => { if (!stale) setStartedAt(null); }, [stale]);

  const retry = (): void => { setStartedAt(Date.now()); router.refresh(); };
  return (
    <PageFreshness.Provider value={report}>
      <div className={["live-root", className].filter(Boolean).join(" ")} data-asof={asOf ?? undefined} data-fresh={state}>
        {stale && now !== null ? (
          <div className="live-guard" role="status" aria-live="polite">
            <span className="live-guard-dot" aria-hidden="true" />
            <span>{liveLine(state, asOfMs, now)}</span>
            {state === "lastKnown" ? <button type="button" className="btn btn-sm btn-quiet" onClick={retry}>Retry</button> : null}
          </div>
        ) : null}
        {children}
      </div>
    </PageFreshness.Provider>
  );
}
