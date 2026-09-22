"use client";
import Link from "@/components/ui/Link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NAV, isActive } from "./nav";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The main nav. On desktop a pill slides under the link being pointed at and settles on the
 * current page; the drawer uses the same links without the pill.
 */
export function NavLinks({ className, onNavigate, pill = false }: { className: string; onNavigate?: () => void; pill?: boolean }): React.ReactElement {
  const pathname = usePathname() ?? "/";
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ x: number; w: number; on: boolean } | null>(null);

  const moveTo = useCallback((el: Element | null) => {
    const nav = ref.current;
    if (!nav || !el) { setBox((b) => (b ? { ...b, on: false } : null)); return; }
    const a = (el as HTMLElement).getBoundingClientRect(), n = nav.getBoundingClientRect();
    setBox({ x: a.left - n.left, w: a.width, on: true });
  }, []);
  const settle = useCallback(() => moveTo(ref.current?.querySelector('[aria-current="page"]') ?? null), [moveTo]);

  useIso(() => { if (pill) settle(); }, [pathname, pill, settle]);
  useEffect(() => {
    if (!pill) return;
    const on = (): void => settle();
    window.addEventListener("resize", on);
    void document.fonts?.ready.then(on);
    return () => window.removeEventListener("resize", on);
  }, [pill, settle]);

  return (
    <nav aria-label="Main" className={className} ref={ref} onMouseLeave={pill ? settle : undefined} onBlur={pill ? (e) => { if (!ref.current?.contains(e.relatedTarget as Node)) settle(); } : undefined}>
      {pill ? <span className="nav-pill" aria-hidden="true" data-on={box?.on || undefined} style={box ? { transform: `translateX(${box.x}px)`, width: box.w } : undefined} /> : null}
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}
          {...(pill ? { onMouseEnter: (e: React.MouseEvent) => moveTo(e.currentTarget), onFocus: (e: React.FocusEvent) => moveTo(e.currentTarget) } : {})}
          {...(onNavigate ? { onClick: onNavigate } : {})}>{n.label}</Link>
      ))}
    </nav>
  );
}
