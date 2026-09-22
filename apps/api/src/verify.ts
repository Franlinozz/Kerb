/**
 * The check /proof shows as its last verify result: recompute a posted report from its stored
 * input bundle, under the formula and parameters that bundle carries, and compare every posted
 * field with what went on chain. The same comparison `kerb verify` prints, run in-process.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import type { Sql } from "@kerb/collector/db";
import { computeReport, engineConfigFromBundle, type InputBundle } from "@kerb/engine";
import { dec, keccakText, toUnitsFloor, type DecString } from "@kerb/types";

const BUNDLE_DIR = process.env["KERB_BUNDLE_DIR"] ?? resolve(repoRoot(), "data/reports/bundles");

export interface VerifyResult {
  inputsHash: string;
  chainId: number;
  symbol: string | null;
  tx: string;
  kts: string;
  checkedAt: string;
  /** "matches", "clamped tighter onchain" (the attester's guardrails), or "differs". */
  fields: { field: string; verdict: "matches" | "clamped tighter onchain" | "differs" }[];
  ok: boolean;
}

const cache = new Map<string, VerifyResult>();

export async function verifyPosted(sql: Sql, inputsHash: string, now = Date.now()): Promise<VerifyResult | null> {
  const key = inputsHash.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const path = resolve(BUNDLE_DIR, `${key}.json`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  // Bytes that do not hash to the posted reference are not the bundle.
  if (keccakText(text).toLowerCase() !== key) return null;
  const bundle = JSON.parse(text) as InputBundle;
  const rows = await sql<{
    chain_id: number; symbol: string | null; tx_hash: string; credit_mark: string; carry_ltv: string;
    session_max_ltv: string; debt_ceiling: string; executable_depth1: string;
  }[]>`
    SELECT chain_id, symbol, tx_hash, credit_mark, carry_ltv, session_max_ltv, debt_ceiling, executable_depth1
    FROM terms_posts WHERE lower(inputs_hash) = ${key} ORDER BY ts DESC LIMIT 1`;
  const p = rows[0];
  if (!p) return null;
  const r = computeReport(bundle, engineConfigFromBundle(bundle));
  const wad = (d: DecString): bigint => toUnitsFloor(dec(d), 18);
  const loan = (d: DecString): bigint => toUnitsFloor(dec(d), 6);
  const checks: [string, bigint, bigint, boolean][] = [
    ["creditMark", BigInt(p.credit_mark), wad(r.mark.creditMark), false],
    ["carryLTV", BigInt(p.carry_ltv), wad(r.capacity.carryLTV), true],
    ["sessionMaxLTV", BigInt(p.session_max_ltv), wad(r.capacity.sessionMaxLTV), true],
    ["debtCeiling", BigInt(p.debt_ceiling), loan(r.capacity.debtCeiling), true],
    ["executableDepth1", BigInt(p.executable_depth1), loan(r.depth.C_1), false],
  ];
  const fields = checks.map(([field, posted, recomputed, mayClamp]) => ({
    field,
    verdict: posted === recomputed ? "matches" as const : mayClamp && posted < recomputed ? "clamped tighter onchain" as const : "differs" as const,
  }));
  const out: VerifyResult = {
    inputsHash: key, chainId: p.chain_id, symbol: p.symbol, tx: p.tx_hash, kts: String(bundle.kts ?? "0.1"),
    checkedAt: new Date(now).toISOString(), fields, ok: fields.every((f) => f.verdict !== "differs"),
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}
