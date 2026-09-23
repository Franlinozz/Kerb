import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { wrapFetchWithPaymentFromConfig } from "@okxweb3/x402-fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createApp } from "../src/app.js";
import { resourceServer, type PayConfig } from "../src/pay.js";
import type { PaidCall } from "../src/store.js";
import { reportFromBundle, UpstreamError, type Upstream } from "../src/upstream.js";
import type { AssetRef, PostedTerms } from "../src/compute.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = (r: Response): Promise<any> => r.json();

/** Real API responses captured 23 Sep 2026, served offline. */
const FX = resolve(__dirname, "fixtures");
const read = (f: string): string => readFileSync(resolve(FX, f), "utf8");
const board = JSON.parse(read("board.json"));
const ASSETS: AssetRef[] = [
  { symbol: "HKEXCx", token: "0x0000000000000000000000000000000000000001", tokenDecimals: 18, assetId: "" },
  { symbol: "BRK.Bx", token: "0x0000000000000000000000000000000000000002", tokenDecimals: 18, assetId: "" },
  { symbol: "SLVx", token: "0x0000000000000000000000000000000000000003", tokenDecimals: 18, assetId: "" },
];
let upstreamDown = false;
let unusable = false;
const upstream: Upstream = {
  assets: () => ASSETS,
  async terms(symbol) {
    if (upstreamDown) throw new UpstreamError("the Kerb API did not answer");
    const t = JSON.parse(read(`terms-${symbol}.json`)) as PostedTerms;
    return unusable ? { ...t, usable: false, regime: { value: "STALE" } } : t;
  },
  async board() { return board; },
  async boardRow(symbol) { return board.rows.find((r: { symbol: string }) => r.symbol === symbol); },
  async report(h) { return reportFromBundle(read(`bundle-${h}.json`), h); },
  async json(path) { if (path === "/v1/credit/1952") return JSON.parse(read("credit-1952.json")); throw new UpstreamError("not in fixtures"); },
};

