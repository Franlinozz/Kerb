import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** Native details/summary: keyboard and screen reader support for free. */
export function Disclosure({ summary, children, open = false }: { summary: ReactNode; children: ReactNode; open?: boolean }): React.ReactElement {
  return (
    <details className="disclosure" open={open}>
      <summary>{summary}<ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
