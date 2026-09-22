"use client";

/**
 * The position (V2-08 step 5): No position, Ready to carry, the Last Call takeover, Cured, and
 * Liquidatable. The Last Call state draws a brass border in and says exactly what is owed, by
 * when, and that the liquidation line is not moving.
 */
import type { CreditCollateral, CreditMarket, DemoClock } from "@/lib/api";
import { countdown, utcHm } from "@/lib/time";
import { EmptyState } from "@/components/ui/EmptyState";
import { LtvLadder } from "@/components/kerb/LtvLadder";
import { useLive, useNow } from "@/components/kerb/useLive";
import { fmtUnits, hfWad, pctWad, WAD, type PositionState } from "./usePosition";

interface Cure { tx: string | null; repaid: string; target: string; block: number }
const OKLINK = "https://www.oklink.com/x-layer-testnet";

export function PositionPanel({ market, c, pos, demo, onRepay, onAddCollateral }: {
  market: CreditMarket; c: CreditCollateral; pos: PositionState; demo: DemoClock; onRepay: () => void; onAddCollateral: () => void;
}): React.ReactElement {
  const now = useNow();
  const dec = market.loanAsset.decimals, sym = market.loanAsset.symbol;
  const mine = useLive<{ lastCures?: Record<string, Cure> }>(pos.address ? `/v1/credit/1952/positions?user=${pos.address}` : null, null, 30_000);
  const lastCure = pos.address ? mine.data?.lastCures?.[`${pos.address.toLowerCase()}|${c.assetId.toLowerCase()}`] ?? null : null;
  const lt = BigInt(c.liquidationThreshold);
  const wadToStr = (v: bigint): string => fmtUnits(v, 18, 18).replace(/,/g, "");

  if (!pos.isConnected) return <div className="pos pos-empty"><span className="t-label">Your position</span><EmptyState title="No wallet connected">Connect a wallet in the setup steps and your position appears here, read straight from KerbCredit.</EmptyState></div>;
  if (!pos.loaded) return <div className="pos"><span className="t-label">Your position</span><div className="skel" style={{ height: 180, marginTop: 12 }} /></div>;
  if (pos.owed === 0n && pos.held === 0n) {
    return <div className="pos pos-empty"><span className="t-label">Your position · k{c.mirrors}</span><EmptyState title="No position yet">Mint test collateral in the setup steps, then deposit it and borrow in the centre panel.</EmptyState></div>;
  }
  const liquidatable = pos.hf !== null && pos.hf < WAD && pos.owed > 0n;
  const lastCall = pos.cureEligible;
  const deadline = pos.cureDeadline ?? Date.parse(demo.nextCureClosesAt);

  if (liquidatable) {
    return (
      <div className="pos pos-oxide" role="alert">
        <span className="t-label oxide">Liquidatable</span>
        <div className="pos-big">Health {hfWad(pos.hf)}</div>
        <p>The position is past the fixed {pctWad(lt)} liquidation line at the current Credit Mark. Anyone may now liquidate part of it, up to the close factor, and take the default bonus. Repaying or adding collateral brings it back.</p>
        <div className="row"><button type="button" className="btn btn-primary" onClick={onRepay}>Repay</button><button type="button" className="btn" onClick={onAddCollateral}>Add collateral</button></div>
      </div>
    );
  }
  if (lastCall) {
    return (
      <div className="pos pos-lastcall" aria-live="polite">
        <span className="t-label brass">Last Call</span>
        <div className="pos-big">{fmtUnits(pos.cureRequired, dec, 2)} {sym} <span className="t-body ink-2">cure required by {utcHm(deadline)} UTC{now === null ? "" : `, in ${countdown(deadline, now)}`}</span></div>
        <p>Repay or add collateral before the window closes. After that, anyone may cure the position back to its {pctWad(pos.carryTarget)} Carry target and earn a {pctWad(BigInt(c.cureBonus))} bonus. Only the difference, never the whole loan.</p>
        <div className="row"><button type="button" className="btn btn-primary" onClick={onRepay}>Repay {fmtUnits(pos.cureRequired, dec, 2)} {sym}</button><button type="button" className="btn" onClick={onAddCollateral}>Add collateral</button></div>
        <LtvLadder carry={wadToStr(pos.carryTarget)} session={c.terms.sessionMaxLTV ? wadToStr(BigInt(c.terms.sessionMaxLTV)) : null} lt={wadToStr(lt)} position={pos.ltv === null ? null : wadToStr(pos.ltv)} />
        <p className="t-small ink-3">Liquidation line {pctWad(lt)} is not moving.</p>
      </div>
    );
  }
  const cured = lastCure && pos.owed > 0n && Number(pos.lastCureAt) > 0;
  return (
    <div className="pos">
      <span className="t-label">{cured ? "Cured · ready to carry" : "Ready to carry"} · k{c.mirrors} · {pos.mode === 1 ? "Session Max" : "Carry"}</span>
      <div className="pos-big">Health {hfWad(pos.hf)}</div>
      <LtvLadder carry={wadToStr(pos.carryTarget > 0n ? pos.carryTarget : BigInt(c.terms.carryLTV))} session={wadToStr(BigInt(c.terms.sessionMaxLTV))} lt={wadToStr(lt)} position={pos.ltv === null ? null : wadToStr(pos.ltv)} />
      <dl className="preview">
        <div><dt className="t-label">Current LTV</dt><dd>{pctWad(pos.ltv)}</dd></div>
        <div><dt className="t-label">Carry target</dt><dd>{pctWad(pos.carryTarget)}</dd></div>
        <div><dt className="t-label">Owing</dt><dd>{fmtUnits(pos.owed, dec, 2)} {sym}</dd></div>
        <div><dt className="t-label">Next Last Call</dt><dd suppressHydrationWarning>{utcHm(Date.parse(demo.nextCureOpensAt))} UTC{now === null ? "" : `, in ${countdown(Date.parse(demo.nextCureOpensAt), now)}`}</dd></div>
      </dl>
      {pos.mode === 1 && pos.ltv !== null && pos.ltv > pos.carryTarget ? <p className="t-small brass">Above the Carry target: when Last Call opens, {fmtUnits(pos.cureRequired, dec, 2)} {sym} or more will be curable unless you repay first.</p> : null}
      {cured && lastCure ? (
        <div className="cure-line t-small">
          <span className="t-label">Last cure</span>
          <span>Session Max, then a cure of {fmtUnits(BigInt(lastCure.repaid), dec, 2)} {sym}, back to the {pctWad(BigInt(lastCure.target))} Carry target.</span>
          {lastCure.tx ? <a href={`${OKLINK}/tx/${lastCure.tx}`} target="_blank" rel="noreferrer" className="mono">{lastCure.tx.slice(0, 12)}</a> : null}
        </div>
      ) : null}
      <div className="row mt-4"><button type="button" className="btn btn-sm" onClick={onRepay}>Repay</button><button type="button" className="btn btn-sm" onClick={onAddCollateral}>Add collateral</button></div>
    </div>
  );
}
