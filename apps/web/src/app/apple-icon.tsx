import { ImageResponse } from "next/og";
import { MARK_LOWER, MARK_UPPER, MARK_VIEWBOX } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The mark in bone on the Night canvas. */
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0C0A" }}>
        <svg viewBox={MARK_VIEWBOX} width="140" height="68"><path d={MARK_UPPER} fill="#ECE8DE" /><path d={MARK_LOWER} fill="#ECE8DE" fillOpacity="0.6" /></svg>
      </div>
    ),
    size,
  );
}
