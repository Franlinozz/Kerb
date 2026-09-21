import type { ButtonHTMLAttributes } from "react";

/** A square icon button. The label is required: an icon alone is not an accessible name. */
export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): React.ReactElement {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={["icon-btn", className].filter(Boolean).join(" ")}>
      {children}
    </button>
  );
}
