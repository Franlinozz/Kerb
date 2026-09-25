"use client";
import Link from "@/components/ui/Link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Blocks, Bot, BookOpen, Braces, ChevronDown, CircleHelp, Code2, Compass, FileText, GitBranch, History, Layers, Package, PlayCircle, Scale, ShieldCheck, ShieldHalf } from "lucide-react";
import { NAV, isActive, type NavItem, type NavSub } from "./nav";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

const ICONS: Record<string, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  package: Package, braces: Braces, code: Code2, bot: Bot, check: ShieldCheck, layers: Layers, git: GitBranch,
  book: BookOpen, help: CircleHelp, paper: FileText, history: History, compass: Compass, scale: Scale, shield: ShieldHalf, alert: AlertTriangle, blocks: Blocks, play: PlayCircle,
};

/** Same-page hash links do not fire hashchange through the router; the Developers tabs listen for it. */
const nudgeHash = (href: string): void => {
  const [p, h] = href.split("#");
  if (h && p === window.location.pathname) setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 0);
};

function SubLink({ s, onPick }: { s: NavSub; onPick: () => void }): React.ReactElement {
  const Icon = ICONS[s.icon] ?? BookOpen;
  const body = (
    <>
      <span className="navm-ico"><Icon size={14} aria-hidden /></span>
      <span className="navm-txt"><span className="navm-label">{s.label}{s.external ? <ArrowUpRight size={12} aria-hidden /> : null}</span><span className="navm-note">{s.note}</span></span>
    </>
  );
  if (s.tour) return <button type="button" role="menuitem" className="navm-item" onClick={() => { onPick(); window.dispatchEvent(new Event("kerb-tour")); }}>{body}</button>;
  if (s.external) return <a role="menuitem" className="navm-item" href={s.href} target="_blank" rel="noreferrer" onClick={onPick}>{body}</a>;
  return <Link role="menuitem" className="navm-item" href={s.href} onClick={() => { onPick(); nudgeHash(s.href); }}>{body}</Link>;
}

/** A top-level link with a menu: hover or focus opens it after a short intent delay; the chevron toggles it for touch and keyboard. */
function MenuItem({ n, current, onPoint }: { n: NavItem; current: boolean; onPoint: (el: Element) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const later = (v: boolean, ms: number): void => { window.clearTimeout(t.current); t.current = window.setTimeout(() => setOpen(v), ms); };
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e: KeyboardEvent): void => { if (e.key === "Escape") { setOpen(false); (wrap.current?.querySelector(".navm-toggle") as HTMLElement | null)?.focus(); } };
    const away = (e: PointerEvent): void => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key); window.addEventListener("pointerdown", away);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", away); };
  }, [open]);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const id = `navm-${n.label.toLowerCase()}`;
  return (
    <div ref={wrap} className="navm" data-open={open || undefined}
      onMouseEnter={() => { later(true, 90); if (wrap.current) onPoint(wrap.current); }} onMouseLeave={() => later(false, 160)}
      onFocus={() => { if (wrap.current) onPoint(wrap.current); }}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) later(false, 0); }}>
      <Link href={n.href} aria-current={current ? "page" : undefined}>
        {n.label}
      </Link>
      <button type="button" className="navm-toggle" aria-label={`More in ${n.label}`} aria-expanded={open} aria-controls={id} onClick={() => { window.clearTimeout(t.current); setOpen((v) => !v); }}>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      <div className="navm-panel" id={id} role="menu" aria-label={n.label} hidden={!open}>
        <div className="navm-groups" data-cols={n.menu?.length}>
          {n.menu?.map((g) => (
            <div key={g.label} className="navm-group">
              <span className="t-label">{g.label}</span>
              {g.items.map((s) => <SubLink key={s.label} s={s} onPick={() => setOpen(false)} />)}
            </div>
          ))}
        </div>
        {n.foot ? <div className="navm-foot"><a href={n.foot.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>{n.foot.label}<ArrowUpRight size={12} aria-hidden="true" /></a></div> : null}
      </div>
    </div>
  );
}

/**
 * The main nav. On desktop a pill slides under the link being pointed at and settles on the
 * current page; Developers and Docs open a menu. The drawer uses the same links without the pill,
 * with the menu entries listed under each.
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
  // A menu item's pill covers its label and its arrow together, so it sits like every other entry.
  const settle = useCallback(() => { const a = ref.current?.querySelector('[aria-current="page"]') ?? null; moveTo(a?.closest(".navm") ?? a); }, [moveTo]);

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
      {NAV.map((n) => {
        const current = isActive(pathname, n.href);
        if (pill && n.menu) return <MenuItem key={n.href} n={n} current={current} onPoint={moveTo} />;
        return (
          <div key={n.href} className="nav-entry">
            <Link href={n.href} aria-current={current ? "page" : undefined}
              {...(pill ? { onMouseEnter: (e: React.MouseEvent) => moveTo(e.currentTarget), onFocus: (e: React.FocusEvent) => moveTo(e.currentTarget) } : {})}
              {...(onNavigate ? { onClick: onNavigate } : {})}>{n.label}</Link>
            {!pill && n.menu ? (
              <div className="drawer-sub">
                {n.menu.flatMap((g) => g.items).map((s) => s.tour
                  ? <button key={s.label} type="button" onClick={() => { onNavigate?.(); window.dispatchEvent(new Event("kerb-tour")); }}>{s.label}</button>
                  : s.external
                    ? <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
                    : <Link key={s.label} href={s.href} onClick={() => { onNavigate?.(); nudgeHash(s.href); }}>{s.label}</Link>)}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
