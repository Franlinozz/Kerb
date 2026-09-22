"use client";

/**
 * The SessionRail, Kerb's signature (V2-DESIGN-SYSTEM.md sections 8 and 9). Variants:
 *   full     one asset's market over a week (Board, Asset)
 *   compact  the same, 40 px, for inner pages
 *   lanes    New York and Hong Kong on one shared axis and cursor (Home)
 *   demo     one compressed KerbClockDemo cycle (Credit)
 *
 * All geometry is lib/time.ts; the session data is the Clock API, which runs the same resolver
 * the onchain KerbClock is equivalence-tested against. The countdown never goes negative: past a
 * transition the rail refetches and says "Updating".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Clock, ClockSegment, DemoClock, Regime } from "@/lib/api";
import { centredWindow, clip, countdown, dayColumns, demoSegments, localHm, pct, utcHm } from "@/lib/time";
import { RegimePill } from "./RegimePill";
import { useClock } from "./useClock";
import { useNarrow, useNow, useReducedMotion } from "./useLive";

export const KIND_WORD: Record<ClockSegment["kind"], string> = { PRE: "Pre-market", REGULAR: "Regular session", LUNCH: "Lunch break", POST: "After hours", CLOSED: "Closed" };
const REASON_WORD: Record<string, string> = { OVERNIGHT: "overnight", WEEKEND: "weekend", HOLIDAY: "holiday", EARLY_CLOSE: "early close", HALF_DAY: "half day" };
export const TRANSITION_WORD: Record<string, string> = {
  PRE_OPEN: "Pre-market opens", SESSION_OPEN: "Session opens", SESSION_CLOSE: "Session closes", LUNCH_START: "Lunch break starts",
  LUNCH_END: "Session resumes", POST_OPEN: "After hours", POST_CLOSE: "Market closes", EARLY_CLOSE: "Early close",
};
const transitionWord = (t: string): string => TRANSITION_WORD[t] ?? t.replace(/_/g, " ").toLowerCase();

interface Seg { kind: ClockSegment["kind"] | "LAST_CALL"; startMs: number; endMs: number; names?: string[] }
interface Hover { seg: Seg; x: number; lane: number }

function sessionWord(c: Clock): string {
  const s = c.clock.session;
  const r = REASON_WORD[s.reason];
  return `${KIND_WORD[s.kind]}${r ? ` (${r})` : ""}${s.names.length ? `: ${s.names.join(", ")}` : ""}`;
}

function segmentsOf(c: Clock): Seg[] {
  return c.segments.map((g) => ({ kind: g.kind, startMs: Date.parse(g.startsAt), endMs: Date.parse(g.endsAt), names: g.names }));
}

/** Last Call closes every regular segment that ends in a weakening: the last cureSec of it. */
function lastCalls(c: Clock): Seg[] {
  const len = c.clock.cureWindow.lengthSec * 1000;
  return c.segments.filter((g) => g.kind === "REGULAR").map((g) => ({ kind: "LAST_CALL" as const, startMs: Date.parse(g.endsAt) - len, endMs: Date.parse(g.endsAt) }));
}

function Band({ segs, calls, fromMs, toMs, lane, onHover, focusable, label }: {
  segs: Seg[]; calls: Seg[]; fromMs: number; toMs: number; lane: number; onHover: (h: Hover | null) => void; focusable: boolean; label: string;
}): React.ReactElement {
  return (
    <div className="rail-band" role="group" aria-label={label}>
      {segs.map((g) => {
        const c = clip(g.startMs, g.endMs, fromMs, toMs);
        if (!c || g.kind === "CLOSED") return null;
        const text = `${KIND_WORD[g.kind as ClockSegment["kind"]]} ${utcHm(g.startMs)} to ${utcHm(g.endMs)} UTC`;
        return (
          <span key={`${g.kind}${g.startMs}`} className={`rail-seg rail-${g.kind}`} style={{ left: `${c.left}%`, width: `${c.width}%` }}
            tabIndex={focusable ? 0 : -1} aria-label={text}
            onMouseEnter={() => onHover({ seg: g, x: c.left + c.width / 2, lane })} onMouseLeave={() => onHover(null)}
            onFocus={() => onHover({ seg: g, x: c.left + c.width / 2, lane })} onBlur={() => onHover(null)} />
        );
      })}
      {calls.map((g) => {
        const c = clip(g.startMs, g.endMs, fromMs, toMs);
        if (!c) return null;
        return (
          <span key={`lc${g.startMs}`} className="rail-seg rail-LAST_CALL" style={{ left: `${c.left}%`, width: `${Math.max(c.width, 0.25)}%` }}
            tabIndex={focusable ? 0 : -1} aria-label={`Last Call ${utcHm(g.startMs)} to ${utcHm(g.endMs)} UTC`}
            onMouseEnter={() => onHover({ seg: g, x: c.left + c.width / 2, lane })} onMouseLeave={() => onHover(null)}
            onFocus={() => onHover({ seg: g, x: c.left + c.width / 2, lane })} onBlur={() => onHover(null)} />
        );
      })}
    </div>
  );
}

