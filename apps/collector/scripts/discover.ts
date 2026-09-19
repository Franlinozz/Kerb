/**
 * K-03 asset discovery. Reads targets from config/assets.json, resolves each through the
 * issuer API, then confirms every candidate pool onchain by reading token0(), token1(),
 * fee(), tickSpacing(), slot0(), liquidity() and factory(). Writes config/assets.json.
 * Never invents an address: anything that cannot be confirmed is marked unresolved.
 */
import { writeFileSync } from "node:fs";
import { getAddress, zeroAddress, type Address } from "viem";
import {
  LiveHttp, XStocksApi, UNISWAP_V3_XLAYER, assetsPath, erc20Abi, explorerAddress, explorerToken,
  hermesBase, loadAssets, marketFromXStocks, parseJsonOk, publicClient, uniV3FactoryAbi, uniV3PoolAbi,
  xLayerDeployment, yahooQuote, yahooSymbol, type AssetConfig, type AssetsFile, type PoolRef, type ReferenceFeed, type RouteConfig,
} from "@kerb/adapters";

const client = publicClient(196);
const http = new LiveHttp(30_000);
const api = new XStocksApi(http);
const file: AssetsFile = loadAssets();
const factory = getAddress(file.discovery.factory);
if (factory !== getAddress(UNISWAP_V3_XLAYER.factory)) throw new Error("factory mismatch with Uniswap deployments");

const block = await client.getBlockNumber();
const now = new Date().toISOString();
console.log(`discovery at block ${block} (${now})`);

