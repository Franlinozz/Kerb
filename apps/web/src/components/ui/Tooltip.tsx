"use client";
import { useId, useState, type ReactNode } from "react";

/** Shows on hover and on focus, and is tied to its trigger with aria-describedby. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} aria-describedby={open ? id : undefined}>
      {children}
      {open ? <span role="tooltip" id={id} className="tip-body">{content}</span> : null}
    </span>
  );
}
