import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { okxDexCredsFromEnv, okxDexQuote, okxSign } from "../src/okxdex.js";
import type { HttpFetcher, RawHttp } from "../src/http.js";

describe("okx dex signing", () => {
  it("signs timestamp + method + path + body with HMAC-SHA256, base64", () => {
    const want = createHmac("sha256", "s3cret").update("2026-09-19T00:00:00.000ZGET/api/v6/dex/aggregator/quote?a=1").digest("base64");
    expect(okxSign("s3cret", "2026-09-19T00:00:00.000Z", "GET", "/api/v6/dex/aggregator/quote?a=1")).toBe(want);
  });
  it("returns null creds unless key, secret, passphrase and project are all set", () => {
    expect(okxDexCredsFromEnv({ OKX_DEX_API_KEY: "k" })).toBeNull();
    // Without the project id the Web3 API answers 403, so incomplete credentials are refused.
    expect(okxDexCredsFromEnv({ OKX_DEX_API_KEY: "k", OKX_DEX_API_SECRET: "s", OKX_DEX_API_PASSPHRASE: "p" })).toBeNull();
    expect(okxDexCredsFromEnv({ OKX_DEX_API_KEY: "k", OKX_DEX_API_SECRET: "s", OKX_DEX_API_PASSPHRASE: "p", OKX_DEX_PROJECT_ID: "x" }))
      .toEqual({ apiKey: "k", secret: "s", passphrase: "p", project: "x" });
  });
});

describe("okx dex quote", () => {
  const creds = { apiKey: "k", secret: "s", passphrase: "p", project: "proj" };
  const q = { chainIndex: 196, fromToken: "0xa", toToken: "0xb", amountRaw: 10n ** 18n };
  const stub = (body: string, status = 200): HttpFetcher => ({
    get: async (url: string, headers?: Record<string, string>): Promise<RawHttp> => {
      expect(headers?.["OK-ACCESS-SIGN"]).toBeTruthy();
      expect(headers?.["OK-ACCESS-PROJECT"]).toBe("proj");
      expect(headers?.["user-agent"]).toContain("Mozilla");
      return { url, status, body, fetchedAt: "t", latencyMs: 1 };
    },
  });
  it("parses toTokenAmount exactly", async () => {
    const r = await okxDexQuote(stub('{"code":"0","msg":"","data":[{"toTokenAmount":"123456789012345678901","priceImpactPercent":"-0.49","dexRouterList":[{"dexProtocol":[{"dexName":"Uniswap V3","percent":"100"}]}]}]}'), creds, q);
    expect(r.toTokenAmount).toBe(123456789012345678901n);
    expect(r.priceImpactPercent).toBe("-0.49");
    expect(r.routerNote).toBe("Uniswap V3:100%");
  });
  it("reads the router whether dexProtocol is an object, an array, or nested", async () => {
    const obj = await okxDexQuote(stub('{"code":"0","msg":"","data":[{"toTokenAmount":"1","dexRouterList":[{"dexProtocol":{"dexName":"Uniswap V3","percent":"100"}}]}]}'), creds, q);
    expect(obj.routerNote).toBe("Uniswap V3:100%");
    const nested = await okxDexQuote(stub('{"code":"0","msg":"","data":[{"toTokenAmount":"1","dexRouterList":[{"subRouterList":[{"dexProtocol":[{"dexName":"SushiSwap","percent":"60"}]}]}]}]}'), creds, q);
    expect(nested.routerNote).toBe("SushiSwap:60%");
  });

  it("fails loudly on API errors and missing amounts", async () => {
    await expect(okxDexQuote(stub('{"code":"50103","msg":"key"}'), creds, q)).rejects.toThrow(/50103/);
    await expect(okxDexQuote(stub('{"code":"0","msg":"","data":[{}]}'), creds, q)).rejects.toThrow(/toTokenAmount/);
    await expect(okxDexQuote(stub("nope", 401), creds, q)).rejects.toThrow(/401/);
  });
});
