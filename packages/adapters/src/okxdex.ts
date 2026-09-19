import { createHmac } from "node:crypto";
import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";

/** OKX DEX aggregator quote API (OKX Web3 / Onchain OS), v6. Requires project API credentials. */
export interface OkxDexCreds {
  apiKey: string;
  secret: string;
  passphrase: string;
  project?: string;
}

export function okxDexCredsFromEnv(env: NodeJS.ProcessEnv = process.env): OkxDexCreds | null {
  const apiKey = env["OKX_DEX_API_KEY"];
  const secret = env["OKX_DEX_API_SECRET"];
  const passphrase = env["OKX_DEX_API_PASSPHRASE"];
  if (!apiKey || !secret || !passphrase) return null;
  const project = env["OKX_DEX_PROJECT_ID"];
  return project ? { apiKey, secret, passphrase, project } : { apiKey, secret, passphrase };
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
  if (creds.project) headers["OK-ACCESS-PROJECT"] = creds.project;
  const raw = await http.get(`${okxDexBase()}${path}`, headers);
  const b = parseJsonOk<{ code: string; msg: string; data?: { toTokenAmount?: string; dexRouterList?: unknown[] }[] }>(raw);
  if (b.code !== "0") throw new Error(`okx dex code ${b.code}: ${b.msg}`);
  const d = b.data?.[0];
  if (!d?.toTokenAmount || !/^\d+$/.test(d.toTokenAmount)) throw new Error("okx dex: no toTokenAmount");
  return { raw, toTokenAmount: BigInt(d.toTokenAmount), routerNote: `${d.dexRouterList?.length ?? 0} route(s)` };
}
