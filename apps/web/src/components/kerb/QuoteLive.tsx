"use client";
/**
 * A live onchain read of KerbQuote.quoteToken (V3-07, SPEC-ONCHAIN-CONSUMERS.md section 7), made
 * from the browser against the X Layer RPC: no Kerb server in the path. Shows the block it read at.
 */
import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { fmtUnits } from "@/lib/creditMath";

const ABI = parseAbi(["function quoteToken(address token, uint256 collateralAmount, uint8 mode) view returns ((bool usable, uint16 regime, uint64 observedAt, uint128 creditMark, uint64 ltv, uint64 liquidationThreshold, uint256 collateralValue, uint256 maxBorrow, uint128 maxPositionDebt, uint128 debtCeiling, uint128 executableDepth1, uint64 cureDeadline, uint64 nextWeakeningAt, bytes32 inputsHash))"]);
const RPC: Record<number, string> = { 196: "https://rpc.xlayer.tech", 1952: "https://testrpc.xlayer.tech" };

type Q = { usable: boolean; ltv: bigint; collateralValue: bigint; maxBorrow: bigint; observedAt: bigint; inputsHash: string };

export function QuoteLive({ quote, chainId, token, symbol }: { quote: Address; chainId: number; token: Address; symbol: string }): React.ReactElement {
  const [r, setR] = useState<{ q: Q; block: bigint } | { error: string } | null>(null);
  useEffect(() => {
    const c = createPublicClient({ chain: { id: chainId, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [RPC[chainId] as string] } } }, transport: http(RPC[chainId]) });
    let live = true;
    (async () => {
      try {
        const block = await c.getBlockNumber();
        const q = (await c.readContract({ address: quote, abi: ABI, functionName: "quoteToken", args: [token, 10n * 10n ** 18n, 0], blockNumber: block })) as Q;
        if (live) setR({ q, block });
      } catch { if (live) setR({ error: "The X Layer RPC did not answer; try the cast line below." }); }
    })();
    return () => { live = false; };
  }, [quote, chainId, token]);
  return (
    <div className="quote-live" aria-live="polite">
      <span className="t-label">Live read · quoteToken({symbol}, 10 tokens, Carry) · {chainId === 196 ? "X Layer mainnet" : "X Layer testnet"}</span>
      {r === null ? <p className="t-small ink-3">Reading the chain.</p> : "error" in r ? <p className="t-small ink-3">{r.error}</p> : (
        <dl className="quote-grid">
          <div><dt className="t-label">Usable</dt><dd>{r.q.usable ? "Yes" : "No: terms stale or regime unsound"}</dd></div>
          <div><dt className="t-label">Collateral value</dt><dd>{fmtUnits(r.q.collateralValue, 6, 2)} USDG</dd></div>
          <div><dt className="t-label">Carry LTV</dt><dd>{fmtUnits(r.q.ltv * 100n, 18, 2)}%</dd></div>
          <div><dt className="t-label">Max borrow</dt><dd>{fmtUnits(r.q.maxBorrow, 6, 2)} USDG</dd></div>
          <div><dt className="t-label">Block</dt><dd className="mono">{r.block.toString()}</dd></div>
        </dl>
      )}
    </div>
  );
}