function Days({ fromMs, toMs }: { fromMs: number; toMs: number }): React.ReactElement {
  const cols = dayColumns(fromMs, toMs);
  return (
    <div className="rail-days" aria-hidden="true">
      {cols.map((d) => (
        <span key={d.startMs} className="rail-day" style={{ left: `${d.left}%`, width: `${d.width}%` }}>
          {d.width > 6 ? <span className="rail-day-label">{d.label}</span> : null}
        </span>
      ))}
    </div>
  );
}

function Tip({ hover, tzs }: { hover: Hover | null; tzs: string[] }): React.ReactElement | null {
  if (!hover) return null;
  const tz = tzs[hover.lane] ?? "UTC";
  const g = hover.seg;
  const word = g.kind === "LAST_CALL" ? "Last Call" : KIND_WORD[g.kind];
  return (
    <div className="rail-tip" role="status" style={{ left: `${Math.min(88, Math.max(12, hover.x))}%` }}>
      <strong>{word}{g.names?.length ? ` · ${g.names.join(", ")}` : ""}</strong>
      <span>{utcHm(g.startMs)} to {utcHm(g.endMs)} UTC</span>
      <span className="ink-3">{localHm(g.startMs, tz)} to {localHm(g.endMs, tz)}</span>
    </div>
  );
}

function Cursor({ now, fromMs, toMs }: { now: number | null; fromMs: number; toMs: number }): React.ReactElement | null {
  if (now === null || now < fromMs || now > toMs) return null;
  return <span className="rail-cursor" style={{ left: `${pct(now, fromMs, toMs)}%` }} aria-hidden="true"><span className="rail-now">NOW</span></span>;
}

/** Tone cross-fade on a regime change: the one orchestrated motion (section 8). */
function useChanged(key: string | null): boolean {
  const last = useRef(key);
  const [changed, setChanged] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (last.current !== null && key !== null && last.current !== key && !reduced) {
      setChanged(true);
      const t = setTimeout(() => setChanged(false), 1200);
      last.current = key;
      return () => clearTimeout(t);
    }
    last.current = key;
    return undefined;
  }, [key, reduced]);
  return changed;
}

