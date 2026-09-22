"use client";

/**
 * Curable now (V2-08 step 6): every position in Last Call, found from the market's own events,
 * and a Cure button anyone can press. The cure re-reads the required amount at click time and
 * leaves a tenth of a percent of headroom, because cure may be partial and a stale figure reverts.
 */
import { readContract } from "wagmi/actions";
import { useAccount, useConfig } from "wagmi";
import { useHydratedAccount } from "@/lib/useHydrated";
import type { Hex } from "viem";
import type { CreditMarket, DemoClock } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { useTxFlow } from "@/lib/txflow";
import { countdown, utcHm } from "@/lib/time";
import { AddressChip } from "@/components/ui/AddressChip";
import { TxStepper } from "@/components/ui/TxStepper";
import { useLive, useNow } from "@/components/kerb/useLive";
import { fmtUnits, MAX, pctWad } from "./usePosition";

interface P { user: Hex; assetId: Hex; symbol: string | null; mode: string; debt: string; positionLTV: string | null; carryTarget: string; cure: { eligible: boolean; deadline: string | null; requiredRepay: string } }

export function CurableTable({ market, demo }: { market: CreditMarket; demo: DemoClock }): React.ReactElement {
  const live = useLive<{ positions: P[] }>("/v1/credit/1952/positions?state=curable", null, 15_000);
  const now = useNow();
  const { address } = useHydratedAccount(useAccount());
  const config = useConfig();
  const dec = market.loanAsset.decimals, sym = market.loanAsset.symbol;
  const credit = market.contracts.KerbCredit as Hex, loan = market.contracts.loanAsset as Hex;
  const flow = useTxFlow({ loanSymbol: sym }, () => live.refetch());
  const rows = live.data?.positions ?? [];
  const bonusOf = (assetId: string): string => { const c = market.collaterals.find((x) => x.assetId.toLowerCase() === assetId.toLowerCase()); return c ? pctWad(BigInt(c.cureBonus)) : ""; };

  const cure = async (p: P): Promise<void> => {
    const allowance = address ? ((await readContract(config, { address: loan, abi: ERC20_ABI, functionName: "allowance", args: [address, credit], chainId: 1952 })) as bigint) : 0n;
    const need = BigInt(p.cure.requiredRepay);
    await flow.run([
      ...(allowance < need ? [{ label: `Approve ${sym}`, call: { address: loan, abi: ERC20_ABI, functionName: "approve", args: [credit, MAX] } as const }] : []),
      {
        label: `Cure ${p.symbol ?? "position"}`,
        call: { address: credit, abi: CREDIT_ABI, functionName: "cure", args: [p.user, p.assetId, need] },
        prepare: async () => {
          const s = (await readContract(config, { address: credit, abi: CREDIT_ABI, functionName: "cureStatus", args: [p.user, p.assetId], chainId: 1952 })) as readonly [boolean, bigint, bigint];
          if (!s[0] || s[2] === 0n) return null;
          return [p.user, p.assetId, (s[2] * 9990n) / 10000n];
        },
      },
    ], `Cured ${p.symbol ?? "the position"}`);
  };

  return (
    <section className="curable" aria-labelledby="curable-title">
      <div className="section-head"><span className="cross" aria-hidden="true" />
        <div className="section-head-row"><span className="t-label" id="curable-title">Curable now · public · anyone may cure</span><span className="t-label ink-3">{live.updating ? "Updating" : `${rows.length} in Last Call`}</span></div>
      </div>
      {rows.length === 0 ? (
        <div className="curable-empty">
          {demo.state === "LAST_CALL"
            ? <p className="ink-2">Last Call is open until {utcHm(Date.parse(demo.nextCureClosesAt))} UTC and no position needs a cure right now.</p>
            : <p className="ink-2">No position needs a cure right now. The next demo Last Call opens in <span suppressHydrationWarning>{now === null ? "" : countdown(Date.parse(demo.nextCureOpensAt), now)}</span>, at {utcHm(Date.parse(demo.nextCureOpensAt))} UTC.</p>}
          {/* AGENTS.md 12.8, demo position rung 3: no keeper holds a standing position, so say where one comes from. */}
          <p className="t-small ink-3">Kerb does not keep a standing demo position. Borrow with Session Max and your position appears here when Last Call opens; a second wallet, or anyone, may then cure it.</p>
        </div>
      ) : (
        <div className="dt-wrap">
          <table className="dt" style={{ minWidth: 860 }}>
            <thead><tr><th>Borrower</th><th>Collateral</th><th>Mode</th><th className="num">LTV / target</th><th className="num">Required repay</th><th className="num">Bonus</th><th className="num">Deadline</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={`${p.user}${p.assetId}`}>
                  <td><AddressChip value={p.user} href={`https://www.oklink.com/x-layer-testnet/address/${p.user}`} label="borrower" /></td>
                  <td>{p.symbol ?? "Mirror"}</td><td>{p.mode}</td>
                  <td className="num">{p.positionLTV ? pctWad(BigInt(p.positionLTV)) : "No mark"} / {pctWad(BigInt(p.carryTarget))}</td>
                  <td className="num">{fmtUnits(BigInt(p.cure.requiredRepay), dec, 2)} {sym}</td>
                  <td className="num">{bonusOf(p.assetId)}</td>
                  <td className="num" suppressHydrationWarning>{p.cure.deadline ? `${utcHm(Date.parse(p.cure.deadline))} UTC${now === null ? "" : `, ${countdown(Date.parse(p.cure.deadline), now)}`}` : "Open"}</td>
                  <td><button type="button" className="btn btn-sm btn-primary" disabled={!address || flow.running} onClick={() => void cure(p)}>Cure</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!address && rows.length > 0 ? <p className="t-small ink-3 mt-3">Connect a wallet to cure. The cure is paid in {sym} and returns the collateral plus the bonus.</p> : null}
      {flow.steps.length ? <TxStepper steps={flow.steps} note={flow.note} tone={flow.tone} explorerHref={flow.hash ? `https://www.oklink.com/x-layer-testnet/tx/${flow.hash}` : null} /> : null}
    </section>
  );
}
