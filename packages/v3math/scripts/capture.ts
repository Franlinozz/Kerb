/**
 * Capture v3math test fixtures from X Layer at ONE pinned block: pool snapshots plus
 * QuoterV2.quoteExactInputSingle results for both directions at several sizes. The tests
 * then check the offline simulation against the chain's own quoter.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAbi, type Address } from "viem";
import { UNISWAP_V3_XLAYER, erc20Abi, loadAssets, publicClient, readPoolSnapshot, repoRoot } from "@kerb/adapters";
import { Decimal, toUnitsFloor } from "@kerb/types";

const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const client = publicClient(196);
const cfg = loadAssets();
const wanted = new Map<string, string>();
for (const a of cfg.assets) if (a.pool) wanted.set(a.pool.address, `${a.symbol}/${a.quoteToken}`);
for (const a of cfg.assets) for (const v of a.venues) if (!wanted.has(v.address)) wanted.set(v.address, `${a.symbol}/${v.quote}`);
for (const r of cfg.routes) wanted.set(r.pool.address, `${r.from}/${r.to}`);

const block = await client.getBlockNumber();
const out = resolve(repoRoot(), "data/fixtures/v3math");
mkdirSync(out, { recursive: true });
const USD_SIZES = ["10", "1000", "5000", "20000", "60000"];

for (const [pool, label] of wanted) {
  const snap = await readPoolSnapshot(client, pool as Address, { rangePct: 0.6, twapWindowSec: 900, blockNumber: block });
  const [d0, d1, s0, s1] = await Promise.all([
    client.readContract({ address: snap.token0, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
    client.readContract({ address: snap.token1, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
    client.readContract({ address: snap.token0, abi: erc20Abi, functionName: "symbol", blockNumber: block }),
    client.readContract({ address: snap.token1, abi: erc20Abi, functionName: "symbol", blockNumber: block }),
  ]);
  // Rough USD value of one token for choosing test sizes only (not a value path).
  const sp = new Decimal(snap.sqrtPriceX96).div(new Decimal(2).pow(96));
  const p01 = sp.mul(sp).mul(new Decimal(10).pow(d0 - d1));
  const usdPer = (sym: string, is0: boolean): Decimal => {
    const stable = (s: string) => ["USDG", "USDC"].includes(s);
    if (stable(sym)) return new Decimal(1);
    const other = is0 ? s1 : s0;
    const inOther = is0 ? p01 : new Decimal(1).div(p01);
    return stable(other) ? inOther : inOther.mul(4000); // xETH pairs: order-of-magnitude only
  };
  const quotes: { zeroForOne: boolean; amountIn: string; amountOut: string; sqrtPriceX96After: string; ticksCrossed: number; error?: string }[] = [];
  for (const zeroForOne of [true, false]) {
    const [tin, tout, dIn, sIn] = zeroForOne ? [snap.token0, snap.token1, d0, s0] : [snap.token1, snap.token0, d1, s1];
    for (const usd of USD_SIZES) {
      const amt = toUnitsFloor(new Decimal(usd).div(usdPer(sIn, zeroForOne)), dIn);
      if (amt === 0n) continue;
      try {
        const { result } = await client.simulateContract({
          address: UNISWAP_V3_XLAYER.quoterV2, abi: quoterAbi, functionName: "quoteExactInputSingle",
          args: [{ tokenIn: tin, tokenOut: tout, amountIn: amt, fee: snap.fee, sqrtPriceLimitX96: 0n }], blockNumber: block,
        });
        quotes.push({ zeroForOne, amountIn: amt.toString(), amountOut: result[0].toString(), sqrtPriceX96After: result[1].toString(), ticksCrossed: Number(result[2]) });
      } catch (e) {
        quotes.push({ zeroForOne, amountIn: amt.toString(), amountOut: "", sqrtPriceX96After: "", ticksCrossed: 0, error: ((e as Error).message.split("\n")[0] ?? "").slice(0, 160) });
      }
    }
  }
  const fx = { label, symbol0: s0, symbol1: s1, decimals0: d0, decimals1: d1, capturedAtBlock: block.toString(), snapshot: snap, quoterV2: quotes };
  writeFileSync(resolve(out, `${label.replace("/", "-")}.json`), `${JSON.stringify(fx, null, 2)}\n`);
  console.log(`${label.padEnd(12)} ${pool} ticks=${snap.ticks.length} quotes=${quotes.filter((q) => !q.error).length}/${quotes.length}`);
}
console.log(`captured at block ${block}`);
