/**
 * The opening of an editorial or evidence page: copy on the left, one art plate on the right
 * bleeding to the edge, and (optionally) the page's strongest real numbers directly under the copy.
 * The art introduces the page; the content below proves it.
 */
import type { ReactNode } from "react";
import { ArtPlate } from "@/components/ui/ArtPlate";
import { GeometricKerbstone } from "@/components/ui/ArtPanel";
import type { PlateId } from "@/lib/art";

export function PlateHero({ label, title, lede, plate, evidence, tall = false, forest = false, serif = false }: {
  label: ReactNode; title: ReactNode; lede?: ReactNode; plate: PlateId | "geometric"; evidence?: ReactNode; tall?: boolean;
  /** A forest feature band behind the whole hero (Research, section 11.5). */
  forest?: boolean;
  /** The title in the editorial serif rather than the display sans. */
  serif?: boolean;
}): React.ReactElement {
  return (
    <section className={`plate-hero construct${tall ? " plate-hero-tall" : ""}${forest ? " plate-hero-forest" : ""}`}>
      <div className="construct-grid" aria-hidden="true" />
      <span className="cross cross-tl" aria-hidden="true" /><span className="cross cross-bl" aria-hidden="true" />
      <div className="plate-hero-art" aria-hidden="true">
        {plate === "geometric"
          ? <div className="plate-geometric"><GeometricKerbstone /></div>
          : <ArtPlate id={plate} sizes="(max-width: 760px) 100vw, 60vw" mask="band" />}
      </div>
      <div className="plate-hero-copy">
        <span className="t-label">{label}</span>
        <h1 className={`${serif ? "t-serif-xl" : "t-display"} plate-hero-title`}>{title}</h1>
        {lede ? <div className="t-body-l ink-2 plate-hero-lede">{lede}</div> : null}
        {evidence ? <div className="plate-hero-evidence">{evidence}</div> : null}
      </div>
    </section>
  );
}
