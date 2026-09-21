import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The mark in bone on the Night canvas, 3 px inset at 32 px scaled up. */
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0C0A" }}>
        <svg viewBox="0 0 24 24" width="140" height="140"><path d="M2 8.5h11v5h9V20H2z" fill="#ECE8DE" /><rect x="15.5" y="4" width="4" height="4" fill="#ECE8DE" /></svg>
      </div>
    ),
    size,
  );
}
