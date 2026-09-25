/**
 * Display formatting for Kerb numbers.
 *
 * Every value that becomes a price, amount, ratio or term arrives as a decimal string or as a
 * raw integer plus its decimals, and stays a string all the way to the DOM. There is no
 * `Number()` on any value path in this file: floats are how a risk number quietly becomes wrong.
 */

export type ProvenanceLabel = "Verified" | "Observed" | "Attested" | "Computed";

/** Scale a raw integer string by its decimals, exactly. `123456`/4 -> `12.3456`. */
export function scale(raw: string, decimals: number): string {
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).replace(/^0+(?=\d)/, "").padStart(decimals + 1, "0");
  const cut = digits.length - decimals;
  const whole = digits.slice(0, cut);
  const frac = digits.slice(cut);
  return `${neg ? "-" : ""}${frac ? `${whole}.${frac}` : whole}`;
}

/** Round a decimal string to `places`, half-up, on the digits themselves. */
export function round(value: string, places: number): string {
  const neg = value.startsWith("-");
  const v = neg ? value.slice(1) : value;
  const [whole = "0", frac = ""] = v.split(".");
  if (frac.length <= places) {
    return `${neg ? "-" : ""}${places === 0 ? whole : `${whole}.${frac.padEnd(places, "0")}`}`;
  }
  const keep = frac.slice(0, places);
  const next = frac.charCodeAt(places) - 48;
  let digits = `${whole}${keep}`;
  if (next >= 5) {
    // Increment the integer string by one, carrying by hand.
    const out = digits.split("");
    let i = out.length - 1;
    for (; i >= 0; i--) {
      if (out[i] === "9") out[i] = "0";
      else { out[i] = String((out[i]!.charCodeAt(0) - 48) + 1); break; }
    }
    digits = (i < 0 ? "1" : "") + out.join("");
  }
  const cut = digits.length - places;
  const w = digits.slice(0, cut).replace(/^0+(?=\d)/, "") || "0";
  const f = digits.slice(cut);
  return `${neg ? "-" : ""}${places === 0 ? w : `${w}.${f}`}`;
}

