import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { okxDexCredsFromEnv, okxDexQuote, okxSign } from "../src/okxdex.js";
import type { HttpFetcher, RawHttp } from "../src/http.js";

describe("okx dex signing", () => {
  it("signs timestamp + method + path + body with HMAC-SHA256, base64", () => {
    const want = createHmac("sha256", "s3cret").update("2026-09-19T00:00:00.000ZGET/api/v6/dex/aggregator/quote?a=1").digest("base64");
    expect(okxSign("s3cret", "2026-09-19T00:00:00.000Z", "GET", "/api/v6/dex/aggregator/quote?a=1")).toBe(want);
  });
  it("returns null creds unless all three are set", () => {
    expect(okxDexCredsFromEnv({ OKX_DEX_API_KEY: "k" })).toBeNull();
    expect(okxDexCredsFromEnv({ OKX_DEX_API_KEY: "k", OKX_DEX_API_SECRET: "s", OKX_DEX_API_PASSPHRASE: "p" })).toEqual({ apiKey: "k", secret: "s", passphrase: "p" });
  });
});

describe("okx dex quote", () => {
  const creds = { apiKey: "k", secret: "s", passphrase: "p" };
  const q = { chainIndex: 196, fromToken: "0xa", toToken: "0xb", amountRaw: 10n ** 18n };
  const stub = (body: string, status = 200): HttpFetcher => ({
    get: async (url: string, headers?: Record<string, string>): Promise<RawHttp> => {
      expect(headers?.["OK-ACCESS-SIGN"]).toBeTruthy();
      return { url, status, body, fetchedAt: "t", latencyMs: 1 };
    },
  });
  it("parses toTokenAmount exactly", async () => {
    const r = await okxDexQuote(stub('{"code":"0","msg":"","data":[{"toTokenAmount":"123456789012345678901","dexRouterList":[{}]}]}'), creds, q);
    expect(r.toTokenAmount).toBe(123456789012345678901n);
  });
  it("fails loudly on API errors and missing amounts", async () => {
    await expect(okxDexQuote(stub('{"code":"50103","msg":"key"}'), creds, q)).rejects.toThrow(/50103/);
    await expect(okxDexQuote(stub('{"code":"0","msg":"","data":[{}]}'), creds, q)).rejects.toThrow(/toTokenAmount/);
    await expect(okxDexQuote(stub("nope", 401), creds, q)).rejects.toThrow(/401/);
  });
});
