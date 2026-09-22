/**
 * Geometry and words for the time components (SessionRail, MarketClocks, Tape). Pure, so the
 * rules that V1 got wrong (a countdown that went negative, day labels on the midnight tick)
 * are pinned by unit tests.
 */
const DAY = 86_400_000;

/** Position of a moment on a window, as a percentage clamped to [0, 100]. */
export function pct(ms: number, fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  return Math.max(0, Math.min(100, ((ms - fromMs) / (toMs - fromMs)) * 100));
}

/** A segment clipped to the window; null when it lies entirely outside it or has no width. */
export function clip(startMs: number, endMs: number, fromMs: number, toMs: number): { left: number; width: number } | null {
  const a = Math.max(startMs, fromMs);
  const b = Math.min(endMs, toMs);
  if (b <= a) return null;
  const left = pct(a, fromMs, toMs);
  return { left, width: pct(b, fromMs, toMs) - left };
}

export interface DayColumn { startMs: number; endMs: number; left: number; width: number; centre: number; label: string; full: boolean }

/**
 * UTC day columns across a window. The label sits at the centre of the visible part of its
 * day, so a session reads under the day it belongs to, never under the next one.
 */
export function dayColumns(fromMs: number, toMs: number): DayColumn[] {
  const out: DayColumn[] = [];
  for (let d = Math.floor(fromMs / DAY) * DAY; d < toMs; d += DAY) {
    const c = clip(d, d + DAY, fromMs, toMs);
    if (!c) continue;
    const date = new Date(d);
    const label = `${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()]} ${date.getUTCDate()}`;
    out.push({ startMs: d, endMs: d + DAY, left: c.left, width: c.width, centre: c.left + c.width / 2, label, full: d >= fromMs && d + DAY <= toMs });
  }
  return out;
}

/**
 * Countdown words. Never negative and never a dash: once the moment has passed the next one
 * is being read, and the rail says so.
 */
export function countdown(targetMs: number, nowMs: number): string {
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return "Updating";
  const ms = targetMs - nowMs;
  if (ms <= 0) return "Updating";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** HH:MM in UTC. */
export function utcHm(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

/** HH:MM and the zone name in an exchange's local time. */
export function localHm(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(ms));
  const g = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  const zone = tz === "Asia/Hong_Kong" ? "HKT" : g("timeZoneName");
  return `${g("hour")}:${g("minute")} ${zone}`;
}

/** A window of `hours` centred on now, for narrow screens. */
export function centredWindow(nowMs: number, hours: number): { fromMs: number; toMs: number } {
  const half = (hours * 3_600_000) / 2;
  return { fromMs: nowMs - half, toMs: nowMs + half };
}

/** The UTC week (Monday 00:00 to Monday 00:00) containing now. */
export function weekWindow(nowMs: number): { fromMs: number; toMs: number } {
  const d = new Date(Math.floor(nowMs / DAY) * DAY);
  const monday = d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY;
  return { fromMs: monday, toMs: monday + 7 * DAY };
}

export interface DemoSchedule { cycleStartedAt: string; weekLengthSec: number; cureStartSec: number; sessionEndSec: number }

/** One demo cycle as rail segments: session, Last Call (inside the session), closed. */
export function demoSegments(d: DemoSchedule): { fromMs: number; toMs: number; segments: { kind: "REGULAR" | "CLOSED"; startMs: number; endMs: number }[]; lastCall: { startMs: number; endMs: number } } {
  const start = Date.parse(d.cycleStartedAt);
  const end = start + d.weekLengthSec * 1000;
  const sessionEnd = start + d.sessionEndSec * 1000;
  return {
    fromMs: start,
    toMs: end,
    segments: [{ kind: "REGULAR", startMs: start, endMs: sessionEnd }, { kind: "CLOSED", startMs: sessionEnd, endMs: end }],
    lastCall: { startMs: start + d.cureStartSec * 1000, endMs: sessionEnd },
  };
}


/** The rail's data window: whole UTC days from two days back to five ahead. */
export function railWindow(nowMs: number): { fromMs: number; toMs: number } {
  const today = Math.floor(nowMs / DAY) * DAY;
  return { fromMs: today - 2 * DAY, toMs: today + 5 * DAY };
}

export const clockPath = (symbol: string, w: { fromMs: number; toMs: number }, chainId = 196): string =>
  `/v1/clock/${chainId}/${encodeURIComponent(symbol)}?from=${new Date(w.fromMs).toISOString()}&to=${new Date(w.toMs).toISOString()}`;
