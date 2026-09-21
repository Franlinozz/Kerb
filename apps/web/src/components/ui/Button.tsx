import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
const cls = (v: Variant, size: "md" | "sm", extra?: string): string =>
  ["btn", v === "primary" ? "btn-primary" : v === "quiet" ? "btn-quiet" : v === "danger" ? "btn-danger" : "", size === "sm" ? "btn-sm" : "", extra ?? ""].filter(Boolean).join(" ");

export function Button({ variant = "secondary", size = "md", loading = false, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: "md" | "sm"; loading?: boolean;
}): React.ReactElement {
  return (
    <button type="button" {...rest} className={cls(variant, size, className)} data-loading={loading || undefined} aria-busy={loading || undefined} disabled={rest.disabled || loading}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", size = "md", children, external = false }: { href: string; variant?: Variant; size?: "md" | "sm"; children: ReactNode; external?: boolean }): React.ReactElement {
  if (external) return <a className={cls(variant, size)} href={href} target="_blank" rel="noreferrer">{children}</a>;
  return <Link className={cls(variant, size)} href={href}>{children}</Link>;
}
