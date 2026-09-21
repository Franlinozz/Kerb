"use client";

/** The root layout itself failed: plain markup, no shell, still no raw error text. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }): React.ReactElement {
  return (
    <html lang="en" data-theme="night">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0B0C0A", color: "#ECE8DE", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 560 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#B8B3A6" }}>Kerb</p>
          <h1 style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "12px 0" }}>Something upstream stopped answering.</h1>
          <p style={{ color: "#B8B3A6", lineHeight: 1.55 }}>The page could not load. Nothing on chain has changed. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: 20, height: 46, padding: "0 20px", background: "#ECE8DE", color: "#0B0C0A", border: 0, borderRadius: 2, font: "500 15px system-ui" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
