/**
 * An art plate with Night and Day sources and masked edges. Until the generated plates land
 * (V2-03), or if the manifest has no entry, it draws the geometric Kerbstone: rung 2 of the art
 * ladder (AGENTS.md 12.8), on-brand and sharp at every size. Never a stock image.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ManifestEntry { night: string; day: string; width: number; height: number; blur?: string; alt: string }

function manifest(): Record<string, ManifestEntry> {
  try {
    const p = resolve(process.cwd(), "public/art/manifest.json");
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Record<string, ManifestEntry>) : {};
  } catch { return {}; }
}

export function ArtPanel({ plate, mask = "left", className, alt }: { plate: string; mask?: "left" | "radial" | "none"; className?: string; alt?: string }): React.ReactElement {
  const m = manifest()[plate];
  const maskCls = mask === "none" ? "" : mask === "radial" ? "art-mask-radial" : "art-mask-left";
  if (m) {
    return (
      <div className={["art-panel", maskCls, className].filter(Boolean).join(" ")}>
        {/* Both variants ship; the theme on <html> shows one. The site theme is not the OS theme. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="art-night" src={m.night} alt={alt ?? m.alt} width={m.width} height={m.height} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="art-day" src={m.day} alt="" aria-hidden="true" width={m.width} height={m.height} />
      </div>
    );
  }
  return (
    <div className={["art-panel", maskCls, className].filter(Boolean).join(" ")} aria-hidden={alt ? undefined : true} role={alt ? "img" : undefined} aria-label={alt}>
      <GeometricKerbstone />
    </div>
  );
}

/** The mark's geometry at monumental scale, in hairlines over the construction grid. */
export function GeometricKerbstone(): React.ReactElement {
  return (
    <svg viewBox="0 0 920 620" fill="none" preserveAspectRatio="xMidYMax meet">
      <defs>
        <pattern id="ks-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-3)" strokeWidth="1" opacity=".55" />
        </pattern>
        <linearGradient id="ks-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--panel-2)" /><stop offset="1" stopColor="var(--canvas)" /></linearGradient>
      </defs>
      <path d="M150 300 L520 300 L520 470 L150 470 Z" fill="url(#ks-face)" stroke="var(--ink-2)" />
      <path d="M150 300 L230 250 L600 250 L520 300 Z" fill="var(--panel)" stroke="var(--ink-2)" />
      <path d="M520 300 L600 250 L600 360" stroke="var(--ink-2)" />
      <path d="M520 400 L820 400 L820 470 L520 470 Z" fill="url(#ks-face)" stroke="var(--ink-2)" />
      <path d="M520 400 L600 360 L880 360 L820 400 Z" fill="var(--panel)" stroke="var(--ink-2)" />
      <path d="M820 400 L880 360 L880 430 L820 470" fill="var(--canvas-2)" stroke="var(--ink-2)" />
      <path d="M150 470 L820 470 L880 430 L900 520 L120 560 Z" fill="url(#ks-hatch)" opacity=".5" />
      <path d="M520 398 C540 390 560 402 580 392 C590 388 600 396 604 390" stroke="var(--moss)" strokeWidth="3" strokeLinecap="round" />
      <g stroke="var(--ink-2)">
        <rect x="360" y="222" width="16" height="16" /><rect x="398" y="196" width="14" height="14" />
        <rect x="478" y="140" width="12" height="12" /><rect x="520" y="118" width="14" height="14" />
        <rect x="600" y="70" width="10" height="10" /><rect x="640" y="50" width="12" height="12" />
        <rect x="420" y="232" width="10" height="10" /><rect x="505" y="178" width="9" height="9" /><rect x="590" y="130" width="9" height="9" />
      </g>
    </svg>
  );
}
