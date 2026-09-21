/**
 * KTS-0.2 fork test (V2-01 step 6, KTS-0.2 section 7.3). Posts a replayed 0.2 series through the
 * REAL mainnet KerbTerms on a local anvil fork, in time order, and counts reverts.
 *
 * Nothing here touches mainnet. The fork must be a local anvil (the script refuses any other RPC),
 * and the reports are signed by a throwaway key that the fork's admin registers as an attester, so
 * the real attester key is never loaded and no signature produced here is valid on mainnet.
 *
 * The series is rebuilt from the observation store every --step minutes over --hours, then shifted
 * forward so the first report lands just after the fork's head: spacing between posts, and so the
 * contract's loosen cooldown and step rules, are exactly those of the real series.
 *
 *   anvil --fork-url $KERB_RPC_MAINNET --port 8546 &
 *   pnpm --filter @kerb/attester exec tsx scripts/fork-kts02.ts --rpc http://127.0.0.1:8546 --symbols KOx,HKEXCx,SLVx
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createTestClient, createWalletClient, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadAssets, repoRoot } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { buildBundle, computeReport, engineConfigFromBundle, loadParams, type Report } from "@kerb/engine";
import { artifact, deploymentOf } from "../src/chain.js";
import { TERMS_TYPES, type TermsStruct } from "../src/sign.js";
import { prepareTerms, type OnchainGuardrails } from "../src/post.js";

const arg = (k: string, d: string): string => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? (process.argv[i + 1] ?? d) : d; };
const rpc = arg("rpc", "http://127.0.0.1:8546");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(rpc)) throw new Error(`refusing ${rpc}: the fork test only runs against a local anvil`);
const hours = Number(arg("hours", "72"));
const stepMin = Number(arg("step", "15"));
const symbols = arg("symbols", "KOx,HKEXCx,SLVx").split(",");

const params = loadParams();
if (params.kts !== "0.2") throw new Error("run the fork test on the KTS-0.2 parameter file");
const chain = { id: 196, name: "X Layer (anvil fork)", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;
const pub = createPublicClient({ chain, transport: http(rpc) });
const test = createTestClient({ chain, transport: http(rpc), mode: "anvil" });
if ((await pub.getChainId()) !== 196) throw new Error("the fork is not of X Layer mainnet (chain 196)");

const termsAddr = deploymentOf(196, "KerbTerms").address as Address;
const abi = artifact("KerbTerms").abi;
const cfg = loadAssets();
const { assetId } = await import("@kerb/types");

// A throwaway attester, registered on the fork only by impersonating the fork's admin.
const throwaway = privateKeyToAccount(generatePrivateKey());
const admin = (await pub.readContract({ address: termsAddr, abi, functionName: "admin" })) as Address;
await test.impersonateAccount({ address: admin });
await test.setBalance({ address: admin, value: 10n ** 20n });
const adminWallet = createWalletClient({ chain, transport: http(rpc), account: admin });
await pub.waitForTransactionReceipt({ hash: await adminWallet.writeContract({ address: termsAddr, abi, functionName: "setAttester", args: [throwaway.address, true] }) });
await test.stopImpersonatingAccount({ address: admin });
await test.setBalance({ address: throwaway.address, value: 10n ** 20n });
const poster = createWalletClient({ chain, transport: http(rpc), account: throwaway });
console.log(`fork head ${await pub.getBlockNumber()}, admin ${admin}, throwaway attester ${throwaway.address}`);

// Build the 0.2 series from real observations.
const endMs = Date.now();
const startMs = endMs - hours * 3_600_000;
const { sql } = connect();
const series: { symbol: string; atMs: number; report: Report }[] = [];
try {
  for (let t = startMs; t <= endMs; t += stepMin * 60_000) {
    for (const s of symbols) {
      try {
        const b = await buildBundle(sql, s, params, { atMs: t });
        series.push({ symbol: s, atMs: b.observedAtMs, report: computeReport(b, engineConfigFromBundle(b)) });
      } catch { /* no observations yet at t: nothing to post, as live */ }
    }
  }
} finally { await sql.end(); }
series.sort((a, b) => a.atMs - b.atMs);
console.log(`series: ${series.length} reports across ${symbols.join(", ")}`);

