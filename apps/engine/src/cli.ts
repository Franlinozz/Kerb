#!/usr/bin/env node
/**
 * kerb report <symbol> [--at <iso>] [--pin] [--json]
 * kerb verify <reportId|bundleCID|path> : recompute from the pinned bundle and diff.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { canonicalJson, dec, keccakText, toUnitsFloor, type DecString } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { createPublicClient, decodeEventLog, http, parseAbi, type Address, type Hex } from "viem";
import { assetId as assetIdOf } from "@kerb/types";
import { buildBundle } from "./build.js";
import { identifyBundle, type InputBundle } from "./bundle.js";
import { engineConfig, engineConfigFromBundle, loadParams } from "./params.js";
import { computeReport, type Report } from "./report.js";
import { pinBundle } from "./pin.js";

const OUT = process.env["KERB_REPORT_DIR"] ?? resolve(repoRoot(), "data/reports/kts");

function store(): string {
  mkdirSync(OUT, { recursive: true });
  return OUT;
}

export function reportId(r: Report): string {
  return `${r.assetSymbol}-${r.observedAt.replace(/[:.]/g, "-")}`;
}

async function cmdReport(symbol: string, args: string[]): Promise<void> {
  const atArg = args[args.indexOf("--at") + 1];
  const atMs = args.includes("--at") && atArg ? Date.parse(atArg) : undefined;
  const params = loadParams();
  const { sql } = connect();
  try {
    const bundle = await buildBundle(sql, symbol, params, atMs === undefined ? {} : { atMs });
    const cfg = engineConfig(params, symbol, bundle.market.cureWindowSec);
    const report = computeReport(bundle, cfg);
    const id = identifyBundle(bundle);
    const dir = store();
    const rid = reportId(report);
    writeFileSync(resolve(dir, `${rid}.bundle.json`), id.canonical);
    if (args.includes("--pin")) {
      const pin = await pinBundle(id.canonical, id.cidV1Raw, `${rid}.bundle.json`);
      (report as Report & { pin?: unknown }).pin = pin;
      console.error(`pin: ${pin.status} ${pin.cid}${pin.reason ? ` (${pin.reason})` : ""}`);
    }
    writeFileSync(resolve(dir, `${rid}.report.json`), `${canonicalJson(report)}\n`);
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else printReport(report, id.bytes, rid);
  } finally {
    await sql.end();
  }
}

function printReport(r: Report, bundleBytes: number, rid: string): void {
  const pct = (x: string): string => `${(Number(x) * 100).toFixed(2)}%`;
  console.log(`${r.assetSymbol}  ${r.regime}  (${r.underlying.symbol} on ${r.underlying.market})  observed ${r.observedAt}`);
  console.log(`  report id     ${rid}`);
  console.log(`  session       ${r.regimeInputs.calendarSession}, rule ${r.regimeInputs.rule}: ${r.regimeInputs.reason}`);
  console.log(`  next          ${r.regimeInputs.nextTransition.type} at ${r.regimeInputs.nextTransition.at}`);
  console.log(`  weakening     ${r.regimeInputs.nextWeakening.type} at ${r.regimeInputs.nextWeakening.at}   cure window opens ${r.regimeInputs.cureWindowOpensAt} (open=${r.regimeInputs.cureWindowOpen})`);
  console.log(`  mark          creditMark ${r.mark.creditMark}  reference ${r.mark.reference.value} [${r.mark.reference.sources.join(", ")}]  pool ${r.mark.pool.value} (${r.mark.pool.basis})`);
  console.log(`                band [${r.mark.band.join(", ")}]  haircut ${pct(r.mark.haircut)}  dispersion ${pct(r.mark.dispersion)}${r.mark.dispersionBreach ? " BREACH" : ""}`);
  console.log(`  depth         C(0.5%) ${r.depth.C_0_5}  C(1%) ${r.depth.C_1}  C(3%) ${r.depth.C_3}  frag ${r.depth.fragmentationFactor}  crosscheck ${"status" in r.depth.crosscheck ? `${r.depth.crosscheck.status} (rung ${r.depth.crosscheck.rung})` : r.depth.crosscheck.used}`);
  for (const v of r.depth.venues) console.log(`                path ${v.path.join(" -> ")}  C(1%) ${v.C_1.notional}`);
  for (const x of r.depth.excluded) console.log(`                excluded ${x.path.join(" -> ")}: ${x.reason}`);
  console.log(`  capacity      LT ${pct(r.capacity.LT)}  carryLTV ${pct(r.capacity.carryLTV)}  sessionMaxLTV ${pct(r.capacity.sessionMaxLTV)}`);
  console.log(`                debtCeiling ${r.capacity.debtCeiling}  maxPositionDebt ${r.capacity.maxPositionDebt}  coverage ${r.capacity.coverageRatioAtCeiling}`);
  if (r.capacity.clamped.length) for (const c of r.capacity.clamped) console.log(`                clamped ${c.field}: ${c.from} -> ${c.to} (${c.reason})`);
  console.log(`  stress        H_weak ${r.stress.horizonHoursWeak}h (${r.stress.sessionsWeak} sessions) g=${r.stress.gapQuantileWeak}  H_cure ${r.stress.horizonHoursCure}h g=${r.stress.gapQuantileCure}`);
  console.log(`                volScaler ${r.stress.volScaler}  s=${r.stress.impactAtReferenceSize}  historySufficient=${r.stress.historySufficient}`);
  console.log(`  inputs        hash ${r.inputsHash}  cid ${r.inputsCidV1Raw}  (${bundleBytes} bytes)`);
}

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
];

/**
 * Resolve a bundle from whatever a verifier actually has in their hand.
 *
 * A judge reading a TermsPosted event has an inputsHash and nothing else, so verify accepts
 * that: it looks on disk, then in the posts table for the CID that was pinned alongside it,
 * then fetches those exact bytes from IPFS. A report that can only be verified by someone who
 * already has the file is not reproducible in any useful sense.
 */
