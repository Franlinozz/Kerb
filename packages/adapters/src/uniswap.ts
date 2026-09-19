import type { Address } from "viem";

/** Uniswap v3 on X Layer (196), from developers.uniswap.org/docs/protocols/v3/deployments/v3-xlayer-deployments. */
export const UNISWAP_V3_XLAYER = {
  factory: "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804",
  tickLens: "0x661e93cca42afacb172121ef892830ca3b70f08d",
  quoterV2: "0xd1b797d92d87b688193a2b976efc8d577d204343",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
} as const satisfies Record<string, Address>;

export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;
