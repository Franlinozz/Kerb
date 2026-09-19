import type { MarketCode } from "@kerb/types";
import { CALENDAR_VERSION, MARKETS, type SessionKind } from "./markets.js";
import { segmentAt, timeline, transitions, type Transition } from "./timeline.js";

export interface ClockInput {
  market: MarketCode;
  /** Unix ms. Time is an input: the resolver never reads the system clock. */
  atMs: number;
  /** Last Call length for this asset; defaults to the market's configured window. */
  cureWindowSec?: number;
}

export interface ClockResolution {
  calendarVersion: string;
  market: MarketCode;
  at: string;
  session: { kind: SessionKind; reason: string; startedAt: string; endsAt: string; names: string[] };
  /** Underlying is in its main (regular) session. */
  inMainSession: boolean;
  /** Underlying is in no session at all (KTS REFERENCE_CLOSED input). */
  referenceClosed: boolean;
  nextTransition: Transition;
  /**
   * Next material weakening: the next exit from the main session (close, lunch break,
   * early close). This is the cure deadline for Session Max positions.
   */
  nextWeakening: Transition;
  /** Next time the underlying enters no session at all. */
  nextReferenceClosed: Transition;
  /** Next start of the main session after nextWeakening: the end of the weak horizon. */
  nextMainOpen: Transition;
  /** Last entry into the main session at or before `at`, for RECOVERY cooldowns. */
  lastMainOpen: string | null;
  cureWindow: { lengthSec: number; opensAt: string; closesAt: string; open: boolean };
  /** Hours from `at` to the next main-session open after the next weakening (KTS H). Decimal string. */
  horizonHours: string;
}

const DAY = 86_400_000;

function first(ts: Transition[], pred: (t: Transition) => boolean, what: string): Transition {
  const t = ts.find(pred);
  if (!t) throw new Error(`no ${what} within horizon`);
  return t;
}

/** Hours with exactly 4 decimals, computed on integers. */
function hoursString(ms: number): string {
  const tenThousandths = Math.floor((ms * 10_000) / 3_600_000);
  const whole = Math.floor(tenThousandths / 10_000);
  const frac = String(tenThousandths % 10_000).padStart(4, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

export function resolveClock(input: ClockInput): ClockResolution {
  const { market, atMs } = input;
  const spec = MARKETS[market];
  const cureSec = input.cureWindowSec ?? spec.defaultCureWindowSec;
  const seg = segmentAt(market, atMs);
  const ts = transitions(market, atMs, 21 * DAY);
  const nextTransition = first(ts, () => true, "transition");
  const nextWeakening = first(ts, (t) => t.from === "REGULAR", "weakening");
  const nextReferenceClosed = first(ts, (t) => t.to === "CLOSED", "reference close");
  const nextMainOpen = first(ts, (t) => t.to === "REGULAR" && t.atMs > nextWeakening.atMs, "main open");

  const past = timeline(market, atMs - 7 * DAY, atMs + 1);
  let lastMainOpen: string | null = null;
  for (let i = 1; i < past.length; i++) {
    const b = past[i];
    const a = past[i - 1];
    if (b && a && b.kind === "REGULAR" && a.kind !== "REGULAR" && b.startMs <= atMs) lastMainOpen = new Date(b.startMs).toISOString();
  }

  const opensMs = nextWeakening.atMs - cureSec * 1000;
  return {
    calendarVersion: CALENDAR_VERSION,
    market,
    at: new Date(atMs).toISOString(),
    session: { kind: seg.kind, reason: seg.reason, startedAt: new Date(seg.startMs).toISOString(), endsAt: new Date(seg.endMs).toISOString(), names: seg.names },
    inMainSession: seg.kind === "REGULAR",
    referenceClosed: seg.kind === "CLOSED",
    nextTransition,
    nextWeakening,
    nextReferenceClosed,
    nextMainOpen,
    lastMainOpen,
    cureWindow: { lengthSec: cureSec, opensAt: new Date(opensMs).toISOString(), closesAt: nextWeakening.at, open: atMs >= opensMs && atMs < nextWeakening.atMs },
    horizonHours: hoursString(nextMainOpen.atMs - atMs),
  };
}

/** Asset-level entry point: any asset profile carrying its underlying market code. */
export function resolveAssetClock(asset: { underlying: { market: MarketCode } }, atMs: number, cureWindowSec?: number): ClockResolution {
  return resolveClock(cureWindowSec === undefined ? { market: asset.underlying.market, atMs } : { market: asset.underlying.market, atMs, cureWindowSec });
}
