"use client";
/**
 * The guided tour: onboarding without a model. A first visit on Home offers it; the wallet menu,
 * the Docs menu and the FAQ restart it. Each step opens a page, glides a spotlight to a real
 * element, and anchors a card beside it with two sentences and, where it helps, a live number
 * from the public API. Progress lives in sessionStorage, the "seen" flag in localStorage, both
 * wrapped so a blocked store never breaks the page.
 */
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Code2, Landmark, RotateCcw, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { Mark } from "@/components/ui/Mark";

interface Live { assets: number; obs: number; posts196: number; posts1952: number }
interface Step { path: string; target: string; chapter: string; title: string; body: string; live?: (l: Live) => string }

const n = (v: number): string => v.toLocaleString("en-US");
export const TOUR: Step[] = [
  { path: "/", target: ".hero h1", chapter: "The idea", title: "Credit on the market's clock", body: "Tokenized stocks trade all week, but the markets behind them close. Kerb measures what the X Layer pool could really absorb and how long a loan must survive, and posts both as credit terms on mainnet." },
  { path: "/", target: ".consumers", chapter: "The idea", title: "One set of terms, four consumers", body: "A credit market, any X Layer contract, paying agents and developers all read the same terms. Each card carries its own live evidence." },
  { path: "/board", target: ".kpi-band", chapter: "Measure", title: "The Board", body: "Every stock's regime, Credit Mark, executable depth and terms, right now. Hover a Terms cell to read why it is what it is.", live: (l) => `${l.assets} stocks, ${n(l.obs)} observations recorded` },
  { path: "/asset/HKEXCx", target: ".why-block", chapter: "Explain", title: "Every term explains itself", body: "Kerb computes why each term is what it is, with its own numbers, from the post's inputs. The Liquidity tab walks the pool tick by tick against the OKX DEX quote." },
  { path: "/credit", target: ".rail-demo", chapter: "Borrow", title: "Borrow on a demo clock", body: "Kerb Credit runs a trading week every hour on X Layer testnet. Borrow at Carry, or more at Session Max with a promise to cure at Last Call, the brass window." },
  { path: "/credit", target: ".curable", chapter: "Cure", title: "Anyone can cure", body: "When Last Call opens, positions above their Carry target appear here. A standing demo position is always one of them: connect any wallet and cure it for a bonus." },
  { path: "/proof", target: ".proof-tiles", chapter: "Verify", title: "Check everything", body: "Every contract, the Builder Code on every post, paid agent calls, and a term recomputed from its inputs, live on this page.", live: (l) => `${n(l.posts196)} term posts on X Layer mainnet so far` },
  { path: "/developers", target: "[role=tablist]", chapter: "Build", title: "Build on it", body: "npm i kerb-sdk, REST with no key, KerbQuote from any contract on mainnet, and paid credit checks for agents over x402." },
];
const CHAPTERS = [...new Set(TOUR.map((s) => s.chapter))];
const SEEN = "kerb-tour-seen", STEP = "kerb-tour-step", DONE = -1;
const get = (s: Storage | undefined, k: string): string | null => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const set = (s: Storage | undefined, k: string, v: string | null): void => { try { if (v === null) s?.removeItem(k); else s?.setItem(k, v); } catch { /* storage blocked */ } };
const reduced = (): boolean => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Box = { top: number; left: number; width: number; height: number };
type Place = { top: number; left: number; side: "below" | "above" | "dock"; arrow: number };

/** Put the card beside the spotlight: below if it fits, else above, else docked to the corner. */
function place(box: Box | null, card: { w: number; h: number }): Place {
  const vw = window.innerWidth, vh = window.innerHeight, gap = 18, m = 16;
  if (!box || vw < 700) return { top: vh - card.h - m, left: vw < 700 ? m : vw - card.w - 24, side: "dock", arrow: 0 };
  const left = Math.min(Math.max(box.left, m), vw - card.w - m);
  const arrow = Math.min(Math.max(box.left + Math.min(box.width, 240) / 2 - left, 24), card.w - 24);
  if (box.top + box.height + gap + card.h + m <= vh) return { top: box.top + box.height + gap, left, side: "below", arrow };
  if (box.top - gap - card.h >= m) return { top: box.top - gap - card.h, left, side: "above", arrow };
  return { top: vh - card.h - 24, left: vw - card.w - 24, side: "dock", arrow: 0 };
}

