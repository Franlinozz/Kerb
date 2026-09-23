"use client";
/**
 * The FAQ, browsable (V3 audit): a search that filters questions and answers as you type, each
 * category as its own numbered block, and each answer with the page that proves it.
 */
import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import type { Faq } from "@/lib/faq";

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function FaqBrowser({ groups }: { groups: { group: string; intro: string; items: Faq[] }[] }): React.ReactElement {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => groups.map((g) => ({ ...g, items: g.items.filter((f) => !needle || `${f.q} ${f.a}`.toLowerCase().includes(needle)) })).filter((g) => g.items.length), [groups, needle]);
  const total = shown.reduce((n, g) => n + g.items.length, 0);
  let n = 0;
  return (
    <div className="faqb">
      <div className="faqb-search">
        <label className="t-label" htmlFor="faq-q">Search the questions</label>
        <span className="fld-box"><input id="faq-q" className="left" type="search" placeholder="Try: cure, liquidation, agents, IPFS" value={q} onChange={(e) => setQ(e.target.value)} /></span>
        <span className="t-small ink-3" aria-live="polite">{needle ? `${total} ${total === 1 ? "answer" : "answers"} for "${q.trim()}"` : `${total} questions in ${groups.length} topics`}</span>
      </div>
      {shown.length === 0 ? <p className="ink-2 mt-5">Nothing matches. The <Link href="/docs">docs</Link> go deeper.</p> : null}
      {shown.map((g) => (
        <section key={g.group} id={slug(g.group)} className="faqb-group method-section">
          <header className="faqb-head"><h2>{g.group}</h2><p className="ink-3">{g.intro}</p></header>
          <div className="faqb-list">
            {g.items.map((f) => { n++; return (
              <details key={f.q} className="faqb-item" open={Boolean(needle)}>
                <summary><span className="faqb-n mono">{String(n).padStart(2, "0")}</span><span className="faqb-q">{f.q}</span><svg className="faqb-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></summary>
                <div className="faqb-a"><p>{f.a}</p>{f.href ? <Link className="faqb-link" href={f.href}>{f.link ?? "Open"} <span aria-hidden="true">→</span></Link> : null}</div>
              </details>
            ); })}
          </div>
        </section>
      ))}
    </div>
  );
}
