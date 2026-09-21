"use client";

/**
 * The lender's side. Supply the loan asset, withdraw it, see what the pool owes you.
 *
 * Withdrawal is capped by what is not currently lent out, and the panel says so rather than
 * letting the contract refuse a transaction the page could have predicted.
 */
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, parseUnits, type Hex } from "viem";
import type { CreditMarket } from "@/lib/api";
import { CREDIT_ABI, ERC20_ABI } from "@/lib/creditAbi";
import { group, round } from "@/lib/format";
import { TxNotice, useTx } from "./Tx";

const EXPLORER = "https://www.oklink.com/x-layer-testnet";
const MAX = (1n << 255n) - 1n;
const ZERO = "0x0000000000000000000000000000000000000000" as Hex;

export function SupplyPanel({ market }: { market: CreditMarket }): React.ReactElement {
  const { address } = useAccount();
  const credit = market.contracts.KerbCredit as Hex;
  const loanToken = market.contracts.loanAsset as Hex;
  const decimals = market.loanAsset.decimals;
  const symbol = market.loanAsset.symbol;
  const account = (address ?? ZERO) as Hex;
  const enabled = Boolean(address);

  const [amount, setAmount] = useState("");

  const balance = useReadContract({ address: loanToken, abi: ERC20_ABI, functionName: "balanceOf", args: [account], query: { enabled } });
  const allowance = useReadContract({ address: loanToken, abi: ERC20_ABI, functionName: "allowance", args: [account, credit], query: { enabled } });
  const shares = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "supplyShares", args: [account], query: { enabled, refetchInterval: 10_000 } });
  const supplied = useReadContract({ address: credit, abi: CREDIT_ABI, functionName: "suppliedOf", args: [account], query: { enabled, refetchInterval: 10_000 } });

  const tx = useTx(() => {
    void balance.refetch(); void allowance.refetch(); void shares.refetch(); void supplied.refetch();
  });

  const wanted = safeParse(amount, decimals);
  const held = supplied.data ?? 0n;
  const available = BigInt(market.pool.available);
  const busy = tx.status === "signing" || tx.status === "pending";
  const needsApproval = (allowance.data ?? 0n) < wanted;
  const money = (v: bigint): string => `${group(round(formatUnits(v, decimals), 2))} ${symbol}`;

  return (
    <div className="panel">
      <TxNotice tx={tx} explorer={EXPLORER} />
      <div className="rowbar">
        <h3>Supply {symbol}</h3>
        <span className="faint">
          you have supplied {money(held)} · wallet {money(balance.data ?? 0n)}
        </span>
      </div>

      <div className="row-actions">
        <button type="button" disabled={busy} onClick={() => tx.send({ address: loanToken, abi: ERC20_ABI, functionName: "faucet", args: [parseUnits("10000", decimals)] })}>
          Get 10,000 {symbol}
        </button>
        <label>
          <span className="faint">Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal" />
        </label>
        {needsApproval && wanted > 0n ? (
          <button type="button" disabled={busy} onClick={() => tx.send({ address: loanToken, abi: ERC20_ABI, functionName: "approve", args: [credit, MAX] })}>
            Approve {symbol}
          </button>
        ) : (
          <button type="button" disabled={busy || wanted === 0n} onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "supply", args: [wanted] })}>
            Supply
          </button>
        )}
        <button
          type="button"
          disabled={busy || (shares.data ?? 0n) === 0n}
          onClick={() => tx.send({ address: credit, abi: CREDIT_ABI, functionName: "withdraw", args: [shares.data ?? 0n] })}
        >
          Withdraw everything
        </button>
      </div>

      {held > available && held > 0n ? (
        <div className="callout callout-warn">
          Only {money(available)} of the pool is not currently lent out, so a full withdrawal will not fit until
          borrowers repay. Withdrawing what is available works now.
        </div>
      ) : null}
    </div>
  );
}

function safeParse(v: string, decimals: number): bigint {
  try {
    if (!v || !/^\d*\.?\d*$/.test(v.trim())) return 0n;
    return parseUnits(v.trim() === "" || v.trim() === "." ? "0" : v.trim(), decimals);
  } catch {
    return 0n;
  }
}
