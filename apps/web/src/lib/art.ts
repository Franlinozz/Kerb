/**
 * The Kerbstone art manifest: the operator-approved masters (docs/v2/ART.md), P4 (The Seal)
 * included since 22 Sep. A slot with no manifest entry falls back to the geometric Kerbstone.
 * Focal points were chosen by looking at each master, not from its filename: x/y are the CSS
 * object-position used at each breakpoint.
 */
import generated from "./art.generated.json";

export type PlateId = "p1-kerbstone-night" | "p1-kerbstone-day" | "p2-record" | "p3-standard" | "p4-seal" | "p5-fog";

export interface Plate {
  id: PlateId;
  name: string;
  page: string;
  theme?: "night" | "day";
  /** object-position per breakpoint. */
  focus: { desktop: string; tablet: string; mobile: string };
  /** Meaningful alt where the plate carries meaning; "" where the heading already says it. */
  alt: string;
}

export const PLATES: Record<PlateId, Plate> = {
  // Subject: a moss-grown stone arch standing in still water, right 45% to 93% of the frame, open sky left.
  "p1-kerbstone-night": {
    id: "p1-kerbstone-night", name: "The Kerbstone, Night", page: "Home hero", theme: "night",
    focus: { desktop: "72% 50%", tablet: "70% 50%", mobile: "69% 50%" },
    alt: "A moss-grown stone arch standing in still water at night, stone and brass cubes lifting off it: Kerb's image for the step between market regimes.",
  },
  "p1-kerbstone-day": {
    id: "p1-kerbstone-day", name: "The Kerbstone, Day", page: "Home hero", theme: "day",
    focus: { desktop: "72% 50%", tablet: "70% 50%", mobile: "69% 50%" },
    alt: "A moss-grown stone arch standing in still water at golden hour, stone and brass cubes lifting off it: Kerb's image for the step between market regimes.",
  },
  // Subject: a stepped wall of stone and glass cubes rising right, fog and mountains left.
  "p2-record": {
    id: "p2-record", name: "The Record", page: "Research", focus: { desktop: "64% 45%", tablet: "66% 45%", mobile: "70% 45%" }, alt: "",
  },
  // Subject: stacked glass slabs over a mossy stone step, centred slightly left of the frame's centre.
  "p3-standard": {
    id: "p3-standard", name: "The Standard", page: "Methodology", focus: { desktop: "58% 42%", tablet: "58% 42%", mobile: "58% 40%" }, alt: "",
  },
  // Subject: two stone monoliths holding a lit glass cube, right of centre; fog and peaks left.
  "p4-seal": {
    id: "p4-seal", name: "The Seal", page: "Proof", focus: { desktop: "66% 40%", tablet: "66% 40%", mobile: "66% 42%" }, alt: "",
  },
  // Subject: a stone gate in fog, right third, lit from within.
  "p5-fog": {
    id: "p5-fog", name: "Fog", page: "404", focus: { desktop: "74% 50%", tablet: "74% 50%", mobile: "76% 50%" }, alt: "",
  },
};

interface Generated {
  width: number; height: number; widths: number[];
  mobile: { width: number; height: number; left: number; files: { w: number; ext: string }[] } | null;
  blur: string;
}
export const ART = generated as unknown as Record<PlateId, Generated>;

export const srcSet = (id: PlateId, ext: "avif" | "webp"): string =>
  ART[id].widths.map((w) => `/art/optimized/${id}-${w}.${ext} ${w}w`).join(", ");

export const mobileSrcSet = (id: PlateId, ext: "avif" | "webp"): string | null => {
  const m = ART[id].mobile;
  if (!m) return null;
  return [...new Set(m.files.filter((f) => f.ext === ext).map((f) => f.w))].map((w) => `/art/optimized/${id}-m-${w}.${ext} ${w}w`).join(", ");
};