function useDisplayWindow(data: { fromMs: number; toMs: number }, now: number | null): { fromMs: number; toMs: number } {
  const narrow = useNarrow();
  return useMemo(() => {
    if (!narrow || now === null) return data;
    const c = centredWindow(now, 72);
    return { fromMs: Math.max(c.fromMs, data.fromMs), toMs: Math.min(c.toMs, data.toMs) };
  }, [narrow, now === null ? 0 : Math.floor(now / 600_000), data.fromMs, data.toMs]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ------------------------------------------------------------------------------ full / compact

export function AssetRail({ symbol, initial, regime, tz, compact = false }: { symbol: string; initial: Clock; regime: Regime | null; tz: string; compact?: boolean }): React.ReactElement {
  const { clock, updating, now } = useClock(symbol, initial);
  const c = clock ?? initial;
  const data = { fromMs: Date.parse(c.window.from), toMs: Date.parse(c.window.to) };
  const w = useDisplayWindow(data, now);
  const [hover, setHover] = useState<Hover | null>(null);
  const changed = useChanged(regime);
  const nextMs = Date.parse(c.clock.nextTransition.at);
  const desc = `${symbol} on ${c.market}: ${sessionWord(c)}. ${transitionWord(c.clock.nextTransition.type)} at ${utcHm(nextMs)} UTC, ${localHm(nextMs, tz)}. Last Call windows are marked at the end of each regular session.`;
  return (
    <section className={`rail rail-${compact ? "compact" : "full"}`} data-changed={changed || undefined} aria-label={`Session rail for ${symbol}`}>
      <div className="rail-head">
        <div className="rail-now-row">
          <span key={regime ?? "none"} className="rail-pill"><RegimePill regime={regime} size={compact ? "sm" : "md"} /></span>
          <span className="ink-2">{sessionWord(c)}</span>
        </div>
        <div className="rail-next">
          <span className="ink-3">{transitionWord(c.clock.nextTransition.type)} in</span>{" "}
          <strong suppressHydrationWarning>{updating || now === null ? (now === null ? "" : "Updating") : countdown(nextMs, now)}</strong>{" "}
          <span className="ink-3" suppressHydrationWarning>{utcHm(nextMs)} UTC · {localHm(nextMs, tz)}</span>
        </div>
      </div>
      <div className="rail-body">
        <Band segs={segmentsOf(c)} calls={lastCalls(c)} fromMs={w.fromMs} toMs={w.toMs} lane={0} onHover={setHover} focusable={!compact} label={desc} />
        <Cursor now={now} fromMs={w.fromMs} toMs={w.toMs} />
        <Tip hover={hover} tzs={[tz]} />
      </div>
      {compact ? null : <Days fromMs={w.fromMs} toMs={w.toMs} />}
      <p className="sr-only">{desc}</p>
    </section>
  );
}

// ------------------------------------------------------------------------------ lanes

export function LanesRail({ initial, compact = false }: { initial: { ny: Clock; hk: Clock }; compact?: boolean }): React.ReactElement {
  const ny = useClock(initial.ny.symbol, initial.ny);
  const hk = useClock(initial.hk.symbol, initial.hk);
  const now = ny.now;
  const lanes = [
    { city: "New York", code: "XNYS · XNAS", tz: "America/New_York", c: ny.clock ?? initial.ny, updating: ny.updating },
    { city: "Hong Kong", code: "XHKG", tz: "Asia/Hong_Kong", c: hk.clock ?? initial.hk, updating: hk.updating },
  ];
  const data = { fromMs: Math.max(...lanes.map((l) => Date.parse(l.c.window.from))), toMs: Math.min(...lanes.map((l) => Date.parse(l.c.window.to))) };
  const w = useDisplayWindow(data, now);
  const [hover, setHover] = useState<Hover | null>(null);
  const soonest = [...lanes].sort((a, b) => Date.parse(a.c.clock.nextTransition.at) - Date.parse(b.c.clock.nextTransition.at))[0]!;
  const soonMs = Date.parse(soonest.c.clock.nextTransition.at);
  const changed = useChanged(lanes.map((l) => l.c.clock.session.kind).join("|"));
  return (
    <section className={`rail rail-lanes${compact ? " rail-lanes-compact" : ""}`} data-changed={changed || undefined} aria-label="Session rail: New York and Hong Kong on one clock">
      <div className="rail-head">
        <div className="rail-now-row ink-2">
          {lanes.map((l) => <span key={l.city}><span className="ink">{l.city}</span> {KIND_WORD[l.c.clock.session.kind].toLowerCase()}</span>).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, <span key={`s${i}`} className="ink-3"> · </span>, x] : [x]), [])}
        </div>
        <div className="rail-next">
          <span className="ink-3">{soonest.city}: {transitionWord(soonest.c.clock.nextTransition.type).toLowerCase()} in</span>{" "}
          <strong suppressHydrationWarning>{now === null ? "" : soonest.updating ? "Updating" : countdown(soonMs, now)}</strong>{" "}
          <span className="ink-3" suppressHydrationWarning>{utcHm(soonMs)} UTC · {localHm(soonMs, soonest.tz)}</span>
        </div>
      </div>
      <div className="rail-lanes-grid">
        {lanes.map((l, i) => (
          <div key={l.city} className="rail-lane">
            <div className="rail-lane-label t-label">{l.city}<span className="ink-3"> · {l.code}</span></div>
            <div className="rail-body">
              <Band segs={segmentsOf(l.c)} calls={lastCalls(l.c)} fromMs={w.fromMs} toMs={w.toMs} lane={i} onHover={setHover} focusable={!compact}
                label={`${l.city}: ${sessionWord(l.c)}. ${transitionWord(l.c.clock.nextTransition.type)} at ${utcHm(Date.parse(l.c.clock.nextTransition.at))} UTC.`} />
              {hover?.lane === i ? <Tip hover={hover} tzs={lanes.map((x) => x.tz)} /> : null}
            </div>
          </div>
        ))}
        <div className="rail-lanes-cursor"><Cursor now={now} fromMs={w.fromMs} toMs={w.toMs} /></div>
      </div>
      {compact ? null : <div className="rail-lanes-days"><Days fromMs={w.fromMs} toMs={w.toMs} /></div>}
    </section>
  );
}

