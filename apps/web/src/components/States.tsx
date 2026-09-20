/**
 * Failure and empty states. A source that is down says so, with what failed and what to do next.
 * It never renders a number it does not have: AGENTS.md rule 1.
 */
export function SourceTrouble({ what, detail }: { what: string; detail: string }): React.ReactElement {
  return (
    <div className="callout callout-danger" role="status">
      <strong>{what} is unavailable right now.</strong> {detail}. Nothing is shown in its place because Kerb
      does not display a number it has not observed. Reload in a moment, or read{" "}
      <a href="/proof">the proof page</a> for what is live.
    </div>
  );
}

export function Stale({ what, ageText }: { what: string; ageText: string }): React.ReactElement {
  return (
    <div className="callout callout-warn" role="status">
      <strong>{what} is stale.</strong> The last observation is {ageText} old, so no new risk should be taken
      against it. Repayments, cures and liquidations are unaffected.
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="empty">{children}</div>;
}
