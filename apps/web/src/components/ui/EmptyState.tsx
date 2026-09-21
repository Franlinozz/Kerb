import type { ReactNode } from "react";

/** What belongs here, and what to do next. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }): React.ReactElement {
  return (
    <div className="state state-empty" role="status">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="row">{action}</div> : null}
    </div>
  );
}
