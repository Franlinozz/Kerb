import { ImageResponse } from "next/og";

/**
 * Interim social card, drawn in code until the V2-03 art lands: the mark, the section, the line.
 * Values are the Night tokens; nothing here is data.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "Kerb. Credit on the market's clock. Interim card, generated art pending.";

export function ogCard(section: string, line = "Credit on the market's clock."): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0B0C0A", color: "#ECE8DE" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, letterSpacing: -1 }}>
          <svg viewBox="0 0 24 24" width="48" height="48"><path d="M2 8.5h11v5h9V20H2z" fill="#ECE8DE" /><rect x="15.5" y="4" width="4" height="4" fill="#D6A64F" /></svg>
          Kerb
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#B8B3A6", textTransform: "uppercase" }}>{section}</div>
          <div style={{ fontSize: 84, lineHeight: 0.95, letterSpacing: -3, color: "#ECE8DE", maxWidth: 980 }}>{line}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 4, color: "#8A857A", textTransform: "uppercase" }}>
          <span>X Layer · usekerb.xyz</span>
          <span>Never lend more than you can liquidate</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
