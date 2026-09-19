import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { VenueSnapshot } from "../src/depth.js";

export interface V3Fixture {
  label: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  capturedAtBlock: string;
  snapshot: {
    pool: string; token0: string; token1: string; sqrtPriceX96: string; tick: number; liquidity: string; fee: number; tickSpacing: number;
    ticks: { tick: number; liquidityNet: string; liquidityGross: string }[]; bitmapWords: { lower: number; upper: number };
  };
  quoterV2: { zeroForOne: boolean; amountIn: string; amountOut: string; sqrtPriceX96After: string; ticksCrossed: number; error?: string }[];
}

const dir = resolve(__dirname, "../../../data/fixtures/v3math");

export function loadFixtures(): V3Fixture[] {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as V3Fixture);
}

export function fixture(label: string): V3Fixture {
  const f = loadFixtures().find((x) => x.label === label);
  if (!f) throw new Error(`no fixture ${label}`);
  return f;
}

export function venue(f: V3Fixture): VenueSnapshot {
  const s = f.snapshot;
  return {
    pool: s.pool, token0: s.token0, token1: s.token1, decimals0: f.decimals0, decimals1: f.decimals1, sqrtPriceX96: s.sqrtPriceX96,
    tick: s.tick, liquidity: s.liquidity, fee: s.fee, tickSpacing: s.tickSpacing, ticks: s.ticks, bitmapWords: s.bitmapWords,
  };
}
