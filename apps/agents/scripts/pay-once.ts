/**
 * One paid call to Kerb Credit Check over x402, as any agent would make it (V3-03 section 9).
 * The payer is Kerb's own throwaway wallet, and the evidence says so. The payer signs an EIP-3009
 * transfer; the OKX facilitator settles it on X Layer. Evidence: data/agents/paid-call-<ts>.json.
 *   node --env-file=/root/.kerb/payer.env --import tsx scripts/pay-once.ts [url]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@okxweb3/x402-fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { privateKeyToAccount } from "viem/accounts";
import { repoRoot } from "@kerb/adapters";

const url = process.argv[2] ?? "https://api.usekerb.xyz/agents/credit-check?asset=HKEXCx&amount=100&mode=session_max";
const key = process.env["KERB_PAYER_KEY"] as `0x${string}` | undefined;
if (!key) throw new Error("KERB_PAYER_KEY is not set");
const account = privateKeyToAccount(key);
const pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:*", client: new ExactEvmScheme(toClientEvmSigner(account)) }] });
const t0 = Date.now();
const r = await pay(url);
const body = await r.json();
const header = r.headers.get("payment-response");
const settlement = header ? decodePaymentResponseHeader(header) : null;
const evidence = { at: new Date().toISOString(), url, payer: account.address, payerIsKerbsOwnWallet: true, status: r.status, ms: Date.now() - t0, settlement, answer: body };
mkdirSync(resolve(repoRoot(), "data/agents"), { recursive: true });
const file = resolve(repoRoot(), `data/agents/paid-call-${evidence.at.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify(evidence, null, 1));
console.log(`status ${r.status} in ${evidence.ms} ms`);
console.log("settlement", JSON.stringify(settlement));
console.log("answer", JSON.stringify({ asset: body.asset, maxBorrowUSDG: body.maxBorrowUSDG, covenant: body.covenant, tx: body.provenance?.tx, inputsHash: body.provenance?.inputsHash }));
console.log(`evidence ${file}`);