const head = await pub.getBlock();
const shift = Number(head.timestamp) + 120 - Math.floor((series[0]?.atMs ?? endMs) / 1000);
let posted = 0;
const reverts: { symbol: string; at: string; error: string }[] = [];
const clampCounts: Record<string, number> = {};
const perAsset: Record<string, { first?: { carry: string; session: string }; last?: { carry: string; session: string }; carryValues: Set<string>; loosenings: number }> = {};
let lastBlockTs = Number(head.timestamp);

for (const item of series) {
  const id = assetId(196, cfg.assets.find((a) => a.symbol === item.symbol)!.token.address) as Hex;
  const observedAt = Math.floor(item.atMs / 1000) + shift;
  const blockTs = Math.max(observedAt + 5, lastBlockTs + 1);
  const g = (await pub.readContract({ address: termsAddr, abi, functionName: "guardrails", args: [id] })) as OnchainGuardrails;
  const prevRaw = (await pub.readContract({ address: termsAddr, abi, functionName: "latest", args: [id] })) as TermsStruct;
  const previous = prevRaw.observedAt === 0n ? null : prevRaw;
  const lastLoosenAt = (await pub.readContract({ address: termsAddr, abi, functionName: "lastLoosenAt", args: [id] })) as bigint;
  const canLoosen = lastLoosenAt === 0n || BigInt(blockTs) - lastLoosenAt >= BigInt(g.loosenCooldownSec);
  const { terms: t, clamped } = prepareTerms(item.report, g, previous, 6, canLoosen);
  t.observedAt = BigInt(observedAt);
  for (const c of clamped) clampCounts[c.field] = (clampCounts[c.field] ?? 0) + 1;
  if (previous && t.observedAt <= previous.observedAt) continue;

  const sig = await throwaway.signTypedData({
    domain: { name: "Kerb Terms", version: "0.1", chainId: 196, verifyingContract: termsAddr },
    types: TERMS_TYPES, primaryType: "TermsReport", message: { assetId: id, ...t },
  });
  await test.setNextBlockTimestamp({ timestamp: BigInt(blockTs) });
  lastBlockTs = blockTs;
  const pa = (perAsset[item.symbol] ??= { carryValues: new Set(), loosenings: 0 });
  try {
    const hash = await poster.writeContract({ address: termsAddr, abi, functionName: "postTerms", args: [id, t, sig], gas: 600_000n });
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`reverted in ${hash}`);
    posted++;
    const vals = { carry: t.carryLTV.toString(), session: t.sessionMaxLTV.toString() };
    pa.first ??= vals; pa.last = vals; pa.carryValues.add(vals.carry);
    if (previous && (t.carryLTV > previous.carryLTV || t.sessionMaxLTV > previous.sessionMaxLTV)) pa.loosenings++;
  } catch (e) {
    await test.mine({ blocks: 1 });
    reverts.push({ symbol: item.symbol, at: new Date(item.atMs).toISOString(), error: (e instanceof Error ? e.message : String(e)).split("\n").slice(0, 3).join(" ") });
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  note: "Local anvil fork of X Layer mainnet. Throwaway attester registered on the fork only; nothing was sent to mainnet.",
  fork: { rpc, headBlock: head.number.toString(), headTimestamp: head.timestamp.toString(), terms: termsAddr },
  window: { from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString(), stepMinutes: stepMin },
  paramsVersion: params.paramsVersion,
  reports: series.length, posted, reverts: reverts.length, revertDetail: reverts.slice(0, 20), clampCounts,
  perAsset: Object.fromEntries(Object.entries(perAsset).map(([k, v]) => [k, { first: v.first, last: v.last, distinctCarryValues: v.carryValues.size, loosenings: v.loosenings }])),
};
writeFileSync(resolve(repoRoot(), "data/reports/kts-0.2-fork.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ ...result, revertDetail: result.revertDetail.slice(0, 5) }, null, 1));
