import type { Address } from "viem";
import { getAddress } from "viem";
import { dec, fromUnits, toDecString, type DecString, type MarketCode, isMarketCode } from "@kerb/types";
import { parseJsonOk, type HttpFetcher, type RawHttp } from "./http.js";
import { erc20Abi, xStockTokenAbi, xStockWrapperAbi } from "./abi.js";
import type { AssetConfig } from "./config.js";
import type { AssetAdapter, AssetProfile } from "./types.js";
import type { PublicClient } from "viem";

export function xStocksBase(): string {
  return process.env["XSTOCKS_API_BASE"] ?? "https://api.xstocks.fi/api/v2/public";
}

export interface XStocksDeployment {
  address: string;
  network: string;
  wrapperAddressV2?: string;
  supportsAtomicSwaps?: boolean;
  stablecoins?: { symbol: string; address: string; decimals: number }[];
}

export interface XStocksAsset {
  id: string;
  name: string;
  symbol: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  underlying: { symbol: string; isin: string; currency: string; listingCountry: string };
  isTradingHalted: boolean;
  trading: {
    currency: string;
    tradingHoursMode: string;
    isTradingHalted: boolean;
    currentPeriod: string;
    openNow: boolean;
    nextChangeAt: string | null;
    exchange: { mic: string; abbreviation: string; name: string; timezone: string };
  };
  deployments: XStocksDeployment[];
}

export interface XStocksMultiplier {
  currentMultiplier: number | string;
  newMultiplier: number | string;
  activationDateTime: number | string;
  reason: string | null;
}

/** The API returns multipliers as JSON numbers; recover the exact text from the raw bytes. */
export function rawNumberField(body: string, field: string): string | null {
  const m = new RegExp(`"${field}"\\s*:\\s*("?)(-?[0-9]+(?:\\.[0-9]+)?(?:[eE][-+]?[0-9]+)?)\\1`).exec(body);
  return m?.[2] ?? null;
}

/** Normalise a JSON numeric literal (possibly exponent form) to a decimal string without floats. */
export function numericLiteralToDec(lit: string): DecString {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([-+]?\d+))?$/.exec(lit);
  if (!m) throw new Error(`bad numeric literal ${lit}`);
  const [, sign, int, frac = "", exp = "0"] = m;
  const digits = `${int}${frac}`;
  const point = (int as string).length + Number(exp);
  let s: string;
  if (point <= 0) s = `0.${"0".repeat(-point)}${digits}`;
  else if (point >= digits.length) s = `${digits}${"0".repeat(point - digits.length)}`;
  else s = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return toDecString(dec(`${sign}${s.replace(/^0+(?=\d)/, "")}`));
}

export class XStocksApi {
  constructor(private readonly http: HttpFetcher) {}

  async asset(symbol: string): Promise<{ raw: RawHttp; asset: XStocksAsset }> {
    const raw = await this.http.get(`${xStocksBase()}/assets/${encodeURIComponent(symbol)}`);
    return { raw, asset: parseJsonOk<XStocksAsset>(raw) };
  }

  async allAssets(): Promise<{ raws: RawHttp[]; assets: XStocksAsset[] }> {
    const raws: RawHttp[] = [];
    const assets: XStocksAsset[] = [];
    for (let page = 0; page < 50; page++) {
      const raw = await this.http.get(`${xStocksBase()}/assets?page=${page}`);
      const b = parseJsonOk<{ nodes: XStocksAsset[]; page: { hasNextPage: boolean } }>(raw);
      raws.push(raw);
      assets.push(...b.nodes);
      if (!b.page.hasNextPage) break;
    }
    return { raws, assets };
  }

  /** {"quote": 88.16}. Value in the xStocks trading currency (USD). */
  async priceData(symbol: string): Promise<{ raw: RawHttp; quote: DecString }> {
    const raw = await this.http.get(`${xStocksBase()}/assets/${encodeURIComponent(symbol)}/price-data`);
    parseJsonOk<{ quote: number }>(raw);
    const lit = rawNumberField(raw.body, "quote");
    if (lit === null) throw new Error(`no quote in ${raw.body.slice(0, 120)}`);
    return { raw, quote: numericLiteralToDec(lit) };
  }

  async multiplier(symbol: string, network = "XLayer"): Promise<{
    raw: RawHttp; current: DecString; next: DecString; activationDateTime: string; reason: string | null;
  }> {
    const raw = await this.http.get(`${xStocksBase()}/assets/${encodeURIComponent(symbol)}/multiplier?network=${network}`);
    const b = parseJsonOk<XStocksMultiplier>(raw);
    const cur = rawNumberField(raw.body, "currentMultiplier");
    const nxt = rawNumberField(raw.body, "newMultiplier");
    const act = rawNumberField(raw.body, "activationDateTime");
    if (cur === null || nxt === null) throw new Error(`bad multiplier payload ${raw.body.slice(0, 160)}`);
    return {
      raw,
      current: numericLiteralToDec(cur),
      next: numericLiteralToDec(nxt),
      activationDateTime: act ?? "0",
      reason: b.reason,
    };
  }
}

export function xLayerDeployment(a: XStocksAsset): XStocksDeployment | undefined {
  return a.deployments.find((d) => d.network === "XLayer");
}

