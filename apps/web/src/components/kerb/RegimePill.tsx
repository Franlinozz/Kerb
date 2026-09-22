import type { Regime } from "@/lib/api";

/** V2-DESIGN-SYSTEM.md section 9: glyph plus word, never colour alone. */
export const REGIME_WORD: Record<Regime, string> = {
  DEEP: "Deep", NORMAL: "Normal", THIN: "Thin", PRE_TRANSITION: "Last Call", REFERENCE_CLOSED: "Closed",
  ACTION: "Corporate action", HALTED: "Halted", STALE: "Stale", RECOVERY: "Recovering",
};

export const REGIME_MEANING: Record<Regime, string> = {
  DEEP: "Deep executable liquidity and a fresh reference price.",
  NORMAL: "Normal executable liquidity in the underlying's regular session.",
  THIN: "Executable depth is thin relative to the debt it supports.",
  PRE_TRANSITION: "Last Call: the session is about to weaken, and Session Max positions must cure before it closes.",
  REFERENCE_CLOSED: "The underlying market is closed, so no new reference price is arriving.",
  ACTION: "A corporate action is pending or in progress on the underlying.",
  HALTED: "Trading in the underlying is halted.",
  STALE: "The sources the mark needs are too old to price against.",
  RECOVERY: "The session has reopened and terms are loosening back on the cooldown.",
};

function Glyph({ regime }: { regime: Regime }): React.ReactElement {
  const c = "currentColor";
  switch (regime) {
    case "DEEP": return <svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={c} /></svg>;
    case "NORMAL": return <svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke={c} strokeWidth="1.2" /><path d="M5 5V1a4 4 0 1 1-4 4z" fill={c} /></svg>;
    case "THIN": return <svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke={c} strokeWidth="1.2" /><path d="M5 1a4 4 0 0 1 0 8z" fill={c} /></svg>;
    case "PRE_TRANSITION": return <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1l4 8H1z" fill={c} /></svg>;
    case "REFERENCE_CLOSED": return <svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke={c} strokeWidth="1.2" /></svg>;
    case "ACTION": case "HALTED": return <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" fill={c} /></svg>;
    case "STALE": return <svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="1.5 1.5" /></svg>;
    case "RECOVERY": return <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 6.5A4 4 0 0 1 8.5 3.5" fill="none" stroke={c} strokeWidth="1.6" /></svg>;
  }
}

export function RegimePill({ regime, size = "md" }: { regime: Regime | null; size?: "md" | "sm" }): React.ReactElement {
  if (!regime) return <span className="rpill" data-size={size}>Not yet posted</span>;
  return (
    <span className="rpill" data-regime={regime} data-size={size} title={REGIME_MEANING[regime]}>
      <Glyph regime={regime} />
      {REGIME_WORD[regime]}
    </span>
  );
}
