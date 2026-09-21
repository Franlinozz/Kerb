/**
 * Pool token balances at a moment in time, so a window capture can report the change in what is
 * actually sitting in each pool, not only what the tick walk says is executable.
 *
 * Balances are read straight from the token contracts. No price is applied here: a balance is a
 * measurement, and converting it to dollars is a separate claim with its own inputs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { erc20Abi, type Address } from "viem";
import { loadAssets, publicClient, repoRoot, resolvedAssets } from "@kerb/adapters";

const label = process.argv[2] ?? "balances";
const client = publicClient(196);
const cfg = loadAssets();
const assets = resolvedAssets(cfg);

const pools = new Map<string, { pool: Address; symbol: string | null; token0: Address; token1: Address }>();
for (const a of assets) {
  if (!a.pool) continue;
  pools.set(a.pool.address.toLowerCase(), {
    pool: a.pool.address as Address,
    symbol: a.symbol,
    token0: a.pool.token0 as Address,
    token1: a.pool.token1 as Address,
  });
}
// Route legs are a list of {from, to, pool}: a multi-hop sale passes through them, so their
// balances belong in the same capture as the asset pools.
for (const r of (cfg.routes ?? []) as { from?: string; to?: string; pool?: { address?: string; token0?: string; token1?: string } }[]) {
  const pool = r.pool;
  if (!pool?.address || !pool.token0 || !pool.token1) continue;
  if (pools.has(pool.address.toLowerCase())) continue;
  pools.set(pool.address.toLowerCase(), {
    pool: pool.address as Address,
    symbol: r.from && r.to ? `${r.from}/${r.to}` : null,
    token0: pool.token0 as Address,
    token1: pool.token1 as Address,
  });
}

const block = await client.getBlockNumber();
const rows: Record<string, unknown>[] = [];
for (const p of pools.values()) {
  try {
    const [b0, b1, d0, d1] = await Promise.all([
      client.readContract({ address: p.token0, abi: erc20Abi, functionName: "balanceOf", args: [p.pool], blockNumber: block }),
      client.readContract({ address: p.token1, abi: erc20Abi, functionName: "balanceOf", args: [p.pool], blockNumber: block }),
      client.readContract({ address: p.token0, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
      client.readContract({ address: p.token1, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
    ]);
    rows.push({
      pool: p.pool, symbol: p.symbol,
      token0: p.token0, balance0: b0.toString(), decimals0: d0,
      token1: p.token1, balance1: b1.toString(), decimals1: d1,
    });
  } catch (err) {
    rows.push({ pool: p.pool, symbol: p.symbol, error: err instanceof Error ? err.message.slice(0, 120) : String(err) });
  }
}

const out = {
  label,
  capturedAt: new Date().toISOString(),
  chainId: 196,
  blockNumber: block.toString(),
  note: "Raw token balances held by each pool contract, read at the block above. No price is applied.",
  pools: rows,
};
const dir = resolve(repoRoot(), "data/windows");
mkdirSync(dir, { recursive: true });
const path = resolve(dir, `balances-${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${path}  (block ${block}, ${rows.length} pools, ${rows.filter((r) => r["error"]).length} failed)`);
