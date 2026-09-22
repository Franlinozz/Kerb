/**
 * An approved art plate: AVIF with WebP fallback, responsive widths, a 4:5 phone crop where one
 * exists, intrinsic size set so nothing shifts, and a blur placeholder. Only the Home hero is
 * high priority.
 */
import { ART, PLATES, mobileSrcSet, srcSet, type PlateId } from "@/lib/art";

export function ArtPlate({ id, sizes, priority = false, className, mask = "none" }: {
  id: PlateId; sizes: string; priority?: boolean; className?: string; mask?: "none" | "left" | "hero" | "radial" | "band";
}): React.ReactElement {
  const p = PLATES[id];
  const g = ART[id];
  const mobileAvif = mobileSrcSet(id, "avif");
  const mobileWebp = mobileSrcSet(id, "webp");
  const style = {
    "--focus-d": p.focus.desktop, "--focus-t": p.focus.tablet, "--focus-m": p.focus.mobile,
    backgroundImage: `url(${g.blur})`,
  } as React.CSSProperties;
  return (
    <picture className={["art-plate", `art-mask-${mask}`, p.theme ? `art-${p.theme}` : "", className].filter(Boolean).join(" ")} style={style}>
      {mobileAvif ? <source media="(max-width: 760px)" type="image/avif" srcSet={mobileAvif} sizes="100vw" /> : null}
      {mobileWebp ? <source media="(max-width: 760px)" type="image/webp" srcSet={mobileWebp} sizes="100vw" /> : null}
      <source type="image/avif" srcSet={srcSet(id, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(id, "webp")} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/art/optimized/${id}-${g.widths[g.widths.length - 1]}.webp`}
        width={g.width} height={g.height} alt={p.alt} decoding="async"
        // Lazy even for the hero: a theme pair ships both variants, and a hidden lazy image is never
        // fetched, so only the painted theme's plate downloads. fetchpriority puts it first.
        loading="lazy"
        {...(priority ? { fetchPriority: "high" as const } : {})}
        // The Home inline script promotes the painted hero to eager before React hydrates.
        suppressHydrationWarning={priority}
      />
    </picture>
  );
}
