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
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x…" spellCheck={false} className="mono" />
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
                <dd>{ltv.data === undefined ? "—" : `${round(shift(scale(ltv.data.toString(), 18), 2), 2)}%`}</dd>
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
                  disabled={busy || !eligible || !address}
                  onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "cure", args: [user, assetId, required] })}
                >
                  {eligible ? `Cure for ${money(required)}` : "Cure (waiting for Last Call)"}
                </button>
              )}
              <span className="faint">
                You are repaid in collateral at the cure bonus. Cure cannot repay more than the covenant requires,
                and cannot run outside the window.
              </span>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
