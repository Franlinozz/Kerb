/**
 * The attester: build a report from the append-only record, pin the bundle, sign it with the
 * attester key and post it with the poster key. Posts every 5 minutes, always on a regime
 * change, and skips when nothing moved beyond epsilon. Stops loudly if the poster runs low
 * on gas; it never stalls silently.
 */
import { formatEther, parseEther, type Address, type Hex } from "viem";
import { explorerTx, loadAssets, resolvedAssets, type KerbChainId } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { termsPosts } from "@kerb/collector/schema";
import { buildBundle, computeReport, engineConfig, identifyBundle, loadParams, pinBundle } from "@kerb/engine";
import { artifact, deploymentOf, walletFor, suffix } from "./chain.js";
import { signTerms, type TermsStruct } from "./sign.js";
import { isLoosening, prepareTerms, withinEpsilon, type OnchainGuardrails } from "./post.js";

const chainId = Number(process.env["KERB_ATTESTER_CHAIN_ID"] ?? 1952) as KerbChainId;
const intervalMs = Number(process.env["KERB_ATTESTER_INTERVAL_MS"] ?? 300_000);
const epsilonBps = BigInt(process.env["KERB_ATTESTER_EPSILON_BPS"] ?? "25");
const minBalance = parseEther(process.env["KERB_POSTER_MIN_BALANCE"] ?? "0.002");
const loanDecimals = Number(process.env["KERB_LOAN_DECIMALS"] ?? 6);

const terms = deploymentOf(chainId, "KerbTerms");
const termsAbi = artifact("KerbTerms").abi;
const wallet = walletFor(chainId, "KERB_POSTER_KEY");
const poster = wallet.account.address;
const params = loadParams();
const cfg = loadAssets();
const { sql, db } = connect();

const lastRegime = new Map<string, number>();
let consecutiveFailures = 0;
let stopped = false;

function log(...a: unknown[]): void {
  console.log(new Date().toISOString(), ...a);
}

async function guardrailsOf(assetId: Hex): Promise<OnchainGuardrails> {
  return (await wallet.readContract({ address: terms.address, abi: termsAbi, functionName: "guardrails", args: [assetId] })) as OnchainGuardrails;
}

async function latestOf(assetId: Hex): Promise<TermsStruct | null> {
  const t = (await wallet.readContract({ address: terms.address, abi: termsAbi, functionName: "latest", args: [assetId] })) as TermsStruct;
  return t.observedAt === 0n ? null : t;
}

async function checkGas(): Promise<void> {
  const balance = await wallet.getBalance({ address: poster });
  if (balance < minBalance) {
    stopped = true;
    console.error(`!!!!! KERB ATTESTER STOPPED !!!!! poster ${poster} balance ${formatEther(balance)} OKB is below ${formatEther(minBalance)}. Fund it and restart.`);
    throw new Error("poster balance below the hard stop");
  }
}

