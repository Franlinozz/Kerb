/**
 * Daily bar history for the underlying instruments, used only for the stress statistics
 * (KTS-0.1 section 7.1). Values are recovered from the raw JSON literals, never via floats.
 */
import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";
import { numericLiteralToDec } from "./xstocks.js";
import type { DecString } from "@kerb/types";

export interface DailyBar {
  /** Local trading date at the listing venue, YYYY-MM-DD. */
  date: string;
  open: DecString;
  close: DecString;
}

export interface DailyHistory {
  raw: RawHttp;
  symbol: string;
  currency: string;
  timezone: string;
  bars: DailyBar[];
}

interface YahooChart {
  chart: {
    result: {
      meta: { symbol: string; currency: string; exchangeTimezoneName: string };
      timestamp: number[];
      indicators: { quote: { open: (number | null)[]; close: (number | null)[] }[] };
    }[] | null;
    error: unknown;
  };
}

/** Exact decimal strings for the i-th open/close, taken from the raw payload text. */
function literals(body: string, field: "open" | "close"): (string | null)[] {
  const m = new RegExp(`"${field}"\\s*:\\s*\\[([^\\]]*)\\]`).exec(body);
  if (!m?.[1]) throw new Error(`no ${field} array in payload`);
  return m[1].split(",").map((x) => {
    const t = x.trim();
    return t === "null" || t === "" ? null : t;
  });
}

function localDate(tsSec: number, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(tsSec * 1000));
  return p;
}

export async function yahooDailyHistory(http: HttpFetcher, symbol: string, range = "10y"): Promise<DailyHistory> {
  const raw = await http.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
    { "user-agent": "Mozilla/5.0 (compatible; kerb-collector/0.1; +https://userkerb.xyz)" },
  );
  const b = parseJsonOk<YahooChart>(raw);
  const r = b.chart.result?.[0];
  if (!r) throw new Error(`yahoo history ${symbol}: no result`);
  if (r.meta.symbol !== symbol) throw new Error(`yahoo history ${symbol}: returned ${r.meta.symbol}`);
  const opens = literals(raw.body, "open");
  const closes = literals(raw.body, "close");
  if (opens.length !== r.timestamp.length || closes.length !== r.timestamp.length) {
    throw new Error(`yahoo history ${symbol}: ${r.timestamp.length} timestamps but ${opens.length}/${closes.length} values`);
  }
  const bars: DailyBar[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = opens[i];
    const c = closes[i];
    const ts = r.timestamp[i];
    if (o == null || c == null || ts === undefined) continue;
    bars.push({ date: localDate(ts, r.meta.exchangeTimezoneName), open: numericLiteralToDec(o), close: numericLiteralToDec(c) });
  }
  return { raw, symbol, currency: r.meta.currency, timezone: r.meta.exchangeTimezoneName, bars };
}
