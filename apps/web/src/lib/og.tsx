import { readFileSync } from "node:fs";
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
        <img src={art(plate)} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(11,12,10,0.96) 0%, rgba(11,12,10,0.86) 38%, rgba(11,12,10,0.25) 70%, rgba(11,12,10,0.05) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, letterSpacing: -1 }}>
            <svg viewBox="0 0 24 24" width="48" height="48"><path d="M2 8.5h11v5h9V20H2z" fill="#ECE8DE" /><rect x="15.5" y="4" width="4" height="4" fill="#D6A64F" /></svg>
            Kerb
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
