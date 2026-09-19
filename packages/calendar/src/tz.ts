/**
 * Timezone conversion on the IANA database shipped with Node (ICU). Times here are integer
 * milliseconds; nothing on this path is a money value. DST is handled by the database.
 */
const fmts = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    fmts.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
  /** 0 = Sunday ... 6 = Saturday. */
  dow: number;
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(tz: string, utcMs: number): LocalParts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return {
    y: Number(p["year"]), m: Number(p["month"]), d: Number(p["day"]), hh: Number(p["hour"]), mm: Number(p["minute"]), ss: Number(p["second"]),
    dow: DOW[p["weekday"] ?? ""] ?? -1,
  };
}

/** Offset of the zone from UTC at an instant, in ms (local = utc + offset). */
export function offsetMs(tz: string, utcMs: number): number {
  const l = localParts(tz, utcMs);
  const asUtc = Date.UTC(l.y, l.m - 1, l.d, l.hh, l.mm, l.ss);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** UTC instant of a local wall-clock time. minutes may be 1440 (end of day). */
export function localToUtc(tz: string, y: number, m: number, d: number, minutes: number): number {
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const o1 = offsetMs(tz, naive);
  let t = naive - o1;
  const o2 = offsetMs(tz, t);
  if (o2 !== o1) t = naive - o2;
  return t;
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Add days to a civil date (no timezone involved). */
export function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number; dow: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}