async function loadBundleByRef(ref: string): Promise<{ bundle: InputBundle; path: string }> {
  const candidates = [ref, resolve(OUT, ref), resolve(OUT, `${ref}.bundle.json`)];
  for (const p of candidates) {
    if (existsSync(p)) return { bundle: JSON.parse(readFileSync(p, "utf8")) as InputBundle, path: p };
  }
  let apiCopy: { bundle: InputBundle; path: string } | null = null;

  /**
   * The Kerb API serves every posted bundle under its own inputsHash. IPFS is the stronger
   * source, because the bytes are addressed by their own hash and do not depend on Kerb being
   * online, so it is tried first; this is the fallback when pinning did not happen.
   */
  if (/^0x[0-9a-fA-F]{64}$/.test(ref)) {
    const api = process.env["KERB_API_PUBLIC"] ?? "https://api.usekerb.xyz";
    try {
      const res = await fetch(`${api}/v1/bundle/${ref}`, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const text = await res.text();
        // Bytes that do not hash to the reference are not the bundle, whoever served them.
        if (keccakText(text).toLowerCase() === ref.toLowerCase()) {
          apiCopy = { bundle: JSON.parse(text) as InputBundle, path: `${api}/v1/bundle/${ref}` };
        } else {
          console.error(`  ${api} served bytes hashing to ${keccakText(text)}, not ${ref}; ignoring them`);
        }
      }
    } catch (err) {
      console.error(`  ${api}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let cid: string | null = /^bafk[a-z2-7]+$/.test(ref) ? ref : null;
  // A verifier outside Kerb has no database: the API copy, checked against its own hash, is enough.
  if (!cid && !HAS_DB && apiCopy) return apiCopy;
  if (!cid && HAS_DB && /^0x[0-9a-fA-F]{64}$/.test(ref)) {
    const { sql } = connect();
    try {
      const rows = await sql<{ bundle_cid: string | null; pin_status: string | null }[]>`
        SELECT bundle_cid, pin_status FROM terms_posts
        WHERE lower(inputs_hash) = ${ref.toLowerCase()} AND bundle_cid IS NOT NULL
        ORDER BY ts DESC LIMIT 1`;
      const row = rows[0];
      if (row?.bundle_cid) {
        cid = row.bundle_cid;
        console.error(`inputsHash ${ref} was posted with bundle CID ${cid} (${row.pin_status ?? "unknown"})`);
      }
    } finally {
      await sql.end();
    }
  }
  if (!cid) {
    if (apiCopy) return apiCopy;
    throw new Error(`no bundle found for ${ref} (looked on disk in ${OUT}, on the Kerb API, and for a posted CID)`);
  }

  for (const gw of GATEWAYS) {
    try {
      const res = await fetch(`${gw}/${cid}`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const text = await res.text();
      // The bytes must hash to the CID they were fetched by, or they are not the bundle.
      const fetched = identifyBundle(JSON.parse(text) as InputBundle);
      if (fetched.cidV1Raw !== cid) {
        throw new Error(`${gw} served bytes whose CID is ${fetched.cidV1Raw}, not ${cid}`);
      }
      return { bundle: JSON.parse(text) as InputBundle, path: `${gw}/${cid}` };
    } catch (err) {
      console.error(`  ${gw}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (apiCopy) {
    console.error(`  no gateway served ${cid}; falling back to the Kerb API copy`);
    return apiCopy;
  }
  throw new Error(`bundle ${cid} could not be fetched from any gateway`);
}


/**
 * Compare a recomputed report against what was actually posted on chain for the same inputsHash.
 * Returns null when nothing was posted under that hash, so the caller can fall back.
 *
 * This is the claim being tested: a stranger holding only the hash from a TermsPosted event can
 * fetch the pinned inputs and arrive at the same numbers the contract is serving.
 */
async function comparePosted(inputsHash: string, recomputed: Report, bundle: InputBundle, txArg: string | null): Promise<boolean | null> {
  if (!HAS_DB || txArg) return comparePostedOnchain(inputsHash, recomputed, bundle, txArg);
  const { sql } = connect();
  try {
    const rows = await sql<{
      chain_id: number; symbol: string | null; tx_hash: string; credit_mark: string; carry_ltv: string;
      session_max_ltv: string; debt_ceiling: string; executable_depth1: string; regime: number;
    }[]>`
      SELECT chain_id, symbol, tx_hash, credit_mark, carry_ltv, session_max_ltv, debt_ceiling,
             executable_depth1, regime
      FROM terms_posts WHERE lower(inputs_hash) = ${inputsHash.toLowerCase()} ORDER BY ts DESC LIMIT 1`;
    const p = rows[0];
    if (!p) return null;

    const loanDecimals = 6;
    const toWad = (d: DecString): bigint => toUnitsFloor(dec(d), 18);
    const toLoan = (d: DecString): bigint => toUnitsFloor(dec(d), loanDecimals);

    const checks: { field: string; posted: bigint; recomputed: bigint }[] = [
      { field: "creditMark", posted: BigInt(p.credit_mark), recomputed: toWad(recomputed.mark.creditMark) },
      { field: "carryLTV", posted: BigInt(p.carry_ltv), recomputed: toWad(recomputed.capacity.carryLTV) },
      { field: "sessionMaxLTV", posted: BigInt(p.session_max_ltv), recomputed: toWad(recomputed.capacity.sessionMaxLTV) },
      { field: "debtCeiling", posted: BigInt(p.debt_ceiling), recomputed: toLoan(recomputed.capacity.debtCeiling) },
      { field: "executableDepth1", posted: BigInt(p.executable_depth1), recomputed: toLoan(recomputed.depth.C_1) },
    ];

    console.log(`posted     chain ${p.chain_id} ${p.symbol ?? ""} tx ${p.tx_hash}`);
    let ok = true;
    for (const c of checks) {
      // The attester clamps into the onchain guardrails, so a posted value may legitimately be
      // tighter than the engine's. Anything looser than the recomputed value is a real failure.
      const equal = c.posted === c.recomputed;
      const tighter = c.field === "debtCeiling" || c.field.endsWith("LTV") ? c.posted < c.recomputed : false;
      const verdict = equal ? "MATCHES" : tighter ? "clamped tighter onchain" : "DIFFERS";
      if (!equal && !tighter) ok = false;
      console.log(`  ${c.field.padEnd(18)} ${verdict.padEnd(24)} posted ${c.posted}  recomputed ${c.recomputed}`);
    }
    console.log(ok ? "recompute  the inputs reproduce the posted terms" : "recompute  MISMATCH against the posted terms");
    return ok;
  } finally {
    await sql.end();
  }
}

const HAS_DB = Boolean(process.env["DATABASE_URL"]);
const RPC: Record<number, string> = { 196: "https://rpc.xlayer.tech", 1952: "https://testrpc.xlayer.tech" };
const TERMS_ABI = parseAbi([
  "event TermsPosted(bytes32 indexed assetId, address indexed attester, uint64 observedAt, uint16 regime, uint128 creditMark, uint64 carryLTV, uint64 sessionMaxLTV, uint128 debtCeiling, uint128 executableDepth1, bytes32 inputsHash)",
  "function latest(bytes32 assetId) view returns ((uint64 observedAt, uint16 regime, uint128 creditMark, uint64 carryLTV, uint64 sessionMaxLTV, uint128 debtCeiling, uint128 maxPositionDebt, uint128 executableDepth1, bytes32 inputsHash, bytes32 engineVersion))",
]);

/**
 * The stranger's path: no database, only the chain. The posted values come from KerbTerms on
 * X Layer, either the TermsPosted log in a transaction the verifier names (--tx), or the
 * contract's latest terms for the asset when their inputsHash is the one being verified.
 */
async function comparePostedOnchain(inputsHash: string, recomputed: Report, bundle: InputBundle, txArg: string | null): Promise<boolean | null> {
  const chainId = bundle.asset.chainId;
  const deployments = JSON.parse(readFileSync(resolve(repoRoot(), "config/deployments.json"), "utf8")) as Record<string, { address: string }>;
  const terms = deployments[`${chainId}:KerbTerms`]?.address as Address | undefined;
  const rpc = process.env["KERB_RPC_URL"] ?? RPC[chainId];
  if (!terms || !rpc) { console.log(`no KerbTerms address or RPC for chain ${chainId}`); return null; }
  const client = createPublicClient({ transport: http(rpc) });
  const id = assetIdOf(chainId, bundle.asset.token as Address);
  let posted: { creditMark: bigint; carryLTV: bigint; sessionMaxLTV: bigint; debtCeiling: bigint; executableDepth1: bigint; inputsHash: Hex } | null = null;
  let where = "";
  if (txArg) {
    const receipt = await client.getTransactionReceipt({ hash: txArg as Hex });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== terms.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: TERMS_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "TermsPosted") { posted = ev.args; where = `TermsPosted in tx ${txArg}`; }
      } catch { /* another event */ }
    }
  } else {
    posted = await client.readContract({ address: terms, abi: TERMS_ABI, functionName: "latest", args: [id] });
    where = `KerbTerms.latest(${id.slice(0, 10)}…) at ${terms}`;
  }
  if (!posted) { console.log(`no TermsPosted from ${terms} in that transaction`); return null; }
  if (posted.inputsHash.toLowerCase() !== inputsHash.toLowerCase()) {
    console.log(`onchain    ${where} carries inputsHash ${posted.inputsHash}, a newer post; pass --tx <hash> of the post you want to check`);
    return null;
  }
  console.log(`posted     chain ${chainId} ${bundle.asset.symbol} read from ${where} (no database used)`);
  return printChecks([
    { field: "creditMark", posted: posted.creditMark, recomputed: toUnitsFloor(dec(recomputed.mark.creditMark), 18) },
    { field: "carryLTV", posted: posted.carryLTV, recomputed: toUnitsFloor(dec(recomputed.capacity.carryLTV), 18) },
    { field: "sessionMaxLTV", posted: posted.sessionMaxLTV, recomputed: toUnitsFloor(dec(recomputed.capacity.sessionMaxLTV), 18) },
    { field: "debtCeiling", posted: posted.debtCeiling, recomputed: toUnitsFloor(dec(recomputed.capacity.debtCeiling), 6) },
    { field: "executableDepth1", posted: posted.executableDepth1, recomputed: toUnitsFloor(dec(recomputed.depth.C_1), 6) },
  ]);
}