export function marketFromXStocks(a: XStocksAsset): MarketCode {
  const mic = a.trading.exchange.mic;
  if (!isMarketCode(mic)) throw new Error(`${a.symbol}: unsupported market ${mic}`);
  return mic;
}

const WAD = 10n ** 18n;

/**
 * XStocksAdapter: builds the KTS-0.1 section 3.1 asset profile from the xStocks public
 * API (issuer data) plus the token and wrapper contracts on X Layer (chain truth).
 */
export class XStocksAdapter implements AssetAdapter {
  readonly id = "xstocks";
  private readonly api: XStocksApi;

  constructor(http: HttpFetcher, private readonly client: PublicClient) {
    this.api = new XStocksApi(http);
  }

  supports(a: AssetConfig): boolean {
    return a.issuer === "xstocks";
  }

  async profile(a: AssetConfig): Promise<AssetProfile> {
    const [{ raw: assetRaw, asset }, mult] = await Promise.all([
      this.api.asset(a.symbol),
      this.api.multiplier(a.symbol),
    ]);
    const dep = xLayerDeployment(asset);
    if (!dep) throw new Error(`${a.symbol}: no XLayer deployment in issuer data`);
    const token = getAddress(dep.address);
    if (token !== getAddress(a.token.address)) {
      throw new Error(`${a.symbol}: issuer token ${token} != config ${a.token.address}`);
    }
    const block = await this.client.getBlockNumber();
    const reads = await this.client.multicall({
      blockNumber: block,
      allowFailure: true,
      contracts: [
        { address: token, abi: erc20Abi, functionName: "decimals" },
        { address: token, abi: erc20Abi, functionName: "symbol" },
        { address: token, abi: xStockTokenAbi, functionName: "multiplier" },
        { address: token, abi: xStockTokenAbi, functionName: "paused" },
      ],
    });
    const [decR, symR, multR, pausedR] = reads;
    if (decR?.status !== "success" || symR?.status !== "success" || multR?.status !== "success") {
      throw new Error(`${a.symbol}: token reads failed`);
    }

    let wrapper: AssetProfile["wrapper"] = null;
    const wAddr = dep.wrapperAddressV2 ? getAddress(dep.wrapperAddressV2) : null;
    if (wAddr) {
      const w = await this.client.multicall({
        blockNumber: block,
        allowFailure: true,
        contracts: [
          { address: wAddr, abi: xStockWrapperAbi, functionName: "asset" },
          { address: wAddr, abi: xStockWrapperAbi, functionName: "convertToAssets", args: [WAD] },
          { address: wAddr, abi: erc20Abi, functionName: "symbol" },
          { address: wAddr, abi: erc20Abi, functionName: "decimals" },
        ],
      });
      const [assetR, convR, wSymR, wDecR] = w;
      if (assetR?.status !== "success" || convR?.status !== "success" || wSymR?.status !== "success" || wDecR?.status !== "success") {
        throw new Error(`${a.symbol}: wrapper reads failed`);
      }
      if (getAddress(assetR.result) !== token) throw new Error(`${a.symbol}: wrapper.asset() != token`);
      wrapper = {
        address: wAddr,
        type: "xstocks-wrapper",
        version: "v2",
        symbol: wSymR.result,
        decimals: wDecR.result,
        assetsPerShare: fromUnits(convR.result, 18),
      };
    }

    const activation = Number(mult.activationDateTime);
    const pending = !dec(mult.next).isZero() && activation > 0;

    return {
      adapter: this.id,
      chainId: 196,
      symbol: symR.result,
      name: asset.name,
      token,
      decimals: decR.result,
      wrapper,
      underlying: {
        symbol: asset.underlying.symbol,
        isin: asset.underlying.isin,
        currency: asset.underlying.currency,
        listingCountry: asset.underlying.listingCountry,
        market: marketFromXStocks(asset),
        exchangeTimezone: asset.trading.exchange.timezone,
      },
      corporateActionMethod: "multiplier",
      multiplier: {
        onchain: fromUnits(multR.result, 18),
        issuer: mult.current,
        pending: pending
          ? { value: mult.next, activatesAt: new Date(activation * (activation < 1e12 ? 1000 : 1)).toISOString(), reason: mult.reason }
          : null,
      },
      halted: {
        issuer: asset.isTradingHalted || asset.trading.isTradingHalted,
        tokenPaused: pausedR?.status === "success" ? pausedR.result : null,
      },
      issuerSession: {
        mode: asset.trading.tradingHoursMode,
        currentPeriod: asset.trading.currentPeriod,
        openNow: asset.trading.openNow,
        nextChangeAt: asset.trading.nextChangeAt,
      },
      observedAt: new Date().toISOString(),
      observedAtBlock: block.toString(),
      sources: [
        { label: "Observed", source: "xstocks:assets", at: assetRaw.fetchedAt },
        { label: "Observed", source: "xstocks:multiplier", at: mult.raw.fetchedAt },
        { label: "Verified", source: `xlayer:196:block:${block}`, at: new Date().toISOString() },
      ],
    };
  }
}

export function toMultiplierDec(raw: bigint): DecString {
  return fromUnits(raw, 18);
}

export type { Address };