async function postOne(symbol: string): Promise<"posted" | "skipped"> {
  const { assetId } = await import("@kerb/types");
  const asset = cfg.assets.find((a) => a.symbol === symbol);
  if (!asset) throw new Error(`unknown asset ${symbol}`);
  const id = assetId(196, asset.token.address) as Hex;

  const bundle = await buildBundle(sql, symbol, params);
  const report = computeReport(bundle, engineConfig(params, symbol, bundle.market.cureWindowSec));
  const g = await guardrailsOf(id);
  if (!g.exists) throw new Error(`${symbol}: no guardrails onchain`);
  const previous = await latestOf(id);
  const lastLoosenAt = (await wallet.readContract({ address: terms.address, abi: termsAbi, functionName: "lastLoosenAt", args: [id] })) as bigint;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const canLoosen = lastLoosenAt === 0n || nowSec - lastLoosenAt >= BigInt(g.loosenCooldownSec);
  const { terms: t, clamped } = prepareTerms(report, g, previous, loanDecimals, canLoosen);

  const regimeChanged = previous !== null && previous.regime !== t.regime;
  const firstEver = previous === null;
  if (!firstEver && !regimeChanged && withinEpsilon(previous, t, epsilonBps)) {
    lastRegime.set(symbol, t.regime);
    return "skipped";
  }
  // observedAt must strictly increase, and the contract refuses a future timestamp.
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (previous && t.observedAt <= previous.observedAt) {
    log(`${symbol}: observation ${t.observedAt} is not newer than the posted ${previous.observedAt}, skipping`);
    return "skipped";
  }
  if (t.observedAt > now) t.observedAt = now;

  const id2 = identifyBundle(bundle);
  const pin = await pinBundle(id2.canonical, id2.cidV1Raw, `${symbol}-${report.observedAt}`);
  const sig = await signTerms(chainId, terms.address as Address, id, t);

  const hash = await wallet.writeContract({
    address: terms.address, abi: termsAbi, functionName: "postTerms", args: [id, t, sig],
    chain: wallet.chain, account: wallet.account, ...(suffix() ? { dataSuffix: suffix() } : {}),
  });
  const receipt = await wallet.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`${symbol}: postTerms reverted ${explorerTx(chainId, hash)}`);
  await db.insert(termsPosts).values({
    chainId, assetId: id, symbol, txHash: hash, blockNumber: receipt.blockNumber,
    observedAt: new Date(Number(t.observedAt) * 1000), regime: t.regime,
    creditMark: t.creditMark.toString(), carryLtv: t.carryLTV.toString(), sessionMaxLtv: t.sessionMaxLTV.toString(),
    debtCeiling: t.debtCeiling.toString(), executableDepth1: t.executableDepth1.toString(),
    inputsHash: t.inputsHash, bundleCid: pin.cid, pinStatus: pin.status,
    gasUsed: receipt.gasUsed, feeWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
    clamped,
  }).onConflictDoNothing();
  lastRegime.set(symbol, t.regime);
  log(
    `${symbol.padEnd(7)} posted ${report.regime.padEnd(16)} carry=${t.carryLTV} session=${t.sessionMaxLTV} ceiling=${t.debtCeiling} C1=${t.executableDepth1}`,
    `${regimeChanged ? "REGIME CHANGE " : ""}${isLoosening(previous, t) ? "loosening " : ""}${clamped.length ? `clamped:${clamped.map((c) => c.field).join(",")} ` : ""}pin=${pin.status} gas=${receipt.gasUsed} ${hash}`,
  );
  return "posted";
}

async function cycle(): Promise<void> {
  await checkGas();
  let posted = 0;
  let skipped = 0;
  let failed = 0;
  for (const a of resolvedAssets(cfg)) {
    try {
      const r = await postOne(a.symbol);
      if (r === "posted") posted++;
      else skipped++;
    } catch (e) {
      failed++;
      console.error(`${new Date().toISOString()} ${a.symbol}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  log(`cycle done: posted ${posted}, skipped ${skipped}, failed ${failed}`);
  if (failed === resolvedAssets(cfg).length) consecutiveFailures++;
  else consecutiveFailures = 0;
  if (consecutiveFailures >= 5) {
    console.error("!!!!! KERB ATTESTER STOPPED !!!!! five consecutive cycles failed for every asset");
    stopped = true;
  }
}

async function loop(): Promise<void> {
  log(`attester starting: chain ${chainId}, KerbTerms ${terms.address}, poster ${poster}, every ${intervalMs / 1000}s`);
  while (!stopped) {
    const started = Date.now();
    try {
      await cycle();
    } catch (e) {
      console.error(`${new Date().toISOString()} cycle failed: ${(e as Error).message}`);
      if (stopped) break;
      // Exponential backoff, capped, so a failing RPC does not hammer the node.
      const backoff = Math.min(60_000 * 2 ** Math.min(consecutiveFailures, 4), 600_000);
      await new Promise((r) => setTimeout(r, backoff));
    }
    const wait = Math.max(5_000, intervalMs - (Date.now() - started));
    if (!stopped) await new Promise((r) => setTimeout(r, wait));
  }
  await sql.end();
  process.exitCode = 1;
}

const once = process.argv.includes("--once");
if (once) {
  await cycle();
  await sql.end();
} else {
  const shutdown = (sig: string): void => {
    log(`received ${sig}, stopping after the current cycle`);
    stopped = true;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  await loop();
}
