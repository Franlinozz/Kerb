import { Check, ExternalLink } from "lucide-react";

export type StepState = "pending" | "active" | "done" | "failed";
export interface Step { label: string; state: StepState }

/** Approve, Sign, Confirming, Done. A failed step stays highlighted with its mapped reason. */
export function TxStepper({ steps, note, tone, explorerHref, onRetry }: { steps: Step[]; note?: string | null; tone?: "error" | "info"; explorerHref?: string | null; onRetry?: () => void }): React.ReactElement {
  return (
    <div aria-live="polite">
      <ol className="stepper" role="list">
        {steps.map((s, i) => (
          <li key={s.label} className="step" data-state={s.state}>
            <span className="step-mark" aria-hidden="true">{s.state === "done" ? <Check size={11} /> : s.state === "failed" ? "!" : i + 1}</span>
            <span>{s.label}<span className="sr-only">: {s.state}</span></span>
          </li>
        ))}
      </ol>
      {note || explorerHref || onRetry ? (
        <p className="stepper-note" data-tone={tone}>
          {note}
          {explorerHref ? <> <a href={explorerHref} target="_blank" rel="noreferrer">View on OKLink <ExternalLink size={12} style={{ display: "inline" }} /></a></> : null}
          {onRetry ? <> <button type="button" className="btn btn-quiet" onClick={onRetry}>Retry</button></> : null}
        </p>
      ) : null}
    </div>
  );
}
