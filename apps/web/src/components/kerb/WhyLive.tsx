"use client";
/**
 * Client-side "why" lines (V3-04): the Credit mode cards and the Board's Terms hover card read the
 * same computed sentences as the Asset page, from /v1/terms/196/:asset/why, only when shown.
 */
import { useState } from "react";
import { ProvMark } from "@/components/ui/ProvMark";
import { PUBLIC_API, type Why, type WhyField } from "@/lib/api";
import { useLive } from "./useLive";

export function useWhy(symbol: string | null): Why | null {
  return useLive<Why>(symbol ? `/v1/terms/196/${encodeURIComponent(symbol)}/why` : null, null, 120_000, { asOf: (w) => w.asOf }).data;
}

/** One computed line per Credit mode card, from the mainnet asset the mirror relays. */
export function ModeWhy({ mirrors }: { mirrors: string }): React.ReactElement | null {
  const why = useWhy(mirrors);
  const line = (f: WhyField): React.ReactNode => {
    const s = why?.sentences?.find((x) => x.field === f);
    if (!why || !s) return <span className="t-small ink-3">{why?.note ?? "Reading why these terms are what they are."}</span>;
    return <span className="t-small ink-2">Mainnet {mirrors}: {s.sentence} <ProvMark label="Computed" source={`Computed from input bundle ${why.inputsHash.slice(0, 10)} of the mainnet post the mirror relays`} observedAt={why.asOf} href={`${PUBLIC_API}/v1/bundle/${why.inputsHash}`} hrefLabel="The input bundle" /></span>;
  };
  return <div className="mode-why" aria-label="Why these limits">{line("carryLTV")}{line("sessionMaxLTV")}</div>;
}

/** The Board's Terms cell: the ladder, and on hover or focus the computed sentences for that row. */
export function TermsHover({ symbol, children }: { symbol: string; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const why = useWhy(seen ? symbol : null);
  const show = (): void => { setOpen(true); setSeen(true); };
  return (
    <span className="terms-hover" onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)} tabIndex={0} aria-label={`${symbol} terms: hover or focus for why`}>
      {children}
      {open ? (
        <span role="tooltip" className="prov-card terms-card">
          <strong>Why these terms</strong>
          {why?.sentences ? why.sentences.filter((s) => s.field !== "debtCeiling").map((s) => <span key={s.field} className="ink-2">{s.sentence}</span>) : <span className="ink-3">{why?.note ?? "Reading."}</span>}
          {why ? <span className="t-label">Computed from bundle {why.inputsHash.slice(0, 10)}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
