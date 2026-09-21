/**
 * Regime glyphs. docs/ARCHITECTURE.md section 9: the glyph always sits beside the word, and colour
 * is never the only carrier of meaning, so a colourblind judge reads the same thing everyone else does.
 */
import type { Regime } from "@/lib/api";

/**
 * REFERENCE_CLOSED uses the dimmest tone in the palette, which is correct for a session band but
 * disappears as a 10px glyph. The glyph therefore draws in the dim text tone while the band keeps
 * the quiet one: same meaning, both legible.
 */
const GLYPH_TONE: Partial<Record<Regime, string>> = {
  REFERENCE_CLOSED: "var(--text-dim)",
};

const TONE: Record<Regime, string> = {
  DEEP: "var(--tone-deep)",
  NORMAL: "var(--tone-normal)",
  THIN: "var(--tone-thin)",
  PRE_TRANSITION: "var(--accent-lastcall)",
  REFERENCE_CLOSED: "var(--tone-closed)",
  ACTION: "var(--tone-action)",
  HALTED: "var(--tone-halted)",
  STALE: "var(--tone-stale)",
  RECOVERY: "var(--tone-recovery)",
};

/** Plain words. A judge should not need the docs open to read the Board. */
export const REGIME_WORDS: Record<Regime, string> = {
  DEEP: "Deep",
  NORMAL: "Normal",
  THIN: "Thin",
  PRE_TRANSITION: "Last Call",
  REFERENCE_CLOSED: "Reference closed",
  ACTION: "Corporate action",
  HALTED: "Halted",
  STALE: "Stale",
  RECOVERY: "Recovery",
};

export const REGIME_MEANING: Record<Regime, string> = {
  DEEP: "Deep executable liquidity and a fresh reference price.",
  NORMAL: "Normal executable liquidity in the underlying's regular session.",
  THIN: "Executable depth is thin relative to the debt it supports.",
  PRE_TRANSITION: "The session is about to weaken. Session Max positions must cure before it closes.",
  REFERENCE_CLOSED: "The underlying market is closed, so no new reference price is arriving.",
  ACTION: "A corporate action is pending or in progress on the underlying.",
  HALTED: "Trading in the underlying is halted.",
  STALE: "The sources the mark needs are too old to price against.",
  RECOVERY: "The session has reopened and terms are loosening back on the cooldown.",
};

export function RegimeGlyph({ regime, size = 10 }: { regime: Regime; size?: number }): React.ReactElement {
  const tone = GLYPH_TONE[regime] ?? TONE[regime];
  const s = size;
  const c = s / 2;
  const r = s / 2 - 1;
  const common = { fill: tone, stroke: tone, strokeWidth: 1 };
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" style={{ flex: "none", verticalAlign: "-0.08em" }}>
      {regime === "DEEP" && <circle cx={c} cy={c} r={r} {...common} />}
      {regime === "NORMAL" && (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke={tone} strokeWidth={1} />
          <path d={`M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - r} ${c} Z`} fill={tone} stroke="none" />
        </>
      )}
      {regime === "THIN" && (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke={tone} strokeWidth={1} />
          <path d={`M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`} fill={tone} stroke="none" />
        </>
      )}
      {regime === "PRE_TRANSITION" && <path d={`M ${c} 1 L ${s - 1} ${s - 1} L 1 ${s - 1} Z`} {...common} />}
      {regime === "REFERENCE_CLOSED" && <circle cx={c} cy={c} r={r} fill="none" stroke={tone} strokeWidth={1.2} />}
      {regime === "ACTION" && <rect x={1} y={1} width={s - 2} height={s - 2} fill="none" stroke={tone} strokeWidth={1.2} />}
      {regime === "HALTED" && <rect x={1} y={1} width={s - 2} height={s - 2} {...common} />}
      {regime === "STALE" && <rect x={0} y={c - 0.75} width={s} height={1.5} fill={tone} stroke="none" />}
      {regime === "RECOVERY" && (
        <path d={`M 1 ${c + r / 2} A ${r} ${r} 0 0 1 ${s - 1} ${c + r / 2}`} fill="none" stroke={tone} strokeWidth={1.6} />
      )}
    </svg>
  );
}

/** The glyph, the word, and nothing else. */
export function RegimeTag({ regime, title }: { regime: Regime; title?: boolean }): React.ReactElement {
  return (
    <span
      className="regime-tag"
      style={{ color: GLYPH_TONE[regime] ?? TONE[regime] }}
      {...(title === false ? {} : { title: REGIME_MEANING[regime] })}
    >
      <RegimeGlyph regime={regime} />
      {REGIME_WORDS[regime]}
    </span>
  );
}

export { TONE as REGIME_TONE };