const calls = { verify: 0, settle: 0 };
const facilitator = {
  async verify() { calls.verify++; return { isValid: true, payer: "0x00000000000000000000000000000000000000aa" }; },
  async settle() { calls.settle++; return { success: true, transaction: "0xsettled", network: "eip155:1952", payer: "0x00000000000000000000000000000000000000aa" }; },
  async getSupported() { return { kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:1952" }], extensions: [], signers: {} }; },
};
const recorded: PaidCall[] = [];
const pay: PayConfig = { network: "eip155:1952", payTo: "0x0d63f9EeB86813230B72017444cea16Cd4A453F2", price: "$0.01" };
let base = "";
let close: () => void = () => {};

beforeAll(async () => {
  const server = resourceServer(facilitator as never, pay, { record: async (c) => { recorded.push(c); } });
  const app = createApp({ upstream, pay, server, syncFacilitatorOnStart: true, limits: { paidPerMin: 1000, freePerMin: 1000, mcpPerMin: 3 } });
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  close = () => s.close();
});
afterAll(() => close());
beforeEach(() => { calls.verify = 0; calls.settle = 0; upstreamDown = false; unusable = false; recorded.length = 0; });

const payingFetch = (): typeof fetch => wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:1952", client: new ExactEvmScheme(toClientEvmSigner(privateKeyToAccount(generatePrivateKey()))) }] });

describe("Kerb for Agents (V3-03)", () => {
  it("asks for payment: 402 with a PAYMENT-REQUIRED header on X Layer", async () => {
    const r = await fetch(`${base}/agents/credit-check?asset=HKEXCx&amount=100`);
    expect(r.status).toBe(402);
    const h = r.headers.get("payment-required");
    expect(h).toBeTruthy();
    const req = JSON.parse(Buffer.from(h as string, "base64").toString("utf8"));
    expect(req.accepts[0]).toMatchObject({ scheme: "exact", network: "eip155:1952", payTo: pay.payTo, amount: "10000" });
    expect(req.accepts[0].asset.toLowerCase()).toBe("0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c");
  });

  it("paid: answers from the posted terms, settles once, records the call", async () => {
    const r = await payingFetch()(`${base}/agents/credit-check?asset=hkexcx&amount=100&mode=session_max`);
    expect(r.status).toBe(200);
    const b = (await j(r))
    const t = JSON.parse(read("terms-HKEXCx.json"));
    expect(b.asset).toBe("HKEXCx");
    expect(b.provenance.inputsHash).toBe(t.inputsHash);
    expect(b.provenance.tx).toBe(t.tx);
    expect(b.mode).toBe("session_max");
    expect(b.maxBorrowUSDG).toMatch(/^\d+\.\d{2}$/);
    expect(Number(b.maxBorrowUSDG)).toBeLessThanOrEqual(Number(b.collateralValueUSDG));
    expect(b.why.length).toBe(2);
    expect(b.why.join(" ")).not.toMatch(/[{}]|undefined|NaN/);
    expect(calls.settle).toBe(1);
    expect(recorded[0]).toMatchObject({ network: "eip155:1952", settlementTx: "0xsettled", inputsHash: t.inputsHash });
    expect(recorded[0]?.responseSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exit check: impact at a size on the walked curve, never extrapolated", async () => {
    const r = await payingFetch()(`${base}/agents/exit-check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset: "BRK.Bx", sizeUSDG: "2000" }) });
    expect(r.status).toBe(200);
    const b = (await j(r))
    expect(b.beyondMeasuredCurve).toBe(false);
    expect(Number(b.impactAtSize)).toBeGreaterThan(0);
    const huge = (await j(await payingFetch()(`${base}/agents/exit-check?asset=BRK.Bx&sizeUSDG=999999999`)))
    expect(huge.beyondMeasuredCurve).toBe(true);
    expect(huge.impactAtSize).toBeNull();
  });

  it("bad input is 400 and unknown asset 404, before any payment is asked for", async () => {
    for (const q of ["asset=HKEXCx&amount=-1", "asset=HKEXCx&amount=abc", "asset=HKEXCx", "amount=5", "asset=HKEXCx&amount=1e5"]) {
      const r = await fetch(`${base}/agents/credit-check?${q}`);
      expect(r.status, q).toBe(400);
      expect((await j(r)).error).not.toMatch(/\n\s+at |Error:|\.ts:\d/);
    }
    expect((await fetch(`${base}/agents/credit-check?asset=NOPE&amount=1`)).status).toBe(404);
    // An empty request is discovery: the 402 with the requirements, as directories probe.
    expect((await fetch(`${base}/agents/credit-check`, { method: "POST" })).status).toBe(402);
    expect(calls.verify + calls.settle).toBe(0);
  });

  it("an invalid mode after payment is a 400, and a 4xx is never settled", async () => {
    const r = await payingFetch()(`${base}/agents/credit-check?asset=HKEXCx&amount=1&mode=yolo`);
    expect(r.status).toBe(400);
    expect(calls.settle).toBe(0);
  });

  it("upstream failure: 503 with a plain reason and no settlement", async () => {
    upstreamDown = true;
    const r = await payingFetch()(`${base}/agents/credit-check?asset=HKEXCx&amount=1`);
    expect(r.status).toBe(503);
    expect((await j(r)).error).toMatch(/did not answer/);
    expect(calls.settle).toBe(0);
    expect(recorded.length).toBe(0);
  });

  it("unusable terms: 200 with usable false and a zero max borrow", async () => {
    unusable = true;
    const b = (await j(await payingFetch()(`${base}/agents/credit-check?asset=SLVx&amount=10`)))
    expect(b.usable).toBe(false);
    expect(b.maxBorrowUSDG).toBe("0");
    expect(b.reason).toMatch(/STALE/);
  });

  it("decimal strings round trip: usdg unit values the amount as given", async () => {
    const b = (await j(await payingFetch()(`${base}/agents/credit-check?asset=BRK.Bx&amount=1000.5&unit=usdg`)))
    expect(b.collateralValueUSDG).toBe("1000.50");
    expect(typeof b.creditMark).toBe("string");
  });

  it("free terms need no payment", async () => {
    const r = await fetch(`${base}/agents/terms/SLVx`);
    expect(r.status).toBe(200);
    expect((await j(r)).why.length).toBe(2);
  });

  it("MCP: lists six tools, answers one, and rate limits with a plain reason", async () => {
    const rpc = (body: unknown): Promise<Response> => fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
    const list = await j(await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }));
    expect(list.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["kerb_board", "kerb_clock", "kerb_paid_tools", "kerb_position", "kerb_terms", "kerb_why"]);
    const why = await j(await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "kerb_why", arguments: { asset: "HKEXCx" } } }));
    expect(JSON.parse(why.result.content[0].text).why.length).toBe(2);
    const paid = await j(await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "kerb_paid_tools", arguments: {} } }));
    expect(paid.result.content[0].text).toMatch(/credit-check/);
    const limited = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} });
    expect(limited.status).toBe(429);
    expect((await j(limited)).error).toMatch(/rate limit/);
  });
});
