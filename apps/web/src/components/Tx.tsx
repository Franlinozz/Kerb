"use client";

/**
 * One place for the four states a transaction can be in, so every action on the page reports
 * them the same way: pending, rejected by the user, reverted by the contract, or confirmed.
 * AGENTS.md section 9 lists all four as things the UI must handle.
 */
import { useEffect, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Hex } from "viem";

export interface TxState {
  send: (args: { address: Hex; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => void;
  status: "idle" | "signing" | "pending" | "confirmed" | "rejected" | "reverted" | "failed";
  message: string | null;
  hash: Hex | undefined;
  reset: () => void;
}

/** Turn a wallet or contract error into something a person can act on. */
function explain(err: unknown): { status: "rejected" | "reverted" | "failed"; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/User rejected|User denied|rejected the request/i.test(raw)) {
    return { status: "rejected", message: "You rejected the transaction in your wallet. Nothing was sent." };
  }
  // Contract custom errors read like ExceedsModeLTV(...) and are the useful part of the message.
  const custom = /Error:\s*([A-Za-z]+)\(([^)]*)\)/.exec(raw);
  if (custom) {
    return { status: "reverted", message: `The contract refused this: ${custom[1]}(${custom[2] ?? ""}).` };
  }
  if (/insufficient funds/i.test(raw)) {
    return { status: "failed", message: "Not enough OKB in this account to pay for gas on X Layer testnet." };
  }
  return { status: "failed", message: raw.split("\n")[0]?.slice(0, 180) ?? "The transaction failed." };
}

export function useTx(onConfirmed?: () => void): TxState {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const { isLoading: mining, isSuccess, isError: mineError, error: receiptError } =
    useWaitForTransactionReceipt({ hash });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isSuccess && onConfirmed) onConfirmed();
  }, [isSuccess, onConfirmed]);

  let status: TxState["status"] = "idle";
  let message: string | null = null;

  if (!dismissed) {
    if (error) {
      const e = explain(error);
      status = e.status;
      message = e.message;
    } else if (mineError) {
      const e = explain(receiptError);
      status = "reverted";
      message = e.message;
    } else if (isPending) {
      status = "signing";
      message = "Confirm in your wallet.";
    } else if (mining) {
      status = "pending";
      message = "Sent. Waiting for the block.";
    } else if (isSuccess) {
      status = "confirmed";
      message = "Confirmed.";
    }
  }

  return {
    send: (args) => {
      setDismissed(false);
      writeContract(args as never);
    },
    status,
    message,
    hash,
    reset: () => {
      setDismissed(true);
      resetWrite();
    },
  };
}

export function TxNotice({ tx, explorer }: { tx: TxState; explorer: string }): React.ReactElement | null {
  if (tx.status === "idle" || !tx.message) return null;
  const tone =
    tx.status === "confirmed" ? "" : tx.status === "rejected" ? " callout-warn" : tx.status === "signing" || tx.status === "pending" ? "" : " callout-danger";
  return (
    <div className={`callout${tone}`} role="status">
      {tx.message}
      {tx.hash ? (
        <>
          {" "}
          <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="mono">
            view transaction
          </a>
        </>
      ) : null}
      {tx.status !== "signing" && tx.status !== "pending" ? (
        <button type="button" className="theme-toggle" style={{ marginLeft: 8 }} onClick={tx.reset}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
