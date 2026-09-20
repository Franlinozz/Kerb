import { createHmac } from "node:crypto";
import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";

/** OKX DEX aggregator quote API (OKX Web3 / Onchain OS), v6. Requires project API credentials. */
export interface OkxDexCreds {
  apiKey: string;
  secret: string;
  passphrase: string;
  /** Project id from the OKX Web3 developer dashboard; sent as OK-ACCESS-PROJECT. */
  project: string;
}

export function okxDexCredsFromEnv(env: NodeJS.ProcessEnv = process.env): OkxDexCreds | null {
  const apiKey = env["OKX_DEX_API_KEY"];
  const secret = env["OKX_DEX_API_SECRET"];
  const passphrase = env["OKX_DEX_API_PASSPHRASE"];
  const project = env["OKX_DEX_PROJECT_ID"];
  // The Web3 (Onchain OS) API rejects a request without its project header, so all four are required.
  if (!apiKey || !secret || !passphrase || !project) return null;
  return { apiKey, secret, passphrase, project };
}

/** OK-ACCESS-SIGN = base64(HMAC-SHA256(secret, timestamp + method + requestPath + query)). */
export function okxSign(secret: string, timestamp: string, method: "GET" | "POST", pathWithQuery: string, body = ""): string {
  return createHmac("sha256", secret).update(`${timestamp}${method}${pathWithQuery}${body}`).digest("base64");
}

export function okxDexBase(): string {
  return process.env["OKX_DEX_API_BASE"] ?? "https://web3.okx.com";
}

export interface OkxQuote {
  raw: RawHttp;
  /** Output amount in raw units of the destination token. */
  toTokenAmount: bigint;
  /** Price impact percent as the aggregator reports it, e.g. "-0.49". Recorded, never trusted as our own. */
  priceImpactPercent: string | null;
  routerNote: string;
}

export async function okxDexQuote(
  http: HttpFetcher, creds: OkxDexCreds,
  q: { chainIndex: number; fromToken: string; toToken: string; amountRaw: bigint },
  now: () => Date = () => new Date(),
): Promise<OkxQuote> {
  const params = new URLSearchParams({
    chainIndex: String(q.chainIndex), amount: q.amountRaw.toString(), swapMode: "exactIn",
    fromTokenAddress: q.fromToken, toTokenAddress: q.toToken,
  });
  const path = `/api/v6/dex/aggregator/quote?${params.toString()}`;
  const ts = now().toISOString();
  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": creds.apiKey, "OK-ACCESS-SIGN": okxSign(creds.secret, ts, "GET", path),
    "OK-ACCESS-TIMESTAMP": ts, "OK-ACCESS-PASSPHRASE": creds.passphrase,
  };
  headers["OK-ACCESS-PROJECT"] = creds.project;
  // The endpoint returns 403 to requests without a browser-style User-Agent.
  headers["user-agent"] = "Mozilla/5.0 (compatible; kerb-collector/0.1; +https://usekerb.xyz)";
  const raw = await http.get(`${okxDexBase()}${path}`, headers);
  type Protocol = { dexName?: string; percent?: string };
  type Router = { dexProtocol?: Protocol | Protocol[]; subRouterList?: { dexProtocol?: Protocol | Protocol[] }[] };
  const b = parseJsonOk<{ code: string; msg: string; data?: { toTokenAmount?: string; priceImpactPercent?: string; dexRouterList?: Router[] }[] }>(raw);
  if (b.code !== "0") throw new Error(`okx dex code ${b.code}: ${b.msg}`);
  const d = b.data?.[0];
  if (!d?.toTokenAmount || !/^\d+$/.test(d.toTokenAmount)) throw new Error("okx dex: no toTokenAmount");
  // dexProtocol is sometimes an object, sometimes an array, and sometimes nested in subRouterList.
  const asArray = (x: Protocol | Protocol[] | undefined): Protocol[] => (Array.isArray(x) ? x : x ? [x] : []);
  const venues = (d.dexRouterList ?? []).flatMap((r) => [
    ...asArray(r.dexProtocol),
    ...(r.subRouterList ?? []).flatMap((sr) => asArray(sr.dexProtocol)),
  ].map((p) => `${p.dexName ?? "?"}:${p.percent ?? "?"}%`));
  return {
    raw,
    toTokenAmount: BigInt(d.toTokenAmount),
    priceImpactPercent: d.priceImpactPercent ?? null,
    routerNote: venues.length ? venues.join(" + ") : `${d.dexRouterList?.length ?? 0} route(s)`,
  };
}
