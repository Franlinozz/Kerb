import { getAddress, type Address, type Hex, type PublicClient } from "viem";
import { tickLensAbi, uniV3PoolAbi } from "./abi.js";
import { UNISWAP_V3_XLAYER } from "./uniswap.js";

/**
 * Everything KTS-0.1 section 3.4 requires to simulate a sale against a Uniswap V3 pool,
 * read at a single pinned block so the snapshot is internally consistent.
 * All integers are decimal strings so the snapshot is JSON- and hash-stable.
 */
export interface PoolSnapshot {
  kind: "uniswap-v3-pool-snapshot";
  version: 1;
  chainId: number;
  pool: Address;
  blockNumber: string;
  blockHash: Hex;
  blockTimestamp: string;
  token0: Address;
  token1: Address;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  observationCardinality: number;
  /** Tick cumulatives at [twapWindowSec, 0] seconds ago, when the oracle has enough history. */
  twap: { windowSec: number; tickCumulatives: [string, string] } | { windowSec: number; error: string };
  /** Tick range for which every initialised tick is included. Outside it, state is unknown. */
  coveredTicks: { lower: number; upper: number };
  bitmapWords: { lower: number; upper: number };
  /** Initialised ticks within coveredTicks, ascending. */
  ticks: { tick: number; liquidityNet: string; liquidityGross: string }[];
}

export interface ReadPoolOptions {
  /** Fractional price move to cover on each side, e.g. 0.3 means at least -30% and +30%. */
  rangePct: number;
  twapWindowSec: number;
  blockNumber?: bigint;
}

const LN_1_0001 = Math.log(1.0001);

/**
 * Tick distance for a price move. This is an I/O bound, not a value path: it only decides
 * how many bitmap words to read, and is rounded outward.
 */
export function tickDelta(rangePct: number): number {
  if (!(rangePct > 0 && rangePct < 1)) throw new Error("rangePct must be in (0,1)");
  const down = -Math.log(1 - rangePct) / LN_1_0001;
  const up = Math.log(1 + rangePct) / LN_1_0001;
  return Math.ceil(Math.max(down, up));
}

/** Floor division that matches Solidity's compressed-tick semantics for negative ticks. */
export function compress(tick: number, spacing: number): number {
  return Math.floor(tick / spacing);
}

export function wordOf(tick: number, spacing: number): number {
  return compress(tick, spacing) >> 8;
}

export async function readPoolSnapshot(client: PublicClient, poolAddr: Address, opts: ReadPoolOptions): Promise<PoolSnapshot> {
  const pool = getAddress(poolAddr);
  const blockNumber = opts.blockNumber ?? (await client.getBlockNumber());
  const block = await client.getBlock({ blockNumber });
  const chainId = client.chain?.id;
  if (chainId === undefined) throw new Error("client has no chain");

  const base = { address: pool, abi: uniV3PoolAbi } as const;
  const [slot0, liquidity, tickSpacing, fee, token0, token1] = await client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: [
      { ...base, functionName: "slot0" },
      { ...base, functionName: "liquidity" },
      { ...base, functionName: "tickSpacing" },
      { ...base, functionName: "fee" },
      { ...base, functionName: "token0" },
      { ...base, functionName: "token1" },
    ],
  });

  const [sqrtPriceX96, tick, , observationCardinality] = slot0;
  const spacing = Number(tickSpacing);
  const d = tickDelta(opts.rangePct);
  const wLo = wordOf(tick - d, spacing);
  const wHi = wordOf(tick + d, spacing);

  const wordIdx: number[] = [];
  for (let w = wLo; w <= wHi; w++) wordIdx.push(w);
  const words = await client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: wordIdx.map((w) => ({
      address: UNISWAP_V3_XLAYER.tickLens,
      abi: tickLensAbi,
      functionName: "getPopulatedTicksInWord" as const,
      args: [pool, w] as const,
    })),
  });

  const ticks = words
    .flat()
    .map((t) => ({ tick: Number(t.tick), liquidityNet: t.liquidityNet.toString(), liquidityGross: t.liquidityGross.toString() }))
    .sort((a, b) => a.tick - b.tick);

  let twap: PoolSnapshot["twap"];
  try {
    const [cums] = await client.readContract({
      ...base,
      functionName: "observe",
      args: [[opts.twapWindowSec, 0]],
      blockNumber,
    });
    twap = { windowSec: opts.twapWindowSec, tickCumulatives: [String(cums[0]), String(cums[1])] };
  } catch (e) {
    twap = { windowSec: opts.twapWindowSec, error: shortErr(e) };
  }

  return {
    kind: "uniswap-v3-pool-snapshot",
    version: 1,
    chainId,
    pool,
    blockNumber: blockNumber.toString(),
    blockHash: block.hash,
    blockTimestamp: block.timestamp.toString(),
    token0: getAddress(token0),
    token1: getAddress(token1),
    fee: Number(fee),
    tickSpacing: spacing,
    sqrtPriceX96: sqrtPriceX96.toString(),
    tick,
    liquidity: liquidity.toString(),
    observationCardinality,
    twap,
    coveredTicks: { lower: wLo * 256 * spacing, upper: (wHi + 1) * 256 * spacing - 1 },
    bitmapWords: { lower: wLo, upper: wHi },
    ticks,
  };
}

function shortErr(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return (m.split("\n")[0] ?? m).slice(0, 200);
}
