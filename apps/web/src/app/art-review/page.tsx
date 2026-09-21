import type { Metadata } from "next";
import { ArtPlate } from "@/components/ui/ArtPlate";
import { ART, PLATES, type PlateId } from "@/lib/art";

// Temporary art review harness (art integration pass). Not linked anywhere; removed after sign-off.
export const metadata: Metadata = { title: "Art review", robots: { index: false, follow: false } };

const CROPS: { label: string; ratio: string; width: string }[] = [
  { label: "Desktop hero, 7 of 12 columns", ratio: "7 / 5.4", width: "min(100%, 760px)" },
  { label: "Tablet band", ratio: "16 / 7", width: "min(100%, 760px)" },
  { label: "Mobile 4:5", ratio: "4 / 5", width: "min(100%, 320px)" },
];

export default function ArtReview(): React.ReactElement {
  return (
    <div>
      <span className="t-label">Art review · temporary · six approved masters, five placed</span>
      <h1 className="mt-3">Kerbstone plates</h1>
      {(Object.keys(PLATES) as PlateId[]).map((id) => {
        const p = PLATES[id];
        const g = ART[id];
        return (
          <section key={id} className="section">
            <div className="section-head"><span className="cross" aria-hidden="true" />
              <div className="section-head-row"><span className="t-label">{id}.png · {g.width} × {g.height} · {(g.width / g.height).toFixed(3)}</span><span className="t-label ink-3">{p.name} · {p.page}</span></div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/art/masters/${id}.png`} alt="" width={g.width} height={g.height} style={{ width: "100%", height: "auto" }} />
            <div className="row mt-5" style={{ alignItems: "flex-start", gap: 24 }}>
              {CROPS.map((c) => (
                <figure key={c.label} style={{ width: c.width }}>
                  <div style={{ aspectRatio: c.ratio }}><ArtPlate id={id} sizes="760px" className="review-crop" /></div>
                  <figcaption className="t-small ink-2 mt-2">{c.label} · focus {c.label.startsWith("Mobile") ? p.focus.mobile : c.label.startsWith("Tablet") ? p.focus.tablet : p.focus.desktop}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
