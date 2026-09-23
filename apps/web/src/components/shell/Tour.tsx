"use client";
/**
 * The guided tour (V3 audit, operator request): onboarding without a model. A first visit offers
 * it; the header's help button restarts it. Each step opens a page, scrolls to a real element,
 * outlines it, and says what it is in two sentences. Progress lives in sessionStorage, the "seen"
 * flag in localStorage, both wrapped so a blocked store never breaks the page.
 */
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Step { path: string; target: string; title: string; body: string }
export const TOUR: Step[] = [
  { path: "/", target: ".hero h1", title: "Credit on the market's clock", body: "Tokenized stocks trade all week, but the markets behind them close. Kerb measures what the X Layer pool could really absorb and how long a loan must survive, and posts both as credit terms on mainnet." },
  { path: "/", target: ".consumers", title: "One set of terms, four consumers", body: "A credit market, any X Layer contract, paying agents and developers all read the same terms. Each card shows live evidence." },
  { path: "/board", target: ".kpi-band", title: "The Board", body: "Every stock's regime, Credit Mark, executable depth and terms, right now. Hover a Terms cell to read why it is what it is." },
  { path: "/asset/HKEXCx", target: ".why-block", title: "Every term explains itself", body: "Kerb computes why each term is what it is, with its numbers, from the post's own inputs. The Liquidity tab shows the exit check against the OKX DEX quote." },
  { path: "/credit", target: ".rail-demo", title: "Borrow on a demo clock", body: "Kerb Credit runs a trading week every hour on X Layer testnet. Borrow at Carry, or more at Session Max with a promise to cure at Last Call, the brass window." },
  { path: "/credit", target: ".curable", title: "Anyone can cure", body: "When Last Call opens, positions above their Carry target appear here. A standing demo position is always one of them: connect any wallet and cure it for a bonus." },
  { path: "/proof", target: ".proof-tiles", title: "Check everything", body: "Every contract, the Builder Code on every post, paid agent calls, and a term recomputed from its inputs live on this page." },
  { path: "/developers", target: "[role=tablist]", title: "Build on it", body: "REST with no key, KerbQuote from any contract on mainnet, and paid credit checks for agents over x402. The Docs and FAQ answer the rest." },
];
const SEEN = "kerb-tour-seen", STEP = "kerb-tour-step";
const get = (s: Storage | undefined, k: string): string | null => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const set = (s: Storage | undefined, k: string, v: string | null): void => { try { if (v === null) s?.removeItem(k); else s?.setItem(k, v); } catch { /* storage blocked */ } };

export function Tour(): React.ReactElement | null {
  const path = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [offer, setOffer] = useState(false);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    // The mount may have been triggered by a start request made before this code loaded.
    if ((window as Window & { __kerbTourAsked?: boolean }).__kerbTourAsked) { (window as Window & { __kerbTourAsked?: boolean }).__kerbTourAsked = false; setOffer(false); set(sessionStorage, STEP, "0"); setStep(0); }
    const s = get(sessionStorage, STEP);
    if (s !== null) setStep(Number(s));
    else if (path === "/" && get(localStorage, SEEN) === null) { const t = setTimeout(() => setOffer(true), 2500); return () => clearTimeout(t); }
    const start = (): void => { setOffer(false); go(0); };
    window.addEventListener("kerb-tour", start);
    return () => window.removeEventListener("kerb-tour", start);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((i: number) => {
    if (i >= TOUR.length) { set(sessionStorage, STEP, null); set(localStorage, SEEN, "1"); setStep(null); setBox(null); return; }
    set(sessionStorage, STEP, String(i));
    setStep(i);
    const s = TOUR[i]!;
    if (s.path !== window.location.pathname) router.push(s.path);
  }, [router]);
  const end = (): void => { set(sessionStorage, STEP, null); set(localStorage, SEEN, "1"); setStep(null); setOffer(false); setBox(null); };

  // Find the step's element on its page, scroll to it, and follow it on scroll and resize.
  useEffect(() => {
    if (step === null) return undefined;
    const s = TOUR[step];
    if (!s || s.path !== path) return undefined;
    let el: Element | null = null;
    let tries = 0;
    const find = (): void => {
      el = document.querySelector(s.target);
      if (!el && tries++ < 30) { setTimeout(find, 200); return; }
      if (el) { el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); setTimeout(measure, 450); }
      else setBox(null);
    };
    const measure = (): void => { if (el) setBox(el.getBoundingClientRect()); };
    find();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [step, path]);

  useEffect(() => {
    if (step === null) return undefined;
    const key = (e: KeyboardEvent): void => { if (e.key === "Escape") end(); if (e.key === "ArrowRight") go(step + 1); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, go]); // eslint-disable-line react-hooks/exhaustive-deps

  if (offer && step === null) {
    return (
      <div className="tour-offer" role="dialog" aria-label="Take the tour">
        <strong>New to Kerb?</strong>
        <p>A 60-second tour of what it does, from the Board to curing a position.</p>
        <div className="row"><button type="button" className="btn btn-sm btn-primary" onClick={() => { setOffer(false); go(0); }}>Take the tour</button><button type="button" className="btn btn-sm btn-quiet" onClick={end}>Not now</button></div>
      </div>
    );
  }
  if (step === null) return null;
  const s = TOUR[step];
  if (!s) return null;
  const onPage = s.path === path;
  const pad = 8;
  return (
    <>
      {onPage && box ? <div className="tour-ring" aria-hidden="true" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} /> : null}
      <div className="tour-card" role="dialog" aria-live="polite" aria-label={`Tour step ${step + 1} of ${TOUR.length}`}>
        <span className="t-label">Tour · {step + 1} of {TOUR.length}</span>
        <strong>{s.title}</strong>
        <p>{onPage ? s.body : "Opening the page."}</p>
        <div className="row between">
          <button type="button" className="btn btn-sm btn-quiet" onClick={end}>End tour</button>
          <span className="row" style={{ gap: 8 }}>
            {step > 0 ? <button type="button" className="btn btn-sm" onClick={() => go(step - 1)}>Back</button> : null}
            <button type="button" className="btn btn-sm btn-primary" onClick={() => go(step + 1)}>{step + 1 === TOUR.length ? "Done" : "Next"}</button>
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
