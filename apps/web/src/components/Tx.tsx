"use client";

/**
 * One place for the states a transaction can be in: signing, pending, confirmed, cancelled,
 * reverted, failed (AGENTS.md section 9). Every message goes through lib/errors.ts, so no raw
 * wallet, RPC or contract text ever reaches the page. Status shows inline as a TxStepper and
 * as a toast; every transaction still carries the Builder Code.
 */
import { useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { builderSuffix } from "@/lib/builderCode";
import { mapTxError, type ErrorContext } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { TxStepper, type Step } from "@/components/ui/TxStepper";

export interface TxState {
  send: (args: { address: Hex; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }, label?: string) => void;
  status: "idle" | "signing" | "pending" | "confirmed" | "rejected" | "reverted" | "failed";
  message: string | null;
  hash: Hex | undefined;
  label: string | null;
  reset: () => void;
}

export function useTx(onConfirmed?: () => void, ctx: ErrorContext = {}): TxState {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const { isLoading: mining, isSuccess, isError: mineError, error: receiptError } = useWaitForTransactionReceipt({ hash });
  const [dismissed, setDismissed] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (isSuccess && onConfirmed) onConfirmed();
  }, [isSuccess, onConfirmed]);

  let status: TxState["status"] = "idle";
  let message: string | null = null;
  if (!dismissed) {
    if (error) {
      const m = mapTxError(error, ctx);
      status = m.kind === "cancelled" ? "rejected" : m.kind === "contract" ? "reverted" : "failed";
      message = m.message;
    } else if (mineError) {
      status = "reverted";
      message = mapTxError(receiptError, ctx).message;
    } else if (isPending) {
      status = "signing";
      message = "Confirm in your wallet.";
    } else if (mining) {
      status = "pending";
      message = "Sent. Waiting for the block.";
    } else if (isSuccess) {
      status = "confirmed";
      message = "Confirmed on X Layer testnet.";
    }
  }

  return {
    send: (args, l) => {
      setDismissed(false);
      setLabel(l ?? null);
      // Every transaction Kerb sends carries its Builder Code, including the ones a borrower signs.
      const suffix = builderSuffix();
      writeContract({ ...args, ...(suffix ? { dataSuffix: suffix } : {}) } as never);
    },
    status,
    message,
    hash,
    label,
    reset: () => {
      setDismissed(true);
      resetWrite();
    },
  };
}

function steps(status: TxState["status"]): Step[] {
  const order = ["Sign", "Confirming", "Done"] as const;
  const at = status === "signing" ? 0 : status === "pending" ? 1 : status === "confirmed" ? 3 : status === "idle" ? -1 : status === "reverted" ? 1 : 0;
  const failed = status === "rejected" || status === "reverted" || status === "failed";
  return order.map((label, i) => ({
    label,
    state: failed && i === at ? "failed" : i < at || (status === "confirmed" && i <= 2) ? "done" : i === at ? "active" : "pending",
  }));
}

/** Inline stepper plus a toast on every change of state. */
export function TxNotice({ tx, explorer }: { tx: TxState; explorer: string }): React.ReactElement | null {
  const last = useRef<string>("idle");
  useEffect(() => {
    const key = `${tx.status}:${tx.hash ?? ""}`;
    if (key === last.current) return;
    last.current = key;
    const href = tx.hash ? `${explorer}/tx/${tx.hash}` : undefined;
    const what = tx.label ?? "Transaction";
    if (tx.status === "pending") toast({ tone: "info", title: `${what}: sent`, body: "Waiting for the block.", ...(href ? { href } : {}) });
    if (tx.status === "confirmed") toast({ tone: "success", title: `${what}: confirmed`, ...(href ? { href } : {}) });
    if (tx.status === "rejected") toast({ tone: "info", title: "Transaction cancelled", body: "Nothing was sent.", ttl: 3000 });
    if (tx.status === "reverted" || tx.status === "failed") toast({ tone: "error", title: "Not sent: the contract refused it", body: tx.message ?? undefined, ...(href ? { href } : {}) });
  }, [tx.status, tx.hash, tx.label, tx.message, explorer]);

  if (tx.status === "idle" || !tx.message) return null;
  const failed = tx.status === "reverted" || tx.status === "failed";
  return (
    <TxStepper
      steps={steps(tx.status)}
      note={tx.message}
      tone={failed ? "error" : "info"}
      explorerHref={tx.hash ? `${explorer}/tx/${tx.hash}` : null}
      {...(tx.status !== "signing" && tx.status !== "pending" ? { onRetry: tx.reset } : {})}
    />
  );
}
