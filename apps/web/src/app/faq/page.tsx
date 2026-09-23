/** FAQ (V3 audit, operator request): plain answers, each with a page that shows it. */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "FAQ", description: "Plain answers about Kerb: the market's clock, Carry and Session Max, Last Call and the cure, where the numbers come from, agents, contracts and trust." };

export default function FaqPage(): React.ReactElement {
  return (
    <div className="faq">
      <header className="page-head">
        <span className="t-label">FAQ · plain answers</span>
        <h1>Questions, answered.</h1>
        <p className="lede">What Kerb is, how borrowing on the market&rsquo;s clock works, where every number comes from, and what is and is not live. Each answer points to the page that shows it.</p>
      </header>
      {FAQ.map((g) => (
        <section key={g.group} className="faq-group" aria-labelledby={`faq-${g.group}`}>
          <h2 id={`faq-${g.group}`} className="t-label">{g.group}</h2>
          <div className="faq-list">
            {g.items.map((f) => (
              <details key={f.q} className="disclosure faq-item">
                <summary>{f.q}<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></summary>
                <div className="disclosure-body"><p className="ink-2">{f.a}</p>{f.href ? <p className="mt-3"><Link href={f.href}>{f.link ?? "Open"}</Link></p> : null}</div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="t-small ink-3 mt-6">Not answered here? The <Link href="/docs">docs</Link> go deeper, and the <Link href="/whitepaper">whitepaper</Link> explains the design.</p>
    </div>
  );
}
