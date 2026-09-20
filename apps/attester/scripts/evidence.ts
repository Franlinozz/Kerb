/**
 * Onchain evidence: the Terms transactions Kerb has sent, one decoded Builder Code straight
 * from calldata, and the poster's gas burn rate measured from actual fees paid.
 */
import { formatEther, type Hex } from "viem";
import { explorerTx, publicClient, type KerbChainId } from "@kerb/adapters";
import { connect } from "@kerb/collector/db";
import { decodeBuilderCode } from "../src/builder-code.js";
import { deploymentOf } from "../src/chain.js";

const chainId = Number(process.argv[2] ?? 1952) as KerbChainId;
const limit = Number(process.argv[3] ?? 10);
const client = publicClient(chainId);
const { sql } = connect();

const REGIMES = ["DEEP", "NORMAL", "THIN", "PRE_TRANSITION", "REFERENCE_CLOSED", "ACTION", "HALTED", "STALE", "RECOVERY"];
const rows = await sql<{ ts: Date; symbol: string; tx_hash: string; block_number: string; regime: number; inputs_hash: string; bundle_cid: string; pin_status: string; gas_used: string; fee_wei: string }[]>`
  SELECT ts, symbol, tx_hash, block_number, regime, inputs_hash, bundle_cid, pin_status, gas_used, fee_wei
  FROM terms_posts WHERE chain_id = ${chainId} ORDER BY ts ASC LIMIT ${limit}`;

console.log(`KerbTerms ${deploymentOf(chainId, "KerbTerms").address} on chain ${chainId}`);
console.log(`\nFirst ${rows.length} TermsPosted transactions`);
for (const r of rows) {
  console.log(`${new Date(r.ts).toISOString()}  ${r.symbol.padEnd(7)} ${(REGIMES[r.regime] ?? "?").padEnd(16)} block ${r.block_number}  gas ${r.gas_used}`);
  console.log(`   inputsHash ${r.inputs_hash}`);
  console.log(`   bundle     ${r.bundle_cid} (${r.pin_status})`);
  console.log(`   ${explorerTx(chainId, r.tx_hash as Hex)}`);
}

const first = rows[0];
if (first) {
  const tx = await client.getTransaction({ hash: first.tx_hash as Hex });
  const codes = decodeBuilderCode(tx.input);
  console.log(`\nBuilder Code decoded from ${first.tx_hash}`);
  console.log(`   calldata tail ${tx.input.slice(-44)}`);
  console.log(`   codes         ${codes.length ? codes.join(", ") : "(none)"}`);
}

const [burn] = await sql<{ posts: string; fee: string; first: Date; last: Date }[]>`
  SELECT count(*) AS posts, coalesce(sum(fee_wei), 0) AS fee, min(ts) AS first, max(ts) AS last
  FROM terms_posts WHERE chain_id = ${chainId}`;
if (burn && Number(burn.posts) > 0) {
  const hours = Math.max(0.25, (new Date(burn.last).getTime() - new Date(burn.first).getTime()) / 3_600_000);
  const perDay = (BigInt(burn.fee) * 24n * 100n) / BigInt(Math.max(1, Math.round(hours * 100)));
  const poster = process.env["KERB_POSTER_ADDRESS"] as Hex;
  console.log(`\nposts ${burn.posts} over ${hours.toFixed(2)}h, fees ${formatEther(BigInt(burn.fee))} OKB`);
  console.log(`burn rate ~${formatEther(perDay)} OKB/day at the observed cadence`);
  if (poster) {
    const bal = await client.getBalance({ address: poster });
    const days = perDay > 0n ? Number((bal * 1000n) / perDay) / 1000 : Infinity;
    console.log(`poster ${poster} balance ${formatEther(bal)} OKB (~${days.toFixed(0)} days at this rate)`);
  }
}
await sql.end();
