"use client";

/**
 * Cure, from the UI, by anyone.
 *
 * Cure is permissionless and Kerb does not privilege its own keeper, so this panel takes any
 * address, shows what that position owes and what bringing it back to target would cost, and
 * lets whoever is looking execute it. That is the point: the covenant is enforced by the market,
 * not by the protocol's own bot.
 */
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, type Hex } from "viem";
import type { CreditCollateral, CreditMarket } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { duration, group, round, scale, shift } from "@/lib/format";
import { TxNotice, useTx } from "./Tx";

const EXPLORER = "https://www.oklink.com/x-layer-testnet";
const MAX = (1n << 255n) - 1n;
const ZERO = "0x0000000000000000000000000000000000000000" as Hex;

export function CurePanel({ market, collaterals }: { market: CreditMarket; collaterals: CreditCollateral[] }): React.ReactElement {
  const { address } = useAccount();
  const credit = market.contracts.KerbCredit as Hex;
  const loanToken = market.contracts.loanAsset as Hex;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;

  const [target, setTarget] = useState("");
  const [assetId, setAssetId] = useState<Hex>((collaterals[0]?.assetId ?? ZERO) as Hex);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(target.trim());
  const user = (valid ? target.trim() : ZERO) as Hex;

  const status = useReadContract({
    address: credit, abi: CREDIT_ABI, functionName: "cureStatus", args: [user, assetId],
    query: { enabled: valid, refetchInterval: 8000 },
  });
  const ltv = useReadContract({
    address: credit, abi: CREDIT_ABI, functionName: "positionLTV", args: [user, assetId], query: { enabled: valid },
  });
  const allowance = useReadContract({
    address: loanToken, abi: ERC20_ABI, functionName: "allowance", args: [(address ?? ZERO) as Hex, credit],
    query: { enabled: Boolean(address) },
  });

  const tx = useTx(() => {
    void status.refetch();
    void ltv.refetch();
  });

  const [sending, setSending] = useState(false);

  /**
   * The required amount moves with the mark, and a report can land between reading it and the
   * block that includes the cure. Sending a stale figure reverts with CureTooLarge, so the button
   * re-reads at click time and then leaves a tenth of a percent of headroom. Cure is allowed to be
   * partial, so erring low is always safe; erring high is not.
   */
  const executeCure = async (): Promise<void> => {
    setSending(true);
    try {
      const fresh = await status.refetch();
      const required_ = fresh.data?.[2] ?? required;
      if (required_ === 0n) return;
      const safe = (required_ * 9990n) / 10000n;
      if (safe === 0n) return;
      tx.send({ address: credit, abi: CREDIT_ABI, functionName: "cure", args: [user, assetId, safe] });
    } finally {
      setSending(false);
    }
  };

  const eligible = status.data?.[0] ?? false;
  const deadline = status.data?.[1] ? Number(status.data[1]) * 1000 : null;
  const required = status.data?.[2] ?? 0n;
  const needsApproval = (allowance.data ?? 0n) < required;
  const busy = tx.status === "signing" || tx.status === "pending";
  const money = (v: bigint): string => `${group(round(formatUnits(v, decimals), 6))} ${symbol}`;

  return (
    <div className="panel">
      <TxNotice tx={tx} explorer={EXPLORER} />
      <div className="row-actions">
        <label>
          <span className="faint">Position to cure</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className="mono"
            aria-label="Position to cure"
          />
        </label>
        {collaterals.length > 1 ? (
          <label>
            <span className="faint">Collateral</span>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value as Hex)}>
              {collaterals.map((c) => (
                <option key={c.assetId} value={c.assetId}>
                  k{c.mirrors}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!valid && target.length > 0 ? (
        <div className="callout callout-warn">That is not an address. It should be 0x followed by 40 hex characters.</div>
      ) : null}

      {valid && status.isSuccess ? (
        required === 0n ? (
          <div className="empty">
            This position is at or below its Carry target. There is nothing to cure, which is the normal state.
          </div>
        ) : (
          <>
            <dl>
              <div className="field">
                <dt>Position LTV</dt>
                <dd>{ltv.data === undefined ? "Reading" : `${round(shift(scale(ltv.data.toString(), 18), 2), 2)}%`}</dd>
              </div>
              <div className="field">
                <dt>Cure would repay</dt>
                <dd>{money(required)}</dd>
              </div>
              <div className="field">
                <dt>Last Call</dt>
                <dd>
                  {eligible ? (
                    <>
                      <span className="badge badge-warn">open now</span>
                      {deadline ? ` · closes in ${duration(deadline - Date.now())}` : ""}
                    </>
                  ) : (
                    <>
                      closed{deadline ? ` · next weakening in ${duration(deadline - Date.now())}` : ""}
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <div className="row-actions">
              {needsApproval ? (
                <button type="button" disabled={busy || !address} onClick={() => tx.send({ address: loanToken, abi: ERC20_ABI, functionName: "approve", args: [credit, MAX] })}>
                  Approve {symbol}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || sending || !eligible || !address}
                  onClick={() => {
                    void executeCure();
                  }}
                >
                  {eligible ? `Cure for ${money(required)}` : "Cure (waiting for Last Call)"}
                </button>
              )}
              <span className="faint">
                You are repaid in collateral at the cure bonus. Cure cannot repay more than the covenant requires,
                and cannot run outside the window. The amount sent is 99.9% of what is required, so a report
                landing between the read and the block cannot revert the whole transaction; the position lands a
                hair above target rather than not being cured at all.
              </span>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