// 1. Confirm quote tokens onchain.
for (const [sym, q] of Object.entries(file.quoteTokens)) {
  const [s, d] = await Promise.all([
    client.readContract({ address: q.address, abi: erc20Abi, functionName: "symbol", blockNumber: block }),
    client.readContract({ address: q.address, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
  ]);
  if (s !== sym || d !== q.decimals) throw new Error(`quote ${sym}: onchain symbol=${s} decimals=${d} disagree with config`);
  q.address = getAddress(q.address);
  console.log(`quote ${sym} ${q.address} confirmed (decimals ${d})`);
}

async function poolAt(tokenA: Address, tokenB: Address, fee: number): Promise<Address | null> {
  const p = await client.readContract({ address: factory, abi: uniV3FactoryAbi, functionName: "getPool", args: [tokenA, tokenB, fee], blockNumber: block });
  return p === zeroAddress ? null : getAddress(p);
}

async function confirmPool(addr: Address, asset: Address, quoteSym: string, quote: Address, fee: number): Promise<PoolRef> {
  const base = { address: addr, abi: uniV3PoolAbi } as const;
  const [t0, t1, f, ts, liq, fac, slot0] = await client.multicall({
    blockNumber: block,
    allowFailure: false,
    contracts: [
      { ...base, functionName: "token0" }, { ...base, functionName: "token1" }, { ...base, functionName: "fee" },
      { ...base, functionName: "tickSpacing" }, { ...base, functionName: "liquidity" }, { ...base, functionName: "factory" },
      { ...base, functionName: "slot0" },
    ],
  });
  const pair = new Set([getAddress(t0), getAddress(t1)]);
  if (!pair.has(getAddress(asset)) || !pair.has(getAddress(quote))) throw new Error(`pool ${addr} tokens ${t0}/${t1} do not match`);
  if (Number(f) !== fee) throw new Error(`pool ${addr} fee ${f} != ${fee}`);
  if (getAddress(fac) !== factory) throw new Error(`pool ${addr} factory ${fac} is not Uniswap v3`);
  if (slot0[0] === 0n) throw new Error(`pool ${addr} is not initialised`);
  return {
    dex: "uniswap-v3", address: addr, fee, tickSpacing: Number(ts), token0: getAddress(t0), token1: getAddress(t1),
    quote: quoteSym, liquidityAtDiscovery: liq.toString(), explorer: explorerAddress(196, addr),
  };
}

// 2. Pyth feed catalogue for independent references.
const pythCatalogue = parseJsonOk<{ id: string; attributes: Record<string, string> }[]>(
  await http.get(`${hermesBase()}/v2/price_feeds?asset_type=equity`),
);
const fxCatalogue = parseJsonOk<{ id: string; attributes: Record<string, string> }[]>(
  await http.get(`${hermesBase()}/v2/price_feeds?asset_type=fx`),
);

function pythFor(listingCountry: string, underlying: string, currency: string): ReferenceFeed | null {
  const sym = listingCountry === "HK" ? `Equity.HK.${underlying.padStart(4, "0")}/HKD` : `Equity.US.${underlying.replace(".", "-")}/USD`;
  const hit = pythCatalogue.find((f) => f.attributes["symbol"] === sym);
  return hit ? { source: "pyth", id: `0x${hit.id}`, symbol: sym, currency } : null;
}

// 3. Resolve each target.
const assets: AssetConfig[] = [];
const currencies = new Set<string>();
for (const target of file.discovery.targets) {
  const [symbol, quoteSym] = target.split("/") as [string, string];
  const quote = file.quoteTokens[quoteSym];
  const unresolved = (reason: string, partial: Partial<AssetConfig> = {}): void => {
    console.log(`UNRESOLVED ${target}: ${reason}`);
    assets.push({ symbol, status: "unresolved", unresolvedReason: reason, ...partial } as AssetConfig);
  };
  if (!quote) { unresolved(`quote ${quoteSym} not configured`); continue; }
  try {
    const { asset } = await api.asset(symbol);
    const dep = xLayerDeployment(asset);
    if (!dep) { unresolved("issuer lists no XLayer deployment"); continue; }
    const token = getAddress(dep.address);
    const wrapper = dep.wrapperAddressV2 ? getAddress(dep.wrapperAddressV2) : null;
    const [tSym, tDec] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol", blockNumber: block }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
    ]);
    if (tSym !== symbol) { unresolved(`onchain symbol ${tSym} != ${symbol}`); continue; }
    let wRef: AssetConfig["wrapper"] = null;
    if (wrapper) {
      const [wSym, wDec] = await Promise.all([
        client.readContract({ address: wrapper, abi: erc20Abi, functionName: "symbol", blockNumber: block }),
        client.readContract({ address: wrapper, abi: erc20Abi, functionName: "decimals", blockNumber: block }),
      ]);
      wRef = { symbol: wSym, address: wrapper, decimals: wDec, version: "v2" };
    }

    // Every (token|wrapper) x quote candidate x fee tier.
    const found: (PoolRef & { side: "token" | "wrapper" })[] = [];
    for (const [side, addr] of [["token", token], ["wrapper", wrapper]] as const) {
      if (!addr) continue;
      for (const qs of file.discovery.quoteCandidates) {
        const q = file.quoteTokens[qs];
        if (!q) continue;
        for (const fee of file.discovery.feeTiers) {
          const p = await poolAt(addr, q.address, fee);
          if (!p) continue;
          const ref = await confirmPool(p, addr, qs, q.address, fee);
          found.push({ ...ref, side });
        }
      }
    }
    const live = found.filter((p) => BigInt(p.liquidityAtDiscovery) > 0n);
    const primaryCands = live.filter((p) => p.quote === quoteSym).sort((a, b) => (BigInt(b.liquidityAtDiscovery) > BigInt(a.liquidityAtDiscovery) ? 1 : -1));
    const primary = primaryCands[0];
    for (const p of found) console.log(`  ${symbol} ${p.side} ${p.quote} fee=${p.fee} ${p.address} L=${p.liquidityAtDiscovery}`);
    if (!primary) { unresolved(`no initialised ${quoteSym} pool with liquidity for ${symbol} or its wrapper`); continue; }
    const venues = [primary, ...live.filter((p) => p.address !== primary.address && p.side === primary.side)];

    const market = marketFromXStocks(asset);
    currencies.add(asset.underlying.currency);
    const references: ReferenceFeed[] = [{ source: "xstocks", id: `xstocks:price-data:${symbol}`, symbol, currency: asset.trading.currency }];
    const pyth = pythFor(asset.underlying.listingCountry, asset.underlying.symbol, asset.underlying.currency);
    if (pyth) references.push(pyth);
    const ySym = yahooSymbol(asset.underlying.listingCountry, asset.underlying.symbol);
    try {
      const y = await yahooQuote(http, ySym);
      if (y.meta.currency !== asset.underlying.currency) throw new Error(`currency ${y.meta.currency} != ${asset.underlying.currency}`);
      references.push({ source: "yahoo", id: ySym, symbol: ySym, currency: y.meta.currency });
    } catch (e) {
      console.log(`  no yahoo reference for ${symbol} (${ySym}): ${(e as Error).message}`);
    }

    const strip = ({ side: _s, ...r }: PoolRef & { side: string }): PoolRef => r;
    assets.push({
      symbol,
      status: "resolved",
      issuer: "xstocks",
      issuerId: asset.id,
      isin: asset.isin,
      token: { symbol, address: token, decimals: tDec },
      wrapper: wRef,
      poolToken: primary.side,
      quoteToken: quoteSym,
      pool: strip(primary),
      venues: venues.map(strip),
      underlying: {
        symbol: asset.underlying.symbol,
        isin: asset.underlying.isin,
        currency: asset.underlying.currency,
        listingCountry: asset.underlying.listingCountry,
        market,
        exchangeTimezone: asset.trading.exchange.timezone,
        tradingHoursMode: asset.trading.tradingHoursMode,
      },
      references,
      explorer: {
        token: explorerToken(196, token),
        wrapper: wrapper ? explorerToken(196, wrapper) : null,
        pool: explorerAddress(196, primary.address),
      },
      verifiedAt: now,
      verifiedAtBlock: block.toString(),
      sourceNote:
        `Token and wrapperV2 from xStocks public API /assets/${symbol} (XLayer deployment); pool from UniswapV3Factory.getPool ` +
        `and confirmed onchain (token0, token1, fee, tickSpacing, slot0, liquidity, factory) at block ${block}. ` +
        `Market ${market} from issuer exchange MIC. ${pyth ? `Independent reference ${pyth.symbol}.` : "No independent Pyth feed found."}`,
    });
    console.log(`RESOLVED ${target}: ${primary.side} pool ${primary.address} fee ${primary.fee}, ${venues.length} venue(s), market ${market}`);
  } catch (e) {
    unresolved((e as Error).message.split("\n")[0] ?? "error");
  }
}

