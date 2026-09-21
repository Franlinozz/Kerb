"use client";

/**
 * The borrow flow, and the panel that must be honest before anyone signs.
 *
 * KTS-0.1 section 8: "The borrower always sees, before signing: the current regime, the next cure
 * deadline, the exact cure amount at the current mark, and the difference between choosing Carry
 * and Session Max." That is this component's whole job.
 */
import { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, parseUnits, type Hex } from "viem";
import type { CreditCollateral, CreditMarket } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { duration, group, round, scale, shift } from "@/lib/format";
import { RegimeTag } from "./Regime";
import { REGIME_BY_INDEX } from "@/lib/api";
import { TxNotice, useTx } from "./Tx";

const WAD = 10n ** 18n;
const EXPLORER = "https://www.oklink.com/x-layer-testnet";
const MAX = (1n << 255n) - 1n;

const pctOf = (raw: bigint, places = 2): string => `${round(shift(scale(raw.toString(), 18), 2), places)}%`;

export function BorrowPanel({ market, collateral }: { market: CreditMarket; collateral: CreditCollateral }): React.ReactElement {
  const { address } = useAccount();
  const credit = market.contracts.KerbCredit as Hex;
  const assetId = collateral.assetId as Hex;
  const token = collateral.token as Hex;
  const loanToken = market.contracts.loanAsset as Hex;
  const loanDecimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  const [collateralInput, setCollateralInput] = useState("");
  const [borrowInput, setBorrowInput] = useState("");
  const [mode, setMode] = useState<0 | 1>(0);

  const enabled = Boolean(address);
  const account = (address ?? "0x0000000000000000000000000000000000000000") as Hex;

  const position = useReadContract({
    address: credit, abi: CREDIT_ABI, functionName: "position", args: [account, assetId],
    query: { enabled, refetchInterval: 8000 },
  });
  const debt = useReadContract({
    address: credit, abi: CREDIT_ABI, functionName: "debtOf", args: [account, assetId],
    query: { enabled, refetchInterval: 8000 },
  });
  const cure = useReadContract({
    address: credit, abi: CREDIT_ABI, functionName: "cureStatus", args: [account, assetId],
    query: { enabled, refetchInterval: 8000 },
  });
  const collateralBalance = useReadContract({
    address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [account], query: { enabled },
  });
  const collateralAllowance = useReadContract({
    address: token, abi: ERC20_ABI, functionName: "allowance", args: [account, credit], query: { enabled },
  });
  const loanAllowance = useReadContract({
    address: loanToken, abi: ERC20_ABI, functionName: "allowance", args: [account, credit], query: { enabled },
  });

  const refresh = (): void => {
    void position.refetch(); void debt.refetch(); void cure.refetch();
    void collateralBalance.refetch(); void collateralAllowance.refetch(); void loanAllowance.refetch();
  };
  const tx = useTx(refresh);

  const held = position.data?.collateralShares ?? 0n;
  const owed = debt.data ?? 0n;
  const mark = BigInt(collateral.terms.creditMark);
  const carryLTV = BigInt(collateral.terms.carryLTV);
  const sessionMaxLTV = BigInt(collateral.terms.sessionMaxLTV);
  const scaleToLoan = 10n ** BigInt(18 - loanDecimals);

  /** Value the collateral exactly as KerbCredit does, so the panel and the contract agree. */
  const collateralValue = useMemo(() => {
    const extra = collateralInput ? safeParse(collateralInput, 18) : 0n;
    return ((held + extra) * mark) / WAD / scaleToLoan;
  }, [held, collateralInput, mark, scaleToLoan]);

  const roomAt = (ltv: bigint): bigint => {
    const ceiling = (collateralValue * ltv) / WAD;
    return ceiling > owed ? ceiling - owed : 0n;
  };
  const carryRoom = roomAt(carryLTV);
  const sessionRoom = roomAt(sessionMaxLTV);
  const extraFromSessionMax = sessionRoom > carryRoom ? sessionRoom - carryRoom : 0n;

  const wanted = borrowInput ? safeParse(borrowInput, loanDecimals) : 0n;
  const projectedDebt = owed + wanted;
  const projectedLTV = collateralValue === 0n ? 0n : (projectedDebt * WAD + collateralValue - 1n) / collateralValue;
  const aboveCarry = projectedLTV > carryLTV;
  const needsSessionMax = aboveCarry;
  const overCeiling = projectedLTV > (mode === 0 ? carryLTV : sessionMaxLTV);
  const overPositionCap = projectedDebt > BigInt(collateral.terms.maxPositionDebt);

  /**
   * What a cure would cost at the projected position, by the same formula the contract uses:
   * R = (debt - target * value) / (1 - target * (1 + bonus)), because the cure also seizes the
   * collateral that pays its own bonus.
   */
  const projectedCure = useMemo(() => {
    if (!aboveCarry || collateralValue === 0n) return 0n;
    const allowed = (collateralValue * carryLTV) / WAD;
    if (projectedDebt <= allowed) return 0n;
    const shortfall = projectedDebt - allowed;
    const bonus = BigInt(collateral.cureBonus);
    const targetWithBonus = (carryLTV * (WAD + bonus) + WAD - 1n) / WAD;
    if (targetWithBonus >= WAD) return projectedDebt;
    return (shortfall * WAD + (WAD - targetWithBonus) - 1n) / (WAD - targetWithBonus);
  }, [aboveCarry, collateralValue, carryLTV, projectedDebt, collateral.cureBonus]);

  const money = (v: bigint, places = 2): string => `${group(round(formatUnits(v, loanDecimals), places))} ${symbol}`;
  const deadline = cure.data?.[1] ? Number(cure.data[1]) * 1000 : null;

  const needsCollateralApproval = (collateralAllowance.data ?? 0n) < (collateralInput ? safeParse(collateralInput, 18) : 0n);
  const needsLoanApproval = (loanAllowance.data ?? 0n) === 0n;
  const busy = tx.status === "signing" || tx.status === "pending";

  return (
    <div className="panel">
      <TxNotice tx={tx} explorer={EXPLORER} />

      {/* ------------------------------------------------ your position */}
      <div className="rowbar">
        <h3>Your position in k{collateral.mirrors}</h3>
        <span className="faint">
          holding {group(round(formatUnits(held, 18), 4))} · owing {money(owed, 6)}
        </span>
      </div>

      {/* ------------------------------------------------ get test tokens */}
      <div className="row-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => tx.send({ address: token, abi: ERC20_ABI, functionName: "faucet", args: [parseUnits("100", 18)] })}
        >
          Get 100 k{collateral.mirrors}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => tx.send({ address: loanToken, abi: ERC20_ABI, functionName: "faucet", args: [parseUnits("10000", loanDecimals)] })}
        >
          Get 10,000 {symbol}
        </button>
        <span className="faint">
          wallet: {group(round(formatUnits(collateralBalance.data ?? 0n, 18), 4))} k{collateral.mirrors}
        </span>
      </div>

      {/* ------------------------------------------------ deposit */}
      <div className="row-actions">
        <label>
          <span className="faint">Deposit collateral</span>
          <input value={collateralInput} onChange={(e) => setCollateralInput(e.target.value)} placeholder="0.0" inputMode="decimal" />
        </label>
        {needsCollateralApproval ? (
          <button type="button" disabled={busy} onClick={() => tx.send({ address: token, abi: ERC20_ABI, functionName: "approve", args: [credit, MAX] })}>
            Approve k{collateral.mirrors}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !collateralInput}
            onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "deposit", args: [assetId, safeParse(collateralInput, 18)] })}
          >
            Deposit
          </button>
        )}
      </div>

      {/* ------------------------------------------------ the mode question, KTS 8 */}
      <fieldset className="mode-choice">
        <legend>How long do you want this loan to survive without you touching it?</legend>
        <div className="mode-options">
          <label className={`mode-option${mode === 0 ? " mode-selected" : ""}`}>
            <input type="radio" name={`mode-${collateral.key}`} checked={mode === 0} onChange={() => setMode(0)} />
            <span className="mode-title">Carry</span>
            <span className="mode-amount">{money(carryRoom)}</span>
            <span className="mode-note">
              Borrowing power that survives the next weakening on its own. No cure deadline, no cure events, nothing
              scheduled to happen to it. Ceiling {pctOf(carryLTV)}.
            </span>
          </label>
          <label className={`mode-option${mode === 1 ? " mode-selected" : ""}`}>
            <input type="radio" name={`mode-${collateral.key}`} checked={mode === 1} onChange={() => setMode(1)} />
            <span className="mode-title">Session Max</span>
            <span className="mode-amount">{money(sessionRoom)}</span>
            <span className="mode-note">
              {extraFromSessionMax > 0n ? <><strong>{money(extraFromSessionMax)} more</strong> than Carry, </> : null}
              but only while this session holds. Before it weakens you must be back at the Carry target, or anyone may
              cure you there for a {pctOf(BigInt(collateral.cureBonus))} bonus. Ceiling {pctOf(sessionMaxLTV)}.
            </span>
          </label>
        </div>
      </fieldset>

      {/* ------------------------------------------------ borrow */}
      <div className="row-actions">
        <label>
          <span className="faint">Borrow {symbol}</span>
          <input value={borrowInput} onChange={(e) => setBorrowInput(e.target.value)} placeholder="0.0" inputMode="decimal" />
        </label>
        <button
          type="button"
          disabled={busy || !borrowInput || overCeiling || overPositionCap || !collateral.terms.usable}
          onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "borrow", args: [assetId, safeParse(borrowInput, loanDecimals), mode] })}
        >
          Borrow
        </button>
      </div>

      {/* ------------------------------------------------ the confirmation panel, KTS 8 */}
      {wanted > 0n ? (
        <div className={`confirm${overCeiling || overPositionCap ? " confirm-blocked" : ""}`}>
          <div className="confirm-row">
            <span className="faint">Regime now</span>
            <span>
              <RegimeTag regime={REGIME_BY_INDEX[collateral.terms.regime] ?? "STALE"} />
            </span>
          </div>
          <div className="confirm-row">
            <span className="faint">Position after this draw</span>
            <span>
              {pctOf(projectedLTV)} LTV, owing {money(projectedDebt)}
            </span>
          </div>
          <div className="confirm-row">
            <span className="faint">Carry gives you</span>
            <span>{money(carryRoom)} at {pctOf(carryLTV)}, with no covenant</span>
          </div>
          <div className="confirm-row">
            <span className="faint">Session Max gives you</span>
            <span>
              {money(sessionRoom)} at {pctOf(sessionMaxLTV)}
              {extraFromSessionMax > 0n ? ` — ${money(extraFromSessionMax)} more than Carry` : ""}
            </span>
          </div>
          <div className="confirm-row">
            <span className="faint">Cure deadline</span>
            <span>
              {aboveCarry ? (
                deadline ? (
                  <>
                    {new Date(deadline).toISOString().slice(0, 16).replace("T", " ")} UTC, in {duration(deadline - Date.now())}
                  </>
                ) : (
                  "at the next weakening of this session"
                )
              ) : (
                "none — this draw sits at or below the Carry target"
              )}
            </span>
          </div>
          <div className="confirm-row">
            <span className="faint">Cure amount at this mark</span>
            <span>
              {aboveCarry ? (
                <>
                  <strong>{money(projectedCure)}</strong>, repayable by anyone for a {pctOf(BigInt(collateral.cureBonus))} bonus
                </>
              ) : (
                "nothing to cure"
              )}
            </span>
          </div>
          {needsSessionMax && mode === 0 ? (
            <div className="confirm-warn">
              This draw is above the Carry ceiling, so it cannot be taken in Carry mode. Choose Session Max and
              accept the covenant, or borrow {money(carryRoom)} or less.
            </div>
          ) : null}
          {overPositionCap ? (
            <div className="confirm-warn">
              Above the maximum for a single position ({money(BigInt(collateral.terms.maxPositionDebt))}). The
              contract will refuse it.
            </div>
          ) : null}
          {overCeiling && !(needsSessionMax && mode === 0) ? (
            <div className="confirm-warn">
              Above the {mode === 0 ? "Carry" : "Session Max"} ceiling of{" "}
              {pctOf(mode === 0 ? carryLTV : sessionMaxLTV)}. The contract will refuse it.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ repay and withdraw */}
      {owed > 0n || held > 0n ? (
        <div className="row-actions">
          {needsLoanApproval ? (
            <button type="button" disabled={busy} onClick={() => tx.send({ address: loanToken, abi: ERC20_ABI, functionName: "approve", args: [credit, MAX] })}>
              Approve {symbol}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || owed === 0n}
              onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "repay", args: [assetId, owed] })}
            >
              Repay everything ({money(owed, 6)})
            </button>
          )}
          <button
            type="button"
            disabled={busy || held === 0n}
            onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "withdrawCollateral", args: [assetId, held] })}
          >
            Withdraw collateral
          </button>
          <span className="faint">Repay and withdrawing to safety are never pausable.</span>
        </div>
      ) : null}

      {cure.data?.[0] ? (
        <div className="callout callout-warn">
          <strong>Last Call is open on this position.</strong> Anyone may repay{" "}
          {money(cure.data[2], 6)} to bring it back to its Carry target and take the bonus in collateral. You can
          avoid that by repaying or adding collateral first.
        </div>
      ) : null}
    </div>
  );
}

/** Parse a typed amount without throwing on a half-typed number. */
function safeParse(v: string, decimals: number): bigint {
  try {
    if (!v || !/^\d*\.?\d*$/.test(v.trim())) return 0n;
    return parseUnits(v.trim() === "" || v.trim() === "." ? "0" : v.trim(), decimals);
  } catch {
    return 0n;
  }
}
