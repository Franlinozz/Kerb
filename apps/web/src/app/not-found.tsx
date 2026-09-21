import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { ArtPanel } from "@/components/ui/ArtPanel";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound(): React.ReactElement {
  return (
    <section className="system-page construct">
      <div className="construct-grid" aria-hidden="true" />
      <div className="system-copy">
        <span className="t-label">404 · No page at this address</span>
        <h1 className="t-display">This street<br /><span className="t-olive">has no kerb.</span></h1>
        <p className="t-body-l ink-2">The page you asked for does not exist. The Board, the proof and every report are still where they were.</p>
        <div className="row mt-5">
          <ButtonLink href="/board" variant="primary">Open the Board</ButtonLink>
          <ButtonLink href="/">Home</ButtonLink>
        </div>
      </div>
      <ArtPanel plate="fog" mask="radial" className="system-art" />
    </section>
  );
}