/** Group the integer part with thin separators. Operates on the string, never on a float. */
export function group(value: string): string {
  const neg = value.startsWith("-");
  const v = neg ? value.slice(1) : value;
  const [whole = "0", frac] = v.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/** A money amount: grouped, fixed places. */
export function money(value: string | null, places = 2): string | null {
  return value === null ? null : group(round(value, places));
}

/** An 18-decimal ratio as a percentage string, e.g. `550000000000000000` -> `55.00%`. */
export function ratioPct(raw: string | null, decimals = 18, places = 2): string | null {
  if (raw === null) return null;
  const asDecimal = scale(raw, decimals);
  // Multiply by 100 by shifting the point two places, still as a string.
  return `${round(shift(asDecimal, 2), places)}%`;
}

/** Shift the decimal point right by `n` places without arithmetic. */
export function shift(value: string, n: number): string {
  const neg = value.startsWith("-");
  const v = neg ? value.slice(1) : value;
  const [whole = "0", frac = ""] = v.split(".");
  let digits = whole + frac;
  let point = whole.length + n;
  // A shift left past the first digit pads with leading zeros: shift("500", -4) is "0.05".
  if (point <= 0) { digits = "0".repeat(1 - point) + digits; point = 1; }
  const padded = point > digits.length ? digits.padEnd(point, "0") : digits;
  const w = padded.slice(0, point).replace(/^0+(?=\d)/, "") || "0";
  const f = padded.slice(point);
  return `${neg ? "-" : ""}${f ? `${w}.${f}` : w}`;
}

/** Compact notional for tight columns: 14868.69 -> 14.9k. Display only, never a value path. */
export function compact(value: string | null, places = 1): string | null {
  if (value === null) return null;
  const whole = (value.startsWith("-") ? value.slice(1) : value).split(".")[0] ?? "0";
  const sign = value.startsWith("-") ? "-" : "";
  if (whole.length > 9) return `${sign}${round(shift(value, -9), places)}B`;
  if (whole.length > 6) return `${sign}${round(shift(value, -6), places)}M`;
  if (whole.length > 3) return `${sign}${round(shift(value, -3), places)}k`;
  return group(round(value, places === 0 ? 0 : 2));
}

/** Duration in words, largest two units. Input is milliseconds of wall clock, not a value path. */
export function duration(ms: number): string {
  if (!Number.isFinite(ms)) return "Unknown";
  // A transition that has already passed: the next one is being read.
  if (ms < 0) return "Refreshing";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** A short age for a freshness marker. */
export function age(seconds: number | null): string {
  if (seconds === null) return "never";
  // Two clocks (a cached page and a fresher health read) can put the event a moment "after" now.
  return duration(Math.max(0, seconds) * 1000);
}

export function shortHash(h: string, lead = 6, tail = 4): string {
  if (h.length <= lead + tail + 2) return h;
  // slice(-0) is slice(0), which returns the whole string: a zero tail must be handled explicitly.
  return tail === 0 ? `${h.slice(0, lead)}…` : `${h.slice(0, lead)}…${h.slice(-tail)}`;
}

/** UTC clock time, always labelled UTC so nobody has to guess a timezone. */
export function utcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function utcStamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Compare two decimal strings exactly. Never parses to a float. */
export function cmpDecimal(a: string, b: string): number {
  const na = a.startsWith("-");
  const nb = b.startsWith("-");
  if (na !== nb) return na ? -1 : 1;
  const [aw = "0", af = ""] = (na ? a.slice(1) : a).split(".");
  const [bw = "0", bf = ""] = (nb ? b.slice(1) : b).split(".");
  const w = Math.max(aw.length, bw.length);
  const f = Math.max(af.length, bf.length);
  const A = aw.padStart(w, "0") + af.padEnd(f, "0");
  const B = bw.padStart(w, "0") + bf.padEnd(f, "0");
  const c = A === B ? 0 : A < B ? -1 : 1;
  return na ? -c : c;
}

/** Descending by a decimal-string field, with missing values last. */
export function byDecimalDesc<T>(pick: (x: T) => string | null): (a: T, b: T) => number {
  return (a, b) => {
    const x = pick(a);
    const y = pick(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return -cmpDecimal(x, y);
  };
}

// ---------------------------------------------------------------- V2 format standard
// V2-DESIGN-SYSTEM.md section 10: USDG as $12.4K / $8,590 in tables, full 2 dp in forms;
// LTVs 1 dp with %; ratios 2 dp with x; prices 2 dp. All on strings.

/** USDG amount for tables: $12.4K at or above ten thousand, $8,590 below. */
export function usd(value: string | null): string | null {
  if (value === null) return null;
  const neg = value.startsWith("-");
  const whole = (neg ? value.slice(1) : value).split(".")[0] ?? "0";
  const sign = neg ? "-" : "";
  if (whole.length > 9) return `${sign}$${round(shift(neg ? value.slice(1) : value, -9), 1)}B`;
  if (whole.length > 6) return `${sign}$${round(shift(neg ? value.slice(1) : value, -6), 1)}M`;
  if (whole.length > 4) return `${sign}$${round(shift(neg ? value.slice(1) : value, -3), 1)}K`;
  return `${sign}$${group(round(neg ? value.slice(1) : value, 0))}`;
}

/** USDG amount for forms and receipts: full, 2 dp. */
export function usdFull(value: string | null): string | null {
  return value === null ? null : `$${group(round(value, 2))}`;
}

/** A 0..1 decimal ratio as an LTV: "0.556041" -> "55.6%". */
export function ltv(value: string | null, places = 1): string | null {
  return value === null ? null : `${round(shift(value, 2), places)}%`;
}

/** A price, 2 dp, grouped. */
export function price(value: string | null): string | null {
  return value === null ? null : `$${group(round(value, 2))}`;
}

/** A ratio, 2 dp with a multiplication sign. */
export function ratio(value: string | null): string | null {
  return value === null ? null : `${round(value, 2)}×`;
}
