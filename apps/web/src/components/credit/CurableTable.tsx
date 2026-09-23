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
import type { CreditMarket, DemoClock, KeeperStatus } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { useTxFlow } from "@/lib/txflow";
import { countdown, utcHm } from "@/lib/time";
import { AddressChip } from "@/components/ui/AddressChip";
import { TxStepper } from "@/components/ui/TxStepper";
import { useLive, useNow } from "@/components/kerb/useLive";
import { scheduleAt } from "@/components/kerb/SessionRail";
import { fmtUnits, MAX, pctWad } from "./usePosition";

interface P { user: Hex; assetId: Hex; symbol: string | null; mode: string; debt: string; positionLTV: string | null; carryTarget: string; cure: { eligible: boolean; deadline: string | null; requiredRepay: string } }

export function CurableTable({ market, demo }: { market: CreditMarket; demo: DemoClock }): React.ReactElement {
  const live = useLive<{ positions: P[] }>("/v1/credit/1952/positions?state=curable", null, 15_000);
  const keeper = useLive<KeeperStatus>("/v1/credit/1952/keeper", null, 30_000).data;
  const now = useNow();
  // The server's demo clock may be from an older render: project it to now, like the rail does.
  const d = now === null ? demo : scheduleAt(demo, now);
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
        <div className="section-head-row"><span className="t-label" id="curable-title">Curable now · public · anyone may cure</span><span className="t-label ink-3">{live.updating ? "Refreshing" : `${rows.length} in Last Call`}</span></div>
      </div>
      {rows.length === 0 ? (
        <div className="curable-empty">
          {d.state === "LAST_CALL"
            ? <p className="ink-2">Last Call is open until <span suppressHydrationWarning>{utcHm(Date.parse(d.nextCureClosesAt))}</span> UTC and no position needs a cure right now.</p>
            : <p className="ink-2">No position needs a cure right now. The next demo Last Call opens in <span suppressHydrationWarning>{now === null ? "" : countdown(Date.parse(d.nextCureOpensAt), now)}</span>, at <span suppressHydrationWarning>{utcHm(Date.parse(d.nextCureOpensAt))}</span> UTC.</p>}
          {keeper?.running ? (
            // V3-02: the keeper holds a standing Session Max position every demo cycle (demo position rung 1).
            <p className="t-small ink-2">A standing demo position opens every cycle and becomes curable when the demo Last Call opens{d.state === "LAST_CALL" ? "" : <> in <span suppressHydrationWarning>{now === null ? "" : countdown(Date.parse(d.nextCureOpensAt), now)}</span></>}. Cure it from any wallet and earn the bonus in mirror collateral.</p>
          ) : (
            // AGENTS.md 12.8, demo position rung 3: the keeper is not running, so say where a position comes from.
            <p className="t-small ink-3">No standing demo position is open right now. Borrow with Session Max and your position appears here when Last Call opens; a second wallet, or anyone, may then cure it.</p>
          )}
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
      {keeper?.running ? (
        <p className="t-small ink-3 keeper-line">Demo keeper <AddressChip value={keeper.address} href={`https://www.oklink.com/x-layer-testnet/address/${keeper.address}`} label="demo keeper" /> · {keeper.position === "open" ? `position open, ${keeper.debt} ${sym}` : "no position open"} · next: {keeper.next?.toLowerCase()}{keeper.nextAt ? ` at ${utcHm(Date.parse(keeper.nextAt))} UTC` : ""}{keeper.lastAction?.tx ? <> · last: <a className="mono" href={`https://www.oklink.com/x-layer-testnet/tx/${keeper.lastAction.tx}`} target="_blank" rel="noreferrer">{keeper.lastAction.action}</a></> : null}</p>
      ) : null}
    </section>
  );
}
