/**
 * Term attribution plumbing (V3-04): turn posted rows and their stored input bundles into the
 * engine's PostSide, and run the incremental job that appends term_changes. Pure engine code does
 * the attribution (@kerb/engine attribute, explainNow); this module only reads.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";
import type { Sql } from "@kerb/collector/db";
import { attribute, computeReport, engineConfigFromBundle, type Change, type InputBundle, type PostSide, type Report } from "@kerb/engine";
import { fromUnits, keccakText, regimeName, type DecString } from "@kerb/types";

const BUNDLE_DIR = process.env["KERB_BUNDLE_DIR"] ?? resolve(repoRoot(), "data/reports/bundles");

export interface PostRow {
  id: string; ts: Date; chain_id: number; symbol: string; tx_hash: string; inputs_hash: string; regime: number;
  carry_ltv: string; session_max_ltv: string; debt_ceiling: string; clamped: { field: string; from: string; to: string }[] | null;
}

interface Loaded { report: Report | null; kts: string; ceilingK: DecString | null; referenceSize: DecString | null }
const cache = new Map<string, Loaded>();

/** The report of a stored bundle, only if its bytes hash to the posted inputsHash. */
export function loadBundle(inputsHash: string): Loaded {
  const key = inputsHash.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const path = resolve(BUNDLE_DIR, `${key}.json`);
  let out: Loaded = { report: null, kts: "unknown", ceilingK: null, referenceSize: null };
  if (existsSync(path)) {
    const text = readFileSync(path, "utf8");
    if (keccakText(text).toLowerCase() === key) {
      const b = JSON.parse(text) as InputBundle & { config: { capacity?: { k?: DecString; referenceLiquidationSize?: DecString } } };
      const report = computeReport(b, engineConfigFromBundle(b));
      out = { report, kts: String(b.kts ?? "0.1"), ceilingK: b.config.capacity?.k ?? null, referenceSize: b.config.capacity?.referenceLiquidationSize ?? null };
    }
  }
  cache.set(key, out);
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  return out;
}

export function sideOf(row: PostRow, loanDecimals = 6): PostSide {
  const l = loadBundle(row.inputs_hash);
  return {
    at: new Date(row.ts).toISOString(),
    tx: row.tx_hash,
    inputsHash: row.inputs_hash,
    kts: l.kts,
    posted: {
      carryLTV: fromUnits(BigInt(row.carry_ltv), 18),
      sessionMaxLTV: fromUnits(BigInt(row.session_max_ltv), 18),
      debtCeiling: fromUnits(BigInt(row.debt_ceiling), loanDecimals),
      regime: regimeName(row.regime),
    },
    report: l.report,
    attesterClamps: Array.isArray(row.clamped) ? row.clamped : null,
    ceilingK: l.ceilingK,
    referenceSize: l.referenceSize,
  };
}

const COLS = "id, ts, chain_id, symbol, tx_hash, inputs_hash, regime, carry_ltv, session_max_ltv, debt_ceiling, clamped";

/**
 * Append the changes for every post after the last one already attributed, per asset. A post
 * whose predecessor is the same bundle (a repost) is skipped. Returns the number of rows added.
 */
const cursor = new Map<string, bigint>();

export async function attributeNewPosts(sql: Sql, chainId = 196, log: (s: string) => void = () => {}): Promise<number> {
  const symbols = await sql<{ symbol: string }[]>`SELECT DISTINCT symbol FROM terms_posts WHERE chain_id = ${chainId}`;
  let added = 0;
  for (const { symbol } of symbols) {
    const [last] = await sql<{ id: string | null }[]>`SELECT max(next_post_id)::text AS id FROM term_changes WHERE chain_id = ${chainId} AND symbol = ${symbol}`;
    const mem = cursor.get(`${chainId}:${symbol}`) ?? 0n;
    const db = BigInt(last?.id ?? "0");
    const after = (mem > db ? mem : db).toString();
    // Include the last attributed post so the next pair has its predecessor.
    const rows = await sql.unsafe<PostRow[]>(`SELECT ${COLS} FROM terms_posts WHERE chain_id = $1 AND symbol = $2 AND id >= $3 ORDER BY id LIMIT 600`, [chainId, symbol, after]);
    for (let i = 1; i < rows.length; i++) {
      const P = rows[i - 1] as PostRow, N = rows[i] as PostRow;
      if (P.inputs_hash === N.inputs_hash) continue;
      let changes: Change[];
      try { changes = attribute(sideOf(P), sideOf(N)); } catch (e) { log(`${symbol} ${N.tx_hash}: ${e instanceof Error ? e.message : String(e)}`); continue; }
      for (const c of changes) {
        const r = await sql`INSERT INTO term_changes (chain_id, symbol, at, field, from_value, to_value, delta, headline, causes, residual, prev_post_id, next_post_id, prev_tx, next_tx, prev_inputs_hash, next_inputs_hash)
          VALUES (${chainId}, ${symbol}, ${N.ts}, ${c.field}, ${c.from}, ${c.to}, ${c.delta}, ${c.headline}, ${JSON.stringify(c.causes)}::jsonb, ${c.residual}, ${P.id}, ${N.id}, ${P.tx_hash}, ${N.tx_hash}, ${P.inputs_hash}, ${N.inputs_hash})
          ON CONFLICT (chain_id, next_tx, field) DO NOTHING`;
        added += r.count;
      }
    }
    const lastRow = rows[rows.length - 1];
    if (lastRow) cursor.set(`${chainId}:${symbol}`, BigInt(lastRow.id));
  }
  return added;
}
