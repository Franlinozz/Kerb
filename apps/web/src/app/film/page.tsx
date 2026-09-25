/**
 * The demo film: the real product, recorded on X Layer, in three and a half minutes. The file is
 * served by Caddy from /media (range requests, no app memory); the master is on the GitHub release.
 */
import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { FilmPlayer, type FilmChapter } from "@/components/kerb/FilmPlayer";

export const metadata: Metadata = {
  title: "The film",
  description: "Kerb in three and a half minutes: the live Board, the exit check, Kerb Terms, a Session Max borrow, Last Call and a public Cure on X Layer, the proof and the evidence.",
};

const MASTER = "https://github.com/Franlinozz/Kerb/releases/latest";

const CHAPTERS: FilmChapter[] = [
  { t: 0, label: "The mismatch", note: "Stocks trade all day; their markets do not" },
  { t: 16.6, label: "The Board", note: "Live on X Layer mainnet" },
  { t: 34.1, label: "Exit capacity", note: "Tick-walk and OKX DEX cross-check" },
  { t: 52.9, label: "Kerb Terms", note: "Carry and Session Max" },
  { t: 72.6, label: "Borrow", note: "Session Max on testnet" },
  { t: 89.6, label: "Last Call", note: "A public Cure from another wallet" },
  { t: 124.5, label: "Proof", note: "Recompute any term" },
  { t: 142.9, label: "Four consumers", note: "Credit, agents, contracts, developers" },
  { t: 161.2, label: "Evidence", note: "Market-Time Report #2" },
  { t: 182.1, label: "Where it runs", note: "Mainnet risk plane, testnet credit" },
];

export default function FilmPage(): React.ReactElement {
  return (
    <div className="film-page">
      <header className="film-head">
        <span className="t-label">The film · 3 min 27 s · recorded on X Layer</span>
        <h1 className="t-display">Kerb, from the Board to a Cure.</h1>
        <p className="t-body-l ink-2">Every screen is the live product. The Board and the terms are on X Layer mainnet; the borrow, Last Call and the Cure run on X Layer testnet with mirror collateral, and a second wallet makes the Cure. Pick a chapter to jump to it.</p>
      </header>
      <FilmPlayer src="/media/kerb-demo.mp4" poster="/media/kerb-demo-poster.jpg" captions="/media/kerb-demo.vtt" chapters={CHAPTERS} />
      <div className="film-foot row">
        <a className="btn btn-sm" href={MASTER} target="_blank" rel="noreferrer">1080p master on GitHub</a>
        <a className="btn btn-sm btn-quiet" href="/media/kerb-demo.vtt" download>Captions</a>
        <Link className="btn btn-sm btn-quiet" href="/credit">Try the same flow on testnet</Link>
      </div>
    </div>
  );
}
