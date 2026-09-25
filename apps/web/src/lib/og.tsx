import { readFileSync } from "node:fs";
import { MARK_LOWER, MARK_UPPER, MARK_VIEWBOX, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";
import type { PlateId } from "./art";

/**
 * The social card: the page's own art plate (a 1200 x 630 crop made by scripts/art/process.mjs),
 * darkened on the left for the words, with the mark, the section and the line. Nothing is data.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Kerb. Credit on the market's clock.";

const art = (plate: PlateId): string => {
  const file = resolve(process.cwd(), "public/art/optimized", `${plate}-og.jpg`);
  return `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
};

export function ogCard(section: string, line = "Credit on the market's clock.", plate: PlateId = "p1-kerbstone-night"): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0B0C0A", color: "#ECE8DE" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art(plate)} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(11,12,10,0.96) 0%, rgba(11,12,10,0.86) 38%, rgba(11,12,10,0.25) 70%, rgba(11,12,10,0.05) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, letterSpacing: -1 }}>
            <svg viewBox={MARK_VIEWBOX} width="66" height="32"><path d={MARK_UPPER} fill="#ECE8DE" /><path d={MARK_LOWER} fill="#ECE8DE" fillOpacity="0.6" /></svg>
            <svg viewBox={WORDMARK_VIEWBOX} width="158" height="24"><path d={WORDMARK_PATH} fill="#ECE8DE" fillRule="evenodd" /></svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 22, letterSpacing: 6, color: "#B8B3A6", textTransform: "uppercase" }}>{section}</div>
            <div style={{ fontSize: 76, lineHeight: 0.98, letterSpacing: -3, color: "#ECE8DE", maxWidth: 700 }}>{line}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#B8B3A6", textTransform: "uppercase" }}>
            <span>X Layer · usekerb.xyz</span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