function printChecks(checks: { field: string; posted: bigint; recomputed: bigint }[]): boolean {
  let ok = true;
  for (const c of checks) {
    // The attester clamps into the onchain guardrails, so a posted value may legitimately be
    // tighter than the engine's. Anything looser than the recomputed value is a real failure.
    const equal = c.posted === c.recomputed;
    const tighter = c.field === "debtCeiling" || c.field.endsWith("LTV") ? c.posted < c.recomputed : false;
    const verdict = equal ? "MATCHES" : tighter ? "clamped tighter onchain" : "DIFFERS";
    if (!equal && !tighter) ok = false;
    console.log(`  ${c.field.padEnd(18)} ${verdict.padEnd(24)} posted ${c.posted}  recomputed ${c.recomputed}`);
  }
  console.log(ok ? "recompute  the inputs reproduce the posted terms" : "recompute  MISMATCH against the posted terms");
  return ok;
}

async function cmdVerify(ref: string, args: string[] = []): Promise<void> {
  const { bundle, path } = await loadBundleByRef(ref);
  const id = identifyBundle(bundle);
  // The bundle carries its own formula version and parameters; verification never borrows
  // today's parameter file to recompute yesterday's report.
  const cfg = engineConfigFromBundle(bundle);
  const recomputed = computeReport(bundle, cfg);
  const rid = reportId(recomputed);
  const storedPath = resolve(OUT, `${rid}.report.json`);
  console.log(`bundle   ${path}`);
  console.log(`inputsHash ${id.inputsHash}`);
  console.log(`cid        ${id.cidV1Raw}`);
  console.log(`kts        ${bundle.kts} (params ${bundle.paramsVersion})`);
  // The check that matters: do the pinned inputs reproduce the numbers that went on chain?
  const txAt = args.indexOf("--tx");
  const onchain = await comparePosted(id.inputsHash, recomputed, bundle, txAt >= 0 ? args[txAt + 1] ?? null : null);
  if (onchain !== null) {
    if (args.includes("--json")) console.log(canonicalJson(recomputed));
    if (!onchain) process.exitCode = 1;
    return;
  }

  if (!existsSync(storedPath)) {
    console.log("no posted terms and no stored report to diff against; recomputed report:");
    console.log(canonicalJson(recomputed));
    return;
  }
  const stored = readFileSync(storedPath, "utf8").trim();
  const fresh = canonicalJson(recomputed);
  if (stored === fresh) {
    console.log(`recompute  IDENTICAL to ${storedPath} (${fresh.length} bytes)`);
    return;
  }
  console.error(`recompute  DIFFERS from ${storedPath}`);
  const a = JSON.parse(stored) as Record<string, unknown>;
  const b = JSON.parse(fresh) as Record<string, unknown>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = JSON.stringify(a[k]);
    const y = JSON.stringify(b[k]);
    if (x !== y) console.error(`  ${k}:\n    stored:     ${x}\n    recomputed: ${y}`);
  }
  process.exitCode = 1;
}

const [cmd, arg, ...rest] = process.argv.slice(2);
if (cmd === "report" && arg) await cmdReport(arg, rest);
else if (cmd === "verify" && arg) await cmdVerify(arg, rest);
else {
  console.error("usage: kerb report <symbol> [--at <iso>] [--pin] [--json]\n       kerb verify <reportId|bundle path>");
  process.exitCode = 2;
}
