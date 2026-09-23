/**
 * The free Kerb MCP server (SPEC-AGENTS.md section 7): streamable HTTP at /mcp, stateless, every
 * tool read-only and deterministic. Numbers come from the posted X Layer mainnet terms; there is
 * no model in the path. Each answer carries the inputsHash that recomputes it.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { explainNow, resolveAsset } from "./compute.js";
import type { Upstream } from "./upstream.js";
import type { PayConfig } from "./pay.js";

const NOTE = "Deterministic, no model: numbers are Kerb Terms posted on X Layer mainnet (chain 196). Verify with the returned inputsHash.";
const text = (v: unknown): { content: { type: "text"; text: string }[] } => ({ content: [{ type: "text", text: JSON.stringify(v, null, 1) }] });

export function mcpServer(up: Upstream, pay: PayConfig, publicBase: string): McpServer {
  const s = new McpServer({ name: "kerb", version: "0.3.0" });
  const asset = z.string().describe("A tokenized stock on X Layer: symbol such as HKEXCx or BRK.Bx, a token address, or an assetId");

  s.registerTool("kerb_terms", { description: `Latest Kerb Terms for one asset: regime, Credit Mark, Carry and Session Max LTV, debt ceiling, executable depth C(1%), with tx and inputsHash. ${NOTE}`, inputSchema: { asset }, annotations: { readOnlyHint: true } }, async ({ asset: q }) => {
    const a = resolveAsset(q, up.assets());
    const { ...t } = await up.terms(a.symbol) as unknown as Record<string, unknown>;
    delete t["history"];
    return text(t);
  });

  s.registerTool("kerb_board", { description: `Every asset on the Kerb Board, compact: regime, Credit Mark, C(1%), Carry and Session Max, next transition. ${NOTE}`, annotations: { readOnlyHint: true } }, async () => {
    const b = await up.board();
    return text({ generatedAt: b.generatedAt, rows: b.rows.map((r) => ({ symbol: r.symbol, regime: (r["regime"] as { value: string | null }).value, creditMark: (r["creditMark"] as { value: string | null }).value, c1USDG: (r["executableDepth1"] as { value: string | null }).value, carryLTV: (r["carryLTV"] as { value: string | null }).value, sessionMaxLTV: (r["sessionMaxLTV"] as { value: string | null }).value, next: r["next"] ?? null, cure: r.cure ?? null })) });
  });

  s.registerTool("kerb_clock", { description: `The market clock for an asset's underlying exchange: session now, next transition, next weakening, the cure window. ${NOTE}`, inputSchema: { asset }, annotations: { readOnlyHint: true } }, async ({ asset: q }) => {
    const a = resolveAsset(q, up.assets());
    return text(await up.json(`/v1/clock/196/${encodeURIComponent(a.symbol)}`));
  });

  s.registerTool("kerb_why", { description: `Why an asset's terms are what they are now: the margin sentences with their numbers, computed from the posted input bundle. ${NOTE}`, inputSchema: { asset }, annotations: { readOnlyHint: true } }, async ({ asset: q }) => {
    const a = resolveAsset(q, up.assets());
    const t = await up.terms(a.symbol);
    const r = await up.report(t.inputsHash);
    return text({ asset: a.symbol, asOf: t.observedAt, why: explainNow(r), whyKind: "now", inputsHash: t.inputsHash, tx: t.tx });
  });

  s.registerTool("kerb_position", {
    description: "A Kerb Credit position on X Layer testnet 1952 (mirror collateral): debt, LTV, Carry target, cure status. Read from chain by the Kerb API.",
    inputSchema: { address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe("Borrower address"), collateral: z.string().describe("Mirror collateral symbol: kKOx or kHKEXCx") },
    annotations: { readOnlyHint: true },
  }, async ({ address, collateral }) => {
    const m = await up.json<{ collaterals: { symbol: string; assetId: string }[] }>("/v1/credit/1952");
    const c = m.collaterals.find((x) => x.symbol.toLowerCase() === collateral.toLowerCase());
    if (!c) return { ...text({ error: `unknown collateral ${collateral}; one of ${m.collaterals.map((x) => x.symbol).join(", ")}` }), isError: true };
    return text(await up.json(`/v1/credit/1952/position/${address}/${c.assetId}`, 0));
  });

  s.registerTool("kerb_paid_tools", { description: "The paid Kerb for Agents endpoints (x402 on X Layer, USDT0): what they answer, price, network, and how to call them.", annotations: { readOnlyHint: true } }, async () => text({
    network: pay.network, price: pay.price, currency: "USDT0", payTo: pay.payTo,
    endpoints: [
      { name: "Kerb Credit Check", url: `${publicBase}/agents/credit-check`, params: "asset, amount, unit (token|usdg), mode (carry|session_max)", answers: "max borrow now, cure deadline, measured exit, with tx and inputsHash" },
      { name: "Kerb Exit Check", url: `${publicBase}/agents/exit-check`, params: "asset, sizeUSDG", answers: "price impact at a size on the walked pool curve, C(0.5%), C(1%), C(3%), route, OKX DEX cross-check" },
    ],
    howTo: "Call without payment to receive HTTP 402 with a PAYMENT-REQUIRED header, sign the EIP-3009 transfer it describes, and retry with PAYMENT-SIGNATURE. Any x402 client (for example @okxweb3/x402-fetch) does this.",
  }));
  return s;
}