// 4. Leg-two routes from each non-loan quote into the loan asset.
const loan = file.quoteTokens[file.loanAsset];
if (!loan) throw new Error("loan asset not in quoteTokens");
const routes: RouteConfig[] = [];
for (const [qs, q] of Object.entries(file.quoteTokens)) {
  if (qs === file.loanAsset) continue;
  for (const fee of file.discovery.feeTiers) {
    const p = await poolAt(q.address, loan.address, fee);
    if (!p) continue;
    const ref = await confirmPool(p, q.address, file.loanAsset, loan.address, fee);
    console.log(`route ${qs}->${file.loanAsset} fee=${fee} ${p} L=${ref.liquidityAtDiscovery}`);
    if (BigInt(ref.liquidityAtDiscovery) > 0n) routes.push({ from: qs, to: file.loanAsset, pool: ref });
  }
}

// 5. FX feeds for non-USD underlyings.
const fx: ReferenceFeed[] = [];
for (const c of currencies) {
  if (c === "USD") continue;
  const hit = fxCatalogue.find((f) => f.attributes["symbol"] === `FX.USD/${c}`);
  if (hit) fx.push({ source: "pyth", id: `0x${hit.id}`, symbol: `FX.USD/${c}`, currency: c });
  else console.log(`WARN no Pyth FX feed for USD/${c}`);
  const y = await yahooQuote(http, `${c}=X`);
  if (y.meta.currency !== c) throw new Error(`yahoo ${c}=X currency ${y.meta.currency}`);
  fx.push({ source: "yahoo", id: `${c}=X`, symbol: `FX.USD/${c}`, currency: c });
}

const out: AssetsFile = { ...file, generatedAt: now, fx, routes, assets };
writeFileSync(assetsPath(), `${JSON.stringify(out, null, 2)}\n`);
const ok = assets.filter((a) => a.status === "resolved").length;
console.log(`wrote ${assetsPath()}: ${ok}/${assets.length} resolved, ${routes.length} routes, ${fx.length} fx feeds`);
