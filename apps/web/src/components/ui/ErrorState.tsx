import type { ReactNode } from "react";

/** Names the source, says whether anything changed, offers a way forward. Never raw error text. */
export function ErrorState({ source, children, action }: { source: string; children?: ReactNode; action?: ReactNode }): React.ReactElement {
  return (
    <div className="state state-error" role="status">
      <h3>{source} is not answering right now.</h3>
      <p>{children ?? "Nothing has changed on chain. Kerb does not show a number it has not read, so nothing is shown in its place."}</p>
      {action ? <div className="row">{action}</div> : null}
    </div>
  );
}
