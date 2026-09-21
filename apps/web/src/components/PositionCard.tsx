"use client";

/**
 * The position card.
 *
 * A borrower should be able to answer three questions without reading documentation: am I safe,
 * what is going to happen next, and what can I do about it right now. The last one is a sentence,
 * not a number, because a countdown nobody understands is not a warning.
 */
import { formatUnits, type Hex } from "viem";
import { useReadContract } from "wagmi";
import type { CreditCollateral, CreditMarket } from "@/lib/api";
import { CREDIT_ABI } from "@/lib/creditAbi";
import { duration, group, round, scale, shift, utcStamp } from "@/lib/format";
import { Prov } from "./Value";

const WAD = 10n ** 18n;
const pct = (v: bigint, places = 2): string => `${round(shift(scale(v.toString(), 18), 2), places)}%`;

export function PositionCard({ market, collateral, user }: {
  market: CreditMarket;
  collateral: CreditCollateral;
  user: Hex;
}): React.ReactElement | null {
  const credit = market.contracts.KerbCredit as Hex;
  const assetId = collateral.assetId as Hex;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  const q = { enabled: true, refetchInterval: 8000 } as const;
  const position = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "position", args: [user, assetId], query: q });
  const debt = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "debtOf", args: [user, assetId], query: q });
  const ltv = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "positionLTV", args: [user, assetId], query: q });
  const health = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "healthFactor", args: [user, assetId], query: q });
  const cure = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "cureStatus", args: [user, assetId], query: q });

  const held = position.data?.collateralShares ?? 0n;
  const owed = debt.data ?? 0n;
  if (held === 0n && owed === 0n) return null;

  const hf = health.data;
  const carryTarget = position.data?.carryTarget ?? 0n;
  const mode = position.data?.mode ?? 0;
  const eligible = cure.data?.[0] ?? false;
  const deadlineMs = cure.data?.[1] ? Number(cure.data[1]) * 1000 : null;
  const required = cure.data?.[2] ?? 0n;
  const money = (v: bigint): string => `${group(round(formatUnits(v, decimals), 6))} ${symbol}`;

  const liquidatable = hf !== undefined && hf < WAD;
  const aboveTarget = required > 0n;

  /** What happens next, and what this borrower can do about it, in one sentence. */
  const whatNext = ((): string => {
    if (liquidatable) {
      return `This position is below its liquidation threshold, so anyone may liquidate part of it now. Repaying ${money(owed)} or adding collateral stops that immediately.`;
    }
    if (eligible && aboveTarget) {
      return `Last Call is open. Until it closes, anyone may repay ${money(required)} on your behalf to bring you back to your Carry target and take that value plus a ${pct(BigInt(collateral.cureBonus))} bonus out of your collateral. Repay or add collateral first and nothing happens.`;
    }
    if (aboveTarget && deadlineMs) {
      return `You are above your Carry target, so when Last Call opens at ${utcStamp(new Date(deadlineMs).toISOString())} anyone may cure ${money(required)} of this position for a bonus. You have ${duration(deadlineMs - Date.now())} to repay or add collateral if you would rather it did not happen.`;
    }
    if (owed === 0n) return "No debt against this collateral. You can withdraw it whenever you like.";
    return "You are at or below your Carry target, so nothing is scheduled to happen to this position. It can sit through the next weakening untouched.";
  })();

  return (
    <div className={`position-card${liquidatable ? " position-danger" : eligible ? " position-warn" : ""}`}>
      <div className="rowbar">
        <h4>
          k{collateral.mirrors} position{" "}
          <span className="badge">{mode === 1 ? "Session Max" : "Carry"}</span>
        </h4>
        {eligible ? <span className="badge badge-warn">Last Call open</span> : null}
        {liquidatable ? <span className="badge badge-danger">liquidatable</span> : null}
      </div>

      <div className="position-grid">
        <div>
          <span className="faint">Health</span>
          <strong>{hf === undefined ? "—" : hf > 10n ** 30n ? "no debt" : round(scale(hf.toString(), 18), 3)}</strong>
          <span className="faint">
            against the fixed {pct(BigInt(collateral.liquidationThreshold))} threshold <Prov label="Computed" />
          </span>
        </div>
        <div>
          <span className="faint">Current LTV</span>
          <strong>{ltv.data === undefined ? "—" : pct(ltv.data)}</strong>
          <span className="faint">
            Carry target {carryTarget === 0n ? "none recorded" : pct(carryTarget)} <Prov label="Computed" />
          </span>
        </div>
        <div>
          <span className="faint">Collateral</span>
          <strong>{group(round(formatUnits(held, 18), 4))}</strong>
          <span className="faint">k{collateral.mirrors} <Prov label="Verified" /></span>
        </div>
        <div>
          <span className="faint">Debt</span>
          <strong>{group(round(formatUnits(owed, decimals), 2))}</strong>
          <span className="faint">{symbol} <Prov label="Verified" /></span>
        </div>
        <div>
          <span className="faint">{eligible ? "Last Call closes" : "Cure deadline"}</span>
          <strong suppressHydrationWarning>
            {deadlineMs && aboveTarget ? duration(deadlineMs - Date.now()) : "none"}
          </strong>
          <span className="faint">
            {deadlineMs && aboveTarget ? utcStamp(new Date(deadlineMs).toISOString()) : "nothing scheduled"}
          </span>
        </div>
        <div>
          <span className="faint">Cure amount</span>
          <strong>{aboveTarget ? group(round(formatUnits(required, decimals), 2)) : "0"}</strong>
          <span className="faint">{symbol} at the current mark <Prov label="Computed" /></span>
        </div>
      </div>

      <p className="position-says">{whatNext}</p>
    </div>
  );
}
