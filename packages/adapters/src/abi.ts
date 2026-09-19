import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

/** Backed / xStocks token surface used by Kerb. multiplier() is the rebasing factor, 1e18 scaled. */
export const xStockTokenAbi = parseAbi([
  "function multiplier() view returns (uint256)",
  "function paused() view returns (bool)",
]);

/** xStocks WrapperV2 (ERC-4626 style, non-rebasing). */
export const xStockWrapperAbi = parseAbi([
  "function asset() view returns (address)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
]);

export const uniV3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

export const uniV3PoolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
  "function factory() view returns (address)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function tickBitmap(int16 wordPosition) view returns (uint256)",
  "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
]);

export const tickLensAbi = parseAbi([
  "struct PopulatedTick { int24 tick; int128 liquidityNet; uint128 liquidityGross; }",
  "function getPopulatedTicksInWord(address pool, int16 tickBitmapIndex) view returns (PopulatedTick[] populatedTicks)",
]);
