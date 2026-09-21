import type { ReactNode } from "react";

export function Pill({ tone, children }: { tone?: "moss" | "brass" | "oxide" | "solid-brass"; children: ReactNode }): React.ReactElement {
  return <span className={["pill", tone ? `pill-${tone}` : ""].filter(Boolean).join(" ")}>{children}</span>;
}
