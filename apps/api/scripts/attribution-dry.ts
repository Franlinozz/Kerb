/** Print the attribution for one asset's consecutive posts between two times, without writing. */
import { connect } from "@kerb/collector/db";
import { attribute, explainNow } from "@kerb/engine";
import { sideOf, type PostRow } from "../src/attribution.js";
const [symbol = "KOx", from = "2026-09-21T19:25:00Z", to = "2026-09-21T20:15:00Z"] = process.argv.slice(2);
const { sql } = connect();
const rows = await sql<PostRow[]>`SELECT id, ts, chain_id, symbol, tx_hash, inputs_hash, regime, carry_ltv, session_max_ltv, debt_ceiling, clamped FROM terms_posts WHERE chain_id = 196 AND symbol = ${symbol} AND ts BETWEEN ${from} AND ${to} ORDER BY id`;
const t0 = Date.now();
for (let i = 1; i < rows.length; i++) {
  for (const c of attribute(sideOf(rows[i - 1]!), sideOf(rows[i]!))) console.log(`${new Date(rows[i]!.ts).toISOString().slice(0, 16)} ${c.field} ${c.delta ?? ""}\n  ${c.headline}\n  causes: ${c.causes.map((x) => `${x.kind} ${x.contribution}`).join(", ")}${c.residual ? `  residual ${c.residual}` : ""}`);
}
const last = rows[rows.length - 1];
if (last) for (const s of explainNow(sideOf(last))) console.log(`NOW ${s.field}: ${s.sentence}`);
console.log(`${rows.length} posts in ${Date.now() - t0} ms`);
await sql.end();
