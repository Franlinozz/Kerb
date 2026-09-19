import { getAddress, type PublicClient } from "viem";
import {
  LiveHttp, XStocksApi, erc20Abi, publicClient, pythLatest, readPoolSnapshot, xStockTokenAbi, xStockWrapperAbi,
  type AssetConfig, type HttpFetcher, yahooQuote,
} from "@kerb/adapters";
import { canonicalJson, fromUnits } from "@kerb/types";
import type { Providers } from "./types.js";

export const POOL_RANGE_PCT = 0.3;
export const TWAP_WINDOW_SEC = 900;
const WAD = 10n ** 18n;

export function httpProviders(http: HttpFetcher, client: PublicClient, mode: Providers["mode"]): Providers {
  const api = new XStocksApi(http);
  return {
    mode,
    pythEnabled: Boolean(process.env["PYTH_API_KEY"]),
    blockNumber: () => client.getBlockNumber(),
    poolSnapshot: (pool, blockNumber) => readPoolSnapshot(client, pool.address, { rangePct: POOL_RANGE_PCT, twapWindowSec: TWAP_WINDOW_SEC, blockNumber }),
    xstocksPrice: (symbol) => api.priceData(symbol),
    xstocksMultiplier: (symbol) => api.multiplier(symbol),
    xstocksAsset: async (symbol) => {
      const { raw, asset } = await api.asset(symbol);
      return { raw, halted: asset.isTradingHalted || asset.trading.isTradingHalted };
    },
    pyth: (ids) => pythLatest(http, ids),
    yahoo: async (symbol) => {
      const q = await yahooQuote(http, symbol);
      return { raw: q.raw, price: q.price, currency: q.meta.currency, marketTime: q.meta.regularMarketTime };
    },
    onchainMultiplier: async (a: AssetConfig, blockNumber: bigint) => {
      const token = getAddress(a.token.address);
      const block = await client.getBlock({ blockNumber });
      const calls = [
        { address: token, abi: xStockTokenAbi, functionName: "multiplier" as const },
        { address: token, abi: xStockTokenAbi, functionName: "paused" as const },
        { address: token, abi: erc20Abi, functionName: "totalSupply" as const },
      ];
      const [m, p, ts] = await client.multicall({ blockNumber, allowFailure: true, contracts: calls });
      if (m?.status !== "success") throw new Error(`${a.symbol}: multiplier() failed`);
      let conv: bigint | null = null;
      if (a.wrapper) {
        conv = await client.readContract({ address: a.wrapper.address, abi: xStockWrapperAbi, functionName: "convertToAssets", args: [WAD], blockNumber });
      }
      const paused = p?.status === "success" ? (p.result as boolean) : null;
      const raw = canonicalJson({
        chainId: 196, blockNumber, blockHash: block.hash, token, wrapper: a.wrapper?.address ?? null,
        calls: {
          "multiplier()": (m.result as bigint).toString(),
          "paused()": p?.status === "success" ? String(p.result) : `error:${p?.error?.name ?? "unknown"}`,
          "totalSupply()": ts?.status === "success" ? (ts.result as bigint).toString() : null,
          "wrapper.convertToAssets(1e18)": conv === null ? null : conv.toString(),
        },
      });
      return {
        blockNumber: blockNumber.toString(),
        blockHash: block.hash,
        multiplier: fromUnits(m.result as bigint, 18),
        wrapperAssetsPerShare: conv === null ? null : fromUnits(conv, 18),
        paused,
        raw,
      };
    },
  };
}

export function liveProviders(): Providers {
  return httpProviders(new LiveHttp(25_000), publicClient(196), "live");
}
