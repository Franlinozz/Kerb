import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";
import { numericLiteralToDec, rawNumberField } from "./xstocks.js";
import type { DecString } from "@kerb/types";

/**
 * Yahoo Finance public chart endpoint. An independent, third-party, unofficial reference
 * (no SLA). Used as the second reference while Pyth Hermes requires an API key.
 */
export interface YahooMeta {
  symbol: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  regularMarketTime: number;
  exchangeTimezoneName: string;
}

export function yahooSymbol(listingCountry: string, underlying: string): string {
  return listingCountry === "HK" ? `${underlying.padStart(4, "0")}.HK` : underlying.replace(".", "-");
}

export async function yahooQuote(http: HttpFetcher, symbol: string): Promise<{ raw: RawHttp; meta: YahooMeta; price: DecString }> {
  const raw = await http.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    { "user-agent": "Mozilla/5.0 (compatible; kerb-collector/0.1; +https://usekerb.xyz)" },
  );
  const b = parseJsonOk<{ chart: { result: { meta: YahooMeta }[] | null; error: unknown } }>(raw);
  const meta = b.chart.result?.[0]?.meta;
  if (!meta) throw new Error(`yahoo ${symbol}: no result`);
  // Yahoo sometimes echoes FX pairs as "USDHKD=X" for a "HKD=X" request; both name the same pair.
  const alias = symbol.endsWith("=X") && meta.symbol === `USD${symbol}`;
  if (meta.symbol !== symbol && !alias) throw new Error(`yahoo ${symbol}: returned ${meta.symbol}`);
  // Take the exact literal from the raw bytes, never a float round trip.
  const lit = rawNumberField(raw.body, "regularMarketPrice");
  if (lit === null) throw new Error(`yahoo ${symbol}: no regularMarketPrice`);
  return { raw, meta, price: numericLiteralToDec(lit) };
}
