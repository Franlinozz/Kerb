/**
 * x402 on X Layer (SPEC-AGENTS.md section 5). The service holds no private key: the payer signs an
 * EIP-3009 transfer, the OKX facilitator verifies and settles it, and the middleware settles only
 * after a 2xx answer (a 4xx or 5xx is never charged). Testnet 1952 unless the operator switches
 * KERB_X402_NETWORK to eip155:196 (AGENTS.md 13.6 gate 10).
 */
import { createHash } from "node:crypto";
import { x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import type { CallStore } from "./store.js";

export type Network = `eip155:${number}`;
export const USDT0: Record<string, string> = { "eip155:196": "0x779ded0c9e1022225f8e0630b35a9b54be713736", "eip155:1952": "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c" };

export interface PayConfig { network: Network; payTo: string; price: string }

export function payConfigFromEnv(env = process.env): PayConfig {
  const network = (env["KERB_X402_NETWORK"] ?? "eip155:1952") as Network;
  if (!/^eip155:(196|1952)$/.test(network)) throw new Error(`KERB_X402_NETWORK must be eip155:1952 or eip155:196, not ${network}`);
  const payTo = env["KERB_PAY_TO"] ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) throw new Error("KERB_PAY_TO must be a receive-only address");
  return { network, payTo, price: env["KERB_X402_PRICE"] ?? "$0.01" };
}

/** The OKX facilitator, with credentials from the VPS environment only. */
export function okxFacilitator(env = process.env): OKXFacilitatorClient {
  const apiKey = env["OKX_API_KEY"], secretKey = env["OKX_SECRET_KEY"], passphrase = env["OKX_PASSPHRASE"];
  if (!apiKey || !secretKey || !passphrase) throw new Error("OKX facilitator credentials are not set (OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE)");
  return new OKXFacilitatorClient({ apiKey, secretKey, passphrase, syncSettle: true });
}

type Facilitator = ConstructorParameters<typeof x402ResourceServer>[0];

export function resourceServer(facilitator: Facilitator, cfg: PayConfig, store: CallStore, onError: (e: unknown) => void = () => {}): x402ResourceServer {
  const server = new x402ResourceServer(facilitator).register(cfg.network, new ExactEvmScheme());
  server.onAfterSettle(async (ctx) => {
    if (!ctx.result.success) return;
    const t = ctx.transportContext as { responseBody?: Buffer | string; request?: { path?: string } } | undefined;
    const body = t?.responseBody === undefined ? "" : Buffer.isBuffer(t.responseBody) ? t.responseBody.toString("utf8") : String(t.responseBody);
    let inputsHash: string | null = null, asOf: string | null = null;
    try { const j = JSON.parse(body) as { provenance?: { inputsHash?: string }; asOf?: string }; inputsHash = j.provenance?.inputsHash ?? null; asOf = j.asOf ?? null; } catch { /* not JSON */ }
    try {
      await store.record({
        route: t?.request?.path ?? "unknown",
        network: ctx.requirements.network,
        payer: ctx.result.payer ?? null,
        amount: ctx.requirements.amount,
        currency: ctx.requirements.asset,
        settlementTx: ctx.result.transaction || null,
        responseSha256: createHash("sha256").update(body).digest("hex"),
        inputsHash,
        asOf,
      });
    } catch (e) { onError(e); }
  });
  return server;
}

export const routeConfig = (cfg: PayConfig, description: string): { accepts: { scheme: "exact"; network: Network; payTo: string; price: string }; description: string; mimeType: string } => ({
  accepts: { scheme: "exact", network: cfg.network, payTo: cfg.payTo, price: cfg.price },
  description,
  mimeType: "application/json",
});
