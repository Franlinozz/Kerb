import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { ArtPlate } from "@/components/ui/ArtPlate";

export const metadata: Metadata = { title: "Not found" };

/** Fog: an unknown path, and no authoritative market state for it. Short, and not a joke. */
export default function NotFound(): React.ReactElement {
  return (
    <section className="fog-page">
      <div className="fog-art" aria-hidden="true"><ArtPlate id="p5-fog" sizes="100vw" mask="radial" /></div>
      <div className="fog-copy">
        <span className="t-label">404</span>
        <h1 className="t-display">No market<br /><span className="t-olive">here.</span></h1>
        <p className="t-body-l ink-2">There is no page at this address, and nothing Kerb measures lives here.</p>
        <div className="row mt-5"><ButtonLink href="/board" variant="primary">Return to the Board</ButtonLink></div>
      </div>
    </section>
  );
}
