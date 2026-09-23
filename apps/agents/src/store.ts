/**
 * Payment evidence (SPEC-AGENTS.md section 6): one append-only row per settled call in
 * agent_calls (same triggers as the observation store) and one line in data/agents/payments.jsonl.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { repoRoot } from "@kerb/adapters";

export interface PaidCall {
  route: string; network: string; payer: string | null; amount: string; currency: string;
  settlementTx: string | null; responseSha256: string; inputsHash: string | null; asOf: string | null;
}
export interface CallStore { record(c: PaidCall): Promise<void> }

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

export function callStore(sql: Sql | null, file = resolve(repoRoot(), "data/agents/payments.jsonl")): CallStore {
  mkdirSync(dirname(file), { recursive: true });
  return {
    async record(c) {
      appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...c })}\n`);
      if (sql) {
        await sql`INSERT INTO agent_calls (route, network, payer, amount, currency, settlement_tx, response_sha256, inputs_hash, as_of)
          VALUES (${c.route}, ${c.network}, ${c.payer}, ${c.amount}, ${c.currency}, ${c.settlementTx}, ${c.responseSha256}, ${c.inputsHash}, ${c.asOf})`;
      }
    },
  };
}