export function Tour(): React.ReactElement | null {
  const path = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [offer, setOffer] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [pos, setPos] = useState<Place | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => {
    if (i >= TOUR.length) { set(sessionStorage, STEP, null); set(localStorage, SEEN, "1"); setBox(null); setStep(DONE); return; }
    if (i < 0) return;
    set(sessionStorage, STEP, String(i));
    setStep(i);
    const s = TOUR[i]!;
    if (s.path !== window.location.pathname) { setBox(null); router.push(s.path, { scroll: false }); }
  }, [router]);
  const end = useCallback((): void => { set(sessionStorage, STEP, null); set(localStorage, SEEN, "1"); setStep(null); setOffer(false); setBox(null); }, []);

  useEffect(() => {
    const w = window as Window & { __kerbTourAsked?: boolean };
    if (w.__kerbTourAsked) { w.__kerbTourAsked = false; setOffer(false); go(0); }
    else {
      const s = get(sessionStorage, STEP);
      if (s !== null) setStep(Number(s));
      else if (path === "/" && get(localStorage, SEEN) === null) { const t = setTimeout(() => setOffer(true), 2500); const start = (): void => { setOffer(false); go(0); }; window.addEventListener("kerb-tour", start); return () => { clearTimeout(t); window.removeEventListener("kerb-tour", start); }; }
    }
    const start = (): void => { setOffer(false); go(0); };
    window.addEventListener("kerb-tour", start);
    return () => window.removeEventListener("kerb-tour", start);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  // One read of the public stats feeds the live lines; the tour works the same without it.
  useEffect(() => {
    if (step === null || live) return;
    const api = "https://api.usekerb.xyz";
    fetch(`${api}/v1/stats`).then((r) => r.json()).then((d: { assets?: number; obsTotalRows?: number; postsByChain?: { chainId: number; count: number }[] }) => {
      const c = (id: number): number => d.postsByChain?.find((p) => p.chainId === id)?.count ?? 0;
      setLive({ assets: d.assets ?? 0, obs: d.obsTotalRows ?? 0, posts196: c(196), posts1952: c(1952) });
    }).catch(() => undefined);
  }, [step, live]);

  // Find the step's element on its page, bring it into view, and follow it on scroll and resize.
  useEffect(() => {
    if (step === null || step === DONE) return undefined;
    const s = TOUR[step];
    if (!s || s.path !== path) return undefined;
    let el: Element | null = null, tries = 0, alive = true, raf = 0;
    const measure = (): void => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (alive && el) { const r = el.getBoundingClientRect(); setBox({ top: r.top, left: r.left, width: r.width, height: Math.min(r.height, window.innerHeight * 0.62) }); } }); };
    const find = (): void => {
      if (!alive) return;
      el = document.querySelector(s.target);
      if (!el && tries++ < 30) { setTimeout(find, 200); return; }
      if (!el) { setBox(null); return; }
      const r = el.getBoundingClientRect();
      const top = window.scrollY + r.top - Math.max(96, (window.innerHeight - Math.min(r.height, window.innerHeight * 0.62)) / 2 - 90);
      window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
      setTimeout(measure, reduced() ? 0 : 480);
    };
    find();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [step, path]);

  useIso(() => {
    if (step === null || !card.current) { setPos(null); return; }
    const r = card.current.getBoundingClientRect();
    setPos(place(step === DONE ? null : box, { w: r.width, h: r.height }));
  }, [box, step, live, path]);

  useEffect(() => {
    if (step === null) return undefined;
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") end();
      else if (step !== DONE && e.key === "ArrowRight") go(step + 1);
      else if (step !== DONE && e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, go, end]);

  if (offer && step === null) {
    return (
      <div className="tour-offer" role="dialog" aria-label="Take the tour">
        <div className="tour-offer-head"><span className="tour-badge"><Mark size={16} /></span><div><strong>Kerb in sixty seconds</strong><p>Eight stops, from the idea to building on it. Real pages, live numbers.</p></div></div>
        <ol className="tour-chapters" aria-label="Chapters">{CHAPTERS.map((c, i) => <li key={c}><span>{String(i + 1).padStart(2, "0")}</span>{c}</li>)}</ol>
        <div className="tour-actions"><button type="button" className="btn btn-sm btn-quiet" onClick={end}>Not now</button><button type="button" className="btn btn-sm btn-primary" onClick={() => { setOffer(false); go(0); }}>Start the tour <ArrowRight size={14} aria-hidden="true" /></button></div>
      </div>
    );
  }
  if (step === null) return null;

  if (step === DONE) {
    return (
      <div className="tour-scrim" role="presentation" onClick={end}>
        <div className="tour-finale" role="dialog" aria-modal="true" aria-label="Tour complete" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="tour-x" aria-label="Close" onClick={end}><X size={16} /></button>
          <span className="tour-badge tour-badge-lg"><Mark size={22} /></span>
          <span className="t-label tour-kicker">Tour complete</span>
          <h2>That is Kerb.</h2>
          <p>Terms measured from the pool, bound to the market&apos;s clock, posted on X Layer every few minutes, and recomputable by anyone. Pick where to go next.</p>
          <div className="tour-next">
            <Link href="/credit" onClick={end} className="tour-next-card"><Landmark size={18} aria-hidden="true" /><strong>Borrow on testnet</strong><span>Carry, Session Max and a live Last Call</span></Link>
            <Link href="/whitepaper" onClick={end} className="tour-next-card"><BookOpen size={18} aria-hidden="true" /><strong>Read the whitepaper</strong><span>The design and the formula</span></Link>
            <Link href="/developers" onClick={end} className="tour-next-card"><Code2 size={18} aria-hidden="true" /><strong>Build with it</strong><span>SDK, REST, Solidity, agents</span></Link>
          </div>
          <button type="button" className="btn btn-sm btn-quiet tour-replay" onClick={() => go(0)}><RotateCcw size={14} aria-hidden="true" /> Replay the tour</button>
        </div>
      </div>
    );
  }

  const s = TOUR[step];
  if (!s) return null;
  const onPage = s.path === path;
  const ready = onPage && box !== null;
  const pad = 10;
  const chapterIndex = CHAPTERS.indexOf(s.chapter);
  return (
    <>
      {ready ? <div className="tour-ring" aria-hidden="true" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} /> : null}
      <div ref={card} className="tour-card" data-side={pos?.side ?? "dock"} role="dialog" aria-live="polite" aria-label={`Tour step ${step + 1} of ${TOUR.length}: ${s.title}`}
        style={pos ? { top: pos.top, left: pos.left, ["--arrow" as string]: `${pos.arrow}px` } : { visibility: "hidden" }}>
        <div className="tour-progress" aria-hidden="true">{TOUR.map((_, i) => <span key={i} data-state={i < step ? "done" : i === step ? "now" : undefined} />)}</div>
        <div className="tour-meta"><span className="t-label tour-kicker">{String(chapterIndex + 1).padStart(2, "0")} · {s.chapter}</span><span className="tour-count mono">{step + 1} / {TOUR.length}</span></div>
        <strong className="tour-title">{s.title}</strong>
        {onPage ? <p key={`b${step}`} className="tour-body">{s.body}</p> : <p className="tour-body tour-loading"><span className="tour-shimmer" />Opening {s.path === "/" ? "Home" : s.path.slice(1).split("/")[0]}</p>}
        {onPage && s.live && live ? <p className="tour-live"><span className="status-dot" aria-hidden="true" />Live · {s.live(live)}</p> : null}
        <div className="tour-actions">
          <button type="button" className="btn btn-sm btn-quiet" onClick={end}>End</button>
          <span className="tour-keys hide-sm" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd><kbd>Esc</kbd></span>
          <span className="row" style={{ gap: 8 }}>
            {step > 0 ? <button type="button" className="btn btn-sm" aria-label="Back" onClick={() => go(step - 1)}><ArrowLeft size={14} aria-hidden="true" /></button> : null}
            <button type="button" className="btn btn-sm btn-primary" onClick={() => go(step + 1)}>{step + 1 === TOUR.length ? "Finish" : "Next"} <ArrowRight size={14} aria-hidden="true" /></button>
          </span>
        </div>
      </div>
    </>
  );
}

/** A link-styled button that starts the tour, for pages and menus. */
export function TourLink({ className, children }: { className?: string; children: React.ReactNode }): React.ReactElement {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("kerb-tour"))}>{children}</button>;
}
