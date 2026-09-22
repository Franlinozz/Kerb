"use client";

/**
 * Multi-step transactions (approve, then act) for the TxStepper. Each step is sent, waited for,
 * and marked done before the next; a failure stops the flow on that step with the mapped reason.
 * Every transaction carries the Builder Code. Nothing raw is ever shown: lib/errors.ts maps it.
 */
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { builderSuffix } from "./builderCode";
import { mapTxError, type ErrorContext } from "./errors";
import { toast } from "./toast";
import type { Step } from "@/components/ui/TxStepper";

export interface FlowStep {
  label: string;
  call: { address: Hex; abi: readonly unknown[]; functionName: string; args: readonly unknown[] };
  /** Resolve the step's arguments at send time (for a figure that must be read fresh). */
  prepare?: () => Promise<readonly unknown[] | null>;
}

const EXPLORER = "https://www.oklink.com/x-layer-testnet";

export function useTxFlow(ctx: ErrorContext = {}, onDone?: () => void): {
  steps: Step[]; note: string | null; tone: "info" | "error"; hash: Hex | null; running: boolean;
  run: (flow: FlowStep[], doneLabel: string) => Promise<boolean>; reset: () => void;
} {
  const config = useConfig();
  const [steps, setSteps] = useState<Step[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "error">("info");
  const [hash, setHash] = useState<Hex | null>(null);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => { setSteps([]); setNote(null); setHash(null); setTone("info"); }, []);

  const run = useCallback(async (flow: FlowStep[], doneLabel: string): Promise<boolean> => {
    const labels = [...flow.map((f) => f.label), "Done"];
    const mark = (i: number, state: Step["state"]): void =>
      setSteps(labels.map((label, j) => ({ label, state: j < i ? "done" : j === i ? state : "pending" })));
    setRunning(true); setTone("info"); setHash(null);
    let last: Hex | null = null;
    for (let i = 0; i < flow.length; i++) {
      const f = flow[i] as FlowStep;
      mark(i, "active");
      setNote(`${f.label}: confirm in your wallet.`);
      try {
        const args = f.prepare ? await f.prepare() : f.call.args;
        if (args === null) { setNote("Nothing to send: the position no longer needs this."); setRunning(false); mark(labels.length - 1, "done"); return true; }
        const suffix = builderSuffix();
        const h = await writeContract(config, { ...f.call, args, ...(suffix ? { dataSuffix: suffix } : {}) } as never);
        setHash(h);
        last = h;
        setNote(`${f.label}: sent, waiting for the block.`);
        const r = await waitForTransactionReceipt(config, { hash: h, chainId: 1952 });
        if (r.status !== "success") throw Object.assign(new Error("reverted"), { receipt: r });
      } catch (err) {
        const m = mapTxError(err, ctx);
        mark(i, "failed");
        setTone(m.kind === "cancelled" ? "info" : "error");
        setNote(m.message);
        toast({ tone: m.kind === "cancelled" ? "info" : "error", title: m.title, body: m.kind === "cancelled" ? undefined : m.message, ttl: m.kind === "cancelled" ? 3000 : null });
        setRunning(false);
        return false;
      }
    }
    mark(labels.length, "done");
    setNote(`${doneLabel}.`);
    setRunning(false);
    toast({ tone: "success", title: doneLabel, href: last ? `${EXPLORER}/tx/${last}` : undefined });
    // The public RPC is load balanced: a read right after the receipt can come from a node that has
    // not seen the block. Refresh now, and again a few seconds later.
    onDone?.();
    setTimeout(() => onDone?.(), 3000);
    setTimeout(() => onDone?.(), 9000);
    return true;
  }, [config, ctx, onDone]);

  return { steps, note, tone, hash, running, run, reset };
}
