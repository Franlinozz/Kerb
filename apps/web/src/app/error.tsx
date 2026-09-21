"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** A route that failed to render. Names what happened, says nothing changed, offers retry. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): React.ReactElement {
  useEffect(() => { console.error("[kerb] route error", error); }, [error]);
  return (
    <section className="system-page">
      <div className="system-copy">
        <span className="t-label">Error{error.digest ? ` · ${error.digest}` : ""}</span>
        <h1 className="t-display">Something upstream<br />stopped answering.</h1>
        <p className="t-body-l ink-2">
          This page could not be built from the Kerb API or the chain just now. Nothing on chain has changed, and no number is shown in place of one Kerb could not read.
          The <Link href="/proof">proof page</Link> shows which sources are live.
        </p>
        <div className="row mt-5">
          <Button variant="primary" onClick={reset}>Try again</Button>
          <Link className="btn" href="/proof">Open the proof</Link>
        </div>
      </div>
    </section>
  );
}
