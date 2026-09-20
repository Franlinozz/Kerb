import { COVERAGE, MARKETS, STRENGTH, type DayOverride, type MarketSpec, type SessionKind } from "./markets.js";
import { addDays, localParts, localToUtc, ymd } from "./tz.js";
import type { MarketCode } from "@kerb/types";

export interface Segment {
  kind: SessionKind;
  startMs: number;
  endMs: number;
  /** Why the market is closed, or what special day produced this segment. */
  reason: "SESSION" | "OVERNIGHT" | "WEEKEND" | "HOLIDAY" | "EARLY_CLOSE" | "HALF_DAY" | "HOLIDAY_HOURS";
  /** Local date(s) the segment belongs to, and holiday names that explain it. */
  dates: string[];
  names: string[];
}

const DAY_MS = 86_400_000;
const hm = (x: string): number => {
  const [h, m] = x.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export function market(code: MarketCode): MarketSpec {
  return MARKETS[code];
}

function covered(date: string): boolean {
  return date >= COVERAGE.from && date <= COVERAGE.to;
}

function assertCovered(date: string): void {
  if (!covered(date)) throw new Error(`calendar does not cover ${date}; refusing to guess`);
}

interface DaySessions {
  date: string;
  dow: number;
  override: DayOverride | undefined;
  segs: Segment[];
  outOfCoverage: boolean;
}

function daySessions(spec: MarketSpec, y: number, m: number, d: number, dow: number): DaySessions {
  const date = ymd(y, m, d);
  // Padding days outside the covered range contribute nothing; the caller asserts coverage
  // for the instant actually being resolved, so nothing beyond the range is ever guessed.
  if (!covered(date)) return { date, dow, override: undefined, segs: [], outOfCoverage: true };
  const override = spec.overrides[date];
  const tpl = override ? override.sessions : (spec.weekly[dow] ?? []);
  const reason: Segment["reason"] = override ? override.reason : "SESSION";
  const segs = tpl.map((t) => ({
    kind: t.kind as SessionKind,
    startMs: localToUtc(spec.tz, y, m, d, hm(t.start)),
    endMs: localToUtc(spec.tz, y, m, d, hm(t.end)),
    reason: reason === "HOLIDAY" ? "SESSION" : reason,
    dates: [date],
    names: override ? [override.name] : [],
  })) as Segment[];
  return { date, dow, override, segs, outOfCoverage: false };
}

/**
 * Contiguous segments covering [fromMs, toMs): the market's sessions with every gap filled
 * by a CLOSED segment explained as OVERNIGHT, WEEKEND or HOLIDAY. Adjacent sessions of the
 * same kind merge (e.g. a 24:00/00:00 boundary).
 */
export function timeline(code: MarketCode, fromMs: number, toMs: number): Segment[] {
  const spec = market(code);
  assertCovered(ymd(localParts(spec.tz, fromMs).y, localParts(spec.tz, fromMs).m, localParts(spec.tz, fromMs).d));
  // Pad generously: a long holiday weekend can leave several days with no session at all,
  // and every instant in [fromMs, toMs) must still land inside a segment.
  const PAD_DAYS = 6;
  const start = localParts(spec.tz, fromMs - PAD_DAYS * DAY_MS);
  const days: DaySessions[] = [];
  for (let i = 0; ; i++) {
    const c = addDays(start.y, start.m, start.d, i);
    const ds = daySessions(spec, c.y, c.m, c.d, c.dow);
    days.push(ds);
    if (localToUtc(spec.tz, c.y, c.m, c.d, 0) > toMs + PAD_DAYS * DAY_MS) break;
  }
  const sessions = days.flatMap((d) => d.segs).filter((s) => s.endMs > s.startMs).sort((a, b) => a.startMs - b.startMs);
  const out: Segment[] = [];
  const closedExplained = (a: number, b: number): Pick<Segment, "reason" | "dates" | "names"> => {
    const touched = days.filter((d) => {
      const [y, m, dd] = d.date.split("-").map(Number) as [number, number, number];
      const ds = localToUtc(spec.tz, y, m, dd, 0);
      return ds < b && ds + DAY_MS > a;
    });
    const hol = touched.filter((d) => d.override?.reason === "HOLIDAY");
    if (hol.length) return { reason: "HOLIDAY", dates: hol.map((d) => d.date), names: hol.map((d) => d.override?.name ?? "") };
    const idle = touched.filter((d) => (spec.weekly[d.dow] ?? []).length === 0);
    if (idle.length) return { reason: "WEEKEND", dates: idle.map((d) => d.date), names: [] };
    return { reason: "OVERNIGHT", dates: [], names: [] };
  };
  // Start at the beginning of the generated range, not at the first session, so a closed
  // stretch that begins before any session in the window is still emitted.
  const firstDay = days[0] as DaySessions;
  const [fy, fm, fd] = firstDay.date.split("-").map(Number) as [number, number, number];
  let cursor = Math.min(localToUtc(spec.tz, fy, fm, fd, 0), sessions[0]?.startMs ?? fromMs);
  for (const sg of sessions) {
    if (sg.startMs > cursor) out.push({ kind: "CLOSED", startMs: cursor, endMs: sg.startMs, ...closedExplained(cursor, sg.startMs) });
    const last = out[out.length - 1];
    if (last && last.kind === sg.kind && last.endMs === sg.startMs && last.reason === sg.reason) {
      last.endMs = sg.endMs;
      last.dates = [...new Set([...last.dates, ...sg.dates])];
    } else {
      out.push({ ...sg });
    }
    cursor = Math.max(cursor, sg.endMs);
  }
  return out.filter((s) => s.endMs > fromMs && s.startMs < toMs);
}

export function segmentAt(code: MarketCode, tsMs: number): Segment {
  const spec = market(code);
  const p = localParts(spec.tz, tsMs);
  assertCovered(ymd(p.y, p.m, p.d));
  const seg = timeline(code, tsMs - DAY_MS, tsMs + DAY_MS).find((s) => s.startMs <= tsMs && tsMs < s.endMs);
  if (!seg) throw new Error(`no segment for ${code} at ${new Date(tsMs).toISOString()}`);
  return seg;
}

export type TransitionType =
  | "PRE_OPEN" | "SESSION_OPEN" | "LUNCH_BREAK" | "LUNCH_END" | "SESSION_CLOSE" | "EARLY_CLOSE" | "POST_CLOSE" | "SESSION_BREAK" | "SESSION_END";

export interface Transition {
  type: TransitionType;
  at: string;
  atMs: number;
  from: SessionKind;
  to: SessionKind;
  weakening: boolean;
}

function transitionType(a: Segment, b: Segment): TransitionType {
  if (b.kind === "REGULAR") return a.kind === "LUNCH" ? "LUNCH_END" : "SESSION_OPEN";
  if (b.kind === "PRE") return "PRE_OPEN";
  if (a.kind === "REGULAR" && b.kind === "LUNCH") return "LUNCH_BREAK";
  if (a.kind === "REGULAR") {
    if (a.reason === "EARLY_CLOSE" || a.reason === "HALF_DAY" || a.reason === "HOLIDAY_HOURS") return "EARLY_CLOSE";
    return b.kind === "CLOSED" && a.reason === "SESSION" ? "SESSION_CLOSE" : "SESSION_CLOSE";
  }
  if (a.kind === "POST") return "POST_CLOSE";
  return b.kind === "CLOSED" ? "SESSION_END" : "SESSION_BREAK";
}

/** All boundaries in (fromMs, fromMs + horizonMs]. */
export function transitions(code: MarketCode, fromMs: number, horizonMs = 21 * DAY_MS): Transition[] {
  const segs = timeline(code, fromMs - DAY_MS, fromMs + horizonMs);
  const out: Transition[] = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1] as Segment;
    const b = segs[i] as Segment;
    if (b.startMs <= fromMs || a.kind === b.kind) continue;
    out.push({ type: transitionType(a, b), at: new Date(b.startMs).toISOString(), atMs: b.startMs, from: a.kind, to: b.kind, weakening: STRENGTH[b.kind] < STRENGTH[a.kind] });
  }
  return out;
}
