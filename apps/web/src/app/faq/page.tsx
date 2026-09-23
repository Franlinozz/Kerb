/** FAQ (V3 audit): searchable, grouped, every answer linked to the page that shows it. */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { FaqBrowser } from "@/components/kerb/FaqBrowser";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";
import { TourLink } from "@/components/shell/Tour";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "FAQ", description: "Plain answers about Kerb: the market's clock, Carry and Session Max, Last Call and the cure, where the numbers come from, agents, contracts and trust." };
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function FaqPage(): React.ReactElement {
  const count = FAQ.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="faq">
      <header className="page-head doc-head">
        <span className="t-label">Help · {count} questions · updated 23 Sep 2026</span>
        <h1>Questions, answered.</h1>
        <p className="lede">What Kerb is, how borrowing on the market&rsquo;s clock works, where every number comes from, and what is and is not live. Every answer points to the page that shows it.</p>
        <div className="row mt-5" style={{ gap: 10 }}><TourLink className="btn btn-primary">Take the 60-second tour</TourLink><Link className="btn" href="/docs">Read the docs</Link></div>
      </header>
      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={FAQ.map((g) => ({ id: slug(g.group), label: g.group }))} /></aside>
        <div className="method-body">
          <FaqBrowser groups={FAQ} />
          <aside className="doc-callout mt-7">
            <strong>Still stuck?</strong>
            <p>The <Link href="/docs">docs</Link> walk through every surface, the <Link href="/whitepaper">whitepaper</Link> explains the design, and anything else can go in an <a href="https://github.com/Franlinozz/Kerb/issues" target="_blank" rel="noreferrer">issue on GitHub</a>.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
