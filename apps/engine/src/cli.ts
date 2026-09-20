#!/usr/bin/env node
/**
 * kerb report <symbol> [--at <iso>] [--pin] [--json]
 * kerb verify <reportId|bundleCID|path> : recompute from the pinned bundle and diff.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import { canonicalJson, dec, toUnitsFloor, type DecString } from "@kerb/types";
import { connect } from "@kerb/collector/db";
import { buildBundle } from "./build.js";
import { identifyBundle, type InputBundle } from "./bundle.js";
import { engineConfig, loadParams } from "./params.js";
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

  let cid: string | null = /^bafk[a-z2-7]+$/.test(ref) ? ref : null;
  if (!cid && /^0x[0-9a-fA-F]{64}$/.test(ref)) {
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
  if (!cid) throw new Error(`no bundle found for ${ref} (looked on disk in ${OUT}, and for a posted CID)`);

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
  throw new Error(`bundle ${cid} could not be fetched from any gateway`);
}


/**
 * Compare a recomputed report against what was actually posted on chain for the same inputsHash.
 * Returns null when nothing was posted under that hash, so the caller can fall back.
 *
 * This is the claim being tested: a stranger holding only the hash from a TermsPosted event can
 * fetch the pinned inputs and arrive at the same numbers the contract is serving.
 */
async function comparePosted(inputsHash: string, recomputed: Report): Promise<boolean | null> {
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
    console.log(ok ? "recompute  the pinned inputs reproduce the posted terms" : "recompute  MISMATCH against the posted terms");
    return ok;
  } finally {
    await sql.end();
  }
}

async function cmdVerify(ref: string, args: string[] = []): Promise<void> {
  const { bundle, path } = await loadBundleByRef(ref);
  const id = identifyBundle(bundle);
  const params = loadParams();
  const cfg = engineConfig(params, bundle.asset.symbol, bundle.market.cureWindowSec);
  const recomputed = computeReport(bundle, cfg);
  const rid = reportId(recomputed);
  const storedPath = resolve(OUT, `${rid}.report.json`);
  console.log(`bundle   ${path}`);
  console.log(`inputsHash ${id.inputsHash}`);
  console.log(`cid        ${id.cidV1Raw}`);
  // The check that matters: do the pinned inputs reproduce the numbers that went on chain?
  const onchain = await comparePosted(id.inputsHash, recomputed);
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
