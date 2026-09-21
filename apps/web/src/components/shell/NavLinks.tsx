"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";

export function NavLinks({ className, onNavigate }: { className: string; onNavigate?: () => void }): React.ReactElement {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className={className}>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined} {...(onNavigate ? { onClick: onNavigate } : {})}>{n.label}</Link>
      ))}
    </nav>
  );
}
