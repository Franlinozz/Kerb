import { dec, toDecString, Decimal, type DecString } from "@kerb/types";
import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";

export interface PythParsed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  ema_price: { price: string; conf: string; expo: number; publish_time: number };
  metadata?: { slot?: number; proof_available_time?: number; prev_publish_time?: number };
}

export interface PythLatest {
  raw: RawHttp;
  parsed: PythParsed[];
}

export function hermesBase(): string {
  return process.env["PYTH_HERMES_BASE"] ?? "https://hermes.pyth.network";
}

/** One request for many feeds. Returns the raw payload plus parsed entries. */
export async function pythLatest(http: HttpFetcher, ids: string[]): Promise<PythLatest> {
  const q = ids.map((id) => `ids[]=${id}`).join("&");
  const key = process.env["PYTH_API_KEY"];
  const raw = await http.get(`${hermesBase()}/v2/updates/price/latest?${q}&parsed=true&encoding=hex`, key ? { authorization: `Bearer ${key}` } : {});
  const body = parseJsonOk<{ parsed?: PythParsed[] }>(raw);
  return { raw, parsed: body.parsed ?? [] };
}

/** price * 10^expo as an exact decimal string. */
export function pythValue(p: { price: string; expo: number }): DecString {
  return toDecString(dec(p.price).mul(new Decimal(10).pow(p.expo)));
}