// ------------------------------------------------------------------------------ demo

/** The demo schedule is deterministic from its immutables, so it is computed locally each second. */
export function scheduleAt(d: DemoClock, nowMs: number): DemoClock {
  const ts = Math.floor(nowMs / 1000);
  const phase = (((ts - d.epoch) % d.weekLengthSec) + d.weekLengthSec) % d.weekLengthSec;
  const start = ts - phase;
  const iso = (s: number): string => new Date(s * 1000).toISOString();
  return {
    ...d, now: iso(ts), phaseSec: phase, cycleStartedAt: iso(start),
    state: phase < d.cureStartSec ? "SESSION" : phase < d.sessionEndSec ? "LAST_CALL" : "CLOSED",
    nextCureOpensAt: iso(phase < d.cureStartSec ? start + d.cureStartSec : start + d.weekLengthSec + d.cureStartSec),
    nextCureClosesAt: iso(phase < d.sessionEndSec ? start + d.sessionEndSec : start + d.weekLengthSec + d.sessionEndSec),
    nextSessionAt: iso(start + d.weekLengthSec),
  };
}

export function DemoRail({ initial, compact = false }: { initial: DemoClock; compact?: boolean }): React.ReactElement {
  const now = useNow();
  const d = now === null ? initial : scheduleAt(initial, now);
  const g = demoSegments(d);
  const [hover, setHover] = useState<Hover | null>(null);
  const changed = useChanged(d.state);
  const inCall = d.state === "LAST_CALL";
  const target = Date.parse(inCall ? d.nextCureClosesAt : d.nextCureOpensAt);
  const stateWord = d.state === "SESSION" ? "Session" : inCall ? "Last Call" : "Closed";
  const segs: Seg[] = g.segments.map((s) => ({ kind: s.kind, startMs: s.startMs, endMs: s.endMs }));
  return (
    <section className={`rail rail-demo${compact ? " rail-compact" : ""}`} data-changed={changed || undefined} data-state={d.state} aria-label="Demo clock rail">
      <div className="rail-head">
        <div className="rail-now-row">
          <span key={d.state} className="rail-pill"><span className="rpill" data-regime={inCall ? "PRE_TRANSITION" : d.state === "CLOSED" ? "REFERENCE_CLOSED" : "NORMAL"} data-size="md">{stateWord}</span></span>
          <span className="t-label">Demo clock · one trading week per hour</span>
        </div>
        <div className="rail-next">
          <span className="ink-3">{inCall ? "Last Call closes in" : "Next Last Call in"}</span>{" "}
          <strong suppressHydrationWarning>{now === null ? "" : countdown(target, now)}</strong>{" "}
          <span className="ink-3" suppressHydrationWarning>{utcHm(target)} UTC</span>
        </div>
      </div>
      <div className="rail-body">
        <Band segs={segs} calls={[{ kind: "LAST_CALL", startMs: g.lastCall.startMs, endMs: g.lastCall.endMs }]} fromMs={g.fromMs} toMs={g.toMs} lane={0} onHover={setHover} focusable={!compact}
          label={`Demo clock, testnet only: session for ${Math.round(d.cureStartSec / 60)} minutes, Last Call for ${Math.round((d.sessionEndSec - d.cureStartSec) / 60)} minutes, then closed for ${Math.round((d.weekLengthSec - d.sessionEndSec) / 60)} minutes, every hour.`} />
        <Cursor now={now} fromMs={g.fromMs} toMs={g.toMs} />
        <Tip hover={hover} tzs={["UTC"]} />
      </div>
      {compact ? null : (
        <div className="rail-demo-scale t-label ink-3" aria-hidden="true">
          <span>{utcHm(g.fromMs)} UTC · cycle start</span><span>{utcHm(g.lastCall.startMs)} Last Call</span><span>{utcHm(g.lastCall.endMs)} closed</span><span>{utcHm(g.toMs)}</span>
        </div>
      )}
    </section>
  );
}
